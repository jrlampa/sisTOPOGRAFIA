import {
  CriticalActionModal,
  ClandestinoToNormalModal,
  CriticalConfirmationConfig,
  NormalRamalModal,
  NormalToClandestinoModal,
  ResetBtTopologyModal,
} from "./BtModals";

type Props = {
  normalRamalModal: React.ComponentProps<typeof NormalRamalModal>["modal"];
  setNormalRamalModal: React.ComponentProps<
    typeof NormalRamalModal
  >["setModal"];
  handleConfirmNormalRamalModal: React.ComponentProps<
    typeof NormalRamalModal
  >["onConfirm"];
  clandestinoToNormalModal: React.ComponentProps<
    typeof ClandestinoToNormalModal
  >["modal"];
  setClandestinoToNormalModal: React.ComponentProps<
    typeof ClandestinoToNormalModal
  >["setModal"];
  handleClandestinoToNormalClassifyLater: React.ComponentProps<
    typeof ClandestinoToNormalModal
  >["onClassifyLater"];
  handleClandestinoToNormalConvertNow: React.ComponentProps<
    typeof ClandestinoToNormalModal
  >["onConvertNow"];
  normalToClandestinoModal: React.ComponentProps<
    typeof NormalToClandestinoModal
  >["modal"];
  setNormalToClandestinoModal: React.ComponentProps<
    typeof NormalToClandestinoModal
  >["setModal"];
  handleNormalToClandestinoKeepClients: React.ComponentProps<
    typeof NormalToClandestinoModal
  >["onKeepClients"];
  handleNormalToClandestinoZeroNormalClients: React.ComponentProps<
    typeof NormalToClandestinoModal
  >["onZeroNormalClients"];
  resetConfirmOpen: boolean;
  handleConfirmResetBtTopology: () => void;
  setResetConfirmOpen: (open: boolean) => void;
  criticalConfirmationModal: CriticalConfirmationConfig | null;
  closeCriticalConfirmationModal: () => void;
};

export function BtModalStack({
  normalRamalModal,
  setNormalRamalModal,
  handleConfirmNormalRamalModal,
  clandestinoToNormalModal,
  setClandestinoToNormalModal,
  handleClandestinoToNormalClassifyLater,
  handleClandestinoToNormalConvertNow,
  normalToClandestinoModal,
  setNormalToClandestinoModal,
  handleNormalToClandestinoKeepClients,
  handleNormalToClandestinoZeroNormalClients,
  resetConfirmOpen,
  handleConfirmResetBtTopology,
  setResetConfirmOpen,
  criticalConfirmationModal,
  closeCriticalConfirmationModal,
}: Props) {
  return (
    <>
      <NormalRamalModal
        modal={normalRamalModal}
        setModal={setNormalRamalModal}
        onConfirm={handleConfirmNormalRamalModal}
      />
      <ClandestinoToNormalModal
        modal={clandestinoToNormalModal}
        setModal={setClandestinoToNormalModal}
        onClassifyLater={handleClandestinoToNormalClassifyLater}
        onConvertNow={handleClandestinoToNormalConvertNow}
      />
      <NormalToClandestinoModal
        modal={normalToClandestinoModal}
        setModal={setNormalToClandestinoModal}
        onKeepClients={handleNormalToClandestinoKeepClients}
        onZeroNormalClients={handleNormalToClandestinoZeroNormalClients}
      />
      <ResetBtTopologyModal
        open={resetConfirmOpen}
        onConfirm={handleConfirmResetBtTopology}
        onCancel={() => setResetConfirmOpen(false)}
      />
      <CriticalActionModal
        modal={criticalConfirmationModal}
        onClose={closeCriticalConfirmationModal}
      />
    </>
  );
}
