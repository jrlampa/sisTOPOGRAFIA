import { deriveLegacyTopologiesFromCanonical } from "../adapters/canonicalTopologyAdapter";
import { FeatureFlag, isFeatureEnabled } from "../config/featureFlags";
import type { BtTopology, MtTopology, BtTransformer } from "../types";
import type { CanonicalNetworkTopology } from "../types.canonical";
import type { MapBtTopology, MapMtTopology } from "../types.map";
import { EMPTY_BT_TOPOLOGY } from "./btNormalization";
import { EMPTY_MT_TOPOLOGY } from "./mtNormalization";

export interface MapTopologyRenderSources {
  btMarkerTopology: MapBtTopology;
  btPopupTopology: MapBtTopology;
  mtMarkerTopology: MapMtTopology;
  mtPopupTopology: MapMtTopology;
  usingCanonicalMarkers: boolean;
  usingCanonicalPopups: boolean;
}

interface SelectMapTopologyRenderSourcesParams {
  canonicalTopology?: CanonicalNetworkTopology;
  btTopology?: BtTopology;
  mtTopology?: MtTopology;
  btTransformers?: BtTransformer[];
}

export function selectMapTopologyRenderSources({
  canonicalTopology,
  btTopology,
  mtTopology,
  btTransformers,
}: SelectMapTopologyRenderSourcesParams): MapTopologyRenderSources {
  const legacyBtTopology = btTopology ?? EMPTY_BT_TOPOLOGY;
  const legacyMtTopology = mtTopology ?? EMPTY_MT_TOPOLOGY;
  const transformers = btTransformers ?? legacyBtTopology.transformers ?? [];
  const fallbackCanonical = canonicalTopology ?? { poles: [], edges: [] };

  const canonicalVisualTopologies = deriveLegacyTopologiesFromCanonical(
    fallbackCanonical,
    transformers,
  );

  const usingCanonicalMarkers = isFeatureEnabled(
    FeatureFlag.CANONICAL_MAP_MARKERS,
  );
  const usingCanonicalPopups = isFeatureEnabled(
    FeatureFlag.CANONICAL_MAP_POPUPS,
  );

  return {
    btMarkerTopology: usingCanonicalMarkers
      ? canonicalVisualTopologies.btTopology
      : legacyBtTopology,
    btPopupTopology: usingCanonicalPopups
      ? canonicalVisualTopologies.btTopology
      : legacyBtTopology,
    mtMarkerTopology: usingCanonicalMarkers
      ? canonicalVisualTopologies.mtTopology
      : legacyMtTopology,
    mtPopupTopology: usingCanonicalPopups
      ? canonicalVisualTopologies.mtTopology
      : legacyMtTopology,
    usingCanonicalMarkers,
    usingCanonicalPopups,
  };
}
