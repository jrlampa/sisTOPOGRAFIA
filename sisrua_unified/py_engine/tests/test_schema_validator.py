"""Tests for py_engine/utils/schema_validator.py"""
import os
import sys

# Allow running from the py_engine directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from utils.schema_validator import validate_against_schema

SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "schemas")


def schema(name: str) -> str:
    return os.path.join(SCHEMAS_DIR, name)


# ── DXF request ───────────────────────────────────────────────────────────────

VALID_DXF_REQUEST = {"lat": -22.9, "lon": -43.2, "radius": 500, "mode": "circle"}


def test_dxf_request_valid_minimal():
    valid, errors = validate_against_schema(VALID_DXF_REQUEST, schema("dxf_request.schema.json"))
    assert errors == []
    assert valid is True


def test_dxf_request_valid_with_bt_context():
    data = {**VALID_DXF_REQUEST, "btContext": {"projectType": "ramais"}}
    valid, errors = validate_against_schema(data, schema("dxf_request.schema.json"))
    assert valid is True, errors


def test_dxf_request_valid_polygon_mode():
    data = {
        **VALID_DXF_REQUEST,
        "mode": "polygon",
        "polygon": [[-43.2, -22.9], [-43.1, -22.9], [-43.1, -22.8]],
    }
    valid, errors = validate_against_schema(data, schema("dxf_request.schema.json"))
    assert valid is True, errors


def test_dxf_request_missing_mode():
    bad = {"lat": -22.9, "lon": -43.2, "radius": 500}
    valid, errors = validate_against_schema(bad, schema("dxf_request.schema.json"))
    assert valid is False
    assert any("mode" in e for e in errors)


def test_dxf_request_invalid_mode_enum():
    bad = {**VALID_DXF_REQUEST, "mode": "triangle"}
    valid, errors = validate_against_schema(bad, schema("dxf_request.schema.json"))
    assert valid is False
    assert any("mode" in e for e in errors)


def test_dxf_request_lat_out_of_range():
    bad = {**VALID_DXF_REQUEST, "lat": -95}
    valid, errors = validate_against_schema(bad, schema("dxf_request.schema.json"))
    assert valid is False
    assert any("lat" in e or "minimum" in e for e in errors)


def test_dxf_request_radius_too_small():
    bad = {**VALID_DXF_REQUEST, "radius": 5}
    valid, errors = validate_against_schema(bad, schema("dxf_request.schema.json"))
    assert valid is False


def test_dxf_request_radius_too_large():
    bad = {**VALID_DXF_REQUEST, "radius": 9999}
    valid, errors = validate_against_schema(bad, schema("dxf_request.schema.json"))
    assert valid is False


def test_dxf_request_invalid_projection_pattern():
    bad = {**VALID_DXF_REQUEST, "projection": "INVALID PROJECTION!"}
    valid, errors = validate_against_schema(bad, schema("dxf_request.schema.json"))
    assert valid is False
    assert any("projection" in e or "pattern" in e for e in errors)


def test_dxf_request_invalid_bt_context_project_type():
    bad = {**VALID_DXF_REQUEST, "btContext": {"projectType": "unknown"}}
    valid, errors = validate_against_schema(bad, schema("dxf_request.schema.json"))
    assert valid is False


# ── DXF response ──────────────────────────────────────────────────────────────

def test_dxf_response_success():
    data = {"status": "success", "message": "Generated output.dxf"}
    valid, errors = validate_against_schema(data, schema("dxf_response.schema.json"))
    assert valid is True, errors


def test_dxf_response_error():
    data = {"status": "error", "message": "OSM fetch failed"}
    valid, errors = validate_against_schema(data, schema("dxf_response.schema.json"))
    assert valid is True, errors


def test_dxf_response_progress():
    data = {"status": "progress", "message": "Loading…", "progress": 30}
    valid, errors = validate_against_schema(data, schema("dxf_response.schema.json"))
    assert valid is True, errors


