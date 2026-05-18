import { useState } from 'react';
import { useAdminForm } from '../../hooks/useAdminForm';
import { AdminSettings } from './AdminSettings';
import { AdminServiceTiers } from './AdminServiceTiers';
import type { AdminSettings as AdminSettingsType } from '../../types';

const DEFAULT_SETTINGS: AdminSettingsType = {
  theme: 'dark',
  language: 'pt-BR',
  autoSave: true,
  debugMode: false,
  serviceTiers: [
    {
      serviceName: 'API Core',
      tier: 'gold',
      supportHours: '24x7',
      slaAvailabilityPct: 99.9,
      sloLatencyP95Ms: 150,
      supportChannel: 'email',
    },
  ],
};

export default function AdminPage() {
  const form = useAdminForm(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = form.handleSubmit(async data => {
    try {
      // TODO: POST para backend
      await new Promise(resolve => setTimeout(resolve, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            Configurações de Admin
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie as preferências globais e perfis de serviço da plataforma.
          </p>
        </header>

        {saveSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">✓</span>
            Configurações salvas com sucesso
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          <AdminSettings
            form={form.form}
            errors={form.errors}
            touched={form.touched}
            onFieldChange={form.handleChange}
            onFieldBlur={form.handleBlur}
          />

          <AdminServiceTiers
            tiers={form.form.serviceTiers}
            errors={form.errors}
            touched={form.touched}
            onTierChange={(index, tier) => form.handleChange(`serviceTiers.${index}`, tier)}
            onTierBlur={index => form.handleBlur(`serviceTiers.${index}`)}
          />

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={form.isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all font-bold text-sm uppercase tracking-wider"
            >
              {form.isSubmitting ? 'Processando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={form.reset}
              className="px-6 py-2.5 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-sm uppercase tracking-wider"
            >
              Descartar Tudo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
