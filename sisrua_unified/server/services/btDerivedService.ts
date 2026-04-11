import { constantsService } from './constantsService.js';
import { CABOS_BASELINE } from '../constants/cqtLookupTables.js';

type BtProjectType = 'ramais' | 'geral' | 'clandestino';

const CURRENT_TO_DEMAND_CONVERSION = 0.375;

interface BtPoleRamalEntry {
    quantity: number;
    ramalType?: string;
}

interface BtPoleNode {
    id: string;
    lat: number;
    lng: number;
    ramais?: BtPoleRamalEntry[];
    circuitBreakPoint?: boolean;
}

interface BtTransformerReading {
    id?: string;
    currentMaxA?: number;
    temperatureFactor?: number;
    billedBrl?: number;
    unitRateBrlPerKwh?: number;
    autoCalculated?: boolean;
}

interface BtTransformer {
    id: string;
    poleId?: string;
    demandKw: number;
    readings: BtTransformerReading[];
}

interface BtEdgeConductorEntry {
    conductorName: string;
}

interface BtEdge {
    fromPoleId: string;
    toPoleId: string;
    lengthMeters?: number;
    conductors?: BtEdgeConductorEntry[];
    removeOnExecution?: boolean;
    edgeChangeFlag?: 'existing' | 'new' | 'remove' | 'replace';
}

interface BtTopology {
    poles: BtPoleNode[];
    transformers: BtTransformer[];
    edges: BtEdge[];
}

export type BtCqtStatus = 'OK' | 'ATENÇÃO' | 'CRÍTICO';

export interface BtPoleAccumulatedDemand {
    poleId: string;
    localClients: number;
    accumulatedClients: number;
    localTrechoDemandKva: number;
    accumulatedDemandKva: number;
    voltageV?: number;
    dvAccumPercent?: number;
    cqtStatus?: BtCqtStatus;
}

export interface BtTransformerEstimatedDemand {
    transformerId: string;
    assignedClients: number;
    estimatedDemandKw: number;
}

export interface BtSectioningImpact {
    unservedPoleIds: string[];
    unservedClients: number;
    estimatedDemandKw: number;
    loadCenter: { lat: number; lng: number } | null;
    suggestedPoleId: string | null;
}

export interface BtClandestinoDisplay {
    demandKw: number;
    areaMin: number;
    areaMax: number;
    demandKva: number | null;
    diversificationFactor: number | null;
    finalDemandKva: number;
}

export interface BtTransformerDerived {
    transformerId: string;
    demandKw: number;
    monthlyBillBrl: number;
}

export interface BtDerivedResponse {
    summary: {
        poles: number;
        transformers: number;
        edges: number;
        totalLengthMeters: number;
        transformerDemandKw: number;
    };
    pointDemandKva: number;
    criticalPoleId: string | null;
    accumulatedByPole: BtPoleAccumulatedDemand[];
    estimatedByTransformer: BtTransformerEstimatedDemand[];
    sectioningImpact: BtSectioningImpact;
    clandestinoDisplay: BtClandestinoDisplay;
    transformersDerived: BtTransformerDerived[];
}

const CLANDESTINO_RAMAL_TYPE = 'Clandestino';

const toFixed2 = (value: number): number => Number(value.toFixed(2));

