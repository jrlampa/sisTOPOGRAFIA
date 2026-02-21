"""
test_fase17_osm_cache.py — FASE 17: Testes para Cache OSM e Tags de Equipment/Infraestrutura.

Cobre:
  1. Cache OSM em memória (hit, miss, TTL, clear)
  2. Novas tags equipment e infrastructure em OsmFetcherUseCase.build_tags()
"""
import sys
import os
import time
import pytest
from unittest.mock import patch, MagicMock
import geopandas as gpd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── 1. Cache OSM ───────────────────────────────────────────────────────────────

class TestOsmCache:
    """Testa o cache em memória com TTL em osmnx_client."""

    def setup_method(self):
        import osmnx_client
        osmnx_client.clear_osm_cache()

    def test_cache_key_is_deterministic(self):
        """Mesmos parâmetros devem gerar a mesma chave."""
        from osmnx_client import _cache_key
        k1 = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        k2 = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        assert k1 == k2

    def test_cache_key_differs_for_different_tags(self):
        """Tags diferentes devem gerar chaves diferentes."""
        from osmnx_client import _cache_key
        k1 = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        k2 = _cache_key(-22.15018, -42.92185, 500, {'highway': True}, None)
        assert k1 != k2

    def test_cache_key_differs_for_different_radius(self):
        """Raios diferentes devem gerar chaves diferentes."""
        from osmnx_client import _cache_key
        k1 = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        k2 = _cache_key(-22.15018, -42.92185, 1000, {'building': True}, None)
        assert k1 != k2

    def test_cache_miss_returns_none(self):
        """Cache vazio deve retornar None."""
        from osmnx_client import _get_cached
        assert _get_cached("chave_inexistente") is None

    def test_cache_set_and_get(self):
        """Dado armazenado deve ser recuperável."""
        from osmnx_client import _set_cache, _get_cached
        expected = gpd.GeoDataFrame()
        _set_cache("test_key", expected)
        result = _get_cached("test_key")
        assert result is not None

    def test_cache_expired_returns_none(self):
        """Cache com TTL expirado deve retornar None."""
        import osmnx_client
        from osmnx_client import _set_cache, _get_cached
        old_ttl = osmnx_client._OSM_CACHE_TTL_SECONDS
        osmnx_client._OSM_CACHE_TTL_SECONDS = 0  # expiração imediata
        try:
            _set_cache("expired_key", gpd.GeoDataFrame())
            time.sleep(0.01)
            assert _get_cached("expired_key") is None
        finally:
            osmnx_client._OSM_CACHE_TTL_SECONDS = old_ttl

    def test_clear_cache(self):
        """clear_osm_cache() deve limpar todas as entradas."""
        from osmnx_client import _set_cache, _get_cached, clear_osm_cache
        _set_cache("k1", gpd.GeoDataFrame())
        _set_cache("k2", gpd.GeoDataFrame())
        clear_osm_cache()
        assert _get_cached("k1") is None
        assert _get_cached("k2") is None

    def test_fetch_osm_data_uses_cache_on_second_call(self):
        """Segunda chamada com mesmo parâmetro deve retornar dado em cache sem chamar ox."""
        from osmnx_client import fetch_osm_data
        dummy_gdf = gpd.GeoDataFrame({'geometry': []}, crs="EPSG:4326")

        with patch('osmnx_client.ox') as mock_ox:
            mock_ox.features.features_from_point.return_value = dummy_gdf
            mock_ox.projection.project_gdf.return_value = dummy_gdf

            tags = {'building': True}
            fetch_osm_data(-22.15018, -42.92185, 100, tags)
            fetch_osm_data(-22.15018, -42.92185, 100, tags)

            # OSMNx deve ter sido chamado apenas UMA vez (segundo acerto é cache)
            assert mock_ox.features.features_from_point.call_count == 1

    def test_fetch_osm_data_different_params_call_ox_twice(self):
        """Parâmetros diferentes devem resultar em duas chamadas reais ao OSMNx."""
        from osmnx_client import fetch_osm_data
        dummy_gdf = gpd.GeoDataFrame({'geometry': []}, crs="EPSG:4326")

        with patch('osmnx_client.ox') as mock_ox:
            mock_ox.features.features_from_point.return_value = dummy_gdf
            mock_ox.projection.project_gdf.return_value = dummy_gdf

            fetch_osm_data(-22.15018, -42.92185, 100, {'building': True})
            fetch_osm_data(-22.15018, -42.92185, 200, {'building': True})

            assert mock_ox.features.features_from_point.call_count == 2


