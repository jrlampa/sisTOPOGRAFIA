export interface PoleCatalogEntry {
  id: number;
  poleId: string;
  displayName: string;
  material: string;
  poleType: string;
  heightM: number;
  nominalEffortDan: number;
  isActive: boolean;
}

interface PoleCatalogResponse {
  id: number | string;
  pole_id: string;
  display_name: string;
  material: string;
  pole_type: string;
  height_m: number;
  nominal_effort_dan: number;
  is_active: boolean;
}

const mapRow = (row: PoleCatalogResponse): PoleCatalogEntry => ({
  id: Number(row.id),
  poleId: row.pole_id,
  displayName: row.display_name,
  material: row.material,
  poleType: row.pole_type,
  heightM: Number(row.height_m),
  nominalEffortDan: Number(row.nominal_effort_dan),
  isActive: row.is_active,
});

export async function listActivePoles(): Promise<PoleCatalogEntry[]> {
  try {
    const response = await fetch('/api/catalog/poles');
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      items?: PoleCatalogResponse[];
    };

    return (payload.items ?? []).map(mapRow);
  } catch {
    return [];
  }
}
