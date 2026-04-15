"""
test_dxf_hardening.py
Tests for DXF attribute injection hardening (Roadmap Item 50).
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_geometry_mixin import sanitize_text_value


# ---------------------------------------------------------------------------
# sanitize_text_value – standalone function
# ---------------------------------------------------------------------------

class TestSanitizeTextValue:
    def test_plain_text_unchanged(self):
        assert sanitize_text_value("hello world") == "hello world"

    def test_semicolon_removed(self):
        assert ";" not in sanitize_text_value("DROP TABLE jobs;")

    def test_backtick_removed(self):
        assert "`" not in sanitize_text_value("`rm -rf /`")

    def test_shell_substitution_removed(self):
        result = sanitize_text_value("$(rm -rf /)")
        assert "$(" not in result

    def test_null_byte_removed(self):
        assert "\x00" not in sanitize_text_value("hello\x00world")

    def test_control_chars_removed(self):
        # \x01 through \x08 should be removed
        assert "\x01" not in sanitize_text_value("a\x01b")
        assert "\x1f" not in sanitize_text_value("a\x1fb")

    def test_tab_preserved(self):
        # \t (\x09) is allowed
        assert "\t" in sanitize_text_value("col1\tcol2")

    def test_newline_preserved(self):
        # \n (\x0a) is allowed
        assert "\n" in sanitize_text_value("line1\nline2")

    def test_truncation_at_default_512(self):
        long_val = "A" * 600
        result = sanitize_text_value(long_val)
        assert result.endswith("...")
        assert len(result) == 515  # 512 chars + "..."

    def test_truncation_at_custom_max(self):
        result = sanitize_text_value("B" * 20, max_length=10)
        assert result == "B" * 10 + "..."

    def test_no_truncation_at_exact_limit(self):
        result = sanitize_text_value("C" * 512)
        assert result == "C" * 512
        assert not result.endswith("...")

    def test_non_string_input_coerced(self):
        assert sanitize_text_value(42) == "42"
        assert sanitize_text_value(3.14) == "3.14"

    def test_combined_attack_string(self):
        payload = "$(cat /etc/passwd); `id`\x00\x1b"
        result = sanitize_text_value(payload)
        assert "$(" not in result
        assert ";" not in result
        assert "`" not in result
        assert "\x00" not in result
        assert "\x1b" not in result
        # legitimate text still present
        assert "cat /etc/passwd" in result or "id" in result

    def test_empty_string_unchanged(self):
        assert sanitize_text_value("") == ""


# ---------------------------------------------------------------------------
# _sanitize_attribs integration – via a minimal stub
# ---------------------------------------------------------------------------

class _MixinStub:
    """Minimal stub that imports _sanitize_attribs via the mixin."""
    from dxf_geometry_mixin import DXFGeometryMixin
    _sanitize_attribs = DXFGeometryMixin._sanitize_attribs


class TestSanitizeAttribsIntegration:
    def setup_method(self):
        self.stub = _MixinStub()

    def test_nan_replaced_with_na(self):
        result = self.stub._sanitize_attribs({"KEY": float("nan")})
        assert result["KEY"] == "N/A"

    def test_empty_string_replaced_with_na(self):
        result = self.stub._sanitize_attribs({"KEY": "  "})
        assert result["KEY"] == "N/A"

    def test_dangerous_value_sanitized(self):
        result = self.stub._sanitize_attribs({"TAG": "val;bad`$()"})
        assert ";" not in result["TAG"]
        assert "`" not in result["TAG"]
        assert "$(" not in result["TAG"]

    def test_normal_value_preserved(self):
        result = self.stub._sanitize_attribs({"ID": "123", "TYPE": "house"})
        assert result["ID"] == "123"
        assert result["TYPE"] == "house"
