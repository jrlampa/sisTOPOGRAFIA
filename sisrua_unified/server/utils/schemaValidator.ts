/**
 * Lightweight JSON Schema draft-07 validator.
 *
 * Supports: type, properties, required, additionalProperties,
 *           minimum, maximum, exclusiveMinimum, exclusiveMaximum,
 *           minLength, maxLength, pattern, enum, items, minItems, maxItems,
 *           oneOf, anyOf, $ref (local #/definitions/…), propertyNames,
 *           const, description (ignored).
 */
import fs from "fs";
import path from "path";

type SchemaDoc = Record<string, unknown>;

function resolvePath(schemaPath: string): string {
  if (path.isAbsolute(schemaPath)) return schemaPath;
  // Resolve relative to the project schemas/ directory
  const schemasDir = path.resolve(__dirname, "../../schemas");
  return path.join(schemasDir, schemaPath);
}

function loadSchema(schemaPath: string): SchemaDoc {
  const resolved = resolvePath(schemaPath);
  const raw = fs.readFileSync(resolved, "utf-8");
  return JSON.parse(raw) as SchemaDoc;
}

function getDefinition(root: SchemaDoc, ref: string): SchemaDoc {
  if (!ref.startsWith("#/"))
    throw new Error(`Only local $ref supported, got: ${ref}`);
  const parts = ref.slice(2).split("/");
  let cur: unknown = root;
  for (const part of parts) {
    if (typeof cur !== "object" || cur === null)
      throw new Error(`$ref path broken at: ${part}`);
    cur = (cur as SchemaDoc)[part];
  }
  return cur as SchemaDoc;
}

