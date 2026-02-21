"""
test_elevation_api.py — Testes unitários para ElevationApiAdapter
Cobre: _probe_latency (json_post OK / json_post error / GET branch),
       select_best_provider (all fail → fallback / results → best selected / TTL cache),
       fetch_grid (json_post / GET fallback / exception fallback grid).
"""
import sys
import os
import time
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from infrastructure.external_api.elevation_api import ElevationApiAdapter


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _make_adapter():
    """Retorna adaptador com cache zerado para cada teste."""
    a = ElevationApiAdapter()
    a._best_provider = None
    a._last_probe_time = 0
    return a


def _mock_ok_response(elevation=850.0):
    """Response HTTP 200 simulada com dados de elevação válidos."""
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {'results': [{'elevation': elevation}]}
    response.raise_for_status = MagicMock()
    return response


# ─── _probe_latency ──────────────────────────────────────────────────────────

class TestProbeLatency:
    def test_json_post_ok_returns_finite_latency(self):
        """Resposta 200 via json_post deve retornar latência finita (float)."""
        adapter = _make_adapter()
        provider = adapter.providers[0]  # json_post
        with patch('requests.post', return_value=_mock_ok_response()):
            name, latency = adapter._probe_latency(provider)
        assert name == provider['name']
        assert latency != float('inf')
        assert latency >= 0

    def test_json_post_exception_returns_inf(self):
        """Exceção em requests.post deve retornar latência infinita."""
        adapter = _make_adapter()
        provider = adapter.providers[0]
        with patch('requests.post', side_effect=Exception("timeout")):
            name, latency = adapter._probe_latency(provider)
        assert latency == float('inf')

    def test_get_type_provider_uses_requests_get(self):
        """Provider com type='get' deve usar requests.get."""
        adapter = _make_adapter()
        get_provider = {
            'name': 'TestGET',
            'url': 'https://api.example.com/elev',
            'type': 'get',
            'payload_key': 'locations'
        }
        resp = _mock_ok_response()
        with patch('requests.get', return_value=resp) as mock_get:
            name, latency = adapter._probe_latency(get_provider)
        mock_get.assert_called_once()
        assert latency != float('inf')

    def test_non_200_status_returns_inf(self):
        """Resposta com status != 200 deve retornar latência infinita."""
        adapter = _make_adapter()
        provider = adapter.providers[0]
        bad_resp = MagicMock()
        bad_resp.status_code = 503
        with patch('requests.post', return_value=bad_resp):
            name, latency = adapter._probe_latency(provider)
        assert latency == float('inf')


# ─── select_best_provider ────────────────────────────────────────────────────

class TestSelectBestProvider:
    def test_all_probes_fail_uses_fallback_provider(self):
        """Quando todos os probes falham, deve usar providers[1] como fallback."""
        adapter = _make_adapter()
        # Todos falham
        with patch.object(adapter, '_probe_latency', return_value=('any', float('inf'))):
            best = adapter.select_best_provider()
        assert best == adapter.providers[1]

    def test_best_provider_selected_by_lowest_latency(self):
        """O provider com menor latência deve ser selecionado."""
        adapter = _make_adapter()
        p0 = adapter.providers[0]
        p1 = adapter.providers[1]

        def fake_probe(provider):
            if provider['name'] == p0['name']:
                return (p0['name'], 0.1)
            return (p1['name'], 0.5)

        with patch.object(adapter, '_probe_latency', side_effect=fake_probe):
            best = adapter.select_best_provider()

        assert best['name'] == p0['name']

    def test_ttl_cache_skips_re_probe(self):
        """Dentro do TTL, select_best_provider deve retornar cache sem re-probe."""
        adapter = _make_adapter()
        adapter._best_provider = adapter.providers[0]
        adapter._last_probe_time = time.time()  # acabou de probar

        with patch.object(adapter, '_probe_latency') as mock_probe:
            result = adapter.select_best_provider()
        mock_probe.assert_not_called()
        assert result == adapter.providers[0]


# ─── fetch_grid ───────────────────────────────────────────────────────────────

class TestFetchGrid:
    def _make_results(self, num_results=25, elevation=800.0):
        return {'results': [{'elevation': elevation}] * num_results}

    def test_json_post_returns_correct_grid_shape(self):
        """fetch_grid via json_post deve retornar grid resolution×resolution."""
        adapter = _make_adapter()
        adapter._best_provider = adapter.providers[0]  # json_post
        adapter._last_probe_time = time.time()

        resp = MagicMock()
        resp.json.return_value = self._make_results(25, 850.0)
        resp.raise_for_status = MagicMock()

        with patch('requests.post', return_value=resp):
            grid = adapter.fetch_grid(-22.15, -42.92, 500, resolution=5)

        assert len(grid) == 5
        assert all(len(row) == 5 for row in grid)

    def test_fetch_grid_get_type_provider(self):
        """fetch_grid com provider GET deve usar requests.get."""
        adapter = _make_adapter()
        adapter._best_provider = {
            'name': 'TestGET',
            'url': 'https://api.example.com/elev',
            'type': 'get',
            'payload_key': 'locations'
        }
        adapter._last_probe_time = time.time()

        resp = MagicMock()
        resp.json.return_value = self._make_results(25, 750.0)
        resp.raise_for_status = MagicMock()

        with patch('requests.get', return_value=resp) as mock_get:
            grid = adapter.fetch_grid(-22.15, -42.92, 200, resolution=5)

        mock_get.assert_called_once()
        assert len(grid) == 5

    def test_fetch_grid_fewer_results_fills_with_zero(self):
        """Menos resultados que pontos da grade preenche com 0.0."""
        adapter = _make_adapter()
        adapter._best_provider = adapter.providers[0]
        adapter._last_probe_time = time.time()

        resp = MagicMock()
        resp.json.return_value = {'results': [{'elevation': 900.0}] * 5}  # só 5, mas 25 esperados
        resp.raise_for_status = MagicMock()

        with patch('requests.post', return_value=resp):
            grid = adapter.fetch_grid(-22.15, -42.92, 100, resolution=5)

        # As primeiras posições terão 900.0, o restante terá 0.0
        flat = [pt for row in grid for pt in row]
        elevations = [pt[2] for pt in flat]
        assert 900.0 in elevations
        assert 0.0 in elevations

    def test_fetch_grid_exception_returns_fallback_grid(self):
        """Exceção em requests.post deve retornar grade de fallback com 100.0."""
        adapter = _make_adapter()
        adapter._best_provider = adapter.providers[0]
        adapter._last_probe_time = time.time()

        with patch('requests.post', side_effect=Exception("Connection failed")):
            grid = adapter.fetch_grid(-22.15, -42.92, 100, resolution=3)

        # Grade de fallback: 3x3 com elevation=100.0
        assert len(grid) == 3
        assert all(pt[2] == 100.0 for row in grid for pt in row)
