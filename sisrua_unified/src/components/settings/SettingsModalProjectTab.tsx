import React from "react";
import { Activity, Briefcase, FolderOpen, Save } from "lucide-react";
import {
  AppSettings,
  BtEditorMode,
  BtProjectType,
  BtQtPontoCalculationMethod,
  BtTransformerCalculationMode,
  ProjectMetadata,
} from "../../types";

type SettingsModalProjectTabProps = {
  settings: AppSettings;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSaveProject?: () => void;
  onLoadProject?: (file: File) => void;
  setBtProjectType: (projectType: BtProjectType) => void;
  setBtEditorMode: (btEditorMode: BtEditorMode) => void;
  setBtTransformerCalculationMode: (
    btTransformerCalculationMode: BtTransformerCalculationMode,
  ) => void;
  setBtQtPontoCalculationMethod: (
    btQtPontoCalculationMethod: BtQtPontoCalculationMethod,
  ) => void;
  setBtCqtPowerFactor: (btCqtPowerFactor: number) => void;
  setClandestinoAreaM2: (clandestinoAreaM2: number) => void;
  updateMetadata: (key: keyof ProjectMetadata, value: string) => void;
};

export function SettingsModalProjectTab({
  settings,
  fileInputRef,
  onSaveProject,
  onLoadProject,
  setBtProjectType,
  setBtEditorMode,
  setBtTransformerCalculationMode,
  setBtQtPontoCalculationMethod,
  setBtCqtPowerFactor,
  setClandestinoAreaM2,
  updateMetadata,
}: SettingsModalProjectTabProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onLoadProject) {
      onLoadProject(file);
    }
  };

  return (
    <div
      role="tabpanel"
      id="settings-panel-project"
      aria-labelledby="settings-tab-project"
      className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
    >
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onSaveProject}
          disabled={!onSaveProject}
          className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
        >
          <Save size={16} /> Salvar Projeto
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!onLoadProject}
          className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
        >
          <FolderOpen size={16} /> Carregar Projeto
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".srua,.osmpro,.json"
          title="Carregar arquivo de projeto"
          className="hidden"
        />
      </div>

      <div className="glass-panel p-4 rounded-lg border border-white/20">
        <div className="text-enterprise-blue mb-4 flex items-center gap-2">
          <Briefcase size={18} />
          <h3 className="font-bold text-sm uppercase">Carimbo (Title Block)</h3>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Dados automáticos para o arquivo CAD.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 block mb-1">
              Nome do Projeto
            </label>
            <input
              type="text"
              value={settings.projectMetadata?.projectName || ""}
              title="Nome do projeto"
              placeholder="Nome do projeto"
              onChange={(event) =>
                updateMetadata("projectName", event.target.value)
              }
              className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cyan-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Empresa</label>
            <input
              type="text"
              value={settings.projectMetadata?.companyName || ""}
              title="Nome da empresa"
              placeholder="Nome da empresa"
              onChange={(event) =>
                updateMetadata("companyName", event.target.value)
              }
              className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cyan-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 block mb-1">
                Responsável
              </label>
              <input
                type="text"
                value={settings.projectMetadata?.engineerName || ""}
                title="Nome do responsável"
                placeholder="Nome do responsável"
                onChange={(event) =>
                  updateMetadata("engineerName", event.target.value)
                }
                className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cyan-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Data</label>
              <input
                type="text"
                value={settings.projectMetadata?.date || ""}
                title="Data do projeto"
                placeholder="DD/MM/AAAA"
                onChange={(event) => updateMetadata("date", event.target.value)}
                className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cyan-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-lg border border-white/20">
        <div className="text-enterprise-blue mb-4 flex items-center gap-2">
          <Activity size={18} />
          <h3 className="font-bold text-sm uppercase">Topologia Rede BT</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-600 block mb-2">
              Tipo de Projeto
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "ramais", label: "RAMAIS" },
                  { value: "geral", label: "GERAL" },
                  { value: "clandestino", label: "CLANDEST." },
                ] as { value: BtProjectType; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBtProjectType(option.value)}
                  className={`py-2 text-xs font-semibold rounded border transition-all ${
                    (settings.projectType ?? "ramais") === option.value
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {(settings.projectType ?? "ramais") === "clandestino" && (
            <div>
              <label className="text-xs text-slate-600 block mb-1">
                Área de Clandestinos (m²)
              </label>
              <input
                type="number"
                min={0}
                value={settings.clandestinoAreaM2 ?? 0}
                title="Área de clandestinos em metros quadrados"
                onFocus={(event) => event.target.select()}
                onClick={(event) => event.currentTarget.select()}
                onChange={(event) =>
                  setClandestinoAreaM2(Number(event.target.value) || 0)
                }
                className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cyan-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Campo obrigatório para o fluxo de clandestinos.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-600 block mb-2">
              Modo de Edição no Mapa
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "none", label: "Navegar" },
                  { value: "add-pole", label: "Inserir Poste" },
                  { value: "add-edge", label: "Inserir Condutor" },
                  { value: "add-transformer", label: "Inserir Trafo" },
                ] as { value: BtEditorMode; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBtEditorMode(option.value)}
                  className={`py-2 text-xs font-semibold rounded border transition-all ${
                    (settings.btEditorMode ?? "none") === option.value
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-600 block mb-2">
              Cálculo dos Transformadores
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "automatic", label: "Automático" },
                  { value: "manual", label: "Manual" },
                ] as { value: BtTransformerCalculationMode; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBtTransformerCalculationMode(option.value)}
                  className={`py-2 text-xs font-semibold rounded border transition-all ${
                    (settings.btTransformerCalculationMode ?? "automatic") ===
                    option.value
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Automático: recalcula demanda/corrente conforme topologia. Manual:
              preserva o que for informado no card.
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-600 block mb-2">
              Método do QT-PONTO
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "impedance_modulus",
                    label: "Módulo |Z|",
                  },
                  {
                    value: "power_factor",
                    label: "R·cosφ + X·sinφ",
                  },
                ] as { value: BtQtPontoCalculationMethod; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBtQtPontoCalculationMethod(option.value)}
                  className={`py-2 text-xs font-semibold rounded border transition-all ${
                    (settings.btQtPontoCalculationMethod ??
                      "impedance_modulus") === option.value
                      ? "bg-amber-600 border-amber-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Padrão: módulo da impedância para manter o cálculo mais
              conservador e compatível com a planilha atual.
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-600 block mb-1">
              Fator de Potência do QT
            </label>
            <input
              type="number"
              min={0.01}
              max={1}
              step={0.01}
              value={settings.btCqtPowerFactor ?? 0.92}
              title="Fator de potência usado no QT-PONTO quando o método com fator de potência estiver ativo"
              onFocus={(event) => event.target.select()}
              onClick={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setBtCqtPowerFactor(Number(event.target.value) || 0.92)
              }
              className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cyan-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Usado apenas quando o método R·cosφ + X·sinφ estiver ativo. Valor
              inicial: 0,92.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
