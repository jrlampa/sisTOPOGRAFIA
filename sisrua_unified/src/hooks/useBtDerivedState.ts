import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlobalState } from '../types';
import {
  calculateAccumulatedDemandByPole,
  calculateEstimatedDemandByTransformer,
  loadClandestinoWorkbookRules,
  type BtPoleAccumulatedDemand,
  type BtTransformerEstimatedDemand,
} from '../utils/btCalculations';
import {
  CURRENT_TO_DEMAND_CONVERSION,
  DEFAULT_TEMPERATURE_FACTOR,
  EMPTY_BT_TOPOLOGY,
} from '../utils/btNormalization';
import {
  LEGACY_ID_ENTROPY,
  ENTITY_ID_PREFIXES,
} from '../constants/magicNumbers';
import { fetchBtDerivedState } from '../services/btDerivedService';

interface UseBtDerivedStateParams {
  appState: GlobalState;
  setAppState: (nextState: GlobalState, commit: boolean) => void;
}

export function useBtDerivedState({ appState, setAppState }: UseBtDerivedStateParams) {
  const [, setClandestinoRulesVersion] = useState(0);
  const [btAccumulatedByPole, setBtAccumulatedByPole] = useState<BtPoleAccumulatedDemand[]>([]);
  const [btEstimatedByTransformer, setBtEstimatedByTransformer] = useState<BtTransformerEstimatedDemand[]>([]);

  // Keep a ref so the transformer-sync effect always spreads the latest appState
  // without needing it as a reactive dependency (avoids firing on every state change).
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const settings = appState.settings;

  useEffect(() => {
    let active = true;

    loadClandestinoWorkbookRules().then((loaded) => {
      if (active && loaded) {
        setClandestinoRulesVersion((version) => version + 1);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const localAccumulatedByPole = useMemo(
    () => calculateAccumulatedDemandByPole(btTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0),
    [btTopology, settings.projectType, settings.clandestinoAreaM2]
  );

  const localEstimatedByTransformer = useMemo(
    () => calculateEstimatedDemandByTransformer(btTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0),
    [btTopology, settings.projectType, settings.clandestinoAreaM2]
  );

  useEffect(() => {
    let active = true;

    const applyFallback = () => {
      if (!active) {
        return;
      }
      setBtAccumulatedByPole(localAccumulatedByPole);
      setBtEstimatedByTransformer(localEstimatedByTransformer);
    };

    fetchBtDerivedState({
      topology: btTopology,
      projectType: settings.projectType ?? 'ramais',
      clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
    })
      .then((payload) => {
        if (!active) {
          return;
        }
        setBtAccumulatedByPole(payload.accumulatedByPole);
        setBtEstimatedByTransformer(payload.estimatedByTransformer);
      })
      .catch(() => {
        applyFallback();
      });

    return () => {
      active = false;
    };
  }, [
    btTopology,
    settings.projectType,
    settings.clandestinoAreaM2,
    localAccumulatedByPole,
    localEstimatedByTransformer,
  ]);

  const btTransformerDebugById = useMemo(
    () =>
      Object.fromEntries(
        btEstimatedByTransformer.map((entry) => [
          entry.transformerId,
          {
            assignedClients: entry.assignedClients,
            estimatedDemandKw: entry.estimatedDemandKw,
          },
        ])
      ) as Record<string, { assignedClients: number; estimatedDemandKw: number }>,
    [btEstimatedByTransformer]
  );

  const btCriticalPoleId = btAccumulatedByPole[0]?.poleId ?? null;

  useEffect(() => {
    if ((settings.btTransformerCalculationMode ?? 'automatic') !== 'automatic') {
      return;
    }

    if (btTopology.transformers.length === 0) {
      return;
    }

    const estimatedByTransformerId = new Map(
      btEstimatedByTransformer.map((entry) => [entry.transformerId, entry.estimatedDemandKw])
    );

    let hasChanges = false;
    const nextTransformers = btTopology.transformers.map((transformer) => {
      const estimatedDemandKw = Number((estimatedByTransformerId.get(transformer.id) ?? 0).toFixed(2));
      const hasReadings = transformer.readings.length > 0;
      const isAutoReading = hasReadings && transformer.readings.every((reading) => reading.autoCalculated === true);

      if (hasReadings && !isAutoReading) {
        return transformer;
      }

      if (!isAutoReading) {
        if (Math.abs((transformer.demandKw ?? 0) - estimatedDemandKw) < 0.01) {
          return transformer;
        }

        hasChanges = true;
        return {
          ...transformer,
          demandKw: estimatedDemandKw,
        };
      }

      const baseReading = transformer.readings[0] ?? {
        id: `${ENTITY_ID_PREFIXES.REGULATOR}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`,
        currentMaxA: 0,
        temperatureFactor: DEFAULT_TEMPERATURE_FACTOR,
        autoCalculated: true,
      };
      const temperatureFactor =
        (baseReading.temperatureFactor ?? DEFAULT_TEMPERATURE_FACTOR) > 0
          ? (baseReading.temperatureFactor ?? DEFAULT_TEMPERATURE_FACTOR)
          : DEFAULT_TEMPERATURE_FACTOR;
      const inferredCurrent =
        Math.round((estimatedDemandKw / (CURRENT_TO_DEMAND_CONVERSION * temperatureFactor)) * 100) / 100;

      const previousCurrent = baseReading.currentMaxA ?? 0;
      const previousDemand = transformer.demandKw ?? 0;
      if (
        Math.abs(previousCurrent - inferredCurrent) < 0.01 &&
        Math.abs(previousDemand - estimatedDemandKw) < 0.01
      ) {
        return transformer;
      }

      hasChanges = true;
      return {
        ...transformer,
        demandKw: estimatedDemandKw,
        readings: [
          {
            ...baseReading,
            currentMaxA: inferredCurrent,
            temperatureFactor,
            autoCalculated: true,
          },
        ],
      };
    });

    if (!hasChanges) {
      return;
    }

    setAppState(
      {
        ...appStateRef.current,
        btTopology: {
          ...btTopology,
          transformers: nextTransformers,
        },
      },
      false
    );
  }, [btEstimatedByTransformer, btTopology, setAppState, settings.btTransformerCalculationMode]);

  return {
    btAccumulatedByPole,
    btEstimatedByTransformer,
    btTransformerDebugById,
    btCriticalPoleId,
  };
}
