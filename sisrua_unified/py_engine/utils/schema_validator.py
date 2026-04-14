"""
Lightweight JSON Schema draft-07 validator for py_engine.

Supports: type, properties, required, additionalProperties,
          minimum, maximum, exclusiveMinimum, exclusiveMaximum,
          minLength, maxLength, pattern, enum, items, minItems, maxItems,
          oneOf, anyOf, $ref (local #/definitions/…), propertyNames,
          const.

Falls back to jsonschema library when available for full spec coverage.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

# ── Optional: use jsonschema if available ────────────────────────────────────
try:
    import jsonschema  # type: ignore
    _JSONSCHEMA_AVAILABLE = True
except ImportError:
    _JSONSCHEMA_AVAILABLE = False

_SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "schemas")


def _resolve_path(schema_path: str) -> str:
    if os.path.isabs(schema_path):
        return schema_path
    return os.path.normpath(os.path.join(_SCHEMAS_DIR, schema_path))


def _load_schema(schema_path: str) -> dict:
    resolved = _resolve_path(schema_path)
    with open(resolved, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _get_definition(root: dict, ref: str) -> dict:
    if not ref.startswith("#/"):
        raise ValueError(f"Only local $ref supported, got: {ref}")
    parts = ref[2:].split("/")
    cur: Any = root
    for part in parts:
        cur = cur[part]
    return cur  # type: ignore[return-value]


def _python_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _validate_node(
    data: Any,
    schema: dict,
    root: dict,
    pointer: str,
    errors: list[str],
) -> None:
    # $ref
    if "$ref" in schema:
        resolved = _get_definition(root, schema["$ref"])
        _validate_node(data, resolved, root, pointer, errors)
        return

    # const
    if "const" in schema:
        if data != schema["const"]:
            errors.append(
                f"{pointer}: expected const {json.dumps(schema['const'])}, got {json.dumps(data)}"
            )
        return

    # oneOf
    if "oneOf" in schema:
        branches: list[dict] = schema["oneOf"]
        passing = [
            b for b in branches
            if not (sub := [], _validate_node(data, b, root, pointer, sub))[1] and not sub
        ]
        # simpler version without walrus for Python < 3.8
        passing_count = 0
        for branch in branches:
            sub: list[str] = []
            _validate_node(data, branch, root, pointer, sub)
            if not sub:
                passing_count += 1
        if passing_count != 1:
            errors.append(
                f"{pointer}: must match exactly one of {len(branches)} schemas (matched {passing_count})"
            )
        return

    # anyOf
    if "anyOf" in schema:
        branches = schema["anyOf"]
        any_pass = False
        for branch in branches:
            sub: list[str] = []
            _validate_node(data, branch, root, pointer, sub)
            if not sub:
                any_pass = True
                break
        if not any_pass:
            errors.append(
                f"{pointer}: must match at least one of {len(branches)} schemas"
            )
        return

    # type
    if "type" in schema:
        allowed_types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        actual = _python_type(data)
        # JSON Schema: integer is a subset of number
        matched = actual in allowed_types or (actual == "integer" and "number" in allowed_types)
        if not matched:
            errors.append(f"{pointer}: expected type {allowed_types}, got {actual}")
            return

    # enum
    if "enum" in schema:
        if data not in schema["enum"]:
            errors.append(
                f"{pointer}: must be one of {json.dumps(schema['enum'])}, got {json.dumps(data)}"
            )

    # string keywords
    if isinstance(data, str):
        if "minLength" in schema and len(data) < schema["minLength"]:
            errors.append(f"{pointer}: minLength {schema['minLength']}, got {len(data)}")
        if "maxLength" in schema and len(data) > schema["maxLength"]:
            errors.append(f"{pointer}: maxLength {schema['maxLength']}, got {len(data)}")
        if "pattern" in schema and not re.search(schema["pattern"], data):
            errors.append(f"{pointer}: does not match pattern {schema['pattern']}")

    # number keywords
    if isinstance(data, (int, float)) and not isinstance(data, bool):
        if "minimum" in schema and data < schema["minimum"]:
            errors.append(f"{pointer}: minimum {schema['minimum']}, got {data}")
        if "maximum" in schema and data > schema["maximum"]:
            errors.append(f"{pointer}: maximum {schema['maximum']}, got {data}")
        if "exclusiveMinimum" in schema and data <= schema["exclusiveMinimum"]:
            errors.append(f"{pointer}: exclusiveMinimum {schema['exclusiveMinimum']}, got {data}")
        if "exclusiveMaximum" in schema and data >= schema["exclusiveMaximum"]:
            errors.append(f"{pointer}: exclusiveMaximum {schema['exclusiveMaximum']}, got {data}")

    # array keywords
    if isinstance(data, list):
        if "minItems" in schema and len(data) < schema["minItems"]:
            errors.append(f"{pointer}: minItems {schema['minItems']}, got {len(data)}")
        if "maxItems" in schema and len(data) > schema["maxItems"]:
            errors.append(f"{pointer}: maxItems {schema['maxItems']}, got {len(data)}")
        if "items" in schema:
            item_schema = schema["items"]
            if isinstance(item_schema, list):
                for i, item in enumerate(data):
                    if i < len(item_schema):
                        _validate_node(item, item_schema[i], root, f"{pointer}[{i}]", errors)
            else:
                for i, item in enumerate(data):
                    _validate_node(item, item_schema, root, f"{pointer}[{i}]", errors)

    # object keywords
    if isinstance(data, dict):
        # propertyNames
        if "propertyNames" in schema:
            pn_schema = schema["propertyNames"]
            for key in data:
                _validate_node(key, pn_schema, root, f"{pointer}[key:{key}]", errors)

        # required
        for req in schema.get("required", []):
            if req not in data:
                errors.append(f"{pointer}: missing required property '{req}'")

        # properties
        props_schema: dict = schema.get("properties", {})
        for key, prop_schema in props_schema.items():
            if key in data:
                _validate_node(data[key], prop_schema, root, f"{pointer}.{key}", errors)

        # additionalProperties
        if schema.get("additionalProperties") is False and props_schema:
            known = set(props_schema.keys())
            for key in data:
                if key not in known:
                    errors.append(f"{pointer}: additional property '{key}' not allowed")


def validate_against_schema(
    data: dict,
    schema_path: str,
) -> tuple[bool, list[str]]:
    """Validate *data* against a JSON Schema v7 file.

    Args:
        data:        The dictionary to validate.
        schema_path: Absolute path or filename relative to schemas/ directory.

    Returns:
        ``(valid, errors)`` — *errors* is empty when *valid* is True.
    """
    errors: list[str] = []
    try:
        schema = _load_schema(schema_path)

        if _JSONSCHEMA_AVAILABLE:
            validator = jsonschema.Draft7Validator(schema)
            for err in validator.iter_errors(data):
                errors.append(f"{'/'.join(str(p) for p in err.absolute_path) or '#'}: {err.message}")
        else:
            _validate_node(data, schema, schema, "#", errors)

    except Exception as exc:  # noqa: BLE001
        errors.append(f"Schema load/parse error: {exc}")

    return (len(errors) == 0, errors)