# ── 2. OsmFetcherUseCase — Equipment e Infrastructure ─────────────────────────

class TestOsmFetcherEquipmentTags:
    """Verifica a lógica de build_tags() para equipment e infrastructure."""

    def _make_fetcher(self, layers_config):
        from application.use_cases.osm_fetcher import OsmFetcherUseCase
        return OsmFetcherUseCase(
            lat=-22.15018, lon=-42.92185, radius=500,
            layers_config=layers_config, crs='auto'
        )

    def test_equipment_adds_leisure_tag(self):
        """Config equipment=True deve incluir tag leisure para parques e lazer."""
        fetcher = self._make_fetcher({'equipment': True})
        tags = fetcher.build_tags()
        assert 'leisure' in tags
        assert set(['park', 'playground', 'sports_centre', 'pitch', 'garden']).issubset(set(tags['leisure']))

    def test_equipment_adds_man_made_tag(self):
        """Config equipment=True deve incluir tag man_made para estruturas."""
        fetcher = self._make_fetcher({'equipment': True})
        tags = fetcher.build_tags()
        assert 'man_made' in tags
        assert set(['tower', 'water_tower', 'chimney', 'flagpole', 'reservoir_covered']).issubset(set(tags['man_made']))

    def test_equipment_disabled_does_not_add_leisure(self):
        """Config equipment=False não deve incluir leisure."""
        fetcher = self._make_fetcher({'equipment': False})
        tags = fetcher.build_tags()
        assert 'leisure' not in tags

    def test_infrastructure_adds_power_tag(self):
        """Config infrastructure=True deve incluir tag power."""
        fetcher = self._make_fetcher({'infrastructure': True})
        tags = fetcher.build_tags()
        assert 'power' in tags
        assert set(['line', 'tower', 'substation', 'pole', 'cable']).issubset(set(tags['power']))

    def test_infrastructure_adds_telecom_tag(self):
        """Config infrastructure=True deve incluir tag telecom."""
        fetcher = self._make_fetcher({'infrastructure': True})
        tags = fetcher.build_tags()
        assert 'telecom' in tags
        assert tags['telecom'] is True

    def test_infrastructure_disabled_does_not_add_power(self):
        """Config infrastructure=False não deve incluir power."""
        fetcher = self._make_fetcher({'infrastructure': False})
        tags = fetcher.build_tags()
        assert 'power' not in tags

    def test_equipment_and_infrastructure_combined(self):
        """Ambos equipment e infrastructure habilitados devem gerar todas as tags."""
        fetcher = self._make_fetcher({'equipment': True, 'infrastructure': True})
        tags = fetcher.build_tags()
        assert 'leisure' in tags
        assert 'man_made' in tags
        assert 'power' in tags
        assert 'telecom' in tags

    def test_all_layers_enabled_generates_complete_tags(self):
        """Todos os layers habilitados devem gerar conjunto completo de tags OSM."""
        fetcher = self._make_fetcher({
            'buildings': True, 'roads': True, 'vegetation': True,
            'furniture': True, 'equipment': True, 'infrastructure': True
        })
        tags = fetcher.build_tags()
        assert 'building' in tags
        assert 'highway' in tags
        assert 'waterway' in tags
        assert 'leisure' in tags
        assert 'power' in tags
        assert 'telecom' in tags

    def test_cadastral_alias_normalizes_equipment(self):
        """Alias 'cadastral' no controller deve normalizar para incluir equipment."""
        from controller import OSMController
        ctrl = OSMController.__new__(OSMController)
        config = ctrl._normalize_layers_config({'cadastral': True})
        assert config.get('equipment') is True

    def test_man_made_includes_water_tower(self):
        """man_made deve incluir water_tower para inventário de equipamentos hídricos."""
        fetcher = self._make_fetcher({'equipment': True})
        tags = fetcher.build_tags()
        assert 'water_tower' in tags['man_made']
