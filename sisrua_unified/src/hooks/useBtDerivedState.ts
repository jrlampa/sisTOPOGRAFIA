import { useEffect, useMemo, useState } from "react";
import type { GlobalState, BtTopology } from "../types";
import type {
  BtPoleAccumulatedDemand,
  BtTransformerEstimatedDemand,
  BtSectioningImpact,
  BtClandestinoDisplay,
} from "../services/btDerivedService";
import { fetchBtDerivedState } from "../services/btDerivedService";
import type { BtTransformerDerived } from "../services/btDerivedService";

const EMPTY_SECTIONING_IMPACT: BtSectioningImpact = {
  unservedPoleIds: [],
  unservedClients: 0,
  estimatedDemandKva: 0,
  loadCenter: null,
  suggestedPoleId: null,
};

const EMPTY_CLANDESTINO_DISPLAY: BtClandestinoDisplay = {
  demandKva: null,
  areaMin: 0,
  areaMax: 0,
  baseDemandKva: null,
  diversificationFactor: null,
  finalDemandKva: 0,
};

type Params = {
  appState: GlobalState;
  setAppState: (
    state: GlobalState | ((prev: GlobalState) => GlobalState),
    addToHistory: boolean,
  ) => void;
};

export function useBtDerivedState({ appState }: Params) {
  const btTopology = appState.btTopology;
  const settings = appState.settings;

  const [isCalculating, setIsCalculating] = useState(false);
  const [btAccumulatedByPole, setBtAccumulatedByPole] = useState<
    BtPoleAccumulatedDemand[]
  >([]);
  const [btEstimatedByTransformer, setBtEstimatedByTransformer] = useState<
    BtTransformerEstimatedDemand[]
  >([]);
  const [btSummary, setBtSummary] = useState({
    poles: 0,
    transformers: 0,
    edges: 0,
    totalLengthMeters: 0,
    transformerDemandKva: 0,
  });
  const [btPointDemandKva, setBtPointDemandKva] = useState(0);
  const [btSectioningImpact, setBtSectioningImpact] =
    useState<BtSectioningImpact>(EMPTY_SECTIONING_IMPACT);
  const [btClandestinoDisplay, setBtClandestinoDisplay] =
    useState<BtClandestinoDisplay>(EMPTY_CLANDESTINO_DISPLAY);
  const [btTransformersDerived, setBtTransformersDerived] = useState<
    BtTransformerDerived[]
  >([]);

  useEffect(() => {
    let active = true;
    setIsCalculating(true);

    // Debounce: aguarda 300ms de inatividade na topologia antes de disparar o motor de cálculo
    const timer = setTimeout(() => {
      fetchBtDerivedState({
        topology: btTopology as BtTopology,
        projectType: settings.projectType ?? "ramais",
        clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
      })
        .then((payload) => {
          if (!active) {
            return;
          }
          setBtAccumulatedByPole(payload.accumulatedByPole);
          setBtEstimatedByTransformer(payload.estimatedByTransformer);
          setBtSummary(payload.summary);
          setBtPointDemandKva(payload.pointDemandKva);
          setBtSectioningImpact(
            payload.sectioningImpact ?? EMPTY_SECTIONING_IMPACT,
          );
          setBtClandestinoDisplay(
            payload.clandestinoDisplay ?? EMPTY_CLANDESTINO_DISPLAY,
          );
          setBtTransformersDerived(payload.transformersDerived ?? []);
          setIsCalculating(false);
        })
        .catch(() => {
          setIsCalculating(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [btTopology, settings.projectType, settings.clandestinoAreaM2]);

  const btTransformerDebugById = useMemo(() => {
    const map: Record<
      string,
      { assignedClients: number; estimatedDemandKva: number }
    > = {};
    for (const item of btEstimatedByTransformer) {
      map[item.transformerId] = {
        assignedClients: item.assignedClients,
        estimatedDemandKva: item.estimatedDemandKva,
      };
    }
    return map;
  }, [btEstimatedByTransformer]);

  const btCriticalPoleId = useMemo(() => {
    // Find the pole with the highest dvAccumPercent
    if (btAccumulatedByPole.length === 0) return null;
    const sorted = [...btAccumulatedByPole].sort(
      (a, b) => (b.dvAccumPercent ?? 0) - (a.dvAccumPercent ?? 0),
    );
    // Only consider it critical if it's over 7%
    if (sorted[0].dvAccumPercent && sorted[0].dvAccumPercent > 7) {
      return sorted[0].poleId;
    }
    return null;
  }, [btAccumulatedByPole]);

  return {
    isCalculating,
    btAccumulatedByPole,
    btEstimatedByTransformer,
    btTransformerDebugById,
    btCriticalPoleId,
    btSummary,
    btPointDemandKva,
    btSectioningImpact,
    btClandestinoDisplay,
    btTransformersDerived,
  };
}
