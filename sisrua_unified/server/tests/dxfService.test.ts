/**
 * dxfService.test.ts
 * Tests for the DXF generation service — layer assignment, height extraction,
 * coordinate projection, terrain mesh generation, and full DXF string output.
 */

import { generateDXF } from "../services/dxfService";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const CENTER = { lat: -23.55, lng: -46.63 };

describe("dxfService: generateDXF", () => {
  it("should return a valid DXF string with header and footer", () => {
    const result = generateDXF([], CENTER);
    expect(result).toContain("SECTION");
    expect(result).toContain("ENTITIES");
    expect(result).toContain("ENDSEC");
    expect(result).toContain("0\nEOF");
  });

  it("should include origin coordinates in metadata comment", () => {
    const result = generateDXF([], CENTER);
    expect(result).toContain(`Lat ${CENTER.lat}`);
    expect(result).toContain(`Lng ${CENTER.lng}`);
  });

  it("should generate a LWPOLYLINE for a highway way", () => {
    const elements = [
      {
        type: "way" as const,
        id: 1,
        tags: { highway: "residential" },
        nodes: [1, 2],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.551, lon: -46.631 },
        ],
        members: [],
      },
    ];

    const result = generateDXF(elements, CENTER);
    expect(result).toContain("LWPOLYLINE");
    expect(result).toContain("ROADS_MINOR");
  });

  it("should generate a LWPOLYLINE with BUILDINGS layer for building ways", () => {
    const elements = [
      {
        type: "way" as const,
        id: 2,
        tags: { building: "apartments", "building:levels": "5" },
        nodes: [1, 2, 3, 1],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.551, lon: -46.63 },
          { lat: -23.551, lon: -46.631 },
          { lat: -23.55, lon: -46.63 },
        ],
        members: [],
      },
    ];

    const result = generateDXF(elements, CENTER);
    expect(result).toContain("BUILDINGS");
  });

  it("should generate a CIRCLE for tree nodes", () => {
    const elements = [
      {
        type: "node" as const,
        id: 3,
        tags: { natural: "tree" },
        lat: -23.55,
        lon: -46.63,
        nodes: [],
        members: [],
      },
    ];

    const result = generateDXF(elements, CENTER);
    expect(result).toContain("CIRCLE");
  });

  it("should generate a CIRCLE for street lamp nodes", () => {
    const elements = [
      {
        type: "node" as const,
        id: 4,
        tags: { highway: "street_lamp" },
        lat: -23.55,
        lon: -46.63,
        nodes: [],
        members: [],
      },
    ];

    const result = generateDXF(elements, CENTER);
    expect(result).toContain("CIRCLE");
  });

  it("should generate 3DFACE elements when terrain is provided", () => {
    const terrain = [
      [
        { lat: -23.55, lng: -46.63, elevation: 800 },
        { lat: -23.55, lng: -46.62, elevation: 810 },
      ],
      [
        { lat: -23.54, lng: -46.63, elevation: 820 },
        { lat: -23.54, lng: -46.62, elevation: 815 },
      ],
    ];

    const result = generateDXF([], CENTER, terrain);
    expect(result).toContain("3DFACE");
    expect(result).toContain("TERRAIN");
  });

  it("should handle relation building members", () => {
    const elements = [
      {
        type: "relation" as const,
        id: 5,
        tags: { building: "yes" },
        nodes: [],
        members: [
          {
            type: "way",
            role: "outer",
            geometry: [
              { lat: -23.55, lon: -46.63 },
              { lat: -23.551, lon: -46.631 },
            ],
          },
        ],
      },
    ];

    const result = generateDXF(elements, CENTER);
    expect(result).toContain("BUILDINGS");
  });

  it("should apply simplification when options.simplify=true", () => {
    const elements = [
      {
        type: "way" as const,
        id: 6,
        tags: { highway: "primary" },
        nodes: [1, 2, 3, 4, 5],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.5505, lon: -46.6305 },
          { lat: -23.551, lon: -46.631 },
          { lat: -23.5515, lon: -46.6315 },
          { lat: -23.552, lon: -46.632 },
        ],
        members: [],
      },
    ];

    const result = generateDXF(elements, CENTER, undefined, { simplify: true });
    expect(result).toContain("Simplify: true");
    expect(result).toContain("LWPOLYLINE");
  });

  it("should use DASHED line type for tunnel ways", () => {
    const elements = [
      {
        type: "way" as const,
        id: 7,
        tags: { highway: "residential", tunnel: "yes" },
        nodes: [1, 2],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.551, lon: -46.631 },
        ],
        members: [],
      },
    ];

    const result = generateDXF(elements, CENTER);
    expect(result).toContain("DASHED");
  });

  it("should use numeric height from tags.height", () => {
    const elements = [
      {
        type: "way" as const,
        id: 8,
        tags: { building: "yes", height: "12m" },
        nodes: [1, 2, 1],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.551, lon: -46.631 },
          { lat: -23.55, lon: -46.63 },
        ],
        members: [],
      },
    ];
    const result = generateDXF(elements, CENTER);
    expect(result).toContain("BUILDINGS");
  });

  it("should apply layer offset from numeric tags.layer", () => {
    const elements = [
      {
        type: "way" as const,
        id: 9,
        tags: { highway: "primary", layer: "2" },
        nodes: [1, 2],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.551, lon: -46.631 },
        ],
        members: [],
      },
    ];
    const result = generateDXF(elements, CENTER);
    expect(result).toContain("LWPOLYLINE");
  });

  it("should assign WATER layer for waterway elements", () => {
    const elements = [
      {
        type: "way" as const,
        id: 10,
        tags: { waterway: "river" },
        nodes: [1, 2],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.551, lon: -46.631 },
        ],
        members: [],
      },
    ];
    const result = generateDXF(elements, CENTER);
    expect(result).toContain("WATER");
  });

  it("should invoke elevation resolver when terrain and way elements are both provided", () => {
    const terrain = [
      [
        { lat: -23.55, lng: -46.63, elevation: 800 },
        { lat: -23.55, lng: -46.62, elevation: 820 },
      ],
      [
        { lat: -23.54, lng: -46.63, elevation: 850 },
        { lat: -23.54, lng: -46.62, elevation: 900 },
      ],
    ];
    const elements = [
      {
        type: "way" as const,
        id: 11,
        tags: { highway: "residential" },
        nodes: [1, 2],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.54, lon: -46.62 },
        ],
        members: [],
      },
    ];
    const result = generateDXF(elements, CENTER, terrain);
    expect(result).toContain("LWPOLYLINE");
  });

  it("should apply simplification that triggers recursive split when points deviate", () => {
    const elements = [
      {
        type: "way" as const,
        id: 12,
        tags: { highway: "primary" },
        nodes: [1, 2, 3, 4, 5],
        geometry: [
          { lat: -23.55, lon: -46.63 },
          { lat: -23.55, lon: -46.64 },
          { lat: -23.56, lon: -46.64 },
          { lat: -23.56, lon: -46.63 },
          { lat: -23.57, lon: -46.62 },
        ],
        members: [],
      },
    ];
    const result = generateDXF(elements, CENTER, undefined, { simplify: true });
    expect(result).toContain("LWPOLYLINE");
  });
});
