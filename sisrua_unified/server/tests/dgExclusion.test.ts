import { buildMst } from "../services/dg/dgPartitioner";
import { type DgExclusionPolygon } from "../services/dg/dgTypes";

describe("DG Partitioner — Exclusion Zones", () => {
  it("MST deve desviar de zonas de exclusão (prédios)", () => {
    // P1 no (0,0), P2 no (100,0).
    // Prédio no meio: (40,-10) até (60,10)
    // Se ligar direto P1-P2, cruza o prédio.
    // Se colocarmos um poste intermediário P3 no (50, 50), 
    // o MST deve preferir P1-P3-P2 se a zona de exclusão bloquear P1-P2.

    const poles = [
      { id: "P1", positionUtm: { x: 0, y: 0 } },
      { id: "P2", positionUtm: { x: 100, y: 0 } },
      { id: "P3", positionUtm: { x: 50, y: 50 } },
    ];
    const trafoUtm = { x: -10, y: 0 }; // Trafo perto do P1

    const exclusionPolygons: DgExclusionPolygon[] = [
      {
        id: "BUILDING_1",
        points: [
          { lat: 0, lon: 0 }, // Serão convertidos para UTM no teste simplificado 
          // mas o buildMst usa isEdgeCrossingExclusionZone que converte latlon.
          // Para o teste funcionar sem mock de proj4, vou precisar que 
          // as coordenadas latlon batam com o que o isEdgeCrossingExclusionZone espera.
        ]
      }
    ];

    // Na verdade, vou mockar o isEdgeCrossingExclusionZone ou 
    // usar coordenadas que façam sentido.
  });
});
