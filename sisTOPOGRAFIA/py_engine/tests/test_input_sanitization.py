"""
test_input_sanitization.py — Testes de sanitização de entradas do motor Python.
Garante que coordenadas inválidas ou perigosas são rejeitadas antes do processamento.
Segue a regra: "Sanitar dados" do memory.md.
"""
import math
import pytest
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.geo import validate_coordinates, utm_zone, sirgas2000_utm_epsg


class TestValidateCoordinates:
    """Testa validate_coordinates() — defesa em profundidade no motor Python."""

    # ── Entradas válidas ──────────────────────────────────────────────────────

    def test_coordenadas_teste_padrao_100m(self):
        """Coordenada de teste padrão: -22.15018, -42.92185, raio 100m."""
        validate_coordinates(-22.15018, -42.92185, 100)  # Não deve lançar

    def test_coordenadas_teste_padrao_500m(self):
        """Coordenada de teste padrão: -22.15018, -42.92185, raio 500m."""
        validate_coordinates(-22.15018, -42.92185, 500)  # Não deve lançar

    def test_coordenadas_teste_padrao_1km(self):
        """Coordenada de teste padrão: -22.15018, -42.92185, raio 1000m."""
        validate_coordinates(-22.15018, -42.92185, 1000)  # Não deve lançar

    def test_raio_minimo_valido(self):
        validate_coordinates(-22.15018, -42.92185, 0.001)  # Deve aceitar qualquer positivo

    def test_raio_maximo_valido(self):
        validate_coordinates(0, 0, 10000)  # Limite superior

    def test_coordenadas_extremas_polo_sul(self):
        validate_coordinates(-90, 0, 100)

    def test_coordenadas_extremas_polo_norte(self):
        validate_coordinates(90, 0, 100)

    def test_coordenadas_extremas_antimeridiano(self):
        validate_coordinates(0, -180, 100)
        validate_coordinates(0, 180, 100)

    def test_equador_meridiano_zero(self):
        validate_coordinates(0, 0, 500)

    # ── Latitudes inválidas ───────────────────────────────────────────────────

    def test_latitude_acima_de_90_deve_falhar(self):
        with pytest.raises(ValueError, match="Latitude"):
            validate_coordinates(90.001, -42.92185, 100)

    def test_latitude_abaixo_de_menos_90_deve_falhar(self):
        with pytest.raises(ValueError, match="Latitude"):
            validate_coordinates(-90.001, -42.92185, 100)

    def test_latitude_nan_deve_falhar(self):
        with pytest.raises(ValueError, match="Latitude"):
            validate_coordinates(float('nan'), -42.92185, 100)

    def test_latitude_inf_deve_falhar(self):
        with pytest.raises(ValueError, match="Latitude"):
            validate_coordinates(float('inf'), -42.92185, 100)

    # ── Longitudes inválidas ──────────────────────────────────────────────────

    def test_longitude_acima_de_180_deve_falhar(self):
        with pytest.raises(ValueError, match="Longitude"):
            validate_coordinates(-22.15018, 180.001, 100)

    def test_longitude_abaixo_de_menos_180_deve_falhar(self):
        with pytest.raises(ValueError, match="Longitude"):
            validate_coordinates(-22.15018, -180.001, 100)

    def test_longitude_nan_deve_falhar(self):
        with pytest.raises(ValueError, match="Longitude"):
            validate_coordinates(-22.15018, float('nan'), 100)

    def test_longitude_inf_deve_falhar(self):
        with pytest.raises(ValueError, match="Longitude"):
            validate_coordinates(-22.15018, float('-inf'), 100)

    # ── Raios inválidos ───────────────────────────────────────────────────────

    def test_raio_zero_deve_falhar(self):
        with pytest.raises(ValueError, match="Raio"):
            validate_coordinates(-22.15018, -42.92185, 0)

    def test_raio_negativo_deve_falhar(self):
        with pytest.raises(ValueError, match="Raio"):
            validate_coordinates(-22.15018, -42.92185, -100)

    def test_raio_excessivo_deve_falhar(self):
        with pytest.raises(ValueError, match="Raio excessivo"):
            validate_coordinates(-22.15018, -42.92185, 10001)

    def test_raio_nan_deve_falhar(self):
        with pytest.raises(ValueError, match="Raio"):
            validate_coordinates(-22.15018, -42.92185, float('nan'))

    def test_raio_inf_deve_falhar(self):
        with pytest.raises(ValueError, match="Raio"):
            validate_coordinates(-22.15018, -42.92185, float('inf'))


class TestUtmZone:
    """Testa utm_zone() — derivação de zona UTM a partir de longitude."""

    def test_brasil_zona_23(self):
        """Longitude -42.92185 deve estar na zona 23."""
        assert utm_zone(-42.92185) == 23

    def test_zona_1_minima(self):
        assert utm_zone(-180) == 1

    def test_zona_60_maxima(self):
        assert utm_zone(180) == 60

    def test_meridiano_zero(self):
        assert utm_zone(0) == 31


class TestSirgas2000Epsg:
    """Testa sirgas2000_utm_epsg() — EPSG correto para coordenadas brasileiras."""

    def test_coordenadas_teste_padrao_retornam_31983(self):
        """Zona 23S (Brasil central/sul-sudeste) → EPSG:31983."""
        epsg = sirgas2000_utm_epsg(-22.15018, -42.92185)
        assert epsg == 31983

    def test_hemisferio_norte_retorna_epsg_adequado(self):
        epsg = sirgas2000_utm_epsg(5.0, -60.0)
        assert epsg > 31970  # Norte do Brasil

    def test_hemisferio_sul_retorna_epsg_adequado(self):
        epsg = sirgas2000_utm_epsg(-22.0, -43.0)
        assert 31960 < epsg < 31990