const getPoleClientsByProjectType = (projectType: BtProjectType, topology: BtTopology, poleId: string): number => {
    const pole = topology.poles.find((item) => item.id === poleId);
    if (!pole) {
        return 0;
    }

    const ramais = pole.ramais ?? [];
    if (projectType === 'clandestino') {
        return ramais
            .filter((ramal) => (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE)
            .reduce((sum, ramal) => sum + ramal.quantity, 0);
    }

    return ramais
        .filter((ramal) => (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) !== CLANDESTINO_RAMAL_TYPE)
        .reduce((sum, ramal) => sum + ramal.quantity, 0);
};

const getClandestinoDemandKvaByAreaAndClients = (areaM2: number, clients: number): number => {
    const areaToKva = constantsService.getSync<Record<string, number>>('clandestino', 'AREA_TO_KVA');
    const clientToDiversifFactor = constantsService.getSync<Record<string, number>>('clandestino', 'CLIENT_TO_DIVERSIF_FACTOR');

    if (!areaToKva || !clientToDiversifFactor) {
        return 0;
    }

    const baseKva = areaToKva[String(Math.round(areaM2))];
    const diversificationFactor = clientToDiversifFactor[String(Math.round(clients))];

    if (!Number.isFinite(baseKva) || !Number.isFinite(diversificationFactor)) {
        return 0;
    }

    return toFixed2(baseKva * diversificationFactor);
};

const calculateRamalDmdiKva = (
    projectType: BtProjectType,
    aa24DemandBase: number,
    sumClientsX: number,
    ab35LookupDmdi: number
): number => {
    if (projectType === 'clandestino') {
        return toFixed2(ab35LookupDmdi);
    }

    if (!Number.isFinite(aa24DemandBase) || !Number.isFinite(sumClientsX) || sumClientsX <= 0) {
        return 0;
    }

    return toFixed2(aa24DemandBase / sumClientsX);
};

interface TransformerOwnershipData {
    localClientByPole: Map<string, number>;
    ownerTransformerByPole: Map<string, string>;
}

const calculateTransformerOwnershipData = (
    topology: BtTopology,
    projectType: BtProjectType
): TransformerOwnershipData => {
    const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
    const circuitBreakPoleIds = new Set(
        topology.poles.filter((pole) => pole.circuitBreakPoint).map((pole) => pole.id)
    );

    const localClientByPole = new Map<string, number>();
    for (const pole of topology.poles) {
        localClientByPole.set(pole.id, getPoleClientsByProjectType(projectType, topology, pole.id));
    }

    const adjacentPoles = new Map<string, string[]>();
    for (const poleId of allPoleIds) {
        adjacentPoles.set(poleId, []);
    }

    const activeEdges = topology.edges.filter((edge) => {
        const edgeFlag = edge.edgeChangeFlag ?? (edge.removeOnExecution ? 'remove' : 'existing');
        return edgeFlag !== 'remove';
    });

    for (const edge of activeEdges) {
        adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
        adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
    }

    const transformerPoleEntries = topology.transformers
        .filter((transformer) => transformer.poleId && allPoleIds.has(transformer.poleId))
        .map((transformer) => ({ transformerId: transformer.id, poleId: transformer.poleId as string }));

    const distanceToTransformer = new Map<string, number>();
    const ownerTransformerByPole = new Map<string, string>();
    for (const poleId of allPoleIds) {
        distanceToTransformer.set(poleId, Number.POSITIVE_INFINITY);
    }

    const queue: Array<{ poleId: string; transformerId: string }> = [];
    for (const entry of transformerPoleEntries) {
        const knownDistance = distanceToTransformer.get(entry.poleId) ?? Number.POSITIVE_INFINITY;
        const knownOwner = ownerTransformerByPole.get(entry.poleId);
        if (knownDistance > 0 || (knownDistance === 0 && (!knownOwner || entry.transformerId < knownOwner))) {
            distanceToTransformer.set(entry.poleId, 0);
            ownerTransformerByPole.set(entry.poleId, entry.transformerId);
        }
        queue.push({ poleId: entry.poleId, transformerId: entry.transformerId });
    }

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }

        const currentDistance = distanceToTransformer.get(current.poleId) ?? Number.POSITIVE_INFINITY;
        const owner = ownerTransformerByPole.get(current.poleId);
        if (!owner || owner !== current.transformerId) {
            continue;
        }

        if (circuitBreakPoleIds.has(current.poleId)) {
            continue;
        }

        const neighbors = adjacentPoles.get(current.poleId) ?? [];
        for (const neighborId of neighbors) {
            const knownDistance = distanceToTransformer.get(neighborId) ?? Number.POSITIVE_INFINITY;
            const knownOwner = ownerTransformerByPole.get(neighborId);
            const nextDistance = currentDistance + 1;

            if (nextDistance < knownDistance || (nextDistance === knownDistance && (!knownOwner || owner < knownOwner))) {
                distanceToTransformer.set(neighborId, nextDistance);
                ownerTransformerByPole.set(neighborId, owner);
                queue.push({ poleId: neighborId, transformerId: owner });
            }
        }
    }

    return { localClientByPole, ownerTransformerByPole };
};

