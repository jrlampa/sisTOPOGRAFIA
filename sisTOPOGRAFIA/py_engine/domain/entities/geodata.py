from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import numpy as np

@dataclass
class Point3D:
    x: float
    y: float
    z: float

@dataclass
class TerrainGrid:
    points: np.ndarray  # (rows, cols, 3) where [r,c] = [x,y,z]
    
    @property
    def z_values(self) -> np.ndarray:
        return self.points[:, :, 2]
    
    @property
    def shape(self):
        return self.points.shape[:2]

@dataclass
class GeoFeature:
    id: str
    geometry: Any
    properties: Dict[str, Any]
    tags: Dict[str, Any]
