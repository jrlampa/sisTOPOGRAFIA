import React from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type {
  BtPoleBtStructures,
  BtPoleConditionStatus,
  BtPoleNode,
  BtPoleRamalEntry,
  BtPoleSpec,
  BtRamalConditionNote,
  BtTopology,
} from "../../types";
import {
  CLANDESTINO_RAMAL_TYPE,
  NORMAL_CLIENT_RAMAL_TYPES,
  getPoleChangeFlag,
  nextId,
  numberFromInput,
} from "./BtTopologyPanelUtils";
import type { AppLocale } from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

interface BtPoleVerificationSectionProps {
  locale: AppLocale;
  btTopology: BtTopology;
  projectType: "ramais" | "geral" | "clandestino";
  selectedPoleId: string;
  selectedPole: BtPoleNode | null;
  isPoleDropdownOpen: boolean;
  setIsPoleDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectPole: (poleId: string) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    nodeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
  updatePoleVerified: (poleId: string, verified: boolean) => void;
  updatePoleRamais: (poleId: string, ramais: BtPoleRamalEntry[]) => void;
  updatePoleSpec: (poleId: string, poleSpec: BtPoleSpec | undefined) => void;
  updatePoleBtStructures: (
    poleId: string,
    btStructures: BtPoleBtStructures | undefined,
  ) => void;
  updatePoleConditionStatus: (
    poleId: string,
    conditionStatus: BtPoleConditionStatus | undefined,
  ) => void;
  updatePoleEquipmentNotes: (
    poleId: string,
    equipmentNotes: string | undefined,
  ) => void;
  updatePoleGeneralNotes: (
    poleId: string,
    generalNotes: string | undefined,
  ) => void;
}

const POLE_CONDITION_OPTIONS: Array<{
  value: BtPoleConditionStatus;
  labelKey: "stateGood" | "stateLeaning" | "stateCracked" | "stateCondemned";
}> = [
  { value: "bom_estado", labelKey: "stateGood" },
  { value: "desaprumado", labelKey: "stateLeaning" },
  { value: "trincado", labelKey: "stateCracked" },
  { value: "condenado", labelKey: "stateCondemned" },
];

const RAMAL_QUICK_NOTES: Array<{
  value: BtRamalConditionNote;
  labelKey: "deteriorated" | "splices" | "noInsulation" | "long" | "crossing" | "other";
}> = [
  { value: "deteriorado", labelKey: "deteriorated" },
  { value: "emendas", labelKey: "splices" },
  { value: "sem_isolamento", labelKey: "noInsulation" },
  { value: "ramal_longo", labelKey: "long" },
  { value: "cruzamento", labelKey: "crossing" },
  { value: "outro", labelKey: "other" },
];

