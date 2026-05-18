import React, { useState } from 'react';
import { X, MapPin, Zap, Layout, ChevronRight, Globe, Layers } from 'lucide-react';
import { ProjectMetadata } from '../services/projectService';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: Partial<ProjectMetadata>) => Promise<void>;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    template: 'greenfield',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate({
        name: formData.name,
        location: formData.location,
        areaM2: 0, // Inicial
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600/20 rounded-2xl">
              <Zap className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">
                Novo Recorte
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
                Defina os parâmetros da nova jurisdição
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fechar modal"
            aria-label="Fechar modal"
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
              Nome do Projeto
            </label>
            <input
              autoFocus
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800"
              placeholder="Ex: Expansão Norte Setor A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                Localização
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  required
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800"
                  placeholder="Cidade, UF"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                Template Base
              </label>
              <div className="relative">
                <Layout className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <select
                  value={formData.template}
                  onChange={e => setFormData({ ...formData, template: e.target.value })}
                  title="Template base"
                  aria-label="Template base"
                  className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all appearance-none"
                >
                  <option value="greenfield">Greenfield (Novo)</option>
                  <option value="retrofit">Retrofit (Existente)</option>
                  <option value="subterraneo">Rede Subterrânea</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] text-center italic">
              Pré-Configuração de Engine
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-3">
                <Globe className="w-5 h-5 text-sky-400 opacity-40" />
                <div className="text-[9px] font-black text-slate-500 uppercase">
                  OSM Geocoding: <span className="text-emerald-400">Ativo</span>
                </div>
              </div>
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-3">
                <Layers className="w-5 h-5 text-fuchsia-400 opacity-40" />
                <div className="text-[9px] font-black text-slate-500 uppercase">
                  Auto-BIM Sync: <span className="text-emerald-400">Ativo</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              disabled={loading}
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm transition-all shadow-2xl shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Criando Workspace...' : 'Inicializar Editor'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
