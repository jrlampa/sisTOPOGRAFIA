/**
 * DG Test — Av. Padre Decaminada (dados reais KMZ / LIGHT)
 *
 * Execução:
 *   npx tsx scripts/dg_test_padre_decaminada.ts
 *
 * Outputs em download/:
 *   dg_padre_decaminada_result.json
 *   dg_padre_decaminada.dxf
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { DOMParser } from "xmldom";
import { runDgOptimization } from "../server/services/dgOptimizationService.js";
import type {
  DgOptimizationInput,
  DgOptimizationOutput,
  DgPartition,
} from "../server/services/dg/dgTypes.js";

// ─── Caminhos ────────────────────────────────────────────────────────────────

const KML_PATH = path.resolve(
  "C:/Users/jonat/OneDrive - IM3 Brasil/utils/sisTOPOGRAFIA/_tmp_kmz/doc.kml",
);
const OUT_DIR = path.resolve("./download");

// ─── Parse KML → DgPoleInput[] ──────────────────────────────────────────────

interface PosteRaw {
  id: string;
  lat: number;
  lon: number;
}

function parseKml(kmlPath: string): PosteRaw[] {
  const xml = fs.readFileSync(kmlPath, "utf-8");
  const doc = new DOMParser().parseFromString(xml, "text/xml");

  const ns = "http://www.opengis.net/kml/2.2";
  const placemarks = Array.from(
    doc.getElementsByTagNameNS(ns, "Placemark") as any,
  );

  const poles: PosteRaw[] = [];
  for (const pm of placemarks) {
    const nameEl = pm.getElementsByTagNameNS(ns, "name")[0];
    const coordEl = pm.getElementsByTagNameNS(ns, "coordinates")[0];
    if (!coordEl) continue; // LineString sem coordenadas de ponto

    const parent = coordEl.parentNode?.localName;
    if (parent !== "Point") continue; // ignora linestrings

    const raw = coordEl.textContent?.trim() ?? "";
    const parts = raw.split(",");
    if (parts.length < 2) continue;
    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lon)) continue;

    poles.push({
      id: nameEl?.textContent?.trim() ?? `P${poles.length + 1}`,
      lat,
      lon,
    });
  }
  return poles;
}

// ─── Monta input DG ─────────────────────────────────────────────────────────

/**
 * Demanda padrão para rede BT residencial LIGHT (Rio de Janeiro):
 *   2 clientes/poste × 1.0 kVA/cliente × 0.75 fator simultâneid. = 1.5 kVA
 * Faixa tipica LIGHT para redes de baixa renda / robustez de BT.
 */
