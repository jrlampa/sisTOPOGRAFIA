"""
test_external_api_adapters.py — FASE 37
Testes unitários para adaptadores de APIs externas com mocks HTTP.
Cobre: GroqAdapter, IBGEAdapter, INCRAAdapter, ICMBioApiAdapter, IneaApiAdapter.
"""
import sys
import os
import json
from unittest.mock import patch, MagicMock

import pytest
import geopandas as gpd
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_response(status_code=200, json_data=None, raise_exc=None):
    """Cria um mock de requests.Response."""
    mock = MagicMock()
    mock.status_code = status_code
    if raise_exc:
        mock.raise_for_status.side_effect = raise_exc
    else:
        mock.raise_for_status = MagicMock()
    mock.json.return_value = json_data or {}
    return mock


def _make_geojson_features(n=2):
    """GeoJSON FeatureCollection com n features Point simples."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-42.92 + i * 0.01, -22.15]},
                "properties": {
                    "nome": f"Marco-{i}",
                    "tipo_estacao": "SAT",
                    "altitude_ortometrica": 800.0 + i * 10,
                    "municipio": "Friburgo",
                    "situacao": "Ativo",
                },
            }
            for i in range(n)
        ],
    }


def _make_incra_features(n=2):
    """GeoJSON features para INCRA SIGEF."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-42.92 + i * 0.01, -22.15]},
                "properties": {
                    "codigo_parcela": f"RJ-{i:04d}",
                    "nome_detentor": f"Proprietário {i}",
                    "nome_imovel": f"Fazenda Exemplo {i}",
                    "area_hectares": 100.0 + i * 5,
                    "situacao_parcela": "Certificada",
                },
            }
            for i in range(n)
        ],
    }


# ── GroqAdapter ────────────────────────────────────────────────────────────────

class TestGroqAdapter:
    """Testes para infrastructure.external_api.groq_adapter.GroqAdapter."""

    def _get_adapter(self, api_key=None):
        from infrastructure.external_api.groq_adapter import GroqAdapter
        return GroqAdapter(api_key=api_key)

    def test_sem_api_key_retorna_sugestao_mock(self):
        """Sem API key, deve retornar a sugestão mock (hardcoded)."""
        adapter = self._get_adapter(api_key=None)
        # Garante que GROQ_API_KEY não está no env
        with patch.dict(os.environ, {}, clear=False):
            if "GROQ_API_KEY" in os.environ:  # pragma: no cover
                os.environ.pop("GROQ_API_KEY")
            adapter.api_key = None
            result = adapter.get_completion("Analisar terreno")
        assert isinstance(result, str)
        assert "Sugestões" in result or "MOCK" in result or "Drenagem" in result

    def test_mock_suggestion_retorna_string_nao_vazia(self):
        """_mock_suggestion deve retornar string com conteúdo."""
        adapter = self._get_adapter()
        result = adapter._mock_suggestion()
        assert isinstance(result, str)
        assert len(result) > 50

    def test_com_api_key_faz_request_http(self):
        """Com API key, deve chamar o endpoint Groq."""
        adapter = self._get_adapter(api_key="test-key-fake")
        mock_response = _make_response(
            json_data={
                "choices": [{"message": {"content": "Resposta da IA Groq"}}]
            }
        )
        with patch("infrastructure.external_api.groq_adapter.requests.post",
                   return_value=mock_response) as mock_post:
            result = adapter.get_completion("Analisar terreno")
        assert result == "Resposta da IA Groq"
        mock_post.assert_called_once()

    def test_erro_http_retorna_mensagem_de_erro(self):
        """Exceção HTTP deve retornar string com 'Erro'."""
        adapter = self._get_adapter(api_key="test-key-fake")
        with patch("infrastructure.external_api.groq_adapter.requests.post",
                   side_effect=requests.exceptions.ConnectionError("Conexão recusada")):
            result = adapter.get_completion("Prompt qualquer")
        assert "Erro" in result or "erro" in result

    def test_url_e_modelo_configurados(self):
        """URL e modelo devem estar definidos corretamente."""
        adapter = self._get_adapter(api_key="dummy")
        assert adapter.url.startswith("https://api.groq.com/")
        assert len(adapter.model) > 0

    def test_api_key_via_env(self):
        """Deve ler GROQ_API_KEY do ambiente quando não passada no construtor."""
        with patch.dict(os.environ, {"GROQ_API_KEY": "env-key-123"}):
            adapter = self._get_adapter(api_key=None)
        assert adapter.api_key == "env-key-123"


# ── IBGEAdapter ────────────────────────────────────────────────────────────────

