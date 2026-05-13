# 🚀 IMPLEMENTAÇÃO FRONTEND - GUIA PASSO A PASSO

**Objetivo:** Resolver issues críticas de type safety, form handling e UX em 2 semanas  
**Fase:** 1 (Crítica)

---

## ⚡ QUICK START (30 min)

### 1. Crie a pasta `src/types/`

```bash
mkdir -p src/types
```

### 2. Crie tipos base (Fase 1A - HOJE)

**`src/types/index.ts`** - Tipos centralizados

```typescript
// ============================================================================
// BT (Baixa Tensão) Types
// ============================================================================

export interface BtNetworkScenarioPayload {
  id?: string;
  mode: 'ramal' | 'clandestino';
  poles?: Array<{
    id: string;
    lat: number;
    lng: number;
    demandaClientesKva?: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface BtEditorModePayload {
  mode: 'view' | 'edit' | 'analyze';
  selectedPolesIds?: string[];
  selectedTransformerIds?: string[];
}

// ============================================================================
// MT (Média Tensão) Types
// ============================================================================

export interface MtNetworkState {
  selectionMode: 'center-radius' | 'polygon';
  terminals?: Array<{ lat: number; lng: number }>;
  profile?: 'rural' | 'urban' | 'industrial';
  maxSnapDistance?: number;
}

export interface MtRouterResult {
  routeId: string;
  segments: Array<{
    id: string;
    start: [number, number];
    end: [number, number];
    distance: number;
  }>;
  totalDistance: number;
}

// ============================================================================
// Form Types
// ============================================================================

export interface FormValidationError {
  field: string;
  message: string;
  code: 'required' | 'invalid' | 'out-of-range';
}

export interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
}

// ============================================================================
// Admin/Settings Types
// ============================================================================

export interface ServiceTierForm {
  serviceName: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  supportHours: string;
  slaAvailabilityPct: number;
  sloLatencyP95Ms: number;
  supportChannel: string;
}

export interface AdminSettings {
  theme: 'light' | 'dark' | 'sunlight';
  language: 'pt-BR' | 'en' | 'es';
  autoSave: boolean;
  debugMode: boolean;
  serviceTiers: ServiceTierForm[];
}

// ============================================================================
// App State Types
// ============================================================================

export interface AppContextState {
  settings: AdminSettings;
  btNetworkScenario: BtNetworkScenarioPayload | null;
  btEditorMode: BtEditorModePayload;
  mtNetworkState: MtNetworkState | null;
  appHistory: Array<{ timestamp: string; action: string }>;
}

export interface AppContextActions {
  setBtNetworkScenario: (s: BtNetworkScenarioPayload | null) => void;
  setBtEditorMode: (m: BtEditorModePayload) => void;
  setMtNetworkState: (s: MtNetworkState | null) => void;
  updateSettings: (s: Partial<AdminSettings>) => void;
}

// ============================================================================
// Component Props Types (exported for use in other files)
// ============================================================================

export interface WithLoading {
  isLoading?: boolean;
  error?: string | null;
}

export interface WithValidation {
  errors?: Record<string, string>;
  touched?: Record<string, boolean>;
}
```

---

## 📋 FASE 1A: Remove `any` Types (2 dias)

### Step 1: Fix `App.tsx`

**Antes:**

```tsx
// ❌ App.tsx line 149
setBtNetworkScenario: (s: any) =>
setBtEditorMode: (m: any) =>
```

**Depois:**

```tsx
// ✅ App.tsx line 149
import type { BtNetworkScenarioPayload, BtEditorModePayload } from './types';

// Dentro do context provider
setBtNetworkScenario: (s: BtNetworkScenarioPayload | null) => {
  // validação automática pelo TypeScript
  setAppState(
    p => ({
      ...p,
      btNetworkScenario: s,
    }),
    true
  );
};

setBtEditorMode: (m: BtEditorModePayload) => {
  setAppState(p => ({
    ...p,
    btEditorMode: m,
  }));
};
```

