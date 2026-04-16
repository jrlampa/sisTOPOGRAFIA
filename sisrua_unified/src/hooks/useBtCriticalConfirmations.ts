import React from "react";
import type { CriticalConfirmationConfig } from "../components/BtModals";

type Params = {
  requestCriticalConfirmation: (config: CriticalConfirmationConfig) => void;
  handleBtDeletePole: (poleId: string) => void;
  handleBtDeleteEdge: (edgeId: string) => void;
  handleBtDeleteTransformer: (transformerId: string) => void;
  handleBtQuickRemovePoleRamal: (poleId: string) => void;
  handleBtQuickRemoveEdgeConductor: (
    edgeId: string,
    conductorName: string,
  ) => void;
};

export function useBtCriticalConfirmations({
  requestCriticalConfirmation,
  handleBtDeletePole,
  handleBtDeleteEdge,
  handleBtDeleteTransformer,
  handleBtQuickRemovePoleRamal,
  handleBtQuickRemoveEdgeConductor,
}: Params) {
  const confirmDeletePole = React.useCallback(
    (poleId: string) => {
      requestCriticalConfirmation({
        title: "Excluir poste BT?",
        message: `O poste ${poleId} será removido da topologia. Esta ação não pode ser desfeita.`,
        confirmLabel: "Excluir poste",
        tone: "danger",
        onConfirm: () => handleBtDeletePole(poleId),
      });
    },
    [handleBtDeletePole, requestCriticalConfirmation],
  );

  const confirmDeleteEdge = React.useCallback(
    (edgeId: string) => {
      requestCriticalConfirmation({
        title: "Excluir condutor BT?",
        message: `O trecho ${edgeId} será removido da topologia. Esta ação não pode ser desfeita.`,
        confirmLabel: "Excluir condutor",
        tone: "danger",
        onConfirm: () => handleBtDeleteEdge(edgeId),
      });
    },
    [handleBtDeleteEdge, requestCriticalConfirmation],
  );

  const confirmDeleteTransformer = React.useCallback(
    (transformerId: string) => {
      requestCriticalConfirmation({
        title: "Excluir transformador?",
        message: `O transformador ${transformerId} será removido da topologia. Esta ação não pode ser desfeita.`,
        confirmLabel: "Excluir transformador",
        tone: "danger",
        onConfirm: () => handleBtDeleteTransformer(transformerId),
      });
    },
    [handleBtDeleteTransformer, requestCriticalConfirmation],
  );

  const confirmQuickRemovePoleRamal = React.useCallback(
    (poleId: string) => {
      requestCriticalConfirmation({
        title: "Reduzir ramais do poste?",
        message: `Será removido 1 ramal do poste ${poleId}.`,
        confirmLabel: "Reduzir ramal",
        tone: "warning",
        onConfirm: () => handleBtQuickRemovePoleRamal(poleId),
      });
    },
    [handleBtQuickRemovePoleRamal, requestCriticalConfirmation],
  );

  const confirmQuickRemoveEdgeConductor = React.useCallback(
    (edgeId: string, conductorName: string) => {
      requestCriticalConfirmation({
        title: "Reduzir condutores do trecho?",
        message: `Será removida 1 unidade do condutor ${conductorName} no trecho ${edgeId}.`,
        confirmLabel: "Reduzir condutor",
        tone: "warning",
        onConfirm: () =>
          handleBtQuickRemoveEdgeConductor(edgeId, conductorName),
      });
    },
    [handleBtQuickRemoveEdgeConductor, requestCriticalConfirmation],
  );

  return {
    confirmDeletePole,
    confirmDeleteEdge,
    confirmDeleteTransformer,
    confirmQuickRemovePoleRamal,
    confirmQuickRemoveEdgeConductor,
  };
}
