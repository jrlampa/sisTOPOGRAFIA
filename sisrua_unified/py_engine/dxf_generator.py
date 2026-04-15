"""
dxf_generator.py — Shim de compatibilidade retroativa.

AVISO: Este arquivo é apenas um wrapper. A implementação real foi modularizada em:
  py_engine/dxf/core/geometria_utils.py  → Utilitários matemáticos/validação
  py_engine/dxf/core/geometria.py        → Desenho de features OSM, camadas, terreno
  py_engine/dxf/core/bt_topologia.py     → Topologia BT (postes/trechos/transformadores)
  py_engine/dxf/core/apresentacao.py     → Legenda, carimbo A3 e quadro BT (Half-way BIM)
  py_engine/dxf/generator.py             → DXFGenerator orquestrador (thin coordinator)

Refatoração: Item 1 do Roadmap T1 — Modularização de Monólitos Python.
Hard Limit de 600 linhas respeitado em todos os submódulos.

Compatibilidade: Todos os importadores existentes (`from dxf_generator import DXFGenerator`)
continuam funcionando sem alteração.
"""

# Re-exporta DXFGenerator do novo pacote modular
from dxf.generator import DXFGenerator  # noqa: F401

__all__ = ["DXFGenerator"]