const calculateAccumulatedDemandByPole = (
    topology: BtTopology,
    projectType: BtProjectType,
    clandestinoAreaM2: number
): BtPoleAccumulatedDemand[] => {
    const allPoleIds = new Set(topology.poles.map((pole) => pole.id));
    for (const edge of topology.edges) {
        allPoleIds.add(edge.fromPoleId);
        allPoleIds.add(edge.toPoleId);
    }

    const adjacentPoles = new Map<string, string[]>();
    const localClientByPole = new Map<string, number>();

    for (const pole of topology.poles) {
        const localClients = getPoleClientsByProjectType(projectType, topology, pole.id);
        localClientByPole.set(pole.id, localClients);
    }

    for (const poleId of allPoleIds) {
        adjacentPoles.set(poleId, []);
    }

    for (const edge of topology.edges) {
        adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
        adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
    }

    const circuitBreakPoleIds = new Set(
        topology.poles
            .filter((pole) => pole.circuitBreakPoint)
            .map((pole) => pole.id)
    );

    const transformerPoleIds = new Set(
        topology.transformers
            .map((transformer) => transformer.poleId)
            .filter((poleId): poleId is string => poleId !== undefined && allPoleIds.has(poleId))
    );

    const distanceToTransformer = new Map<string, number>();
    for (const poleId of allPoleIds) {
        distanceToTransformer.set(poleId, Number.POSITIVE_INFINITY);
    }

    const queue: string[] = [];
    for (const poleId of transformerPoleIds) {
        distanceToTransformer.set(poleId, 0);
        queue.push(poleId);
    }

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }

        if (circuitBreakPoleIds.has(current)) {
            continue;
        }

        const currentDistance = distanceToTransformer.get(current) ?? Number.POSITIVE_INFINITY;
        const neighbors = adjacentPoles.get(current) ?? [];
        for (const neighbor of neighbors) {
            const knownDistance = distanceToTransformer.get(neighbor) ?? Number.POSITIVE_INFINITY;
            if (knownDistance > currentDistance + 1) {
                distanceToTransformer.set(neighbor, currentDistance + 1);
                queue.push(neighbor);
            }
        }
    }

    const totalClients = Array.from(localClientByPole.values()).reduce((sum, value) => sum + value, 0);
    const transformerDemandKva = topology.transformers.reduce((sum, transformer) => sum + transformer.demandKw, 0);
    const avgDemandPerClient = calculateRamalDmdiKva(
        projectType,
        transformerDemandKva,
        totalClients,
        getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClients)
    );

    const memo = new Map<string, BtPoleAccumulatedDemand>();

    const visit = (poleId: string, activePath: Set<string>): BtPoleAccumulatedDemand => {
        const cached = memo.get(poleId);
        if (cached) {
            return cached;
        }

        if (activePath.has(poleId)) {
            const cycleFallback: BtPoleAccumulatedDemand = {
                poleId,
                localClients: localClientByPole.get(poleId) ?? 0,
                accumulatedClients: localClientByPole.get(poleId) ?? 0,
                localTrechoDemandKva: 0,
                accumulatedDemandKva: 0
            };
            memo.set(poleId, cycleFallback);
            return cycleFallback;
        }

        const nextPath = new Set(activePath);
        nextPath.add(poleId);

        const localClients = localClientByPole.get(poleId) ?? 0;
        const currentDistance = distanceToTransformer.get(poleId) ?? Number.POSITIVE_INFINITY;
        const isCircuitBreakPole = circuitBreakPoleIds.has(poleId);

        const children = isCircuitBreakPole
            ? []
            : (adjacentPoles.get(poleId) ?? []).filter((neighborId) => {
                const neighborDistance = distanceToTransformer.get(neighborId) ?? Number.POSITIVE_INFINITY;
                if (Number.isFinite(currentDistance) && Number.isFinite(neighborDistance)) {
                    return neighborDistance > currentDistance;
                }

                return false;
            });

        const childrenResults = children.map((childPoleId) => visit(childPoleId, nextPath));
        const downstreamClients = childrenResults.reduce((sum, child) => sum + child.accumulatedClients, 0);
        const accumulatedClients = localClients + downstreamClients;

        const localTrechoDemandKva = projectType === 'clandestino'
            ? getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, localClients)
            : toFixed2(localClients * avgDemandPerClient);

        const downstreamAccumulatedKva = childrenResults.reduce((sum, child) => sum + child.accumulatedDemandKva, 0);
        const accumulatedDemandKva = projectType === 'clandestino'
            ? getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, accumulatedClients)
            : toFixed2(downstreamAccumulatedKva + localTrechoDemandKva);

        const result: BtPoleAccumulatedDemand = {
            poleId,
            localClients,
            accumulatedClients,
            localTrechoDemandKva,
            accumulatedDemandKva
        };

        memo.set(poleId, result);
        return result;
    };

    const results = Array.from(allPoleIds).map((poleId) => visit(poleId, new Set()));
    return results.sort((a, b) => b.accumulatedDemandKva - a.accumulatedDemandKva);
};

