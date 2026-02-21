"""
test_enterprise_features.py — FASE 15
Testes unitários para EconomicAnalysisUseCase e SuggestiveDesignUseCase.
Valida lógica de negócio sem chamadas de rede (mocks onde necessário).
"""
import pytest
import sys
import os
import numpy as np
from unittest.mock import MagicMock, patch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Fixtures de analytics ─────────────────────────────────────────────────────

def _make_analytics(slope_avg=10.0, cut=500.0, fill=300.0, solar_avg=0.7):
    """Cria dict de analytics compatível com AnalyticsEngine.calculate_slope_grid()."""
    rows, cols = 4, 4
    solar_grid = np.full((rows, cols), solar_avg)
    return {
        'slope_avg': slope_avg,
        'earthwork': {
            'cut_volume': cut,
            'fill_volume': fill,
            'net_volume': cut - fill,
            'target_z': 600.0,
        },
        'solar': solar_grid,
        'hydrology': np.ones((rows, cols)),
        'aspect': np.zeros((rows, cols)),
    }


# ── 1. EconomicAnalysisUseCase ────────────────────────────────────────────────

class TestEconomicAnalysisUseCase:
    """Testes para o cálculo de análise econômica sem dados mockados."""

    def _make_uc(self, unit_prices=None):
        from application.use_cases.economic_analysis import EconomicAnalysisUseCase
        return EconomicAnalysisUseCase(unit_prices=unit_prices)

    def test_returns_required_keys(self):
        """Resultado deve conter currency, breakdown e unit_prices."""
        uc = self._make_uc()
        result = uc.execute(_make_analytics())
        assert 'currency' in result
        assert result['currency'] == 'BRL'
        assert 'breakdown' in result
        assert 'unit_prices' in result

    def test_breakdown_has_earthwork_drainage_summary(self):
        """breakdown deve ter earthwork, drainage e summary."""
        uc = self._make_uc()
        result = uc.execute(_make_analytics())
        for key in ('earthwork', 'drainage', 'summary'):
            assert key in result['breakdown'], f"Chave '{key}' ausente em breakdown"

    def test_cut_cost_proportional_to_volume(self):
        """Custo de corte deve ser proporcional ao volume de corte."""
        uc = self._make_uc({'cut_per_m3': 25.0, 'fill_per_m3': 45.0,
                            'drain_per_m': 120.0, 'solar_roi_factor': 0.15})
        analytics = _make_analytics(cut=100.0, fill=0.0)
        result = uc.execute(analytics)
        assert result['breakdown']['earthwork']['cut_cost'] == pytest.approx(2500.0, rel=1e-3)

    def test_fill_cost_proportional_to_volume(self):
        """Custo de aterro deve ser proporcional ao volume de aterro."""
        uc = self._make_uc({'cut_per_m3': 25.0, 'fill_per_m3': 45.0,
                            'drain_per_m': 120.0, 'solar_roi_factor': 0.15})
        analytics = _make_analytics(cut=0.0, fill=100.0)
        result = uc.execute(analytics)
        assert result['breakdown']['earthwork']['fill_cost'] == pytest.approx(4500.0, rel=1e-3)

    def test_zero_earthwork_zero_cost(self):
        """Sem movimentação de terra, custo de terraplenagem deve ser zero."""
        uc = self._make_uc()
        result = uc.execute(_make_analytics(cut=0.0, fill=0.0))
        assert result['breakdown']['earthwork']['total'] == pytest.approx(0.0, abs=1e-3)

    def test_drain_length_derived_from_analytics(self):
        """drain_length deve ser derivado de volume e declividade, não fixo."""
        uc = self._make_uc()
        # Slope alto + volume alto → drain_length > 0
        analytics_high = _make_analytics(slope_avg=30.0, cut=10000.0, fill=5000.0)
        result_high = uc.execute(analytics_high)
        # Sem volume → drain_length = 0
        analytics_zero = _make_analytics(slope_avg=30.0, cut=0.0, fill=0.0)
        result_zero = uc.execute(analytics_zero)
        assert result_high['breakdown']['drainage']['estimated_length_m'] > 0
        assert result_zero['breakdown']['drainage']['estimated_length_m'] == pytest.approx(0.0, abs=1e-3)

    def test_drain_length_increases_with_slope(self):
        """Maior declividade implica maior comprimento de drenagem estimado."""
        uc = self._make_uc()
        low_slope = uc.execute(_make_analytics(slope_avg=5.0, cut=1000.0, fill=1000.0))
        high_slope = uc.execute(_make_analytics(slope_avg=50.0, cut=1000.0, fill=1000.0))
        low_drain = low_slope['breakdown']['drainage']['estimated_length_m']
        high_drain = high_slope['breakdown']['drainage']['estimated_length_m']
        assert high_drain >= low_drain, "Drenagem deve aumentar com a declividade"

    def test_solar_saving_uses_analytics_array(self):
        """Economia solar deve usar média real do array solar, não valor fixo."""
        uc = self._make_uc({'cut_per_m3': 25.0, 'fill_per_m3': 45.0,
                            'drain_per_m': 120.0, 'solar_roi_factor': 0.10})
        analytics = _make_analytics(solar_avg=0.8)
        result = uc.execute(analytics)
        # solar_avg (0.8) * 1000 * 0.10 = 80.0
        assert result['breakdown']['summary']['solar_annual_saving'] == pytest.approx(80.0, rel=0.05)

    def test_total_capex_is_sum_of_parts(self):
        """total_capex deve ser a soma de terraplenagem e drenagem."""
        uc = self._make_uc()
        analytics = _make_analytics(slope_avg=20.0, cut=200.0, fill=100.0)
        result = uc.execute(analytics)
        bd = result['breakdown']
        expected = bd['earthwork']['total'] + bd['drainage']['cost']
        assert bd['summary']['total_capex'] == pytest.approx(expected, rel=1e-3)

    def test_custom_unit_prices_applied(self):
        """Preços unitários personalizados devem ser respeitados."""
        custom = {'cut_per_m3': 50.0, 'fill_per_m3': 90.0,
                  'drain_per_m': 200.0, 'solar_roi_factor': 0.20}
        uc = self._make_uc(custom)
        result = uc.execute(_make_analytics(cut=10.0, fill=10.0))
        assert result['unit_prices']['cut_per_m3'] == 50.0
        assert result['breakdown']['earthwork']['cut_cost'] == pytest.approx(500.0, rel=1e-3)


