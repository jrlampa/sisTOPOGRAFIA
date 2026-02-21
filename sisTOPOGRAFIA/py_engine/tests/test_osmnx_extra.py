"""
test_osmnx_extra.py — FASE 40
Testes adicionais para osmnx_client.py cobrindo branches não testados:
  - L2 disk cache hit no fetch_osm_data (linhas 140-142)
  - Busca por polígono (linhas 146-152)
  - Raio máximo excedido ValueError (linha 156)
  - CRS personalizado com projeção bem-sucedida e com falha (linhas 169-175)
  - Retorno com GDF não vazio (linhas 180-183)
  - OSError em clear_osm_cache (linhas 106-109)
  - OSError ao remover arquivo expirado em _get_disk_cached (linhas 77-78)
"""
import sys
import os
import time
import pickle
import tempfile
import pytest
import geopandas as gpd
from shapely.geometry import Point, Polygon
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Helpers ────────────────────────────────────────────────────────────────────

def _non_empty_gdf(n=3):
    """GeoDataFrame com n pontos (não vazio)."""
    return gpd.GeoDataFrame(
        {'geometry': [Point(i, i) for i in range(n)]},
        crs='EPSG:4326'
    )


def _tmp_cache_dir():
    return tempfile.mkdtemp(prefix='osmnx_extra_cache_')


# ── L2 disk cache hit ──────────────────────────────────────────────────────────

class TestFetchOsmDataL2Hit:
    """Cobre linhas 140-142: hit no cache em disco promove para L1 e retorna."""

    def setup_method(self):
        import osmnx_client
        self.tmp_dir = _tmp_cache_dir()
        osmnx_client._OSM_CACHE_DIR = self.tmp_dir
        osmnx_client.clear_osm_cache()

    def teardown_method(self):
        import osmnx_client, shutil
        osmnx_client.clear_osm_cache()
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_fetch_uses_disk_cache_when_memory_miss(self):
        """fetch_osm_data deve retornar dados do cache em disco sem chamar ox."""
        import osmnx_client
        from osmnx_client import _set_disk_cache, _cache_key, fetch_osm_data

        tags = {'building': True}
        key = _cache_key(-22.15018, -42.92185, 100, tags, None)
        gdf = _non_empty_gdf(2)
        _set_disk_cache(key, gdf)
        # L1 ainda está vazio

        with patch('osmnx_client.ox') as mock_ox:
            result = fetch_osm_data(-22.15018, -42.92185, 100, tags)
            # ox não deve ter sido chamado (saiu pelo L2 cache hit)
            mock_ox.features.features_from_point.assert_not_called()

        assert result is not None


# ── Busca por polígono ────────────────────────────────────────────────────────

class TestFetchOsmDataPolygon:
    """Cobre linhas 146-152: busca OSM por polígono em vez de ponto+raio."""

    def setup_method(self):
        import osmnx_client
        self.tmp_dir = _tmp_cache_dir()
        osmnx_client._OSM_CACHE_DIR = self.tmp_dir
        osmnx_client.clear_osm_cache()

    def teardown_method(self):
        import osmnx_client, shutil
        osmnx_client.clear_osm_cache()
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_polygon_branch_calls_features_from_polygon(self):
        """Quando polygon>=3 pontos, deve chamar ox.features.features_from_polygon."""
        from osmnx_client import fetch_osm_data
        polygon = [
            [-22.15, -42.93],
            [-22.14, -42.93],
            [-22.14, -42.92],
            [-22.15, -42.92],
        ]
        dummy = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:4326')

        with patch('osmnx_client.ox') as mock_ox:
            mock_ox.features.features_from_polygon.return_value = dummy
            mock_ox.projection.project_gdf.return_value = dummy

            fetch_osm_data(-22.15018, -42.92185, 500, {'building': True}, polygon=polygon)

            mock_ox.features.features_from_polygon.assert_called_once()
            mock_ox.features.features_from_point.assert_not_called()


# ── Raio máximo excedido ──────────────────────────────────────────────────────

class TestFetchOsmDataMaxRadius:
    """Cobre linha 156: ValueError quando raio > MAX_FETCH_RADIUS_METERS."""

    def setup_method(self):
        import osmnx_client
        self.tmp_dir = _tmp_cache_dir()
        osmnx_client._OSM_CACHE_DIR = self.tmp_dir
        osmnx_client.clear_osm_cache()

    def teardown_method(self):
        import osmnx_client, shutil
        osmnx_client.clear_osm_cache()
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_radius_too_large_raises_value_error(self):
        """Raio maior que MAX_FETCH_RADIUS_METERS deve lançar ValueError."""
        from osmnx_client import fetch_osm_data
        from constants import MAX_FETCH_RADIUS_METERS

        with patch('osmnx_client.ox'):
            with pytest.raises(ValueError, match="Radius too large"):
                fetch_osm_data(-22.15018, -42.92185, MAX_FETCH_RADIUS_METERS + 1, {'building': True})


# ── CRS personalizado e retorno com GDF não vazio ─────────────────────────────