### Step 2: Fix `AppWorkspace.tsx`

```tsx
// ❌ ANTES
settings: any;
appPast: any[];
appFuture: any[];
toasts: any[];
sessionDraft: any;
latestBtExport: any;
btExportHistory: any[];
updateSettings: (s: any) => void;

// ✅ DEPOIS
import type { AdminSettings, BtNetworkScenarioPayload } from '../types';

settings: AdminSettings;
appPast: Array<{ timestamp: string; action: string }>;
appFuture: Array<{ timestamp: string; action: string }>;
toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;
sessionDraft: BtNetworkScenarioPayload | null;
latestBtExport: { timestamp: string; filename: string } | null;
btExportHistory: Array<{ timestamp: string; filename: string }>;
updateSettings: (s: Partial<AdminSettings>) => void;
```

### Step 3: Fix `FeatureFlagContext.tsx`

```tsx
// ❌ ANTES
const [data, setData] = useState<any>(null);
const [error, setError] = useState<any>(null);

// ✅ DEPOIS
interface UserPreference {
  userId: string;
  flagName: string;
  enabled: boolean;
  lastUpdated: string;
}

const [data, setData] = useState<UserPreference[] | null>(null);
const [error, setError] = useState<Error | null>(null);

// E no catch
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  setError(error);
  console.error("[Flags] Erro ao sincronizar", error.message);
}
```

---

## 🎨 FASE 1B: Refatorar AdminPage (2 dias)

### Step 1: Criar `useAdminForm.ts` Hook

**`src/hooks/useAdminForm.ts`**

```typescript
import { useState, useCallback } from 'react';
import { z } from 'zod';
import type { AdminSettings } from '../types';

// Schemas
export const ServiceTierSchema = z.object({
  serviceName: z.string().min(1, 'Nome do serviço é obrigatório'),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  supportHours: z.string().min(1, 'Horas de suporte são obrigatórias'),
  slaAvailabilityPct: z.number().min(0).max(100, 'SLA deve estar entre 0-100%'),
  sloLatencyP95Ms: z.number().min(0, 'Latência deve ser positiva'),
  supportChannel: z.string().min(1, 'Canal de suporte é obrigatório'),
});

const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'sunlight']),
  language: z.enum(['pt-BR', 'en', 'es']),
  autoSave: z.boolean(),
  debugMode: z.boolean(),
  serviceTiers: z.array(ServiceTierSchema),
});

export type AdminSettingsFormData = z.infer<typeof SettingsSchema>;

// Hook
export function useAdminForm(initialValues: AdminSettings) {
  const [form, setForm] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (field: string, value: unknown) => {
      try {
        // Validar campo individual
        if (field === 'serviceTierForm') {
          ServiceTierSchema.parse(value);
        } else {
          // Validar todo o form
          SettingsSchema.parse({ ...form, [field]: value });
        }

        // Remover erro se validação passou
        setErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.errors[0]?.message || 'Campo inválido';
          setErrors(prev => ({ ...prev, [field]: message }));
        }
        return false;
      }
    },
    [form]
  );

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      setForm(prev => {
        const keys = field.split('.');
        if (keys.length === 1) {
          return { ...prev, [field]: value };
        }

        // Suporta nested: "serviceTierForm.supportHours"
        const newForm = { ...prev };
        let current: any = newForm;
        for (let i = 0; i < keys.length - 1; i++) {
          current[keys[i]] = { ...current[keys[i]] };
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        return newForm;
      });

      // Validar apenas se campo foi tocado
      if (touched[field]) {
        validateField(field, value);
      }
    },
    [touched, validateField]
  );

  const handleBlur = useCallback(
    (field: string) => {
      setTouched(prev => ({ ...prev, [field]: true }));
      validateField(field, form[field as keyof typeof form]);
    },
    [form, validateField]
  );

  const handleSubmit = useCallback(
    async (onSubmit: (data: AdminSettings) => Promise<void>) => {
      return async (e: React.FormEvent) => {
        e.preventDefault();

        // Validar todo o form
        try {
          SettingsSchema.parse(form);
          setErrors({});
          setIsSubmitting(true);
          await onSubmit(form);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const newErrors: Record<string, string> = {};
            error.errors.forEach(err => {
              const path = err.path.join('.');
              newErrors[path] = err.message;
            });
            setErrors(newErrors);
            setTouched(Object.keys(newErrors).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
          }
        } finally {
          setIsSubmitting(false);
        }
      };
    },
    [form]
  );

  return {
    form,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset: () => setForm(initialValues),
  };
}
```

