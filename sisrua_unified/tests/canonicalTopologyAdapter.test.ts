import { describe, expect, it } from "vitest";
import type { GlobalState } from "../src/types";
import {
  buildCanonicalTopologyFromLegacy,
  collectCanonicalDivergenceWarnings,
  deriveLegacyTopologiesFromCanonical,
} from "../src/adapters/canonicalTopologyAdapter";
import { synchronizeGlobalTopologyState } from "../src/utils/synchronizeGlobalTopologyState";

const baseBtTopology = {
  poles: [
    {
      id: "P-001",
      lat: -23.5,
      lng: -46.6,
      title: "Poste BT",
      btStructures: { si1: "A" },
      ramais: [{ id: "R-1", quantity: 2 }],
    },
  ],
  transformers: [
    {
      id: "TR-001",
      poleId: "P-001",
      lat: -23.5,
      lng: -46.6,
      title: "Trafo 1",
      monthlyBillBrl: 0,
      readings: [],
    },
  ],
  edges: [
    {
      id: "E-BT-1",
      fromPoleId: "P-001",
      toPoleId: "P-002",
      conductors: [{ id: "C-1", quantity: 1, conductorName: "70 Al - MX" }],
    },
  ],
};

const baseMtTopology = {
  poles: [
    {
      id: "P-001",
      lat: -23.5,
      lng: -46.6,
      title: "Poste Compartilhado",
      mtStructures: { n1: "MT" },
    },
    {
      id: "P-010",
      lat: -23.6,
      lng: -46.7,
      title: "Poste MT",
    },
  ],
  edges: [
    {
      id: "E-MT-1",
      fromPoleId: "P-001",
      toPoleId: "P-010",
      lengthMeters: 50,
    },
  ],
};

describe("canonicalTopologyAdapter", () => {
  it("mescla postes BT e MT no modelo canônico", () => {
    const canonical = buildCanonicalTopologyFromLegacy(
      baseBtTopology,
      baseMtTopology,
    );

    expect(canonical.poles).toHaveLength(2);
    expect(canonical.edges).toHaveLength(2);
    expect(canonical.poles.find((pole) => pole.id === "P-001")).toMatchObject({
      hasBt: true,
      hasMt: true,
      btStructures: { si1: "A" },
      mtStructures: { n1: "MT" },
    });
  });

  it("reidrata BT e MT a partir do canônico preservando transformadores BT", () => {
    const canonical = buildCanonicalTopologyFromLegacy(
      baseBtTopology,
      baseMtTopology,
    );
    const legacy = deriveLegacyTopologiesFromCanonical(
      canonical,
      baseBtTopology.transformers,
    );

    expect(legacy.btTopology.transformers).toHaveLength(1);
    expect(legacy.btTopology.poles).toHaveLength(1);
    expect(legacy.mtTopology.poles).toHaveLength(2);
    expect(legacy.btTopology.edges).toHaveLength(1);
    expect(legacy.mtTopology.edges).toHaveLength(1);
  });

  it("gera warnings quando canônico diverge do legado", () => {
    const canonical = {
      poles: [
        { id: "P-X", lat: 0, lng: 0, title: "X", hasBt: true, hasMt: false },
      ],
      edges: [],
    };

    const warnings = collectCanonicalDivergenceWarnings(
      baseBtTopology,
      baseMtTopology,
      canonical,
    );

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("Pole count mismatch");
  });
});

describe("synchronizeGlobalTopologyState", () => {
  it("deriva canonicalTopology quando o estado contém apenas legado", () => {
    const state = synchronizeGlobalTopologyState({
      center: { lat: 0, lng: 0 },
      radius: 500,
      selectionMode: "circle",
      polygon: [],
      measurePath: [],
      settings: {
        enableAI: true,
        simplificationLevel: "low",
        orthogonalize: true,
        contourRenderMode: "spline",
        layers: {
          buildings: true,
          roads: true,
          curbs: true,
          nature: true,
          terrain: true,
          contours: false,
          slopeAnalysis: false,
          furniture: true,
          labels: true,
          dimensions: false,
          grid: false,
          btNetwork: true,
          mtNetwork: true,
        },
        projection: "utm",
        theme: "light",
        mapProvider: "vector",
        projectMetadata: {
          projectName: "Projeto",
          companyName: "Empresa",
          engineerName: "Eng",
          date: "20/04/2026",
          scale: "N/A",
          revision: "R00",
        },
        contourInterval: 5,
      },
      btTopology: baseBtTopology,
      mtTopology: baseMtTopology,
      btExportSummary: null,
      btExportHistory: [],
    } as GlobalState);

    expect(state.canonicalTopology?.poles).toHaveLength(2);
    expect(state.canonicalTopologyMeta?.source).toBe("legacy-derived");
  });

  it("rehidrata BT e MT quando o estado contém apenas canonicalTopology", () => {
    const legacyDerived = buildCanonicalTopologyFromLegacy(
      baseBtTopology,
      baseMtTopology,
    );

    const state = synchronizeGlobalTopologyState({
      center: { lat: 0, lng: 0 },
      radius: 500,
      selectionMode: "circle",
      polygon: [],
      measurePath: [],
      settings: {
        enableAI: true,
        simplificationLevel: "low",
        orthogonalize: true,
        contourRenderMode: "spline",
        layers: {
          buildings: true,
          roads: true,
          curbs: true,
          nature: true,
          terrain: true,
          contours: false,
          slopeAnalysis: false,
          furniture: true,
          labels: true,
          dimensions: false,
          grid: false,
          btNetwork: true,
          mtNetwork: true,
        },
        projection: "utm",
        theme: "light",
        mapProvider: "vector",
        projectMetadata: {
          projectName: "Projeto",
          companyName: "Empresa",
          engineerName: "Eng",
          date: "20/04/2026",
          scale: "N/A",
          revision: "R00",
        },
        contourInterval: 5,
      },
      canonicalTopology: legacyDerived,
      btTopology: { poles: [], transformers: [], edges: [] },
      mtTopology: { poles: [], edges: [] },
      btExportSummary: null,
      btExportHistory: [],
    } as GlobalState);

    expect(state.btTopology?.poles).toHaveLength(1);
    expect(state.mtTopology?.poles).toHaveLength(2);
    expect(state.canonicalTopologyMeta?.source).toBe("canonical-hydrated");
  });
});
