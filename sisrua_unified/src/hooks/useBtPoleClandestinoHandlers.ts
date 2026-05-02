import React from "react";
import { BtTopology, BtProjectType, GlobalState } from "../types";
import { ToastType } from "../components/Toast";
import { 
  CLANDESTINO_RAMAL_TYPE, 
  NORMAL_CLIENT_RAMAL_TYPES,
  getPolesPendingNormalClassification,
  migrateClandestinoToDefaultNormalType,
  PendingNormalClassificationPole
} from "../utils/btNormalization";
import { 
  getPoleNormalClients 
} from "../utils/btPoleProjectTypeUtils";

interface Params {
  btTopology: BtTopology;
  settings: any;
  setAppState: any;
  showToast: (message: string, type: ToastType, action?: any) => void;
  undo: () => void;
  applyProjectTypeSwitch: (nextProjectType: BtProjectType, nextTopology?: BtTopology) => void;
  setPendingNormalClassificationPoles: React.Dispatch<React.SetStateAction<PendingNormalClassificationPole[]>>;
}

export function useBtPoleClandestinoHandlers({
  btTopology,
  settings,
  setAppState,
  showToast,
  undo,
  applyProjectTypeSwitch,
  setPendingNormalClassificationPoles,
}: Params) {
  const [clandestinoToNormalModal, setClandestinoToNormalModal] = React.useState<{
    poles: PendingNormalClassificationPole[];
  } | null>(null);
  const [normalToClandestinoModal, setNormalToClandestinoModal] = React.useState<{
    totalNormalClients: number;
  } | null>(null);

  const onProjectTypeChange = (nextProjectType: BtProjectType) => {
    const currentProjectType = settings.projectType ?? "ramais";
    if (currentProjectType === nextProjectType) return;

    if (currentProjectType === "clandestino" && nextProjectType === "ramais") {
      const pendingPoles = getPolesPendingNormalClassification(btTopology);
      if (pendingPoles.length > 0) {
        setClandestinoToNormalModal({ poles: pendingPoles });
        return;
      }
    }

    if (currentProjectType === "ramais" && nextProjectType === "clandestino") {
      const totalNormalClients = btTopology.poles.reduce(
        (acc, pole) => acc + getPoleNormalClients(pole),
        0,
      );
      if (totalNormalClients > 0) {
        setNormalToClandestinoModal({ totalNormalClients });
        return;
      }
    }

    setPendingNormalClassificationPoles([]);
    setAppState(
      (prev: GlobalState) => ({
        ...prev,
        settings: { ...prev.settings, projectType: nextProjectType },
      }),
      true,
    );
  };

  const handleClandestinoToNormalClassifyLater = () => {
    if (!clandestinoToNormalModal) return;
    setPendingNormalClassificationPoles(clandestinoToNormalModal.poles);
    applyProjectTypeSwitch("ramais");
    setClandestinoToNormalModal(null);
    showToast("Projeto mudou para Normal. Classificação de ramais pendente (DXF bloqueado).", "info", { label: "Desfazer", onClick: undo });
  };

  const handleClandestinoToNormalConvertNow = () => {
    if (!clandestinoToNormalModal) return;
    const migratedTopology = migrateClandestinoToDefaultNormalType(btTopology, NORMAL_CLIENT_RAMAL_TYPES[0]);
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch("ramais", migratedTopology);
    setClandestinoToNormalModal(null);
    showToast("Ramais clandestinos migrados para Ramal Monofasico.", "success", { label: "Desfazer", onClick: undo });
  };

  const handleNormalToClandestinoKeepClients = () => {
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch("clandestino");
    setNormalToClandestinoModal(null);
    showToast("Mudança para Clandestino mantendo clientes normais para possível retorno.", "info", { label: "Desfazer", onClick: undo });
  };

  const handleNormalToClandestinoZeroNormalClients = () => {
    const cleanedTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) => ({
        ...pole,
        ramais: (pole.ramais ?? []).filter((ramal) => (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE),
      })),
    };
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch("clandestino", cleanedTopology);
    setNormalToClandestinoModal(null);
    showToast("Clientes normais zerados. Apenas ramais clandestinos foram mantidos.", "success", { label: "Desfazer", onClick: undo });
  };

  return {
    clandestinoToNormalModal,
    setClandestinoToNormalModal,
    normalToClandestinoModal,
    setNormalToClandestinoModal,
    onProjectTypeChange,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
  };
}