### Step 2: Criar componentes reutilizáveis

**`src/components/forms/FormGroup.tsx`**

```tsx
import { useId } from 'react';

interface FormGroupProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormGroup({
  label,
  required,
  error,
  hint,
  className = '',
  children,
}: FormGroupProps) {
  const id = useId();

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Clonar children e passar id */}
      {children && typeof children === 'object' && 'type' in children
        ? typeof children.type === 'function'
          ? React.cloneElement(children, { id } as any)
          : children
        : children}

      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
```

**`src/components/forms/NumberInput.tsx`**

```tsx
import { forwardRef } from 'react';
import { parseBr, formatBr } from '../../utils/numericFormatting';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: number;
  decimals?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, decimals = 2, onChange, min, max, onBlur, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={formatBr(value, decimals)}
        onChange={e => {
          const parsed = parseBr(e.target.value);
          if (Number.isFinite(parsed)) {
            const clamped =
              min !== undefined && max !== undefined
                ? Math.max(min, Math.min(max, parsed))
                : parsed;
            onChange(clamped);
          }
        }}
        onBlur={e => {
          // Formatar ao sair do campo
          const parsed = parseBr(e.target.value);
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
          onBlur?.(e);
        }}
        className={`
          w-full px-3 py-2 rounded-lg border
          bg-white dark:bg-slate-800
          text-slate-900 dark:text-white
          border-slate-300 dark:border-slate-600
          focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${className}
        `}
        {...props}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';
```

**`src/components/forms/SelectInput.tsx`**

```tsx
import { forwardRef } from 'react';

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  error?: boolean;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ options, error, className = '', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`
          w-full px-3 py-2 rounded-lg border
          bg-white dark:bg-slate-800
          text-slate-900 dark:text-white
          border-slate-300 dark:border-slate-600
          focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${error ? 'border-red-500 dark:border-red-500/50' : ''}
          ${className}
        `}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

SelectInput.displayName = 'SelectInput';
```

### Step 3: Refatorar AdminPage

**`src/components/AdminPage/AdminPage.tsx`** (novo)

