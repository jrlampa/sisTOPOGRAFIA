"""
DXFGenerator — Orquestrador principal DXF 2.5D.

Compõe via herança múltipla (mixins):
  - GeometriaUtilsMixin  → utilitários matemáticos/validação
  - GeometriaMixin       → features OSM, camadas, terreno
  - BtTopologiaMixin     → topologia BT (postes/trechos/trafos)
  - ApresentacaoMixin    → legenda, carimbo, quadro BT (Half-way BIM)

Esta classe é o único ponto de entrada público — a API é idêntica ao monolito original.
Refatoração Item 1 do Roadmap T1: Modularização de Monólitos Python.
"""
import os

import ezdxf

try:
    from ..dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from dxf_styles import DXFStyleManager

try:
    from ..utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

from .core.geometria_utils import GeometriaUtilsMixin
from .core.geometria import GeometriaMixin
from .core.bt_topologia import BtTopologiaMixin
from .core.mt_topologia import MtTopologiaMixin
from .core.apresentacao import ApresentacaoMixin


class DXFGenerator(GeometriaUtilsMixin, GeometriaMixin, BtTopologiaMixin, MtTopologiaMixin, ApresentacaoMixin):
    """
    Gerador de arquivos DXF 2.5D para projetos de engenharia (sisTOPOGRAFIA).

    Responsabilidade: orquestrar submódulos de geometria, BT e apresentação.
    Toda lógica de domínio reside nos mixins especializados.
    """

    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new("R2013")
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]
        self.mt_context: dict = {}

        # Padrões CAD via StyleManager (SRP)
        DXFStyleManager.setup_all(self.doc)

        self.msp = self.doc.modelspace()
        self.project_info = {}
        self.bt_context = {}
        self._offset_initialized = False
        self._street_label_registry = {}
        self._used_label_points = []

    def save(self):
        """Finaliza e salva o arquivo DXF após adicionar todos os elementos."""
        initial_entities = self._count_modelspace_entities()
        if initial_entities <= 0:
            raise RuntimeError("Exportação DXF abortada: model space sem entidades")

        try:
            self._run_finalize_step("legenda", self.add_legend)
            self._run_finalize_step("quadro_bt", self.add_bt_summary)
            self._run_finalize_step(
                "carimbo",
                lambda: self.add_title_block(
                    client=self.project_info.get("client", "CLIENTE PADRÃO"),
                    project=self.project_info.get("project", "EXTRAÇÃO ESPACIAL OSM"),
                ),
            )

            self.doc.saveas(self.filename)
            final_entities = self._count_modelspace_entities()
            output_size = os.path.getsize(self.filename)

            if final_entities <= 0:
                raise RuntimeError("DXF salvo sem entidades no model space")
            if output_size <= 0:
                raise RuntimeError("DXF salvo com tamanho zero")

            Logger.info(
                f"DXF salvo com sucesso: {os.path.basename(self.filename)} "
                f"({final_entities} entidades, {output_size} bytes)"
            )
        except Exception as e:
            Logger.error(f"Erro ao salvar DXF: {e}")
            raise