const BtPoleVerificationSection: React.FC<BtPoleVerificationSectionProps> = ({
  locale,
  btTopology,
  projectType,
  selectedPoleId,
  selectedPole,
  isPoleDropdownOpen,
  setIsPoleDropdownOpen,
  selectPole,
  onBtRenamePole,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  updatePoleVerified,
  updatePoleRamais,
  updatePoleSpec,
  updatePoleBtStructures,
  updatePoleConditionStatus,
  updatePoleEquipmentNotes,
  updatePoleGeneralNotes,
}) => {
  const t = getBtTopologyPanelText(locale).poleVerification;

  return (
    <div className="space-y-3 rounded-lg border border-cyan-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-800">
        {t.title}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] text-slate-400">{t.selectedPole}</div>
        {btTopology.poles.length === 0 ? (
          <div className="text-[10px] text-slate-500">
            {t.noPole}
          </div>
        ) : (
          <>
            <div className="relative">
              <input
                type="text"
                value={selectedPole?.title ?? ""}
                spellCheck={false}
                onChange={(e) => {
                  if (!selectedPole) {
                    return;
                  }

                  const nextTitle = e.target.value;
                  const selectedOtherPole = btTopology.poles.find(
                    (pole) =>
                      pole.id !== selectedPole.id && pole.title === nextTitle,
                  );
                  if (selectedOtherPole) {
                    selectPole(selectedOtherPole.id);
                    return;
                  }

                  onBtRenamePole?.(selectedPole.id, nextTitle);
                }}
                title={t.placeholderPoleName}
                className="w-full rounded border border-slate-300 bg-white p-2 pr-8 text-xs font-medium text-slate-800 focus:border-cyan-500/60 outline-none"
              />
              <button
                type="button"
                onClick={() => setIsPoleDropdownOpen((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                title={t.selectPoleTitle}
              >
                <ChevronDown size={14} />
              </button>
              {isPoleDropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
                  {btTopology.poles.map((pole) => (
                    <button
                      key={pole.id}
                      type="button"
                      onClick={() => selectPole(pole.id)}
                      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${selectedPoleId === pole.id ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700"}`}
                    >
                      {pole.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedPole && (
              <>
                <button
                  onClick={() =>
                    updatePoleVerified(selectedPole.id, !selectedPole.verified)
                  }
                  className="rounded border border-cyan-400 px-3 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
                >
                  {selectedPole.verified
                    ? t.btnMarkUnverified
                    : t.btnMarkVerified}
                </button>

                {onBtSetPoleChangeFlag && (
                  <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-100/70 p-2">
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "remove")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "remove" ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      {t.flagRemove}
                    </button>
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "new")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "new" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      {t.flagNew}
                    </button>
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "replace")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "replace" ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      {t.flagReplace}
                    </button>
                    <button
                      onClick={() =>
                        onBtTogglePoleCircuitBreak?.(
                          selectedPole.id,
                          !(selectedPole.circuitBreakPoint ?? false),
                        )
                      }
                      title="Separa fisicamente o circuito neste poste"
                      className={`rounded border px-2 py-1 text-[10px] font-mono tracking-tight ${(selectedPole.circuitBreakPoint ?? false) ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      -| |-
                    </button>
                    <button
                      onClick={() =>
                        onBtSetPoleChangeFlag(selectedPole.id, "existing")
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${getPoleChangeFlag(selectedPole) === "existing" ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700" : "border-slate-300 bg-white text-slate-700"}`}
                    >
                      {t.flagExisting}
                    </button>
                  </div>
                )}

                {(selectedPole.circuitBreakPoint ?? false) && (
                  <div className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] text-sky-800">
                    {t.activeCircuitBreak}
                  </div>
                )}

                <div className="rounded border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-[10px] text-slate-600">
                    {t.sizeEffortTitle}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] text-slate-400">
                        {t.heightM}
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="ex: 11"
                        value={selectedPole.poleSpec?.heightM ?? ""}
                        title="Altura do poste em metros"
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const raw = numberFromInput(e.target.value);
                          const next: BtPoleSpec = {
                            ...selectedPole.poleSpec,
                            heightM: raw > 0 ? raw : undefined,
                          };
                          updatePoleSpec(
                            selectedPole.id,
                            next.heightM === undefined &&
                              next.nominalEffortDan === undefined
                              ? undefined
                              : next,
                          );
                        }}
                        className="w-20 rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                      />
                    </div>
                    <span className="mt-4 text-slate-400 text-sm">/</span>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] text-slate-400">
                        {t.effortDan}
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={50}
                        placeholder="ex: 400"
                        value={selectedPole.poleSpec?.nominalEffortDan ?? ""}
                        title="Esforço nominal do poste em daN"
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const raw = numberFromInput(e.target.value);
                          const next: BtPoleSpec = {
                            ...selectedPole.poleSpec,
                            nominalEffortDan: raw > 0 ? raw : undefined,
                          };
                          updatePoleSpec(
                            selectedPole.id,
                            next.heightM === undefined &&
                              next.nominalEffortDan === undefined
                              ? undefined
                              : next,
                          );
                        }}
                        className="w-24 rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                      />
                    </div>
                    {selectedPole.poleSpec?.heightM !== undefined &&
                      selectedPole.poleSpec?.nominalEffortDan !== undefined && (
                        <span className="mt-4 rounded bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 border border-cyan-200">
                          {selectedPole.poleSpec.heightM}/
                          {selectedPole.poleSpec.nominalEffortDan}
                        </span>
                      )}
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-[10px] text-slate-600">
                    {t.structuresTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["si1", "si2", "si3", "si4"] as const).map((slot) => (
                      <div key={slot} className="flex flex-col gap-0.5">
                        <label className="text-[9px] uppercase text-slate-400">
                          {slot}
                        </label>
                        <input
                          type="text"
                          value={selectedPole.btStructures?.[slot] ?? ""}
                          title={`Estrutura BT ${slot}`}
                          placeholder={`Informe ${slot}`}
                          maxLength={120}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            const nextStructures: BtPoleBtStructures = {
                              ...selectedPole.btStructures,
                              [slot]:
                                nextValue.trim().length > 0
                                  ? nextValue
                                  : undefined,
                            };
                            const hasAnyStructure = Object.values(
                              nextStructures,
                            ).some(
                              (value) =>
                                typeof value === "string" &&
                                value.trim().length > 0,
                            );
                            updatePoleBtStructures(
                              selectedPole.id,
                              hasAnyStructure ? nextStructures : undefined,
                            );
                          }}
                          className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-[10px] text-slate-600">
                    {t.poleStateTitle}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPole.conditionStatus ?? ""}
                      title="Estado físico do poste"
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        updatePoleConditionStatus(
                          selectedPole.id,
                          nextValue === ""
                            ? undefined
                            : (nextValue as BtPoleConditionStatus),
                        );
                      }}
                      className="w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                    >
                      <option value="">{t.selectState}</option>
                      {POLE_CONDITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t[option.labelKey]}
                        </option>
                      ))}
                    </select>
                    {selectedPole.conditionStatus && (
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        {POLE_CONDITION_OPTIONS.find(
                          (option) =>
                            option.value === selectedPole.conditionStatus,
                        ) ? t[POLE_CONDITION_OPTIONS.find((o) => o.value === selectedPole.conditionStatus)!.labelKey] : selectedPole.conditionStatus}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-[10px] text-slate-600">
                    {t.equipmentsTitle}
                  </div>
                  <textarea
                    value={selectedPole.equipmentNotes ?? ""}
                    title={t.equipmentsTitle}
                    placeholder={t.equipmentsPlaceholder}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      const trimmedValue = nextValue.trim();
                      updatePoleEquipmentNotes(
                        selectedPole.id,
                        trimmedValue.length > 0 ? nextValue : undefined,
                      );
                    }}
                    className="w-full resize-y rounded border border-slate-300 bg-white p-2 text-[11px] text-slate-800"
                  />
                  <div className="mt-1 text-right text-[9px] text-slate-400">
                    {(selectedPole.equipmentNotes ?? "").length}/500
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-[10px] text-slate-600">
                    {t.generalNotesTitle}
                  </div>
                  <textarea
                    value={selectedPole.generalNotes ?? ""}
                    title={t.generalNotesTitle}
                    placeholder={t.generalNotesPlaceholder}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      const trimmedValue = nextValue.trim();
                      updatePoleGeneralNotes(
                        selectedPole.id,
                        trimmedValue.length > 0 ? nextValue : undefined,
                      );
                    }}
                    className="w-full resize-y rounded border border-slate-300 bg-white p-2 text-[11px] text-slate-800"
                  />
                  <div className="mt-1 text-right text-[9px] text-slate-400">
                    {(selectedPole.generalNotes ?? "").length}/500
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-2">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-slate-600">
                    <span>{t.ramaisTitle}</span>
                    <button
                      onClick={() => {
                        const defaultRamalType =
                          projectType === "clandestino"
                            ? CLANDESTINO_RAMAL_TYPE
                            : NORMAL_CLIENT_RAMAL_TYPES[0];
                        updatePoleRamais(selectedPole.id, [
                          ...(selectedPole.ramais ?? []),
                          {
                            id: nextId("RP"),
                            quantity: 1,
                            ramalType: defaultRamalType,
                          },
                        ]);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Plus size={12} /> {t.btnAddRamal}
                    </button>
                  </div>

                  {(selectedPole.ramais ?? []).length === 0 ? (
                    <div className="text-[10px] text-slate-500">
                      {t.noRamais}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="rounded border border-slate-200 bg-slate-50 p-1.5 text-[10px] text-slate-600">
                        {(selectedPole.ramais ?? []).map((ramal) => {
                          const ramalType =
                            ramal.ramalType ??
                            (projectType === "clandestino"
                              ? CLANDESTINO_RAMAL_TYPE
                              : NORMAL_CLIENT_RAMAL_TYPES[0]);
                          return (
                            <div key={`summary-${ramal.id}`}>
                              {ramal.quantity} x {ramalType}
                              {ramal.notes ? (
                                <span className="ml-1 text-amber-700">
                                  ({ramal.notes})
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {(selectedPole.ramais ?? []).map((ramal) => (
                        <div key={ramal.id} className="flex flex-col gap-1.5">
                          <div className="grid grid-cols-[84px_1fr_auto] gap-2">
                            <input
                              type="number"
                              min={1}
                              value={ramal.quantity}
                              title={`Quantidade do ramal ${ramal.id}`}
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const quantity = Math.max(
                                  1,
                                  numberFromInput(e.target.value),
                                );
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).map((item) =>
                                    item.id === ramal.id
                                      ? { ...item, quantity }
                                      : item,
                                  ),
                                );
                              }}
                              className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                            />
                            <select
                              value={
                                ramal.ramalType ??
                                (projectType === "clandestino"
                                  ? CLANDESTINO_RAMAL_TYPE
                                  : NORMAL_CLIENT_RAMAL_TYPES[0])
                              }
                              title={`Tipo do ramal ${ramal.id}`}
                              onChange={(e) => {
                                const ramalType = e.target.value;
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).map((item) =>
                                    item.id === ramal.id
                                      ? { ...item, ramalType }
                                      : item,
                                  ),
                                );
                              }}
                              className="rounded border border-slate-300 bg-white p-1.5 text-[11px] text-slate-800"
                            >
                              {(projectType === "clandestino"
                                ? [CLANDESTINO_RAMAL_TYPE]
                                : NORMAL_CLIENT_RAMAL_TYPES
                              ).map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).filter(
                                    (item) => item.id !== ramal.id,
                                  ),
                                );
                              }}
                              className="rounded border border-rose-300 p-1.5 text-rose-700 hover:bg-rose-50"
                              title={t.btnRemoveRamal}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1">
                              {RAMAL_QUICK_NOTES.map((chip) => (
                                <button
                                  key={chip.value}
                                  type="button"
                                  title={`Observação: ${t.quickNotes[chip.labelKey]}`}
                                  onClick={() => {
                                    const current = ramal.notes ?? "";
                                    const next =
                                      current === t.quickNotes[chip.labelKey] ? "" : t.quickNotes[chip.labelKey];
                                    updatePoleRamais(
                                      selectedPole.id,
                                      (selectedPole.ramais ?? []).map((item) =>
                                        item.id === ramal.id
                                          ? {
                                              ...item,
                                              notes:
                                                next.length > 0
                                                  ? next
                                                  : undefined,
                                            }
                                          : item,
                                      ),
                                    );
                                  }}
                                  className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                    ramal.notes === t.quickNotes[chip.labelKey]
                                      ? "border-amber-400 bg-amber-50 text-amber-800"
                                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {t.quickNotes[chip.labelKey]}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              value={ramal.notes ?? ""}
                              maxLength={80}
                              title={`Observação do ramal ${ramal.id}`}
                              placeholder={t.freeObservation}
                              onChange={(e) => {
                                const next = e.target.value;
                                updatePoleRamais(
                                  selectedPole.id,
                                  (selectedPole.ramais ?? []).map((item) =>
                                    item.id === ramal.id
                                      ? {
                                          ...item,
                                          notes:
                                            next.trim().length > 0
                                              ? next
                                              : undefined,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                              className="w-full rounded border border-slate-200 bg-white p-1.5 text-[10px] text-slate-700 placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BtPoleVerificationSection;
