import React, { useState } from 'react';
import { X, Cpu } from 'lucide-react';
import { AppSettings, SelectionMode, GeoLocation } from '../types';
import SettingsGeneralTab from './settings/SettingsGeneralTab';
import SettingsProjectTab from './settings/SettingsProjectTab';
import SettingsExportFooter from './settings/SettingsExportFooter';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;

  // Selection Props
  selectionMode?: SelectionMode;
  onSelectionModeChange?: (mode: SelectionMode) => void;
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  polygon?: GeoLocation[];
  onClearPolygon?: () => void;

  // Export Props
  hasData?: boolean;
  isDownloading?: boolean;
  onExportDxf?: () => void;
  onExportGeoJSON?: () => void;

  // Persistence Props
  onSaveProject?: () => void;
  onLoadProject?: (file: File) => void;
  onSaveCloudProject?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  selectionMode,
  onSelectionModeChange,
  radius,
  onRadiusChange,
  polygon,
  onClearPolygon,
  hasData,
  isDownloading,
  onExportDxf,
  onExportGeoJSON,
  onSaveProject,
  onLoadProject,
  onSaveCloudProject
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'project'>('general');

  if (!isOpen) return null;

  const tabStyle = (tab: 'general' | 'project') =>
    activeTab === tab
      ? { color: 'var(--enterprise-blue)', borderBottomColor: 'var(--enterprise-blue)' }
      : {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4">
      <div className="glass-card w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--enterprise-blue)' }}>
            <Cpu size={24} style={{ color: 'var(--enterprise-blue-light)' }} />
            Painel de Controle
          </h2>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-800 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-white/20">
          {(['general', 'project'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === tab
                ? 'border-b-2 glass-panel-hover'
                : 'text-slate-600 hover:text-slate-800 hover:bg-white/20'}`}
              style={tabStyle(tab)}
            >
              {tab === 'general' ? 'Geral & Exportação' : 'Projeto & Metadados'}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'project' ? (
            <SettingsProjectTab
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onSaveProject={onSaveProject}
              onLoadProject={onLoadProject}
              onSaveCloudProject={onSaveCloudProject}
            />
          ) : (
            <SettingsGeneralTab
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}
        </div>

        <SettingsExportFooter
          hasData={hasData}
          isDownloading={isDownloading}
          onExportDxf={onExportDxf}
          onExportGeoJSON={onExportGeoJSON}
        />
      </div>
    </div>
  );
};

export default SettingsModal;