// ─── Voltage propagation ──────────────────────────────────────────────────────

const VOLTAGE_PHASE_V = 127;
const VOLTAGE_PHASE_FACTOR_MONO = 2;
const DV_THRESHOLD_ATENCAO = 5;
const DV_THRESHOLD_CRITICO = 8;

const getCqtStatus = (dvPercent: number): BtCqtStatus => {
    if (dvPercent > DV_THRESHOLD_CRITICO) return 'CRÍTICO';
    if (dvPercent > DV_THRESHOLD_ATENCAO) return 'ATENÇÃO';
    return 'OK';
};

/**
 * Enriches accumulated demand results with voltage-drop fields.
 *
 * Algorithm: BFS from transformer poles (top-down), tracking the accumulated
 * QT fraction (voltage-drop fraction) per pole. For each edge traversed, if
 * the edge carries conductor information the partial QT is computed as:
 *
 *   qt_trecho = PHASE_FACTOR × P_accumulada_kVA × R_Ω_per_km × L_m / V_phase_V²
 *
 * where P_accumulada_kVA is the `accumulatedDemandKva` of the downstream pole
 * (child node, further from the transformer).
 * Then: voltageV = V_phase × (1 − qt_accumulated); dvAccumPercent = qt × 100.
 */
const enrichWithVoltage = (
    results: BtPoleAccumulatedDemand[],
    topology: BtTopology
): BtPoleAccumulatedDemand[] => {
    const activeEdges = topology.edges.filter((edge) => {
        const edgeFlag = edge.edgeChangeFlag ?? (edge.removeOnExecution ? 'remove' : 'existing');
        return edgeFlag !== 'remove';
    });

    // Check whether any edge carries conductor data — skip enrichment otherwise
    const hasConductorData = activeEdges.some(
        (edge) => (edge.conductors?.length ?? 0) > 0
    );
    if (!hasConductorData) {
        return results;
    }

    const accumulatedDemandByPole = new Map<string, number>(
        results.map((r) => [r.poleId, r.accumulatedDemandKva])
    );

    // Edge lookup by ordered pole pair (both directions)
    const edgeByPair = new Map<string, BtEdge>();
    for (const edge of activeEdges) {
        edgeByPair.set(`${edge.fromPoleId}|${edge.toPoleId}`, edge);
        edgeByPair.set(`${edge.toPoleId}|${edge.fromPoleId}`, edge);
    }

    const adjacentPoles = new Map<string, string[]>();
    for (const pole of topology.poles) {
        adjacentPoles.set(pole.id, []);
    }
    for (const edge of activeEdges) {
        adjacentPoles.get(edge.fromPoleId)?.push(edge.toPoleId);
        adjacentPoles.get(edge.toPoleId)?.push(edge.fromPoleId);
    }

    const transformerPoleIds = new Set(
        topology.transformers
            .filter((t) => !!t.poleId)
            .map((t) => t.poleId as string)
    );
    const circuitBreakPoleIds = new Set(
        topology.poles.filter((p) => p.circuitBreakPoint).map((p) => p.id)
    );

    // BFS — qtAccumulatedByPole: fraction of nominal voltage already dropped
    const qtAccumulatedByPole = new Map<string, number>();
    const queue: string[] = [];
    for (const poleId of transformerPoleIds) {
        qtAccumulatedByPole.set(poleId, 0);
        queue.push(poleId);
    }

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        if (circuitBreakPoleIds.has(current) && !transformerPoleIds.has(current)) continue;

        const qtAtCurrent = qtAccumulatedByPole.get(current) ?? 0;
        for (const neighbor of adjacentPoles.get(current) ?? []) {
            if (qtAccumulatedByPole.has(neighbor)) continue;

            const edge = edgeByPair.get(`${current}|${neighbor}`);
            const conductorName = edge?.conductors?.[0]?.conductorName;
            const lengthM = edge?.lengthMeters ?? 0;

            let qtTrecho = 0;
            if (conductorName && lengthM > 0) {
                const cabo = CABOS_BASELINE.find((c) => c.name === conductorName);
                if (cabo) {
                    const neighborAccumulatedKva = accumulatedDemandByPole.get(neighbor) ?? 0;
                    qtTrecho =
                        VOLTAGE_PHASE_FACTOR_MONO *
                        neighborAccumulatedKva *
                        cabo.resistance *
                        lengthM /
                        (VOLTAGE_PHASE_V ** 2);
                }
            }

            qtAccumulatedByPole.set(neighbor, qtAtCurrent + qtTrecho);
            queue.push(neighbor);
        }
    }

    return results.map((r) => {
        const qtAccum = qtAccumulatedByPole.get(r.poleId);
        if (qtAccum === undefined || !Number.isFinite(qtAccum)) {
            return r;
        }
        const dvAccumPercent = toFixed2(qtAccum * 100);
        const voltageV = toFixed2(VOLTAGE_PHASE_V * (1 - qtAccum));
        const cqtStatus = getCqtStatus(dvAccumPercent);
        return { ...r, voltageV, dvAccumPercent, cqtStatus };
    });
};

