import { FeatureFlag, isFeatureEnabled } from "../config/featureFlags";
import type { GlobalState } from "../types";
import type { CanonicalTopologyStateMeta } from "../types";
import type { CanonicalNetworkTopology } from "../types.canonical";
import { EMPTY_BT_TOPOLOGY } from "./btNormalization";
import { EMPTY_MT_TOPOLOGY } from "./mtNormalization";
import {
  buildCanonicalTopologyFromLegacy,
  collectCanonicalDivergenceWarnings,
  deriveLegacyTopologiesFromCanonical,
} from "../adapters/canonicalTopologyAdapter";

function hasLegacyTopology(state: GlobalState): boolean {
  const btTopology = state.btTopology ?? EMPTY_BT_TOPOLOGY;
  const mtTopology = state.mtTopology ?? EMPTY_MT_TOPOLOGY;
  return (
    btTopology.poles.length > 0 ||
    btTopology.edges.length > 0 ||
    btTopology.transformers.length > 0 ||
    mtTopology.poles.length > 0 ||
    mtTopology.edges.length > 0
  );
}

export function synchronizeGlobalTopologyState(
  state: GlobalState,
): GlobalState {
  const btTopology = state.btTopology ?? EMPTY_BT_TOPOLOGY;
  const mtTopology = state.mtTopology ?? EMPTY_MT_TOPOLOGY;
  const hasCanonical = Boolean(state.canonicalTopology);
  const hasLegacy = hasLegacyTopology(state);

  let nextBtTopology = btTopology;
  let nextMtTopology = mtTopology;
  let nextCanonicalTopology: CanonicalNetworkTopology =
    state.canonicalTopology ?? {
      poles: [],
      edges: [],
      transformers: btTopology.transformers,
    };
  let source: CanonicalTopologyStateMeta["source"] = "empty";

  if (hasCanonical && !hasLegacy && state.canonicalTopology) {
    const hydrated = deriveLegacyTopologiesFromCanonical(
      state.canonicalTopology,
      btTopology.transformers,
    );
    nextBtTopology = hydrated.btTopology;
    nextMtTopology = hydrated.mtTopology;
    nextCanonicalTopology = state.canonicalTopology;
    source = "canonical-hydrated";
  } else if (hasLegacy) {
    nextCanonicalTopology = buildCanonicalTopologyFromLegacy(
      btTopology,
      mtTopology,
    );
    source = "legacy-derived";
  } else if (state.canonicalTopology) {
    nextCanonicalTopology = state.canonicalTopology;
  } else {
    nextCanonicalTopology = {
      poles: [],
      edges: [],
      transformers: btTopology.transformers,
    };
  }

  const divergenceWarnings = collectCanonicalDivergenceWarnings(
    nextBtTopology,
    nextMtTopology,
    nextCanonicalTopology,
  );

  if (
    divergenceWarnings.length > 0 &&
    isFeatureEnabled(FeatureFlag.DEBUG_MODE)
  ) {
    console.warn("[CanonicalTopologyBridge] divergences detected", {
      divergenceWarnings,
      poleCount: nextCanonicalTopology.poles.length,
      edgeCount: nextCanonicalTopology.edges.length,
      source,
    });
  }

  return {
    ...state,
    btTopology: nextBtTopology,
    mtTopology: nextMtTopology,
    canonicalTopology: nextCanonicalTopology,
    canonicalTopologyMeta: {
      source,
      divergenceWarnings,
      lastSynchronizedAt: new Date().toISOString(),
    },
  };
}