const DEMAND_PER_POLE_KVA = 1.5;

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DG Test — Av. Padre Decaminada (LIGHT / Rio de Janeiro)  ");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Parseia KML
  const polesRaw = parseKml(KML_PATH);
  console.log(`📍 Postes carregados do KMZ: ${polesRaw.length}`);

  const totalDemand = polesRaw.length * DEMAND_PER_POLE_KVA;
  console.log(
    `⚡ Demanda total estimada: ${totalDemand.toFixed(1)} kVA (${DEMAND_PER_POLE_KVA} kVA/poste)`,
  );

  const faixaKva = [15, 30, 45, 75, 112.5, 150, 225, 300];
  const maxKva = Math.max(...faixaKva) * 0.95;
  const minTrafos = Math.ceil(totalDemand / maxKva);
  console.log(`🔌 Estimativa: ~${minTrafos} transformadores necessários\n`);

  // 2. Monta input DG
  const input: DgOptimizationInput = {
    poles: polesRaw.map((p) => ({
      id: p.id,
      position: { lat: p.lat, lon: p.lon },
      demandKva: DEMAND_PER_POLE_KVA,
      clients: 3,
    })),
    // transformer omitido → o otimizador testa toda a faixa kVA permitida
    params: {
      projectMode: "full_project",
      searchMode: "heuristic",
      maxSpanMeters: 60,
      minSpanMeters: 5,
      // 15% CQT: limiar para análise de robustez de rede existente LIGHT
      // (redes novas exigem 8%, mas análise de robustez usa 15% para identificar riscos)
      cqtLimitFraction: 0.15,
      trafoMaxUtilization: 0.95,
      faixaKvaTrafoPermitida: faixaKva,
      maxCandidatesHeuristic: 30,
    },
  };

  // 3. Roda o otimizador DG
  console.log("🔄 Executando DG optimizer (modo heurístico)...");
  const t0 = Date.now();
  const result: DgOptimizationOutput = await runDgOptimization(input);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`✅ DG concluído em ${elapsed}s\n`);

  // 4. Exibe resumo
  printSummary(result);

  // 5. Salva JSON
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "dg_padre_decaminada_result.json");
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\n💾 JSON salvo: ${jsonPath}`);

  // 6. Gera DXF
  const dxfContent = generateDxf(result, polesRaw);
  const dxfPath = path.join(OUT_DIR, "dg_padre_decaminada.dxf");
  try {
    fs.writeFileSync(dxfPath, dxfContent, "utf-8");
    console.log(`📐 DXF salvo: ${dxfPath}`);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EBUSY" || e.code === "EPERM") {
      const altPath = path.join(
        OUT_DIR,
        `dg_padre_decaminada_${Date.now()}.dxf`,
      );
      fs.writeFileSync(altPath, dxfContent, "utf-8");
      console.log(`📐 DXF salvo (arquivo alternativo): ${altPath}`);
    } else {
      throw err;
    }
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════\n",
  );
}

// ─── Sumário do resultado ────────────────────────────────────────────────────

function printSummary(result: DgOptimizationOutput) {
  const {
    recommendation,
    partitionedResult,
    totalFeasible,
    totalCandidatesEvaluated,
  } = result;

  console.log("──── RESULTADO DO OTIMIZADOR DG ────────────────────────────");
  console.log(`  Candidatos avaliados : ${totalCandidatesEvaluated}`);
  console.log(`  Cenários viáveis     : ${totalFeasible}`);

  if (recommendation?.bestScenario) {
    const best = recommendation.bestScenario;
    console.log(`\n  ✔ Melhor cenário (single-trafo):`);
    console.log(`    kVA selecionado : ${best.metadata?.selectedKva ?? "?"}`);
    console.log(`    Score objetivo  : ${best.objectiveScore.toFixed(1)}/100`);
    console.log(
      `    CQT máximo      : ${(best.electricalResult.cqtMaxFraction * 100).toFixed(2)}%`,
    );
    console.log(
      `    Utiliz. trafo   : ${(best.electricalResult.trafoUtilizationFraction * 100).toFixed(1)}%`,
    );
    console.log(
      `    Cabo total      : ${(best.electricalResult.totalCableLengthMeters / 1000).toFixed(3)} km`,
    );
    console.log(
      `    Trafo lat/lon   : ${best.trafoPositionLatLon.lat.toFixed(6)}, ${best.trafoPositionLatLon.lon.toFixed(6)}`,
    );
  } else {
    console.log(`\n  ⚠ Nenhum cenário single-trafo viável.`);
  }

  if (partitionedResult) {
    const {
      partitions,
      totalPartitions,
      avgBalanceRatio,
      infeasiblePartitions,
    } = partitionedResult;
    console.log(
      `\n  ✔ Particionamento de rede (${totalPartitions} sub-redes):`,
    );
    console.log(
      `    Equilíbrio médio   : ${(avgBalanceRatio * 100).toFixed(1)}%`,
    );
    console.log(`    Partições infeasible: ${infeasiblePartitions}`);
    for (const p of partitions) {
      const feasStr = p.electricalResult.feasible ? "✔" : "✗";
      console.log(
        `    [${feasStr}] Partição ${p.partitionId.slice(-8)} | ` +
          `${p.poles.length} postes | ` +
          `${p.totalDemandKva.toFixed(1)} kVA | ` +
          `${p.selectedKva} kVA-trafo | ` +
          `CQT=${(p.electricalResult.cqtMaxFraction * 100).toFixed(2)}% | ` +
          `ecc=${p.eccentricityAdjusted ? "ajust." : "ok"}`,
      );
    }
  }
  console.log("────────────────────────────────────────────────────────────");
}

// ─── Gerador DXF ─────────────────────────────────────────────────────────────

/**
 * Gera DXF 2D com as camadas:
 *   DG_POSTES       – círculos nos postes
 *   DG_REDE_BT      – linhas MST (cor por condutor)
 *   DG_TRAFOS       – símbolo de transformador
 *   DG_PARTICOES    – texto com ID da partição
 *   DG_REDE_SINGLE  – cenário single-trafo (se existir)
 */
function generateDxf(
  result: DgOptimizationOutput,
  polesRaw: PosteRaw[],
): string {
  // Lookup posição por ID
  const poleMap = new Map(polesRaw.map((p) => [p.id, p]));

  // Referência: baricentro para normalizar coordenadas (UTM aprox. em graus)
  const avgLat = polesRaw.reduce((s, p) => s + p.lat, 0) / polesRaw.length;
  const avgLon = polesRaw.reduce((s, p) => s + p.lon, 0) / polesRaw.length;

  // Projeção simples lat/lon → metros (para DXF 2D)
  // usa a mesma referência do centro do projeto
  const R = 6378137;
  const latRad = (avgLat * Math.PI) / 180;
  const toXY = (lat: number, lon: number) => ({
    x: R * (lon - avgLon) * (Math.PI / 180) * Math.cos(latRad),
    y: R * (lat - avgLat) * (Math.PI / 180),
  });

  const lines: string[] = [];
  const pushEntity = (type: string, payload: string) => {
    lines.push(`0\n${type}\n${payload}`);
  };

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push("0\nSECTION\n2\nHEADER");
  lines.push("9\n$ACADVER\n1\nAC1009");
  lines.push("9\n$INSUNITS\n70\n6"); // 6 = metros
  lines.push("0\nENDSEC");

  // ── Tables (layers) ─────────────────────────────────────────────────────
  const LAYERS = [
    { name: "DG_POSTES", color: 7 }, // branco
    { name: "DG_REDE_BT", color: 5 }, // azul
    { name: "DG_TRAFOS", color: 1 }, // vermelho
    { name: "DG_PARTICOES", color: 3 }, // verde
    { name: "DG_REDE_SINGLE", color: 4 }, // cyan
    { name: "DG_TRAFO_SINGLE", color: 2 }, // amarelo
    { name: "DG_TEXTO", color: 7 }, // branco
  ];

  lines.push("0\nSECTION\n2\nTABLES");

  // LTYPE table
  lines.push("0\nTABLE\n2\nLTYPE\n70\n1");
  lines.push(
    "0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0",
  );
  lines.push("0\nENDTAB");

  // LAYER table
  lines.push(`0\nTABLE\n2\nLAYER\n70\n${LAYERS.length}`);
  for (const l of LAYERS) {
    lines.push(`0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`);
  }
  lines.push("0\nENDTAB");
  lines.push("0\nENDSEC");

  // ── Entities ─────────────────────────────────────────────────────────────
  lines.push("0\nSECTION\n2\nENTITIES");

  // 1. Pontos dos postes (círculos pequenos)
  for (const p of polesRaw) {
    const { x, y } = toXY(p.lat, p.lon);
    pushEntity(
      "CIRCLE",
      `8\nDG_POSTES\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n30\n0.0\n40\n1.5`,
    );
    // Texto com ID do poste
    pushEntity(
      "TEXT",
      `8\nDG_TEXTO\n10\n${(x + 1.6).toFixed(4)}\n20\n${(y + 1.6).toFixed(4)}\n30\n0.0\n40\n1.5\n1\n${p.id}`,
    );
  }

  // 2. Particionamento (principal resultado quando demanda > 1 trafo)
  if (result.partitionedResult) {
    const colors = [1, 2, 3, 4, 5, 6, 7, 14, 30, 40]; // cores variadas por partição
    for (let pi = 0; pi < result.partitionedResult.partitions.length; pi++) {
      const partition = result.partitionedResult.partitions[pi];
      const color = colors[pi % colors.length];

      // Arestas MST da partição
      for (const edge of partition.edges) {
        const fromId = edge.fromPoleId.startsWith("trafo-")
          ? null
          : edge.fromPoleId;
        const toId = edge.toPoleId.startsWith("trafo-") ? null : edge.toPoleId;

        let x1: number, y1: number, x2: number, y2: number;

        if (fromId && poleMap.has(fromId)) {
          const pos = poleMap.get(fromId)!;
          ({ x: x1, y: y1 } = toXY(pos.lat, pos.lon));
        } else {
          // fromId é o trafo
          ({ x: x1, y: y1 } = toXY(
            partition.trafoPositionLatLon.lat,
            partition.trafoPositionLatLon.lon,
          ));
        }

        if (toId && poleMap.has(toId)) {
          const pos = poleMap.get(toId)!;
          ({ x: x2, y: y2 } = toXY(pos.lat, pos.lon));
        } else {
          ({ x: x2, y: y2 } = toXY(
            partition.trafoPositionLatLon.lat,
            partition.trafoPositionLatLon.lon,
          ));
        }

        pushEntity(
          "LINE",
          `8\nDG_REDE_BT\n62\n${color}\n` +
            `10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n30\n0.0\n` +
            `11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n31\n0.0`,
        );
      }

      // Transformador: cruz (2 linhas) + círculo grande
      const { x: tx, y: ty } = toXY(
        partition.trafoPositionLatLon.lat,
        partition.trafoPositionLatLon.lon,
      );
      const sz = 4;
      pushEntity(
        "LINE",
        `8\nDG_TRAFOS\n62\n1\n10\n${(tx - sz).toFixed(4)}\n20\n${ty.toFixed(4)}\n30\n0.0\n11\n${(tx + sz).toFixed(4)}\n21\n${ty.toFixed(4)}\n31\n0.0`,
      );
      pushEntity(
        "LINE",
        `8\nDG_TRAFOS\n62\n1\n10\n${tx.toFixed(4)}\n20\n${(ty - sz).toFixed(4)}\n30\n0.0\n11\n${tx.toFixed(4)}\n21\n${(ty + sz).toFixed(4)}\n31\n0.0`,
      );
      pushEntity(
        "CIRCLE",
        `8\nDG_TRAFOS\n62\n1\n10\n${tx.toFixed(4)}\n20\n${ty.toFixed(4)}\n30\n0.0\n40\n${(sz * 1.2).toFixed(2)}`,
      );
      // Anotação: kVA + CQT
      const cqt = (partition.electricalResult.cqtMaxFraction * 100).toFixed(1);
      const feasStr = partition.electricalResult.feasible ? "OK" : "FALHA";
      pushEntity(
        "TEXT",
        `8\nDG_PARTICOES\n10\n${(tx + sz + 1).toFixed(4)}\n20\n${(ty + 2).toFixed(4)}\n30\n0.0\n40\n2.0\n1\nT${pi + 1}:${partition.selectedKva}kVA CQT=${cqt}% [${feasStr}]`,
      );
    }
  }

  // 3. Melhor cenário single-trafo (se existir)
  if (result.recommendation?.bestScenario) {
    const best = result.recommendation.bestScenario;
    const { x: tx, y: ty } = toXY(
      best.trafoPositionLatLon.lat,
      best.trafoPositionLatLon.lon,
    );
    const sz = 5;
    pushEntity(
      "CIRCLE",
      `8\nDG_TRAFO_SINGLE\n62\n2\n10\n${tx.toFixed(4)}\n20\n${ty.toFixed(4)}\n30\n0.0\n40\n${sz.toFixed(2)}`,
    );
    for (const edge of best.edges) {
      const fromId = edge.fromPoleId.startsWith("trafo-")
        ? null
        : edge.fromPoleId;
      const toId = edge.toPoleId.startsWith("trafo-") ? null : edge.toPoleId;

      let x1: number, y1: number, x2: number, y2: number;
      if (fromId && poleMap.has(fromId)) {
        ({ x: x1, y: y1 } = toXY(
          poleMap.get(fromId)!.lat,
          poleMap.get(fromId)!.lon,
        ));
      } else {
        ({ x: x1, y: y1 } = { x: tx, y: ty });
      }
      if (toId && poleMap.has(toId)) {
        ({ x: x2, y: y2 } = toXY(
          poleMap.get(toId)!.lat,
          poleMap.get(toId)!.lon,
        ));
      } else {
        ({ x: x2, y: y2 } = { x: tx, y: ty });
      }
      pushEntity(
        "LINE",
        `8\nDG_REDE_SINGLE\n62\n4\n` +
          `10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n30\n0.0\n` +
          `11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n31\n0.0`,
      );
    }
    const kva = best.metadata?.selectedKva ?? "?";
    const cqt = (best.electricalResult.cqtMaxFraction * 100).toFixed(1);
    pushEntity(
      "TEXT",
      `8\nDG_TEXTO\n10\n${(tx + sz + 1).toFixed(4)}\n20\n${(ty + 2).toFixed(4)}\n30\n0.0\n40\n2.5\n1\nSINGLE:${kva}kVA CQT=${cqt}%`,
    );
  }

  lines.push("0\nENDSEC");
  lines.push("0\nEOF");
  return lines.join("\n");
}

// ─── Entry point ─────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("❌ Erro durante o teste DG:", err);
  process.exit(1);
});
