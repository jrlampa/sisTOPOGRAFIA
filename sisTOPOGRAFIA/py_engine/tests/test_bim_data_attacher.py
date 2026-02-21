"""
test_bim_data_attacher.py — FASE 40
Testes unitários para bim_data_attacher.attach_bim_data e _build_xdata.
Cobre: tags None, Series vazia, sem items, xdata vazio, exceção em set_xdata,
       pd.isna que lança TypeError, chave 'geometry' ignorada, valor lista.
"""
import sys
import os
import pandas as pd
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bim_data_attacher import attach_bim_data, _build_xdata


# ── Helpers ────────────────────────────────────────────────────────────────────

def _mock_entity():
    """Entidade DXF simulada com set_xdata."""
    e = MagicMock()
    e.set_xdata = MagicMock()
    return e


# ── attach_bim_data — guardas de entrada ──────────────────────────────────────

class TestAttachBimDataGuards:

    def test_none_tags_returns_immediately(self):
        """Tags None devem sair imediatamente sem chamar set_xdata."""
        entity = _mock_entity()
        attach_bim_data(entity, None)
        entity.set_xdata.assert_not_called()

    def test_empty_series_returns_immediately(self):
        """Series vazia deve sair imediatamente sem chamar set_xdata."""
        entity = _mock_entity()
        attach_bim_data(entity, pd.Series([], dtype=object))
        entity.set_xdata.assert_not_called()

    def test_no_items_attr_returns_immediately(self):
        """Objeto sem atributo 'items' (ex: int) deve sair imediatamente."""
        entity = _mock_entity()
        attach_bim_data(entity, 42)
        entity.set_xdata.assert_not_called()

    def test_all_none_values_produces_empty_xdata_and_returns(self):
        """Dict com todos os valores None → xdata vazio → set_xdata não chamado."""
        entity = _mock_entity()
        attach_bim_data(entity, {'k1': None, 'k2': None})
        entity.set_xdata.assert_not_called()

    def test_valid_tags_calls_set_xdata(self):
        """Dict com valor válido deve chamar set_xdata."""
        entity = _mock_entity()
        attach_bim_data(entity, {'building': 'yes'})
        entity.set_xdata.assert_called_once()

    def test_entity_set_xdata_exception_swallowed(self):
        """Exceção em set_xdata deve ser capturada sem propagar."""
        entity = _mock_entity()
        entity.set_xdata.side_effect = Exception("ezdxf internal error")
        # Não deve lançar
        attach_bim_data(entity, {'name': 'Edifício A'})


# ── _build_xdata — filtros de valores ─────────────────────────────────────────

class TestBuildXdata:

    def test_geometry_key_is_skipped(self):
        """Chave 'geometry' deve ser ignorada no XDATA."""
        geom_mock = MagicMock()
        result = _build_xdata({'geometry': geom_mock, 'building': 'yes'})
        keys = [v for _, v in result]
        assert not any('geometry' in k for k in keys), "geometry não deve aparecer no XDATA"
        assert any('building' in k for k in keys), "building deve aparecer no XDATA"

    def test_list_value_uses_first_element(self):
        """Valor lista deve usar o primeiro elemento."""
        result = _build_xdata({'amenity': ['school', 'library']})
        assert len(result) == 1
        assert 'school' in result[0][1]

    def test_empty_list_value_skipped(self):
        """Valor lista vazia (nenhum elemento) deve ser ignorado."""
        result = _build_xdata({'amenity': []})
        assert result == []

    def test_nan_float_value_skipped(self):
        """Valor float NaN deve ser ignorado."""
        result = _build_xdata({'height': float('nan')})
        assert result == []

    def test_pd_isna_raises_typeerror_continues(self):
        """pd.isna que lança TypeError deve ser capturado e o par processado normalmente."""
        with patch('bim_data_attacher.pd') as mock_pd:
            mock_pd.isna.side_effect = TypeError("unsupported type")
            # 'geometry' is skipped; use regular key to verify TypeError is swallowed
            result = _build_xdata({'name': 'Edifício'})
        assert any('name' in v for _, v in result)

    def test_string_truncated_to_max_length(self):
        """Strings longas devem ser truncadas a 240 chars."""
        long_val = 'x' * 300
        result = _build_xdata({'desc': long_val})
        assert len(result) == 1
        assert len(result[0][1]) <= 240

    def test_scalar_number_converted(self):
        """Valor numérico escalar deve ser convertido para string no XDATA."""
        result = _build_xdata({'height': 12.5})
        assert len(result) == 1
        assert '12.5' in result[0][1]
