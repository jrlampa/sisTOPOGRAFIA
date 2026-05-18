import { FormGroup } from '../forms/FormGroup';
import { SelectInput } from '../forms/SelectInput';
import type { AdminSettings } from '../../types';

interface AdminSettingsProps {
  form: AdminSettings;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  onFieldChange: (field: string, value: unknown) => void;
  onFieldBlur: (field: string) => void;
}

export function AdminSettings({
  form,
  errors,
  touched,
  onFieldChange,
  onFieldBlur,
}: AdminSettingsProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Aparência & Idioma
      </h2>

      <FormGroup label="Tema" error={touched.theme ? errors.theme : undefined}>
        <SelectInput
          value={form.theme}
          onChange={e => onFieldChange('theme', e.target.value)}
          onBlur={() => onFieldBlur('theme')}
          options={[
            { value: 'light', label: '☀️ Claro' },
            { value: 'dark', label: '🌙 Escuro' },
            { value: 'sunlight', label: '✨ Sunlight' },
          ]}
        />
      </FormGroup>

      <FormGroup label="Idioma" error={touched.language ? errors.language : undefined}>
        <SelectInput
          value={form.language}
          onChange={e => onFieldChange('language', e.target.value)}
          onBlur={() => onFieldBlur('language')}
          options={[
            { value: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
            { value: 'en', label: '🇺🇸 English' },
            { value: 'es', label: '🇪🇸 Español' },
          ]}
        />
      </FormGroup>

      <div className="flex items-center gap-3 pt-2">
        <input
          type="checkbox"
          id="autoSave"
          checked={form.autoSave}
          onChange={e => onFieldChange('autoSave', e.target.checked)}
          className="w-4 h-4 cursor-pointer rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
        />
        <label
          htmlFor="autoSave"
          className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none"
        >
          Auto-save habilitado
        </label>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="debugMode"
          checked={form.debugMode}
          onChange={e => onFieldChange('debugMode', e.target.checked)}
          className="w-4 h-4 cursor-pointer rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
        />
        <label
          htmlFor="debugMode"
          className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none"
        >
          Modo debug (log detalhado)
        </label>
      </div>
    </div>
  );
}
