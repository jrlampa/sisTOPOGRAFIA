import { afterEach, describe, expect, it } from "vitest";
import { FeatureFlag, loadFeatureFlags, resetFeatureFlags } from "../src/config/featureFlags";
import { selectMapTopologyRenderSources } from "../src/utils/selectMapTopologyRenderSources";

const legacyBtTopology = {
  poles: [
    {
      id: "P-LEGACY-BT",
      lat: -23.5,
      lng: -46.6,
      title: "Poste BT legado",
      btStructures: { si1: "A" },
      ramais: [],
    },
  ],
  transformers: [
    {
      id: "TR-001",
      poleId: "P-LEGACY-BT",
      lat: -23.5,
      lng: -46.6,
      title: "Trafo legado",
      monthlyBillBrl: 0,
      readings: [],
    },
  ],
  edges: [],
};

const legacyMtTopology = {
  poles: [
    {
      id: "P-LEGACY-MT",
      lat: -23.6,
      lng: -46.7,
      title: "Poste MT legado",
      mtStructures: { n1: "B" },
    },
  ],
  edges: [],
};

const canonicalTopology = {
  poles: [
    {
      id: "P-LEGACY-BT",
      lat: -23.5,
      lng: -46.6,
      title: "Poste BT canonico",
      hasBt: true,
      hasMt: false,
      btStructures: { si1: "A" },
      ramais: [],
    },
    {
      id: "P-LEGACY-MT",
      lat: -23.6,
      lng: -46.7,
      title: "Poste MT canonico",
      hasBt: false,
      hasMt: true,
      mtStructures: { n1: "B" },
    },
  ],
  edges: [],
};

describe("selectMapTopologyRenderSources", () => {
  afterEach(() => {
    resetFeatureFlags();
  });

  it("mantem legado quando flags canonicas estao desligadas", () => {
    const result = selectMapTopologyRenderSources({
      canonicalTopology,
      btTopology: legacyBtTopology,
      mtTopology: legacyMtTopology,
      btTransformers: legacyBtTopology.transformers,
    });

    expect(result.usingCanonicalMarkers).toBe(false);
    expect(result.usingCanonicalPopups).toBe(false);
    expect(result.btMarkerTopology).toBe(legacyBtTopology);
    expect(result.btPopupTopology).toBe(legacyBtTopology);
    expect(result.mtMarkerTopology).toBe(legacyMtTopology);
    expect(result.mtPopupTopology).toBe(legacyMtTopology);
  });

  it("permite rollout separado para marcadores e popups", () => {
    loadFeatureFlags({
      [FeatureFlag.CANONICAL_MAP_MARKERS]: true,
      [FeatureFlag.CANONICAL_MAP_POPUPS]: false,
    });

    const markersOnly = selectMapTopologyRenderSources({
      canonicalTopology,
      btTopology: legacyBtTopology,
      mtTopology: legacyMtTopology,
      btTransformers: legacyBtTopology.transformers,
    });

    expect(markersOnly.usingCanonicalMarkers).toBe(true);
    expect(markersOnly.usingCanonicalPopups).toBe(false);
    expect(markersOnly.btMarkerTopology).not.toBe(legacyBtTopology);
    expect(markersOnly.btMarkerTopology.poles[0]?.title).toBe("Poste BT canonico");
    expect(markersOnly.btPopupTopology).toBe(legacyBtTopology);
    expect(markersOnly.mtMarkerTopology.poles[0]?.title).toBe("Poste MT canonico");
    expect(markersOnly.mtPopupTopology).toBe(legacyMtTopology);

    resetFeatureFlags();
    loadFeatureFlags({
      [FeatureFlag.CANONICAL_MAP_MARKERS]: false,
      [FeatureFlag.CANONICAL_MAP_POPUPS]: true,
    });

    const popupsOnly = selectMapTopologyRenderSources({
      canonicalTopology,
      btTopology: legacyBtTopology,
      mtTopology: legacyMtTopology,
      btTransformers: legacyBtTopology.transformers,
    });

    expect(popupsOnly.usingCanonicalMarkers).toBe(false);
    expect(popupsOnly.usingCanonicalPopups).toBe(true);
    expect(popupsOnly.btMarkerTopology).toBe(legacyBtTopology);
    expect(popupsOnly.btPopupTopology.poles[0]?.title).toBe("Poste BT canonico");
    expect(popupsOnly.mtMarkerTopology).toBe(legacyMtTopology);
    expect(popupsOnly.mtPopupTopology.poles[0]?.title).toBe("Poste MT canonico");
  });
});