def test_dxf_response_unknown_status():
    data = {"status": "unknown", "message": "x"}
    valid, errors = validate_against_schema(data, schema("dxf_response.schema.json"))
    assert valid is False


# ── BT calculate request ──────────────────────────────────────────────────────

VALID_BT_REQUEST = {
    "transformer": {"id": "tr1", "rootNodeId": "n1", "kva": 75, "zPercent": 3.5, "qtMt": 10},
    "nodes": [{"id": "n1", "load": {"localDemandKva": 5}}],
    "edges": [{"fromNodeId": "n1", "toNodeId": "n2", "conductorId": "cu16", "lengthMeters": 50}],
    "phase": "MONO",
}


def test_bt_request_valid():
    valid, errors = validate_against_schema(VALID_BT_REQUEST, schema("bt_calculate_request.schema.json"))
    assert valid is True, errors


def test_bt_request_missing_transformer():
    bad = {k: v for k, v in VALID_BT_REQUEST.items() if k != "transformer"}
    valid, errors = validate_against_schema(bad, schema("bt_calculate_request.schema.json"))
    assert valid is False
    assert any("transformer" in e for e in errors)


def test_bt_request_invalid_phase():
    bad = {**VALID_BT_REQUEST, "phase": "QUAD"}
    valid, errors = validate_against_schema(bad, schema("bt_calculate_request.schema.json"))
    assert valid is False
    assert any("phase" in e for e in errors)


def test_bt_request_kva_zero_exclusive_minimum():
    bad = {
        **VALID_BT_REQUEST,
        "transformer": {**VALID_BT_REQUEST["transformer"], "kva": 0},
    }
    valid, errors = validate_against_schema(bad, schema("bt_calculate_request.schema.json"))
    assert valid is False
    assert any("kva" in e or "exclusiveMinimum" in e for e in errors)


# ── BT calculate response ─────────────────────────────────────────────────────

VALID_BT_RESPONSE = {
    "qtTrafo": 1.5,
    "nodeResults": [
        {
            "nodeId": "n1",
            "qtSegment": 0.5,
            "qtAccumulated": 0.5,
            "voltageV": 126.5,
            "accumulatedDemandKva": 10,
            "pathFromRoot": ["n1"],
        }
    ],
    "terminalResults": [
        {
            "nodeId": "n2",
            "qtTerminal": 0.8,
            "qtRamal": 0.2,
            "qtTotal": 1.0,
            "voltageEndV": 125.0,
            "ramalConductorId": None,
            "ramalLengthMeters": None,
        }
    ],
    "worstCase": {
        "worstTerminalNodeId": "n2",
        "cqtGlobal": 2.5,
        "criticalPath": ["n1", "n2"],
        "qtTrafo": 1.5,
    },
    "totalDemandKva": 10.0,
    "consistencyAlerts": [],
}


def test_bt_response_valid():
    valid, errors = validate_against_schema(VALID_BT_RESPONSE, schema("bt_calculate_response.schema.json"))
    assert valid is True, errors


def test_bt_response_with_alerts():
    data = {
        **VALID_BT_RESPONSE,
        "consistencyAlerts": [
            {"code": "OVERLOAD", "message": "Transformer overloaded", "severity": "warn"}
        ],
    }
    valid, errors = validate_against_schema(data, schema("bt_calculate_response.schema.json"))
    assert valid is True, errors


def test_bt_response_missing_qt_trafo():
    bad = {k: v for k, v in VALID_BT_RESPONSE.items() if k != "qtTrafo"}
    valid, errors = validate_against_schema(bad, schema("bt_calculate_response.schema.json"))
    assert valid is False
    assert any("qtTrafo" in e for e in errors)


# ── Error handling ────────────────────────────────────────────────────────────

def test_nonexistent_schema_returns_error():
    valid, errors = validate_against_schema({}, schema("nonexistent.schema.json"))
    assert valid is False
    assert any("Schema load/parse error" in e for e in errors)