class TestIBGEAdapter:
    """Testes para infrastructure.external_api.ibge_adapter.IBGEAdapter."""

    def _call(self, json_data=None, raise_exc=None, status_code=200):
        from infrastructure.external_api.ibge_adapter import IBGEAdapter
        mock_resp = _make_response(status_code, json_data, raise_exc)
        with patch("infrastructure.external_api.ibge_adapter.requests.get",
                   return_value=mock_resp):
            return IBGEAdapter.get_stations_nearby(-22.16, -42.93, -22.14, -42.91)

    def test_sucesso_retorna_lista_de_marcos(self):
        result = self._call(json_data=_make_geojson_features(2))
        assert isinstance(result, list)
        assert len(result) == 2

    def test_marco_tem_campos_normalizados(self):
        result = self._call(json_data=_make_geojson_features(1))
        marco = result[0]
        assert "id" in marco
        assert "lat" in marco
        assert "lon" in marco
        assert "altitude" in marco
        assert "municipio" in marco
        assert "situacao" in marco

    def test_sem_features_retorna_lista_vazia(self):
        result = self._call(json_data={"features": []})
        assert result == []

    def test_chave_features_ausente_retorna_lista_vazia(self):
        result = self._call(json_data={})
        assert result == []

    def test_erro_http_retorna_lista_vazia(self):
        from infrastructure.external_api.ibge_adapter import IBGEAdapter
        with patch("infrastructure.external_api.ibge_adapter.requests.get",
                   side_effect=requests.exceptions.Timeout("timeout")):
            result = IBGEAdapter.get_stations_nearby(-22.16, -42.93, -22.14, -42.91)
        assert result == []

    def test_raise_for_status_retorna_lista_vazia(self):
        result = self._call(
            status_code=500,
            raise_exc=requests.exceptions.HTTPError("500 Server Error"),
        )
        assert result == []


# ── INCRAAdapter ───────────────────────────────────────────────────────────────

class TestINCRAAdapter:
    """Testes para infrastructure.external_api.incra_adapter.INCRAAdapter."""

    def _call(self, json_data=None, raise_exc=None, status_code=200):
        from infrastructure.external_api.incra_adapter import INCRAAdapter
        mock_resp = _make_response(status_code, json_data, raise_exc)
        with patch("infrastructure.external_api.incra_adapter.requests.get",
                   return_value=mock_resp):
            return INCRAAdapter.get_parcels_nearby(-22.16, -42.93, -22.14, -42.91)

    def test_sucesso_retorna_lista_de_parcelas(self):
        result = self._call(json_data=_make_incra_features(3))
        assert isinstance(result, list)
        assert len(result) == 3

    def test_parcela_tem_campos_normalizados(self):
        result = self._call(json_data=_make_incra_features(1))
        parcela = result[0]
        assert "id" in parcela
        assert "detentor" in parcela
        assert "imovel" in parcela
        assert "area_ha" in parcela
        assert "situacao" in parcela
        assert "geometria" in parcela

    def test_sem_features_retorna_lista_vazia(self):
        result = self._call(json_data={"features": []})
        assert result == []

    def test_chave_features_ausente_retorna_lista_vazia(self):
        result = self._call(json_data={})
        assert result == []

    def test_timeout_retorna_lista_vazia(self):
        from infrastructure.external_api.incra_adapter import INCRAAdapter
        with patch("infrastructure.external_api.incra_adapter.requests.get",
                   side_effect=requests.exceptions.Timeout("timeout INCRA")):
            result = INCRAAdapter.get_parcels_nearby(-22.16, -42.93, -22.14, -42.91)
        assert result == []

    def test_http_error_retorna_lista_vazia(self):
        result = self._call(
            status_code=503,
            raise_exc=requests.exceptions.HTTPError("503"),
        )
        assert result == []


# ── ICMBioApiAdapter ──────────────────────────────────────────────────────────

class TestICMBioApiAdapter:
    """Testes para infrastructure.adapters.icmbio_api_adapter.ICMBioApiAdapter."""

    def _make_uc_features(self):
        return {
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [[-42.93, -22.16], [-42.91, -22.16],
                             [-42.91, -22.14], [-42.93, -22.14], [-42.93, -22.16]]
                        ]
                    },
                    "properties": {"nome": "APA Macaé de Cima"},
                }
            ]
        }

    def test_sucesso_retorna_geodataframe(self):
        from infrastructure.adapters.icmbio_api_adapter import ICMBioApiAdapter
        mock_resp = _make_response(json_data=self._make_uc_features())
        with patch("infrastructure.adapters.icmbio_api_adapter.requests.get",
                   return_value=mock_resp):
            result = ICMBioApiAdapter.fetch_uc_federal(-43.0, -22.2, -42.9, -22.1)
        assert result is not None
        assert isinstance(result, gpd.GeoDataFrame)
        assert "sisTOPO_type" in result.columns
        assert result.iloc[0]["sisTOPO_type"] == "UC_FEDERAL"

    def test_sem_features_retorna_geodataframe_vazio(self):
        from infrastructure.adapters.icmbio_api_adapter import ICMBioApiAdapter
        mock_resp = _make_response(json_data={"features": []})
        with patch("infrastructure.adapters.icmbio_api_adapter.requests.get",
                   return_value=mock_resp):
            result = ICMBioApiAdapter.fetch_uc_federal(-43.0, -22.2, -42.9, -22.1)
        assert isinstance(result, gpd.GeoDataFrame)
        assert result.empty

    def test_sem_chave_features_retorna_geodataframe_vazio(self):
        from infrastructure.adapters.icmbio_api_adapter import ICMBioApiAdapter
        mock_resp = _make_response(json_data={})
        with patch("infrastructure.adapters.icmbio_api_adapter.requests.get",
                   return_value=mock_resp):
            result = ICMBioApiAdapter.fetch_uc_federal(-43.0, -22.2, -42.9, -22.1)
        assert isinstance(result, gpd.GeoDataFrame)
        assert result.empty

    def test_parse_error_retorna_none(self):
        from infrastructure.adapters.icmbio_api_adapter import ICMBioApiAdapter
        mock_resp = _make_response(json_data=None)
        mock_resp.json.side_effect = ValueError("JSON inválido")
        with patch("infrastructure.adapters.icmbio_api_adapter.requests.get",
                   return_value=mock_resp):
            result = ICMBioApiAdapter.fetch_uc_federal(-43.0, -22.2, -42.9, -22.1)
        assert result is None


