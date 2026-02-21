"""
test_styles_manager.py — FASE 37
Testes unitários para CADStylesManager (gerenciamento de estilos de camadas CAD).
"""
import json
import os
import sys
import tempfile

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from styles_manager import CADStylesManager


class TestCADStylesManagerInit:
    """Testes de inicialização do CADStylesManager."""

    def test_estilos_padrao_carregados_sem_template(self):
        manager = CADStylesManager()
        assert "layers" in manager.styles
        assert "sisTOPO_EDIFICACAO" in manager.styles["layers"]
        assert "sisTOPO_VIAS" in manager.styles["layers"]

    def test_template_path_none_usa_defaults(self):
        manager = CADStylesManager(template_path=None)
        assert manager.styles == CADStylesManager.DEFAULT_STYLES

    def test_template_inexistente_usa_defaults(self):
        manager = CADStylesManager(template_path="/nao/existe.json")
        assert manager.styles == CADStylesManager.DEFAULT_STYLES


class TestCADStylesManagerLoadTemplate:
    """Testes para carregamento de template JSON."""

    def test_carrega_template_valido(self, tmp_path):
        template = {
            "layers": {
                "MINHA_CAMADA_CUSTOM": {"color": 5, "linetype": "HIDDEN"}
            }
        }
        template_file = tmp_path / "styles.json"
        template_file.write_text(json.dumps(template), encoding="utf-8")

        manager = CADStylesManager(template_path=str(template_file))
        assert "MINHA_CAMADA_CUSTOM" in manager.styles["layers"]
        assert manager.styles["layers"]["MINHA_CAMADA_CUSTOM"]["color"] == 5

    def test_template_mescla_com_defaults(self, tmp_path):
        template = {
            "layers": {
                "CAMADA_NOVA": {"color": 3, "linetype": "CONTINUOUS"}
            }
        }
        template_file = tmp_path / "styles.json"
        template_file.write_text(json.dumps(template), encoding="utf-8")

        manager = CADStylesManager(template_path=str(template_file))
        # Deve manter defaults E adicionar camada nova
        assert "sisTOPO_EDIFICACAO" in manager.styles["layers"]
        assert "CAMADA_NOVA" in manager.styles["layers"]

    def test_load_template_json_invalido_nao_quebra(self, tmp_path):
        template_file = tmp_path / "invalido.json"
        template_file.write_text("{json inválido sem fechar", encoding="utf-8")

        # Não deve lançar exceção (deve logar erro e manter defaults)
        manager = CADStylesManager()
        manager.load_template(str(template_file))
        assert "layers" in manager.styles

    def test_load_template_sem_chave_layers(self, tmp_path):
        """Template sem 'layers' deve ser ignorado."""
        template = {"version": "1.0", "other_key": "value"}
        template_file = tmp_path / "sem_layers.json"
        template_file.write_text(json.dumps(template), encoding="utf-8")

        manager = CADStylesManager(template_path=str(template_file))
        # Defaults mantidos, nenhum erro
        assert "sisTOPO_VIAS" in manager.styles["layers"]


class TestCADStylesManagerApplyToGenerator:
    """Testes para apply_to_generator()."""

    def _make_mock_gen(self, existing_layers=None):
        """Cria um mock do DXFGenerator compatível com apply_to_generator."""
        from unittest.mock import MagicMock

        mock_layer = MagicMock()
        mock_layer.color = 7
        mock_layer.linetype = "CONTINUOUS"

        mock_layers = MagicMock()
        existing = existing_layers or []
        mock_layers.__contains__ = lambda self, name: name in existing
        mock_layers.get = lambda name: mock_layer
        mock_layers.new = MagicMock(return_value=mock_layer)

        mock_doc = MagicMock()
        mock_doc.layers = mock_layers

        mock_gen = MagicMock()
        mock_gen.doc = mock_doc
        return mock_gen, mock_layers

    def test_cria_camadas_novas_quando_nao_existem(self):
        manager = CADStylesManager()
        mock_gen, mock_layers = self._make_mock_gen(existing_layers=[])

        manager.apply_to_generator(mock_gen)

        assert mock_layers.new.called

    def test_atualiza_camadas_existentes(self):
        manager = CADStylesManager()
        # Simular que todas as camadas já existem
        all_layers = list(CADStylesManager.DEFAULT_STYLES["layers"].keys())
        mock_gen, mock_layers = self._make_mock_gen(existing_layers=all_layers)

        manager.apply_to_generator(mock_gen)

        # new() não deve ser chamado para camadas existentes
        assert not mock_layers.new.called

    def test_cores_aplicadas_corretamente(self):
        """Verificar que as cores dos estilos padrão são valores válidos de CAD (1-256)."""
        manager = CADStylesManager()
        for _, config in manager.styles["layers"].items():
            assert 1 <= config.get("color", 7) <= 256