const calculateEstimatedDemandByTransformer = (
    topology: BtTopology,
    projectType: BtProjectType,
    clandestinoAreaM2: number
): BtTransformerEstimatedDemand[] => {
    if (topology.transformers.length === 0 || topology.poles.length === 0) {
        return [];
    }

    const hasLinkedTransformers = topology.transformers.some((transformer) => !!transformer.poleId);
    if (!hasLinkedTransformers) {
        return topology.transformers.map((transformer) => ({
            transformerId: transformer.id,
            assignedClients: 0,
            estimatedDemandKw: 0
        }));
    }

    const { localClientByPole, ownerTransformerByPole } = calculateTransformerOwnershipData(topology, projectType);

    const assignedClientsByTransformer = new Map<string, number>();
    for (const transformer of topology.transformers) {
        assignedClientsByTransformer.set(transformer.id, 0);
    }

    for (const [poleId, localClients] of localClientByPole.entries()) {
        const ownerTransformerId = ownerTransformerByPole.get(poleId);
        if (!ownerTransformerId) {
            continue;
        }

        assignedClientsByTransformer.set(
            ownerTransformerId,
            (assignedClientsByTransformer.get(ownerTransformerId) ?? 0) + localClients
        );
    }

    const totalClients = Array.from(localClientByPole.values()).reduce((sum, value) => sum + value, 0);
    const measuredDemandKw = topology.transformers.reduce((sum, transformer) => {
        if (transformer.readings.length === 0) {
            return sum;
        }

        return sum + (transformer.demandKw ?? 0);
    }, 0);
    const demandPerClientKw = totalClients > 0 ? measuredDemandKw / totalClients : 0;

    return topology.transformers.map((transformer) => {
        const assignedClients = assignedClientsByTransformer.get(transformer.id) ?? 0;
        if (transformer.readings.length > 0) {
            return {
                transformerId: transformer.id,
                assignedClients,
                estimatedDemandKw: toFixed2(transformer.demandKw ?? 0)
            };
        }

        const estimatedDemandKw = projectType === 'clandestino'
            ? getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, assignedClients)
            : toFixed2(assignedClients * demandPerClientKw);

        return {
            transformerId: transformer.id,
            assignedClients,
            estimatedDemandKw
        };
    });
};

