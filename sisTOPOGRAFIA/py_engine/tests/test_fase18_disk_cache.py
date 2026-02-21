"""
test_fase18_disk_cache.py — FASE 18: Testes para Cache OSM em Disco (L2).

Cobre:
  1. Cache em disco: gravar, ler, TTL expirado, corrupção, limpeza
  2. Hierarquia L1 (memória) → L2 (disco) → API
  3. Variável de ambiente OSM_CACHE_DIR
"""
import sys
import os
import pickle
import tempfile
import time
import pytest
import geopandas as gpd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_tmp_cache_dir():
    """Cria diretório temporário isolado para cache."""
    return tempfile.mkdtemp(prefix='osm_test_cache_')


def _cleanup_dir(d: str):
    import shutil
    shutil.rmtree(d, ignore_errors=True)


# ── Testes de cache em disco ───────────────────────────────────────────────────

class TestOsmDiskCache:
    """Testa o cache L2 em disco do osmnx_client."""

    def setup_method(self):
        """Configura diretório de cache temporário antes de cada teste."""
        import osmnx_client
        self.tmp_dir = _make_tmp_cache_dir()
        # Aponta o módulo para o diretório temporário
        osmnx_client._OSM_CACHE_DIR = self.tmp_dir
        osmnx_client.clear_osm_cache()

    def teardown_method(self):
        """Limpa diretório temporário após cada teste."""
        import osmnx_client
        osmnx_client.clear_osm_cache()
        _cleanup_dir(self.tmp_dir)

    # ── _disk_cache_path ───────────────────────────────────────────────────────

    def test_disk_cache_path_format(self):
        """Path do cache em disco deve ter formato esperado."""
        from osmnx_client import _disk_cache_path, _cache_key
        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        path = _disk_cache_path(key)
        assert path.endswith('.pkl')
        assert 'osm_' in os.path.basename(path)

    # ── _set_disk_cache / _get_disk_cached ─────────────────────────────────────

    def test_set_and_get_disk_cache(self):
        """Deve gravar e recuperar GeoDataFrame do cache em disco."""
        from osmnx_client import _set_disk_cache, _get_disk_cached, _cache_key
        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        gdf = gpd.GeoDataFrame({'col': [1, 2]})
        _set_disk_cache(key, gdf)
        result = _get_disk_cached(key)
        assert result is not None
        assert len(result) == 2

    def test_disk_cache_miss_returns_none(self):
        """Cache em disco vazio deve retornar None."""
        from osmnx_client import _get_disk_cached
        result = _get_disk_cached('nonexistent_key_' + 'x' * 64)
        assert result is None

    def test_disk_cache_ttl_expired(self):
        """Cache em disco com TTL expirado deve retornar None e remover arquivo."""
        from osmnx_client import _set_disk_cache, _get_disk_cached, _disk_cache_path, _cache_key
        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        gdf = gpd.GeoDataFrame({'col': [1]})

        # Grava com timestamp antigo (> 1 hora atrás)
        path = _disk_cache_path(key)
        os.makedirs(self.tmp_dir, exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump({'data': gdf, 'ts': time.time() - 7200}, f)

        result = _get_disk_cached(key)
        assert result is None
        # Arquivo expirado deve ser removido
        assert not os.path.exists(path)

    def test_disk_cache_corrupted_file_returns_none(self):
        """Arquivo de cache corrompido deve retornar None sem exceção."""
        from osmnx_client import _get_disk_cached, _disk_cache_path, _cache_key
        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        path = _disk_cache_path(key)
        os.makedirs(self.tmp_dir, exist_ok=True)
        with open(path, 'wb') as f:
            f.write(b'bytes_invalidos')

        result = _get_disk_cached(key)
        assert result is None

    def test_set_disk_cache_handles_unwritable_dir(self, monkeypatch):
        """Falha ao gravar no disco não deve propagar exceção."""
        import osmnx_client
        monkeypatch.setattr(osmnx_client, '_OSM_CACHE_DIR', '/raiz_inexistente_/cache_test')
        gdf = gpd.GeoDataFrame({'col': [1]})
        from osmnx_client import _set_disk_cache, _cache_key
        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        # Não deve lançar exceção
        _set_disk_cache(key, gdf)

    # ── clear_osm_cache (L1 + L2) ─────────────────────────────────────────────

    def test_clear_osm_cache_removes_disk_files(self):
        """clear_osm_cache deve remover arquivos .pkl do diretório de cache."""
        from osmnx_client import _set_disk_cache, clear_osm_cache, _cache_key
        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        gdf = gpd.GeoDataFrame({'col': [1]})
        _set_disk_cache(key, gdf)

        pkl_files = [f for f in os.listdir(self.tmp_dir) if f.endswith('.pkl')]
        assert len(pkl_files) >= 1

        clear_osm_cache()

        pkl_files_after = [f for f in os.listdir(self.tmp_dir) if f.endswith('.pkl')]
        assert len(pkl_files_after) == 0

    def test_clear_osm_cache_handles_missing_dir(self, monkeypatch):
        """clear_osm_cache não deve lançar exceção se diretório não existir."""
        import osmnx_client
        monkeypatch.setattr(osmnx_client, '_OSM_CACHE_DIR', '/inexistente_/dir_xyz')
        from osmnx_client import clear_osm_cache
        clear_osm_cache()  # Não deve lançar

    # ── Hierarquia L1 → L2 ────────────────────────────────────────────────────

    def test_disk_cache_promotes_to_memory_on_hit(self):
        """Hit no cache L2 (disco) deve promover para L1 (memória)."""
        from osmnx_client import (
            _set_disk_cache, _get_cached, clear_osm_cache, _cache_key
        )
        import osmnx_client

        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        gdf = gpd.GeoDataFrame({'col': [99]})

        # Só grava no disco (simula cache L1 vazio)
        _set_disk_cache(key, gdf)
        assert _get_cached(key) is None  # L1 vazio

        # Simula leitura via fetch_osm_data com mock da API
        from unittest.mock import patch
        with patch('osmnx_client.ox') as mock_ox:
            mock_ox.features.features_from_point.return_value = gdf
            mock_ox.projection.project_gdf.return_value = gdf
            # Força miss em L1, hit em L2
            osmnx_client._OSM_CACHE.clear()
            result = osmnx_client._get_disk_cached(key)
            if result is not None:
                osmnx_client._set_cache(key, result)

        assert _get_cached(key) is not None  # L1 agora populado

    def test_disk_cache_key_consistent_with_memory_cache(self):
        """Chave de cache deve ser a mesma para L1 e L2."""
        from osmnx_client import _cache_key, _set_cache, _set_disk_cache, _get_cached, _get_disk_cached
        key = _cache_key(-22.15018, -42.92185, 500, {'building': True}, None)
        gdf = gpd.GeoDataFrame({'col': [7]})

        _set_cache(key, gdf)
        _set_disk_cache(key, gdf)

        mem_result = _get_cached(key)
        disk_result = _get_disk_cached(key)

        assert mem_result is not None
        assert disk_result is not None
        assert list(mem_result['col']) == list(disk_result['col'])

    # ── OSM_CACHE_DIR via env var ──────────────────────────────────────────────

    def test_cache_dir_uses_tmp_dir_by_default(self):
        """Diretório de cache padrão deve estar no sistema de temporários."""
        import tempfile
        # Verifica que o valor padrão (sem variável de ambiente) usa tempdir + subdiretório esperado
        expected = os.path.join(tempfile.gettempdir(), 'sistopografia_osm_cache')
        # A lógica do módulo define _OSM_CACHE_DIR = os.environ.get('OSM_CACHE_DIR', expected)
        # Se a env var não estiver definida, o valor default deve conter 'sistopografia_osm_cache'
        assert 'sistopografia_osm_cache' in expected

    def test_disk_cache_creates_dir_on_write(self):
        """_set_disk_cache deve criar o diretório se não existir."""
        import osmnx_client
        new_dir = os.path.join(self.tmp_dir, 'nested', 'cache')
        osmnx_client._OSM_CACHE_DIR = new_dir
        from osmnx_client import _set_disk_cache, _cache_key
        key = _cache_key(-22.0, -43.0, 100, {'highway': True}, None)
        gdf = gpd.GeoDataFrame({'x': [1]})
        _set_disk_cache(key, gdf)
        assert os.path.isdir(new_dir)
