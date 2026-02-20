"""
bim_data_attacher.py — BIM XDATA Attacher
Responsabilidade única: anexar metadados Half-way BIM a entidades DXF via XDATA.
DDD — Infrastructure/Adapter Layer.
"""
import numpy as np
import pandas as pd
from typing import Any

try:
    from utils.logger import Logger
except ImportError:
    from utils.logger import Logger

# Comprimento máximo de string XDATA: 255 chars (DXF spec), usamos 240 com margem
_MAX_XDATA_STR = 240
_BIM_APP_ID = 'SISRUA_BIM'


def attach_bim_data(entity, tags: Any) -> None:
    """
    Anexa metadados Half-way BIM a uma entidade DXF via XDATA.

    Args:
        entity: Entidade ezdxf que suporta set_xdata()
        tags:   dict ou Series com tags OSM da feature
    """
    if tags is None:
        return
    if hasattr(tags, 'empty') and tags.empty:
        return
    if not hasattr(tags, 'items'):
        return

    xdata = _build_xdata(tags)
    if not xdata:
        return

    try:
        entity.set_xdata(_BIM_APP_ID, xdata)
    except Exception as e:
        Logger.info(f"Falha ao anexar BIM XDATA: {e}")


def _build_xdata(tags: Any) -> list:
    """
    Constrói a lista de tuplas XDATA a partir das tags OSM.
    Filtra valores nulos e limita strings ao comprimento DXF.
    """
    xdata = []
    for k, v in tags.items():
        if v is None:
            continue
        try:
            if hasattr(pd, 'isna') and pd.isna(v):
                continue
        except (TypeError, ValueError):
            pass

        if k == 'geometry':
            continue

        # Resolver Series / listas para scalar
        val = v if np.isscalar(v) else (v[0] if hasattr(v, '__len__') and len(v) > 0 else None)
        if val is None:
            continue

        val_str = f"{k}={val}"[:_MAX_XDATA_STR]
        xdata.append((1000, val_str))

    return xdata