function validateNode(
  data: unknown,
  schema: SchemaDoc,
  root: SchemaDoc,
  pointer: string,
  errors: string[],
): void {
  // Resolve $ref
  if (typeof schema["$ref"] === "string") {
    const resolved = getDefinition(root, schema["$ref"]);
    validateNode(data, resolved, root, pointer, errors);
    return;
  }

  // const
  if ("const" in schema) {
    if (data !== schema["const"]) {
      errors.push(
        `${pointer}: expected const ${JSON.stringify(schema["const"])}, got ${JSON.stringify(data)}`,
      );
    }
    return;
  }

  // oneOf
  if (Array.isArray(schema["oneOf"])) {
    const branches = schema["oneOf"] as SchemaDoc[];
    const passing = branches.filter((branch) => {
      const sub: string[] = [];
      validateNode(data, branch, root, pointer, sub);
      return sub.length === 0;
    });
    if (passing.length !== 1) {
      errors.push(
        `${pointer}: must match exactly one of ${branches.length} schemas (matched ${passing.length})`,
      );
    }
    return;
  }

  // anyOf
  if (Array.isArray(schema["anyOf"])) {
    const branches = schema["anyOf"] as SchemaDoc[];
    const passing = branches.some((branch) => {
      const sub: string[] = [];
      validateNode(data, branch, root, pointer, sub);
      return sub.length === 0;
    });
    if (!passing) {
      errors.push(
        `${pointer}: must match at least one of ${branches.length} schemas`,
      );
    }
    return;
  }

  // type check
  if ("type" in schema) {
    const types = Array.isArray(schema["type"])
      ? schema["type"]
      : [schema["type"]];
    const actualType =
      data === null
        ? "null"
        : typeof data === "object"
          ? Array.isArray(data)
            ? "array"
            : "object"
          : typeof data;
    if (!types.includes(actualType)) {
      errors.push(
        `${pointer}: expected type ${types.join("|")}, got ${actualType}`,
      );
      return;
    }
  }

  // enum
  if (Array.isArray(schema["enum"])) {
    const allowed = schema["enum"] as unknown[];
    if (!allowed.includes(data)) {
      errors.push(
        `${pointer}: must be one of ${JSON.stringify(allowed)}, got ${JSON.stringify(data)}`,
      );
    }
  }

  // string keywords
  if (typeof data === "string") {
    if (
      typeof schema["minLength"] === "number" &&
      data.length < schema["minLength"]
    ) {
      errors.push(
        `${pointer}: minLength ${schema["minLength"]}, got ${data.length}`,
      );
    }
    if (
      typeof schema["maxLength"] === "number" &&
      data.length > schema["maxLength"]
    ) {
      errors.push(
        `${pointer}: maxLength ${schema["maxLength"]}, got ${data.length}`,
      );
    }
    if (
      typeof schema["pattern"] === "string" &&
      !new RegExp(schema["pattern"]).test(data)
    ) {
      errors.push(`${pointer}: does not match pattern ${schema["pattern"]}`);
    }
  }

  // number keywords
  if (typeof data === "number") {
    if (typeof schema["minimum"] === "number" && data < schema["minimum"]) {
      errors.push(`${pointer}: minimum ${schema["minimum"]}, got ${data}`);
    }
    if (typeof schema["maximum"] === "number" && data > schema["maximum"]) {
      errors.push(`${pointer}: maximum ${schema["maximum"]}, got ${data}`);
    }
    if (
      typeof schema["exclusiveMinimum"] === "number" &&
      data <= schema["exclusiveMinimum"]
    ) {
      errors.push(
        `${pointer}: exclusiveMinimum ${schema["exclusiveMinimum"]}, got ${data}`,
      );
    }
    if (
      typeof schema["exclusiveMaximum"] === "number" &&
      data >= schema["exclusiveMaximum"]
    ) {
      errors.push(
        `${pointer}: exclusiveMaximum ${schema["exclusiveMaximum"]}, got ${data}`,
      );
    }
  }

  // array keywords
  if (Array.isArray(data)) {
    if (
      typeof schema["minItems"] === "number" &&
      data.length < schema["minItems"]
    ) {
      errors.push(
        `${pointer}: minItems ${schema["minItems"]}, got ${data.length}`,
      );
    }
    if (
      typeof schema["maxItems"] === "number" &&
      data.length > schema["maxItems"]
    ) {
      errors.push(
        `${pointer}: maxItems ${schema["maxItems"]}, got ${data.length}`,
      );
    }
    if (schema["items"] !== undefined) {
      const itemSchema = schema["items"] as SchemaDoc | SchemaDoc[];
      if (Array.isArray(itemSchema)) {
        // tuple validation
        data.forEach((item, i) => {
          if (i < itemSchema.length) {
            validateNode(item, itemSchema[i], root, `${pointer}[${i}]`, errors);
          }
        });
      } else {
        data.forEach((item, i) => {
          validateNode(item, itemSchema, root, `${pointer}[${i}]`, errors);
        });
      }
    }
  }

  // object keywords
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // propertyNames
    if (
      typeof schema["propertyNames"] === "object" &&
      schema["propertyNames"] !== null
    ) {
      const pnSchema = schema["propertyNames"] as SchemaDoc;
      for (const key of Object.keys(obj)) {
        validateNode(key, pnSchema, root, `${pointer}[key:${key}]`, errors);
      }
    }

    // required
    if (Array.isArray(schema["required"])) {
      for (const req of schema["required"] as string[]) {
        if (!(req in obj)) {
          errors.push(`${pointer}: missing required property '${req}'`);
        }
      }
    }

    // properties
    const propsSchema = schema["properties"] as
      | Record<string, SchemaDoc>
      | undefined;
    if (propsSchema) {
      for (const [key, propSchema] of Object.entries(propsSchema)) {
        if (key in obj) {
          validateNode(obj[key], propSchema, root, `${pointer}.${key}`, errors);
        }
      }
    }

    // additionalProperties
    if (schema["additionalProperties"] === false && propsSchema) {
      const knownKeys = new Set(Object.keys(propsSchema));
      for (const key of Object.keys(obj)) {
        if (!knownKeys.has(key)) {
          errors.push(`${pointer}: additional property '${key}' not allowed`);
        }
      }
    }
  }
}

/**
 * Validate `data` against a JSON Schema v7 file.
 *
 * @param data       The value to validate.
 * @param schemaPath Absolute path or filename relative to schemas/ directory.
 * @returns          `{ valid, errors }` — errors is empty when valid.
 */
export function validateAgainstSchema(
  data: unknown,
  schemaPath: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    const schema = loadSchema(schemaPath);
    validateNode(data, schema, schema, "#", errors);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Schema load/parse error: ${msg}`);
  }
  return { valid: errors.length === 0, errors };
}