const calculateSummary = (topology: BtTopology) => {
    const totalLengthMeters = topology.edges.reduce((acc, edge) => acc + (edge.lengthMeters || 0), 0);
    const transformerDemandKw = topology.transformers.reduce((acc, transformer) => acc + (transformer.demandKw || 0), 0);

    return {
        poles: topology.poles.length,
        transformers: topology.transformers.length,
        edges: topology.edges.length,
        totalLengthMeters,
        transformerDemandKw,
    };
};

const distanceMetersBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const earthRadius = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const calculateSectioningImpact = (
    topology: BtTopology,
    projectType: BtProjectType,
    clandestinoAreaM2: number
): BtSectioningImpact => {
    if (topology.poles.length === 0) {
        return { unservedPoleIds: [], unservedClients: 0, estimatedDemandKw: 0, loadCenter: null, suggestedPoleId: null };
    }

    const { localClientByPole, ownerTransformerByPole } = calculateTransformerOwnershipData(topology, projectType);
    const unservedPoles = topology.poles.filter((pole) => !ownerTransformerByPole.has(pole.id));
    const unservedPoleIds = unservedPoles.map((pole) => pole.id);
    const unservedClients = unservedPoles.reduce((sum, pole) => sum + (localClientByPole.get(pole.id) ?? 0), 0);

    const totalClients = Array.from(localClientByPole.values()).reduce((sum, v) => sum + v, 0);
    const measuredDemandKw = topology.transformers.reduce(
        (sum, t) => (t.readings.length === 0 ? sum : sum + (t.demandKw ?? 0)),
        0
    );
    const demandPerClientKw = totalClients > 0 ? measuredDemandKw / totalClients : 0;

    const estimatedDemandKw = projectType === 'clandestino'
        ? getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, unservedClients)
        : toFixed2(unservedClients * demandPerClientKw);

    if (unservedPoles.length === 0) {
        return { unservedPoleIds, unservedClients, estimatedDemandKw, loadCenter: null, suggestedPoleId: null };
    }

    const weighted = unservedPoles.map((pole) => ({ pole, weight: Math.max(localClientByPole.get(pole.id) ?? 0, 1) }));
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    const loadCenter = {
        lat: weighted.reduce((sum, item) => sum + item.pole.lat * item.weight, 0) / (totalWeight || 1),
        lng: weighted.reduce((sum, item) => sum + item.pole.lng * item.weight, 0) / (totalWeight || 1),
    };

    let suggestedPoleId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const pole of unservedPoles) {
        const d = distanceMetersBetween(loadCenter, { lat: pole.lat, lng: pole.lng });
        if (d < nearestDistance) {
            nearestDistance = d;
            suggestedPoleId = pole.id;
        }
    }

    return { unservedPoleIds, unservedClients, estimatedDemandKw, loadCenter, suggestedPoleId };
};

