import React from 'react';
import { Map as MapIcon, Search, Loader2, Mountain, TrendingUp, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeoLocation, AppSettings, SelectionMode, BtTopology, BtEditorMode, BtNetworkScenario, AnalysisStats } from '../types';
import { MIN_RADIUS, MAX_RADIUS } from '../constants';
import BtTopologyPanel from './BtTopologyPanel';
import Dashboard from './Dashboard';
import DxfLegend from './DxfLegend';
import BatchUpload from './BatchUpload';
import { PendingNormalClassificationPole } from '../constants/btConstants';

interface AppSidebarProps {
  isDark: boolean;
  isSidebarDockedForRamalModal: boolean;
  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearching: boolean;
  handleSearch: (e: React.FormEvent) => void;
  center: GeoLocation;
  // BT Editor
  settings: AppSettings;
  btNetworkScenario: BtNetworkScenario;
  btEditorMode: BtEditorMode;
  pendingBtEdgeStartPoleId: string | null;
  setPendingBtEdgeStartPoleId: (id: string | null) => void;
  btPoleCoordinateInput: string;
  setBtPoleCoordinateInput: (v: string) => void;
  handleBtInsertPoleByCoordinates: () => void;
  pendingNormalClassificationPoles: PendingNormalClassificationPole[];
  handleResetBtTopology: () => void;
  // Topology
  btTopology: BtTopology;
  updateBtTopology: (t: BtTopology) => void;
  updateProjectType: (t: 'ramais' | 'clandestino') => void;
  updateClandestinoAreaM2: (v: number) => void;
  handleBtRenamePole: (id: string, title: string) => void;
  handleBtRenameTransformer: (id: string, title: string) => void;
  updateSettings: (s: AppSettings) => void;
  // Selection
  selectionMode: SelectionMode;
  handleSelectionModeChange: (mode: SelectionMode) => void;
  radius: number;
  setAppStateRadius: (r: number) => void;
  saveSnapshot: () => void;
  // Analysis
  isProcessing: boolean;
  isPolygonValid: boolean;
  handleFetchAndAnalyze: () => void;
  // Results
  osmData: unknown;
  stats: AnalysisStats | null;
  analysisText: string;
  terrainData: unknown;
  isDownloading: boolean;
  handleDownloadDxf: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  error: string | null;
}

