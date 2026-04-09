import {
    BtCalculationRequest,
    BtCalculationResponse,
    BtAccumulatedByPole,
    BtDerivedReading,
    BtSectioningImpact,
    BtEstimatedByTransformer,
    BtSummary,
    BtPole,
    BtConsumer,
} from '../schemas/btSchema.js';

export const BT_CALCULATION_VERSION = 'v1';

/**
 * BT (Baixa Tensão / Low Voltage) Calculation Service.
 *
 * All BT business logic, demand calculations, voltage-drop estimation,
 * DMDI derivation and sectioning-impact analysis live here.
 * The frontend consumes the output of this service and MUST NOT replicate
 * any of these formulas.
 */
export class BtCalculationService {

    // ── Demand per consumer ──────────────────────────────────────────────────

    /**
     * Derive instantaneous demand (kW) for a single consumer.
     * For 'estimated' reading mode, converts monthly kWh to average kW and
     * applies a DMDI peak factor (1.5 per ANEEL PRODIST Module 7 guidance).
     */
    static deriveConsumerDemand(consumer: BtConsumer, demandFactor: number): number {
        const DMDI_PEAK_FACTOR = 1.5;
        const HOURS_PER_MONTH = 30 * 24;

        let baseDemand = consumer.powerKw;

        if (consumer.readingMode === 'estimated' && consumer.readingKwh != null) {
            const avgKw = consumer.readingKwh / HOURS_PER_MONTH;
            baseDemand = avgKw * DMDI_PEAK_FACTOR;
        }

        return baseDemand * demandFactor;
    }

    /**
     * DMDI for a consumer: peak instantaneous demand (kW).
     * Uses DMDI peak factor for estimated mode; returns raw demand otherwise.
     */
    static computeDmdi(consumer: BtConsumer, demandFactor: number): number {
        const DMDI_PEAK_FACTOR = 1.5;
        const HOURS_PER_MONTH = 30 * 24;

        if (consumer.readingMode === 'estimated' && consumer.readingKwh != null) {
            const avgKw = consumer.readingKwh / HOURS_PER_MONTH;
            return avgKw * DMDI_PEAK_FACTOR * demandFactor;
        }

        return consumer.powerKw * DMDI_PEAK_FACTOR * demandFactor;
    }

    // ── Pole-level demand ────────────────────────────────────────────────────

    /** Sum of derived demands for all consumers on a pole (kW). */
    static poleLocalDemandKw(pole: BtPole, demandFactor: number): number {
        return pole.consumers.reduce(
            (sum, c) => sum + BtCalculationService.deriveConsumerDemand(c, demandFactor),
            0,
        );
    }

    // ── Voltage drop ─────────────────────────────────────────────────────────

    /**
     * Voltage drop at a pole using simplified single-phase Ohm's law:
     *   ΔU% = (P_acc_W × L_m × ρ_Ω·mm²/m) / (U_V² × A_mm²) × 100
     * where ρ is in Ω·mm²/m (= resistivityOhmPerKmPerMm2 / 1000).
     */
    static voltageDropPercent(
        accumulatedDemandKw: number,
        distanceM: number,
        voltageV: number,
        crossSectionMm2: number,
        powerFactor: number,
        resistivityOhmPerKmPerMm2: number,
    ): number {
        if (distanceM <= 0 || crossSectionMm2 <= 0 || voltageV <= 0) return 0;

        const accumulatedW = accumulatedDemandKw * 1000;
        const resistivityPerM = resistivityOhmPerKmPerMm2 / 1000;

        // Active power voltage drop component (dominant for BT residential)
        const dropV =
            (accumulatedW * powerFactor * distanceM * resistivityPerM) /
            (voltageV * crossSectionMm2);

        return (dropV / voltageV) * 100;
    }

    // ── Current ──────────────────────────────────────────────────────────────

    /**
     * RMS current at a section for single-phase BT circuit (A).
     *   I = P / (U × cosφ)
     */
    static sectionCurrentA(
        accumulatedDemandKw: number,
        voltageV: number,
        powerFactor: number,
    ): number {
        if (voltageV <= 0 || powerFactor <= 0) return 0;
        return (accumulatedDemandKw * 1000) / (voltageV * powerFactor);
    }

    // ── Accumulated by pole ───────────────────────────────────────────────────

    /**
     * Walk the poles in declared order (assumed topological from transformer)
     * and accumulate demand, voltage drop and current for each.
     */
    static computeAccumulatedByPole(
        req: BtCalculationRequest,
    ): BtAccumulatedByPole[] {
        const { topology, settings, constants } = req;
        const { nominalVoltageV, poles } = topology;
        const { demandFactor, powerFactor } = settings;
        const { conductorResistivityOhmPerKmPerMm2, maxVoltageDropPercent } = constants;

        let cumulativeDemandKw = 0;
        const result: BtAccumulatedByPole[] = [];

        for (const pole of poles) {
            const localDemandKw = BtCalculationService.poleLocalDemandKw(pole, demandFactor);
            cumulativeDemandKw += localDemandKw;

            const drop = BtCalculationService.voltageDropPercent(
                cumulativeDemandKw,
                pole.distanceFromTransformerM,
                nominalVoltageV,
                pole.conductorCrossSectionMm2,
                powerFactor,
                conductorResistivityOhmPerKmPerMm2,
            );

            const current = BtCalculationService.sectionCurrentA(
                cumulativeDemandKw,
                nominalVoltageV,
                powerFactor,
            );

            result.push({
                poleId: pole.id,
                label: pole.label,
                localDemandKw,
                accumulatedDemandKw: cumulativeDemandKw,
                voltageDropPercent: drop,
                currentA: current,
                withinLimit: drop <= maxVoltageDropPercent,
            });
        }

        return result;
    }