const calculateClandestinoDisplay = (
    topology: BtTopology,
    clandestinoAreaM2: number
): BtClandestinoDisplay => {
    const areaToKva = constantsService.getSync<Record<string, number>>('clandestino', 'AREA_TO_KVA');
    const clientToDiversifFactor = constantsService.getSync<Record<string, number>>('clandestino', 'CLIENT_TO_DIVERSIF_FACTOR');

    const numericAreaKeys = areaToKva ? Object.keys(areaToKva).map(Number).filter(Number.isFinite) : [];
    const areaMin = numericAreaKeys.length > 0 ? Math.min(...numericAreaKeys) : 0;
    const areaMax = numericAreaKeys.length > 0 ? Math.max(...numericAreaKeys) : 0;

    const areaKey = String(Math.round(clandestinoAreaM2));
    const demandKva = (areaToKva && Number.isFinite(areaToKva[areaKey])) ? areaToKva[areaKey] : null;
    const demandKw = demandKva ?? 0;

    const totalClients = topology.poles.reduce(
        (acc, pole) => acc + (pole.ramais ?? []).reduce((sum, ramal) => sum + ramal.quantity, 0),
        0
    );
    const clientKey = String(Math.round(totalClients));
    const diversificationFactor = (clientToDiversifFactor && Number.isFinite(clientToDiversifFactor[clientKey]))
        ? clientToDiversifFactor[clientKey]
        : null;

    const finalDemandKva = (demandKva !== null && diversificationFactor !== null)
        ? toFixed2(demandKva * diversificationFactor)
        : 0;

    return { demandKw, areaMin, areaMax, demandKva, diversificationFactor, finalDemandKva };
};

const calculateTransformersDerived = (topology: BtTopology): BtTransformerDerived[] => {
    return topology.transformers.map((transformer) => {
        const readings = transformer.readings;
        const monthlyBillBrl = readings.reduce((acc, r) => acc + (r.billedBrl ?? 0), 0);
        if (readings.length === 0) {
            return { transformerId: transformer.id, demandKw: 0, monthlyBillBrl };
        }
        const correctedDemands = readings.map((r) => {
            const currentMaxA = r.currentMaxA ?? 0;
            const temperatureFactor = r.temperatureFactor ?? 1;
            return currentMaxA * CURRENT_TO_DEMAND_CONVERSION * temperatureFactor;
        });
        const demandKw = toFixed2(Math.max(...correctedDemands, 0));
        return { transformerId: transformer.id, demandKw, monthlyBillBrl };
    });
};

export const computeBtDerivedState = (
    topology: BtTopology,
    projectType: BtProjectType,
    clandestinoAreaM2: number
): BtDerivedResponse => {
    const summary = calculateSummary(topology);

    const totalClients = topology.poles.reduce((sum, pole) => {
        return sum + getPoleClientsByProjectType(projectType, topology, pole.id);
    }, 0);

    const pointDemandKva = calculateRamalDmdiKva(
        projectType,
        summary.transformerDemandKw,
        totalClients,
        getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClients)
    );

    const accumulatedByPole = enrichWithVoltage(
        calculateAccumulatedDemandByPole(topology, projectType, clandestinoAreaM2),
        topology
    );
    const estimatedByTransformer = calculateEstimatedDemandByTransformer(topology, projectType, clandestinoAreaM2);
    const sectioningImpact = calculateSectioningImpact(topology, projectType, clandestinoAreaM2);
    const clandestinoDisplay = calculateClandestinoDisplay(topology, clandestinoAreaM2);
    const transformersDerived = calculateTransformersDerived(topology);

    return {
        summary,
        pointDemandKva,
        criticalPoleId: accumulatedByPole[0]?.poleId ?? null,
        accumulatedByPole,
        estimatedByTransformer,
        sectioningImpact,
        clandestinoDisplay,
        transformersDerived,
    };
};
