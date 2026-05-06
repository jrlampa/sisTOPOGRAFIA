import { useState } from "react";
import { OsmElement, AnalysisStats, TerrainGrid, GeoLocation } from "../types";
import { fetchOsmData, OsmStats } from "../services/osmService";
import { fetchElevationGrid } from "../services/elevationService";
import { analyzeArea } from "../services/geminiService";

const EMPTY_ANALYSIS_STATS: AnalysisStats = {
  totalBuildings: 0,
  totalRoads: 0,
  totalNature: 0,
  avgHeight: 0,
  maxHeight: 0,
};

const toAnalysisStats = (stats: OsmStats | null): AnalysisStats => {
  if (!stats) {
    return EMPTY_ANALYSIS_STATS;
  }

  return {
    totalBuildings: stats.totalBuildings,
    totalRoads: stats.totalRoads,
    totalNature: stats.totalNature,
    avgHeight: stats.avgHeight,
    maxHeight: stats.maxHeight,
    density: stats.density,
    densityValue: stats.densityValue,
  };
};

export function useOsmEngine() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [osmData, setOsmData] = useState<OsmElement[] | null>(null);
  const [terrainData, setTerrainData] = useState<TerrainGrid | null>(null);
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [analysisText, setAnalysisText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (
    center: GeoLocation,
    radius: number,
    enableAI: boolean,
  ) => {
    setIsProcessing(true);
    setError(null);
    setStatusMessage("Iniciando análise...");
    setProgressValue(10);

    try {
      // 1. Fetch OSM Data
      setStatusMessage("Consultando infraestrutura OSM...");
      const { elements: data, stats: backendStats } = await fetchOsmData(
        center.lat,
        center.lng,
        radius,
      );
      if (data.length === 0) {
        throw new Error("Nenhum dado geográfico encontrado neste raio.");
      }
      setOsmData(data);
      setProgressValue(40);

      // 2. Fetch Terrain Data
      setStatusMessage("Montando grade de terreno...");
      const terrain = await fetchElevationGrid(center, radius);
      setTerrainData(terrain);
      setProgressValue(70);

      // 3. Use stats pre-computed by the backend.
      const calculatedStats = toAnalysisStats(backendStats);
      setStats(calculatedStats);
      setProgressValue(85);

      // 4. Get analysis narrative
      if (enableAI) {
        setStatusMessage("Gerando resumo da análise...");
        const text = await analyzeArea(
          calculatedStats,
          center.label || "área selecionada",
          true,
        );
        setAnalysisText(text);
      } else {
        setAnalysisText("Resumo de análise desabilitado.");
      }

      setProgressValue(100);
      setStatusMessage("");
      setIsProcessing(false);
      return { success: true as const };
    } catch (err: any) {
      const errorMessage = err.message || "Falha na análise.";
      setError(errorMessage);
      setStatusMessage("");
      // Reset loading state immediately on error, don't wait
      setIsProcessing(false);
      setProgressValue(0);
      
      // If error is related to Overpass/API, we could suggest a retry
      const isRetryable = errorMessage.includes("OSM") || errorMessage.includes("HTTP") || errorMessage.includes("raio");
      
      return { 
        success: false as const, 
        errorMessage,
        retryAction: isRetryable ? {
          label: "Tentar Novamente",
          onClick: () => runAnalysis(center, radius, enableAI)
        } : undefined
      };
    }
  };

  const clearData = () => {
    setOsmData(null);
    setTerrainData(null);
    setStats(null);
    setAnalysisText("");
    setError(null);
  };

  return {
    isProcessing,
    progressValue,
    statusMessage,
    osmData,
    terrainData,
    stats,
    analysisText,
    error,
    runAnalysis,
    clearData,
    setOsmData,
  };
}