# ── IneaApiAdapter ─────────────────────────────────────────────────────────────

class TestIneaApiAdapter:
    """Testes para infrastructure.adapters.inea_api_adapter.IneaApiAdapter."""

    BBOX_RJ = (-43.5, -23.0, -41.0, -22.0)
    BBOX_FORA_RJ = (-48.0, -30.0, -47.0, -29.0)

    def _make_uc_features(self):
        return {
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [[-42.0, -22.5], [-41.9, -22.5],
                             [-41.9, -22.4], [-42.0, -22.4], [-42.0, -22.5]]
                        ]
                    },
                    "properties": {"nome": "Parque Estadual dos Três Picos"},
                }
            ]
        }

    def test_fora_de_rj_retorna_geodataframe_vazio_sem_request(self):
        """Para bbox fora do RJ, deve retornar GDF vazio sem fazer request HTTP."""
        from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
        min_lon, min_lat, max_lon, max_lat = self.BBOX_FORA_RJ
        with patch("infrastructure.adapters.inea_api_adapter.requests.get") as mock_get:
            result = IneaApiAdapter.fetch_uc_estadual(min_lon, min_lat, max_lon, max_lat)
        assert isinstance(result, gpd.GeoDataFrame)
        assert result.empty
        mock_get.assert_not_called()

    def test_dentro_rj_sucesso_retorna_geodataframe(self):
        from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
        mock_resp = _make_response(json_data=self._make_uc_features())
        min_lon, min_lat, max_lon, max_lat = self.BBOX_RJ
        with patch("infrastructure.adapters.inea_api_adapter.requests.get",
                   return_value=mock_resp):
            result = IneaApiAdapter.fetch_uc_estadual(min_lon, min_lat, max_lon, max_lat)
        assert isinstance(result, gpd.GeoDataFrame)
        assert "sisTOPO_type" in result.columns

    def test_dentro_rj_sem_features_retorna_vazio(self):
        from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
        mock_resp = _make_response(json_data={"features": []})
        min_lon, min_lat, max_lon, max_lat = self.BBOX_RJ
        with patch("infrastructure.adapters.inea_api_adapter.requests.get",
                   return_value=mock_resp):
            result = IneaApiAdapter.fetch_uc_estadual(min_lon, min_lat, max_lon, max_lat)
        assert isinstance(result, gpd.GeoDataFrame)
        assert result.empty

    def test_dentro_rj_status_nao_200_retorna_none(self):
        """Status != 200 deve retornar None (fallback gracioso)."""
        from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
        mock_resp = _make_response(status_code=503, json_data=None)
        mock_resp.raise_for_status = MagicMock()  # não lança; apenas status 503
        min_lon, min_lat, max_lon, max_lat = self.BBOX_RJ
        with patch("infrastructure.adapters.inea_api_adapter.requests.get",
                   return_value=mock_resp):
            result = IneaApiAdapter.fetch_uc_estadual(min_lon, min_lat, max_lon, max_lat)
        assert result is None

    def test_dentro_rj_parse_error_retorna_none(self):
        from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
        mock_resp = _make_response(json_data=None)
        mock_resp.json.side_effect = ValueError("JSON inválido")
        min_lon, min_lat, max_lon, max_lat = self.BBOX_RJ
        with patch("infrastructure.adapters.inea_api_adapter.requests.get",
                   return_value=mock_resp):
            result = IneaApiAdapter.fetch_uc_estadual(min_lon, min_lat, max_lon, max_lat)
        assert result is None

    def test_is_in_rj_bbox_correto(self):
        """_is_in_rj deve retornar True para bbox dentro do RJ."""
        from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
        assert IneaApiAdapter._is_in_rj(-43.5, -23.0, -41.0, -22.0) is True
        assert IneaApiAdapter._is_in_rj(-48.0, -30.0, -47.0, -29.0) is False