```tsx
import { useState } from 'react';
import { useAdminForm } from '../../hooks/useAdminForm';
import { AdminSettings } from '../../components/AdminPage/AdminSettings';
import { AdminServiceTiers } from '../../components/AdminPage/AdminServiceTiers';
import type { AdminSettings as AdminSettingsType } from '../../types';

const DEFAULT_SETTINGS: AdminSettingsType = {
  theme: 'dark',
  language: 'pt-BR',
  autoSave: true,
  debugMode: false,
  serviceTiers: [
    {
      serviceName: 'API',
      tier: 'gold',
      supportHours: '24x7',
      slaAvailabilityPct: 99.9,
      sloLatencyP95Ms: 100,
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
      await new Promise(resolve => setTimeout(resolve, 500));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          Configurações de Admin
        </h1>

        {saveSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
            ✓ Configurações salvas com sucesso
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

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={form.isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {form.isSubmitting ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            <button
              type="button"
              onClick={form.reset}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              Descartar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**`src/components/AdminPage/AdminSettings.tsx`** (novo)

```tsx
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
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4">
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
          className="w-4 h-4 cursor-pointer"
        />
        <label
          htmlFor="autoSave"
          className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          ✓ Auto-save habilitado
        </label>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="debugMode"
          checked={form.debugMode}
          onChange={e => onFieldChange('debugMode', e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
        <label
          htmlFor="debugMode"
          className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          🐛 Modo debug
        </label>
      </div>
    </div>
  );
}
```

---

## 🎯 FASE 1C: Logger Estruturado (0.5 dia)

**`src/utils/logger.ts`**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;

  private createEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
  }

  private addToHistory(entry: LogEntry) {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: unknown) {
    const entry = this.createEntry(level, category, message, data);
    this.addToHistory(entry);

    // Apenas em desenvolvimento
    if (this.isDevelopment) {
      const style = this.getConsoleStyle(level);
      console.log(`%c[${entry.timestamp}] [${category}] ${message}`, style, data || '');
    }

    // Em produção: enviar para serviço de logging
    if (!this.isDevelopment && (level === 'error' || level === 'warn')) {
      this.sendToBackend(entry);
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #888; font-size: 0.9em;',
      info: 'color: #2563eb; font-weight: bold;',
      warn: 'color: #ea580c; font-weight: bold;',
      error: 'color: #dc2626; font-weight: bold;',
    };
    return styles[level];
  }

  private async sendToBackend(entry: LogEntry) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      // Silenciosamente falha se backend não disponível
    }
  }

  debug(category: string, message: string, data?: unknown) {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: unknown) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: unknown) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: unknown) {
    this.log('error', category, message, data);
  }

  getHistory() {
    return [...this.logHistory];
  }

  clearHistory() {
    this.logHistory = [];
  }
}

export const logger = new Logger();

// Exportar tipos úteis
export type { LogEntry, LogLevel };
```

**Uso em `FeatureFlagContext.tsx`:**

```tsx
import { logger } from '../utils/logger';

// Substituir console.error
} catch (e) {
  logger.error('FeatureFlags', 'Failed to parse local flags', e);
}

// Substituir console.warn
} catch (error) {
  logger.warn('FeatureFlags', 'Erro ao carregar do banco', error);
}
```

---

## ✅ CHECKLIST FASE 1

- [ ] `src/types/index.ts` criado com tipos base
- [ ] `App.tsx` atualizado - removidos `any` types
- [ ] `AppWorkspace.tsx` atualizado - tipos estruturados
- [ ] `FeatureFlagContext.tsx` atualizado - Error typing
- [ ] `src/hooks/useAdminForm.ts` criado
- [ ] `src/components/forms/` criado com componentes
- [ ] AdminPage refatorado em subcomponentes
- [ ] `src/utils/logger.ts` criado
- [ ] Todos os arquivos com `console.log` migrados para logger
- [ ] `npm run type-check` passa ✅
- [ ] `npm run test:frontend` passa ✅
- [ ] Nenhum novo warning de TypeScript

---

## 🚀 PRÓXIMOS PASSOS (Fase 2)

Após completar Fase 1:

1. **2A - Design System:**
   - LoadingSpinner, SkeletonLoader, EmptyState
   - Tempo: 1.5 dias

2. **2B - Form Components:**
   - FormGroup, NumberInput, SelectInput (melhorias)
   - Tempo: 1.5 dias

3. **2C - Toast System:**
   - Padronizar useToast em todas ações críticas
   - Tempo: 1.5 dias

4. **2D - Modal Accessibility:**
   - Focus trap, ARIA labels, keyboard navigation
   - Tempo: 1 dia

---

## 📚 RECURSOS

- [Zod Documentation](https://zod.dev/)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [React Hook Form](https://react-hook-form.com/) (alternativa futura)
- [Accessible Form Patterns](https://www.a11y-101.com/forms)

---

**Tempo Estimado Fase 1:** 4-5 dias com uma pessoa  
**Começar hoje para ir para Fase 2 na segunda-feira!** 🚀
