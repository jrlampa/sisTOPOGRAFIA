import { useAppOrchestrator } from "./useAppOrchestrator";
import { useOsmEngine } from "./useOsmEngine";
import { useBtDerivedState } from "./useBtDerivedState";
import { useAppTopologySources } from "./useAppTopologySources";
import { useMapState } from "./useMapState";
import { useAutoSave } from "./useAutoSave";
import { useElevationProfile } from "./useElevationProfile";

/** 
 * Centraliza a orquestração de hooks do App para reduzir volumetria do componente principal.
 * Agrupa estados e handlers relacionados por domínio.
 */
export function useAppHooks() {
  const orchestrator = useAppOrchestrator();
  const { appState, setAppState } = orchestrator;

  const osmEngine = useOsmEngine();
  const autoSave = useAutoSave(appState);
  const elevationProfile = useElevationProfile();
  
  const mapState = useMapState({
    appState,
    setAppState,
    clearData: osmEngine.clearData,
    loadElevationProfile: elevationProfile.loadProfile,
    clearProfile: elevationProfile.clearProfile,
  });

  const topologySources = useAppTopologySources({ 
    appState, 
    btTopology: appState.btTopology ?? { poles: [], edges: [] } 
  });

  const derivedState = useBtDerivedState({ appState, setAppState });

  return {
    orchestrator,
    osmEngine,
    autoSave,
    elevationProfile,
    mapState,
    topologySources,
    derivedState
  };
}
