import {
  CLANDESTINO_AREA_TO_KVA,
  CLANDESTINO_CLIENT_TO_DIVERSIF_FACTOR,
  CLANDESTINO_MAX_AREA_M2,
  CLANDESTINO_MAX_CLIENTS,
  CLANDESTINO_MIN_AREA_M2,
  CLANDESTINO_MIN_CLIENTS,
} from "../constants/clandestinoWorkbookRules";

let activeClandestinoAreaToKva: Record<number, number> =
  CLANDESTINO_AREA_TO_KVA;
let activeClandestinoClientToDiversifFactor: Record<number, number> =
  CLANDESTINO_CLIENT_TO_DIVERSIF_FACTOR;
let clandestinoRulesLoadPromise: Promise<boolean> | null = null;

const isLookupRecord = (value: unknown): value is Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (item) => typeof item === "number" && Number.isFinite(item),
  );
};

const toNumericRecord = (
  value: Record<string, number>,
): Record<number, number> =>
  Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [Number(key), item])
      .filter(
        ([key, item]) => Number.isInteger(key) && typeof item === "number",
      ),
  ) as Record<number, number>;

export const loadClandestinoWorkbookRules = async (): Promise<boolean> => {
  if (clandestinoRulesLoadPromise) {
    return clandestinoRulesLoadPromise;
  }

  clandestinoRulesLoadPromise = (async () => {
    try {
      const response = await fetch("/api/constants/clandestino");
      if (!response.ok) {
        return false;
      }

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
      }

      const { areaToKva, clientToDiversifFactor } = payload as {
        areaToKva?: unknown;
        clientToDiversifFactor?: unknown;
      };

      if (
        !isLookupRecord(areaToKva) ||
        !isLookupRecord(clientToDiversifFactor)
      ) {
        return false;
      }

      activeClandestinoAreaToKva = toNumericRecord(areaToKva);
      activeClandestinoClientToDiversifFactor = toNumericRecord(
        clientToDiversifFactor,
      );
      return true;
    } catch {
      return false;
    }
  })();

  return clandestinoRulesLoadPromise;
};

const parseInteger = (value: number): number | null => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value);
  return normalized === value ? normalized : null;
};

export const getClandestinoAreaRange = () => ({
  min: CLANDESTINO_MIN_AREA_M2,
  max: CLANDESTINO_MAX_AREA_M2,
});

export const getClandestinoClientsRange = () => ({
  min: CLANDESTINO_MIN_CLIENTS,
  max: CLANDESTINO_MAX_CLIENTS,
});

export const getClandestinoKvaByArea = (areaM2: number): number | null => {
  const areaKey = parseInteger(areaM2);
  if (areaKey === null) {
    return null;
  }

  return activeClandestinoAreaToKva[areaKey] ?? null;
};

export const getClandestinoDiversificationFactorByClients = (
  clients: number,
): number | null => {
  const clientsKey = parseInteger(clients);
  if (clientsKey === null) {
    return null;
  }

  return activeClandestinoClientToDiversifFactor[clientsKey] ?? null;
};

export const calculateClandestinoDemandKvaByAreaAndClients = (
  areaM2: number,
  clients: number,
): number => {
  const baseKva = getClandestinoKvaByArea(areaM2);
  const diversificationFactor =
    getClandestinoDiversificationFactorByClients(clients);

  if (baseKva === null || diversificationFactor === null) {
    return 0;
  }

  return Number((baseKva * diversificationFactor).toFixed(2));
};

export const calculateClandestinoDemandKva = (areaM2: number): number => {
  const demandKva = getClandestinoKvaByArea(areaM2);
  if (demandKva === null) {
    return 0;
  }
  return demandKva;
};

/** @deprecated Use calculateClandestinoDemandKva. */
export const calculateClandestinoDemandKw = calculateClandestinoDemandKva;
