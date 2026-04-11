import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlobalState, BtTopology } from '../types';
import type {
  BtPoleAccumulatedDemand,
  BtTransformerEstimatedDemand,
  BtSectioningImpact,
  BtClandestinoDisplay,
  BtTransformerDerived,
  BtDerivedSummary,
} from '../services/btDerivedService';
import { fetchBtDerivedState } from '../services/btDerivedService';
import {
  CURRENT_TO_DEMAND_CONVERSION,
  DEFAULT_TEMPERATURE_FACTOR,
  EMPTY_BT_TOPOLOGY,
} from '../constants/btPhysicalConstants';
import {
  LEGACY_ID_ENTROPY,
  ENTITY_ID_PREFIXES,
} from '../constants/magicNumbers';

interface UseBtDerivedStateParams {
  appState: GlobalState;
  setAppState: (nextState: GlobalState, commit: boolean) => void;
}

const EMPTY_SECTIONING_IMPACT: BtSectioningImpact = {
  unservedPoleIds: [],
  unservedClients: 0,
  estimatedDemandKw: 0,
  loadCenter: null,
  suggestedPoleId: null,
};

const EMPTY_CLANDESTINO_DISPLAY: BtClandestinoDisplay = {
  demandKw: 0,
  areaMin: 0,
  areaMax: 0,
  demandKva: null,
  diversificationFactor: null,
  finalDemandKva: 0,
};

export function useBtDerivedState({ appState, setAppState }: UseBtDerivedStateParams) {
  const [btAccumulatedByPole, setBtAccumulatedByPole] = useState<BtPoleAccumulatedDemand[]>([]);
  const [btEstimatedByTransformer, setBtEstimatedByTransformer] = useState<BtTransformerEstimatedDemand[]>([]);
  const [btSectioningImpact, setBtSectioningImpact] = useState<BtSectioningImpact>(EMPTY_SECTIONING_IMPACT);
  const [btClandestinoDisplay, setBtClandestinoDisplay] = useState<BtClandestinoDisplay>(EMPTY_CLANDESTINO_DISPLAY);
  const [btTransformersDerived, setBtTransformersDerived] = useState<BtTransformerDerived[]>([]);
  const [btSummary, setBtSummary] = useState<BtDerivedSummary>({
    poles: 0,
    transformers: 0,
    edges: 0,
    totalLengthMeters: 0,
    transformerDemandKw: 0,
  });
  const [btPointDemandKva, setBtPointDemandKva] = useState(0);

  // Keep a ref so the transformer-sync effect always spreads the latest appState
  // without needing it as a reactive dependency (avoids firing on every state change).
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const settings = appState.settings;

  useEffect(() => {
    let active = true;

    fetchBtDerivedState({
      topology: btTopology as BtTopology,
      projectType: settings.projectType ?? 'ramais',
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
        setBtSectioningImpact(payload.sectioningImpact ?? EMPTY_SECTIONING_IMPACT);
        setBtClandestinoDisplay(payload.clandestinoDisplay ?? EMPTY_CLANDESTINO_DISPLAY);
        setBtTransformersDerived(payload.transformersDerived ?? []);
      })
      .catch(() => {
        // On error, keep previous values (no silent local fallback).
      });

    return () => {
      active = false;
    };
  }, [btTopology, settings.projectType, settings.clandestinoAreaM2]);

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
        } as BtTopology,
      },
      false
    );
  }, [btEstimatedByTransformer, btTopology, setAppState, settings.btTransformerCalculationMode]);

  return {
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
