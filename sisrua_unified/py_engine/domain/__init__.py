"""
domain package - módulos especializados de desenho DXF.

Exporta os drawers e o contexto compartilhado para uso externo.
"""
from .drawing_context import DrawingContext
from .geometry_drawer import GeometryDrawer
from .bt_drawer import BTDrawer
from .annotation_drawer import AnnotationDrawer
from .terrain_drawer import TerrainDrawer

__all__ = [
    "DrawingContext",
    "GeometryDrawer",
    "BTDrawer",
    "AnnotationDrawer",
    "TerrainDrawer",
]