class TestFetchOsmDataCustomCrs:
    """Cobre linhas 169-183: projeção CRS personalizado (sucesso e fallback)."""

    def setup_method(self):
        import osmnx_client
        self.tmp_dir = _tmp_cache_dir()
        osmnx_client._OSM_CACHE_DIR = self.tmp_dir
        osmnx_client.clear_osm_cache()

    def teardown_method(self):
        import osmnx_client, shutil
        osmnx_client.clear_osm_cache()
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_non_empty_gdf_with_auto_crs_sets_cache(self):
        """Fetch bem-sucedido com GDF não vazio deve armazenar no cache."""
        from osmnx_client import fetch_osm_data, _get_cached, _cache_key

        non_empty = _non_empty_gdf(3)
        projected = _non_empty_gdf(3)
        projected.crs = None  # simulação pós-projeção

        tags = {'building': True}

        with patch('osmnx_client.ox') as mock_ox:
            mock_ox.features.features_from_point.return_value = non_empty
            mock_ox.projection.project_gdf.return_value = projected

            result = fetch_osm_data(-22.15018, -42.92185, 100, tags)

        assert result is not None
        # Deve ter sido armazenado no cache L1
        key = _cache_key(-22.15018, -42.92185, 100, tags, None)
        assert _get_cached(key) is not None

    def test_custom_crs_success_path(self):
        """CRS personalizado válido deve usar projeção do GDF real (to_crs é método do GeoDataFrame, não do módulo ox)."""
        from osmnx_client import fetch_osm_data

        non_empty = _non_empty_gdf(2)
        projected = non_empty.to_crs('EPSG:32723')  # UTM real

        tags = {'building': True}
        with patch('osmnx_client.ox') as mock_ox:
            mock_ox.features.features_from_point.return_value = non_empty
            mock_ox.projection.project_gdf.return_value = projected

            result = fetch_osm_data(-22.15018, -42.92185, 100, tags, crs='EPSG:32723')
        assert result is not None

    def test_custom_crs_failure_falls_back_to_auto(self):
        """Falha em to_crs (CRS inválido) deve usar project_gdf como fallback."""
        from osmnx_client import fetch_osm_data

        non_empty = _non_empty_gdf(2)
        fallback_gdf = _non_empty_gdf(2)

        tags = {'natural': True}
        with patch('osmnx_client.ox') as mock_ox:
            # to_crs lança exceção porque CRS 'EPSG:INVALIDO' não existe
            mock_ox.features.features_from_point.return_value = non_empty
            mock_ox.projection.project_gdf.return_value = fallback_gdf

            result = fetch_osm_data(-22.15018, -42.92185, 100, tags, crs='EPSG:INVALIDO')

        # O fallback project_gdf deve ter sido chamado
        assert result is not None
        mock_ox.projection.project_gdf.assert_called()


# ── OSError em clear_osm_cache ────────────────────────────────────────────────

class TestClearOsmCacheOsError:
    """Cobre linhas 106-109: OSError ao remover arquivo na limpeza."""

    def setup_method(self):
        import osmnx_client
        self.tmp_dir = _tmp_cache_dir()
        osmnx_client._OSM_CACHE_DIR = self.tmp_dir
        osmnx_client.clear_osm_cache()

    def teardown_method(self):
        import osmnx_client, shutil
        osmnx_client.clear_osm_cache()
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_oserror_on_remove_is_swallowed(self):
        """OSError ao remover arquivo de cache não deve propagar exceção."""
        import osmnx_client
        from osmnx_client import _set_disk_cache, clear_osm_cache, _cache_key

        key = _cache_key(-22.15018, -42.92185, 200, {'highway': True}, None)
        gdf = gpd.GeoDataFrame({'x': [1]})
        _set_disk_cache(key, gdf)

        with patch('osmnx_client.os.remove', side_effect=OSError("permission denied")):
            # Não deve lançar
            clear_osm_cache()

    def test_exception_in_listdir_is_swallowed(self):
        """Exceção em os.listdir dentro de clear_osm_cache deve ser capturada."""
        import osmnx_client
        with patch('osmnx_client.os.listdir', side_effect=Exception("io error")):
            # Não deve propagar
            osmnx_client.clear_osm_cache()


# ── OSError ao remover arquivo expirado em _get_disk_cached ──────────────────

class TestDiskCacheExpiredOsError:
    """Cobre linhas 77-78: OSError ao remover arquivo de cache expirado."""

    def setup_method(self):
        import osmnx_client
        self.tmp_dir = _tmp_cache_dir()
        osmnx_client._OSM_CACHE_DIR = self.tmp_dir
        osmnx_client.clear_osm_cache()

    def teardown_method(self):
        import osmnx_client, shutil
        osmnx_client.clear_osm_cache()
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_oserror_removing_expired_file_is_swallowed(self):
        """OSError ao tentar remover arquivo expirado deve ser ignorado."""
        from osmnx_client import _get_disk_cached, _disk_cache_path, _cache_key

        key = _cache_key(-22.15018, -42.92185, 300, {'waterway': True}, None)
        path = _disk_cache_path(key)
        os.makedirs(self.tmp_dir, exist_ok=True)

        # Grava entrada expirada
        with open(path, 'wb') as f:
            pickle.dump({'data': gpd.GeoDataFrame(), 'ts': time.time() - 7200}, f)

        with patch('osmnx_client.os.remove', side_effect=OSError("busy")):
            # Não deve lançar; deve retornar None
            result = _get_disk_cached(key)
        assert result is None