const AppSidebar: React.FC<AppSidebarProps> = ({
  isDark, isSidebarDockedForRamalModal,
  searchQuery, setSearchQuery, isSearching, handleSearch, center,
  settings, btNetworkScenario, btEditorMode,
  pendingBtEdgeStartPoleId, setPendingBtEdgeStartPoleId,
  btPoleCoordinateInput, setBtPoleCoordinateInput, handleBtInsertPoleByCoordinates,
  pendingNormalClassificationPoles, handleResetBtTopology,
  btTopology, updateBtTopology, updateProjectType, updateClandestinoAreaM2,
  handleBtRenamePole, handleBtRenameTransformer, updateSettings,
  selectionMode, handleSelectionModeChange, radius, setAppStateRadius, saveSnapshot,
  isProcessing, isPolygonValid, handleFetchAndAnalyze,
  osmData, stats, analysisText, terrainData, isDownloading, handleDownloadDxf,
  showToast, error
}) => (
  <motion.aside
    initial={{ x: -20, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    className={`border-r flex flex-col gap-8 overflow-y-auto z-20 shadow-2xl transition-all duration-300 scrollbar-hide ${isSidebarDockedForRamalModal ? 'w-0 p-0 opacity-0 pointer-events-none border-r-0' : 'w-[400px] p-8 opacity-100'} ${isDark ? 'bg-[#020617] border-white/5' : 'bg-white border-slate-200'}`}
    aria-hidden={isSidebarDockedForRamalModal}
  >
    {/* Search Card */}
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Área Alvo</label>
      </div>
      <form onSubmit={handleSearch} className="relative group">
        <input
          type="text"
          placeholder='Cidade, Endereço ou Coordenadas (UTM)'
          aria-label="Search area"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white placeholder-slate-600 shadow-inner group-hover:border-white/10"
        />
        <Search className="absolute left-4 top-3.5 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
        <AnimatePresence>
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              type="submit"
              disabled={isSearching}
              className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              {isSearching ? <Loader2 className="animate-spin" size={12} /> : "BUSCAR"}
            </motion.button>
          )}
        </AnimatePresence>
      </form>

      {center.label && (
        <motion.div
          layoutId="location-badge"
          className="flex items-center gap-3 text-xs text-blue-400 bg-blue-500/5 p-3 rounded-xl border border-blue-500/10"
        >
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <MapIcon size={14} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold truncate">{center.label}</span>
            <span className="text-[10px] text-slate-500 font-mono italic">{center.lat.toPrecision(7)}, {center.lng.toPrecision(7)}</span>
          </div>
        </motion.div>
      )}
    </div>

    <div className="h-px bg-white/5 mx-2"></div>

    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Editor BT</label>
        <span className="text-[9px] text-slate-500 uppercase">{(settings.projectType ?? 'ramais').toUpperCase()} / {btNetworkScenario === 'asis' ? 'ATUAL' : 'PROJETO'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => updateSettings({ ...settings, btNetworkScenario: 'asis', btEditorMode: 'none' })}
          className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btNetworkScenario === 'asis' ? 'bg-cyan-700 text-white border-cyan-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
        >
          REDE ATUAL
        </button>
        <button
          onClick={() => updateSettings({ ...settings, btNetworkScenario: 'projeto' })}
          className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btNetworkScenario === 'projeto' ? 'bg-indigo-700 text-white border-indigo-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
        >
          REDE NOVA
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => updateSettings({ ...settings, btEditorMode: 'none' })}
          className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'none' ? 'bg-slate-800 text-slate-100 border-white/10' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
        >
          NAVEGAR
        </button>
        <button
          onClick={() => updateSettings({ ...settings, btEditorMode: 'move-pole' })}
          className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'move-pole' ? 'bg-amber-600 text-white border-amber-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
        >
          MOVER
        </button>
        <button
          onClick={() => updateSettings({ ...settings, btEditorMode: 'add-pole' })}
          className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-pole' ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
        >
          + POSTE
        </button>
        <button
          onClick={() => {
            setPendingBtEdgeStartPoleId(null);
            updateSettings({ ...settings, btEditorMode: 'add-edge' });
          }}
          className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-edge' ? 'bg-emerald-600 text-white border-emerald-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
        >
          + CONDUTOR
        </button>
        <button
          onClick={() => updateSettings({ ...settings, btEditorMode: 'add-transformer' })}
          className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-transformer' ? 'bg-violet-600 text-white border-violet-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
        >
          + TRAFO
        </button>
      </div>
      {btEditorMode === 'add-pole' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleBtInsertPoleByCoordinates();
          }}
          className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 space-y-2"
        >
          <div className="text-[10px] font-semibold text-blue-200">Inserir poste por coordenadas</div>
          <input
            type="text"
            value={btPoleCoordinateInput}
            onChange={(e) => setBtPoleCoordinateInput(e.target.value)}
            placeholder="-22.9068 -43.1729 ou 23K 635806 7462003"
            aria-label="Coordenadas do poste"
            className="w-full rounded border border-blue-500/40 bg-slate-900 p-2 text-[11px] text-blue-100 placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="w-full rounded border border-blue-500 bg-blue-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-blue-500"
          >
            INSERIR POR COORDENADA
          </button>
        </form>
      )}
      {btEditorMode === 'move-pole' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium leading-snug text-amber-900 shadow-sm">
          <div>Arraste fino de poste:</div>
          <div>Clique e segure no poste para ajustar a posicao no mapa.</div>
        </div>
      )}
      {btNetworkScenario === 'asis' && (
        <div className="text-[10px] text-cyan-900 bg-cyan-50 border border-cyan-300 rounded-lg p-2">
          Rede Atual ativa: você pode navegar e lançar poste, condutor e trafo na topologia existente.
        </div>
      )}
      {settings.projectType === 'clandestino' && (
        <div className="text-[10px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-lg p-2">
          Área clandestina: {settings.clandestinoAreaM2 ?? 0} m²
        </div>
      )}
      {settings.projectType !== 'clandestino' && pendingNormalClassificationPoles.length > 0 && (
        <div className="text-[10px] text-rose-300 bg-rose-900/20 border border-rose-500/30 rounded-lg p-2">
          Classificação pendente em {pendingNormalClassificationPoles.length} poste(s). DXF bloqueado até classificar.
        </div>
      )}
      <button
        onClick={handleResetBtTopology}
        className="w-full text-[10px] font-bold py-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 transition-all"
        title="Remover toda a topologia BT"
      >
        ZERAR BT (LIMPAR TUDO)
      </button>
    </div>

    <div className="h-px bg-white/5 mx-2"></div>

    <BtTopologyPanel
      btTopology={btTopology}
      projectType={settings.projectType ?? 'ramais'}
      btNetworkScenario={btNetworkScenario}
      clandestinoAreaM2={settings.clandestinoAreaM2 ?? 0}
      onTopologyChange={updateBtTopology}
      onProjectTypeChange={updateProjectType}
      onClandestinoAreaChange={updateClandestinoAreaM2}
      onBtRenamePole={handleBtRenamePole}
      onBtRenameTransformer={handleBtRenameTransformer}
    />

    {/* Control Section */}
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Modo de Seleção</label>
        </div>
        <div className="flex p-1 bg-slate-900 rounded-xl border border-white/5">
          <button
            onClick={() => handleSelectionModeChange('circle')}
            className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'circle' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
          >
            RAIO
          </button>
          <button
            onClick={() => handleSelectionModeChange('polygon')}
            className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'polygon' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
          >
            POLÍGONO
          </button>
          <button
            onClick={() => handleSelectionModeChange('measure')}
            className={`flex-none px-3 py-2 rounded-lg transition-all ${selectionMode === 'measure' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/10' : 'text-slate-500 hover:text-slate-300'}`}
            title="Modo Perfil"
          >
            <TrendingUp size={14} />
          </button>
        </div>
      </div>

      {selectionMode === 'circle' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Raio da Região</label>
            <div className="bg-slate-900 border border-white/5 px-2.5 py-1 rounded-lg">
              <span className="text-xs font-mono font-bold text-blue-400">{radius}</span>
              <span className="text-[10px] text-slate-600 ml-1">METROS</span>
            </div>
          </div>
          <div className="relative pt-1">
            <input
              type="range"
              aria-label="Raio da região"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={10}
              value={radius}
              onMouseDown={saveSnapshot}
              onTouchStart={saveSnapshot}
              onChange={(e) => setAppStateRadius(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
            />
            <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-600 uppercase">
              <span>{MIN_RADIUS}m</span>
              <span>{MAX_RADIUS}m</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>

    <div className="h-px bg-white/5 mx-2"></div>

    {/* Action Button */}
    <div>
      <motion.button
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleFetchAndAnalyze}
        disabled={isProcessing || (selectionMode === 'polygon' && !isPolygonValid)}
        className={`group w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase transition-all shadow-2xl ${isProcessing || (selectionMode === 'polygon' && !isPolygonValid)
          ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30'
          }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            PROCESSANDO...
          </>
        ) : (
          <>
            <div className="p-1 rounded bg-white/10 group-hover:rotate-12 transition-transform">
              <TrendingUp size={16} />
            </div>
            ANALISAR REGIÃO
          </>
        )}
      </motion.button>
    </div>

    {/* Error Display */}
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-rose-400 text-sm overflow-hidden"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="font-medium">{error}</p>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Analysis Results */}
    <AnimatePresence>
      {!!osmData && stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6 mt-auto overflow-visible"
        >
          <div className="h-px bg-white/5 mx-2"></div>
          <Dashboard stats={stats} analysisText={analysisText} />

          <DxfLegend />

          <BatchUpload
            onError={(message) => showToast(message, 'error')}
            onInfo={(message) => showToast(message, 'info')}
          />

          <div className="flex items-center gap-3 p-4 glass rounded-2xl">
            <div className={`p-2 rounded-lg ${terrainData ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
              <Mountain size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">MOTOR DE TERRENO</span>
              <span className="text-xs font-bold text-slate-200">{terrainData ? 'Grade de Alta Resolução Carregada' : 'Grade Pendente...'}</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadDxf}
            disabled={isDownloading}
            className="group w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase shadow-xl shadow-emerald-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? <Loader2 className="animate-spin" size={18} /> : (
              <div className="p-1 rounded bg-white/10 group-hover:animate-bounce">
                <Download size={18} />
              </div>
            )}
            {isDownloading ? 'GERANDO...' : 'BAIXAR DXF'}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.aside>
);

export default AppSidebar;