# ── 2. SuggestiveDesignUseCase ────────────────────────────────────────────────

class TestSuggestiveDesignUseCase:
    """Testa SuggestiveDesignUseCase com GroqAdapter mockado."""

    def _make_uc(self, mock_response="## Proposta\nAdicione drenagem pluvial."):
        from application.use_cases.suggestive_design import SuggestiveDesignUseCase
        mock_adapter = MagicMock()
        mock_adapter.get_completion.return_value = mock_response
        return SuggestiveDesignUseCase(groq_adapter=mock_adapter)

    def test_execute_returns_string(self):
        """execute() deve retornar string não vazia."""
        uc = self._make_uc()
        result = uc.execute(_make_analytics())
        assert isinstance(result, str)
        assert len(result) > 0

    def test_execute_calls_groq_once(self):
        """execute() deve chamar get_completion exatamente uma vez."""
        from application.use_cases.suggestive_design import SuggestiveDesignUseCase
        mock_adapter = MagicMock()
        mock_adapter.get_completion.return_value = "resposta"
        uc = SuggestiveDesignUseCase(groq_adapter=mock_adapter)
        uc.execute(_make_analytics())
        mock_adapter.get_completion.assert_called_once()

    def test_prompt_contains_slope_data(self):
        """O prompt gerado deve conter o valor de declividade."""
        from application.use_cases.suggestive_design import SuggestiveDesignUseCase
        captured_prompts = []
        mock_adapter = MagicMock()
        mock_adapter.get_completion.side_effect = lambda p: captured_prompts.append(p) or "ok"
        uc = SuggestiveDesignUseCase(groq_adapter=mock_adapter)
        uc.execute(_make_analytics(slope_avg=42.5))
        assert len(captured_prompts) == 1
        assert "42.5" in captured_prompts[0]

    def test_prompt_contains_cut_fill_data(self):
        """O prompt deve incluir volumes de corte e aterro."""
        from application.use_cases.suggestive_design import SuggestiveDesignUseCase
        captured_prompts = []
        mock_adapter = MagicMock()
        mock_adapter.get_completion.side_effect = lambda p: captured_prompts.append(p) or "ok"
        uc = SuggestiveDesignUseCase(groq_adapter=mock_adapter)
        uc.execute(_make_analytics(cut=777.0, fill=333.0))
        assert "777" in captured_prompts[0]
        assert "333" in captured_prompts[0]

    def test_context_passed_to_prompt(self):
        """Contexto adicional fornecido pelo usuário deve aparecer no prompt."""
        from application.use_cases.suggestive_design import SuggestiveDesignUseCase
        captured_prompts = []
        mock_adapter = MagicMock()
        mock_adapter.get_completion.side_effect = lambda p: captured_prompts.append(p) or "ok"
        uc = SuggestiveDesignUseCase(groq_adapter=mock_adapter)
        uc.execute(_make_analytics(), context="Área próxima a APP.")
        assert "Área próxima a APP." in captured_prompts[0]

    def test_prompt_in_portuguese(self):
        """Prompt deve estar em Português do Brasil — verifica termos técnicos pt-BR."""
        from application.use_cases.suggestive_design import SuggestiveDesignUseCase
        captured_prompts = []
        mock_adapter = MagicMock()
        mock_adapter.get_completion.side_effect = lambda p: captured_prompts.append(p) or "ok"
        uc = SuggestiveDesignUseCase(groq_adapter=mock_adapter)
        uc.execute(_make_analytics())
        prompt = captured_prompts[0]
        # Verifica termos de engenharia civil em pt-BR que devem aparecer no prompt
        pt_br_terms = ['declividade', 'drenagem', 'terraplanagem', 'aterro']
        found = [t for t in pt_br_terms if t.lower() in prompt.lower()]
        assert len(found) >= 2, f"Prompt deve conter termos técnicos pt-BR; encontrados: {found}"
