import { constantsService } from './constantsService.js';

type BtProjectType = 'ramais' | 'geral' | 'clandestino';

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
    id: string;
}

interface BtTransformer {
    id: string;
    poleId?: string;
    demandKw: number;
    readings: BtTransformerReading[];
}

interface BtEdge {
    fromPoleId: string;
    toPoleId: string;
    lengthMeters?: number;
    removeOnExecution?: boolean;
    edgeChangeFlag?: 'existing' | 'new' | 'remove' | 'replace';
}

interface BtTopology {
    poles: BtPoleNode[];
    transformers: BtTransformer[];
    edges: BtEdge[];
}

export interface BtPoleAccumulatedDemand {
    poleId: string;
    localClients: number;
    accumulatedClients: number;
    localTrechoDemandKva: number;
    accumulatedDemandKva: number;
}

export interface BtTransformerEstimatedDemand {
    transformerId: string;
    assignedClients: number;
    estimatedDemandKw: number;
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

    const accumulatedByPole = calculateAccumulatedDemandByPole(topology, projectType, clandestinoAreaM2);
    const estimatedByTransformer = calculateEstimatedDemandByTransformer(topology, projectType, clandestinoAreaM2);

    return {
        summary,
        pointDemandKva,
        criticalPoleId: accumulatedByPole[0]?.poleId ?? null,
        accumulatedByPole,
        estimatedByTransformer,
    };
};