    // ── Transformer estimation ────────────────────────────────────────────────

    static computeEstimatedByTransformer(
        req: BtCalculationRequest,
        totalDemandKw: number,
    ): BtEstimatedByTransformer {
        const { settings, constants } = req;
        const { topology } = req;
        const { powerFactor, safetyMargin } = settings;
        const { transformerRatedKva, transformerEfficiency } = constants;
        const { nominalVoltageV } = topology;

        const effectiveDemandKw = totalDemandKw * (1 + safetyMargin);
        const demandKva = effectiveDemandKw / (powerFactor * transformerEfficiency);
        const currentA = BtCalculationService.sectionCurrentA(
            effectiveDemandKw,
            nominalVoltageV,
            powerFactor,
        );
        const loadPercent = (demandKva / transformerRatedKva) * 100;

        return { demandKw: effectiveDemandKw, demandKva, currentA, loadPercent };
    }

    // ── Sectioning impact ─────────────────────────────────────────────────────

    /**
     * For each declared sectioning point (a pole id), compute the split
     * between upstream and downstream demand, and list affected poles.
     */
    static computeSectioningImpact(
        req: BtCalculationRequest,
    ): BtSectioningImpact[] {
        const { topology, settings } = req;
        const { poles, sectioningPoints } = topology;
        const { demandFactor } = settings;

        if (!sectioningPoints || sectioningPoints.length === 0) return [];

        const poleIndexById = new Map<string, number>(
            poles.map((p, i) => [p.id, i]),
        );

        return sectioningPoints.map((spId) => {
            const spIndex = poleIndexById.get(spId);

            if (spIndex == null) {
                return {
                    sectioningPointId: spId,
                    demandUpstreamKw: 0,
                    demandDownstreamKw: 0,
                    affectedPoleIds: [],
                    affectedConsumers: 0,
                };
            }

            const upstream = poles.slice(0, spIndex);
            const downstream = poles.slice(spIndex);

            const upDemand = upstream.reduce(
                (s, p) => s + BtCalculationService.poleLocalDemandKw(p, demandFactor),
                0,
            );
            const downDemand = downstream.reduce(
                (s, p) => s + BtCalculationService.poleLocalDemandKw(p, demandFactor),
                0,
            );
            const affectedConsumers = downstream.reduce(
                (s, p) => s + p.consumers.length,
                0,
            );

            return {
                sectioningPointId: spId,
                demandUpstreamKw: upDemand,
                demandDownstreamKw: downDemand,
                affectedPoleIds: downstream.map((p) => p.id),
                affectedConsumers,
            };
        });
    }

    // ── Derived readings ──────────────────────────────────────────────────────

    static computeDerivedReadings(
        req: BtCalculationRequest,
    ): BtDerivedReading[] {
        const { topology, settings } = req;
        const { poles } = topology;
        const { demandFactor } = settings;
        const readings: BtDerivedReading[] = [];

        for (const pole of poles) {
            for (const consumer of pole.consumers) {
                readings.push({
                    consumerId: consumer.id,
                    poleId: pole.id,
                    derivedDemandKw: BtCalculationService.deriveConsumerDemand(
                        consumer,
                        demandFactor,
                    ),
                    readingMode: consumer.readingMode,
                    dmdi: BtCalculationService.computeDmdi(consumer, demandFactor),
                });
            }
        }

        return readings;
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    static computeSummary(
        req: BtCalculationRequest,
        accumulated: BtAccumulatedByPole[],
        transformer: BtEstimatedByTransformer,
    ): BtSummary {
        const { topology, constants } = req;
        const { poles } = topology;

        let totalConsumers = 0;
        let totalClandestine = 0;
        let totalDemandKw = 0;

        for (const pole of poles) {
            totalConsumers += pole.consumers.length;
            totalClandestine += pole.consumers.filter(
                (c) => c.type === 'clandestine',
            ).length;
        }

        if (accumulated.length > 0) {
            totalDemandKw = accumulated[accumulated.length - 1].accumulatedDemandKw;
        }

        const maxVoltageDrop = accumulated.reduce(
            (max, a) => Math.max(max, a.voltageDropPercent),
            0,
        );

        return {
            version: BT_CALCULATION_VERSION,
            totalConsumers,
            totalClandestine,
            totalDemandKw,
            totalDemandKva: transformer.demandKva,
            maxVoltageDropPercent: maxVoltageDrop,
            transformerLoadPercent: transformer.loadPercent,
            withinVoltageDropLimit: maxVoltageDrop <= constants.maxVoltageDropPercent,
        };
    }

    // ── Main entry point ──────────────────────────────────────────────────────

    /**
     * Full BT topology calculation.
     * Returns a stable versioned contract consumed by the frontend service layer.
     */
    static calculate(req: BtCalculationRequest): BtCalculationResponse {
        const accumulated = BtCalculationService.computeAccumulatedByPole(req);

        const totalDemandKw =
            accumulated.length > 0
                ? accumulated[accumulated.length - 1].accumulatedDemandKw
                : 0;

        const transformer = BtCalculationService.computeEstimatedByTransformer(
            req,
            totalDemandKw,
        );

        const sectioning = BtCalculationService.computeSectioningImpact(req);
        const derivedReadings = BtCalculationService.computeDerivedReadings(req);
        const summary = BtCalculationService.computeSummary(req, accumulated, transformer);

        return {
            version: BT_CALCULATION_VERSION,
            summary,
            accumulatedByPole: accumulated,
            estimatedByTransformer: transformer,
            sectioningImpact: sectioning,
            derivedReadings,
        };
    }
}
