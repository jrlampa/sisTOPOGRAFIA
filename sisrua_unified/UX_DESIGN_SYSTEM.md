# 🎨 DESIGN SYSTEM & USABILIDADE - GUIA PRÁTICO

**Foco:** Melhorar experiência do usuário, consistência visual e padrões de interação  
**Audiência:** Designers, Frontend devs, Product managers

---

## 📊 ANÁLISE ATUAL DE UX

| Aspecto                   | Score | Achado                                           | Impacto |
| ------------------------- | ----- | ------------------------------------------------ | ------- |
| **Consistência Visual**   | 7/10  | Cores e tokens definidos, mas faltam componentes | Alto    |
| **Feedback Visual**       | 6/10  | Validação existe, mas falta feedback de ação     | Alto    |
| **Micro-interactions**    | 5/10  | Minimal, poucas animações e transições           | Médio   |
| **Loading States**        | 5/10  | Diferente em cada componente                     | Alto    |
| **Error Handling**        | 6/10  | Bom em alguns, inconsistente em outros           | Alto    |
| **Acessibilidade**        | 8/10  | WCAG 2.1 compliance, faltam melhorias            | Médio   |
| **Mobile Responsiveness** | 7/10  | Bom, mas alguns modals precisam ajuste           | Médio   |
| **Color Contrast**        | 8/10  | Bom em geral, poucos casos de risco              | Baixo   |
| **Dark Mode**             | 8/10  | Implementado bem                                 | Baixo   |
| **Onboarding**            | 4/10  | Mínimo, sem tooltips/help                        | Alto    |

---

## 🎯 PADRÕES UX A IMPLEMENTAR

### 1. LOADING STATES (Prioridade 🔴 ALTA)

**Problema:** Cada componente usa seu próprio loader

```tsx
// ❌ ANTES: Inconsistente
{
  isLoading && <Loader2 size={16} className="animate-spin" />;
}
{
  loading && <SpinnerIcon />;
}
// algum componente não tem feedback
```

**Solução:** Sistema unificado de loading states

```tsx
// ✅ DEPOIS: Consistente

// 1. Spinner para ações rápidas (<2s)
<LoadingSpinner
  size="sm"
  label="Carregando..."
/>

// 2. Skeleton para conteúdo (>2s)
<SkeletonLoader
  count={3}
  height="h-12"
/>

// 3. Progress bar para uploads/processos longos
<ProgressBar
  value={65}
  label="Processando... 65%"
/>
```

**Componentes para criar:**

**`src/components/ui/LoadingSpinner.tsx`**

```tsx
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

export function LoadingSpinner({
  size = 'md',
  label,
  fullScreen = false,
  overlay = false,
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: { icon: 16, container: 'h-16' },
    md: { icon: 24, container: 'h-24' },
    lg: { icon: 32, container: 'h-32' },
  };

  const sizes = sizeMap[size];

  const spinner = (
    <div className={cn('flex flex-col items-center justify-center gap-2', sizes.container)}>
      <Loader2 size={sizes.icon} className="text-blue-500 dark:text-blue-400 animate-spin" />
      {label && <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {overlay && <div className="absolute inset-0 bg-black/50 dark:bg-black/70" />}
        <div className="relative">{spinner}</div>
      </div>
    );
  }

  return spinner;
}
```

**`src/components/ui/SkeletonLoader.tsx`**

```tsx
interface SkeletonLoaderProps {
  count?: number;
  height?: string;
  variant?: 'text' | 'card' | 'avatar';
  className?: string;
}

export function SkeletonLoader({
  count = 3,
  height = 'h-10',
  variant = 'text',
  className = '',
}: SkeletonLoaderProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'avatar':
        return 'rounded-full w-12 h-12';
      case 'card':
        return 'rounded-lg';
      default:
        return 'rounded';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`
            ${height} ${getVariantClasses()}
            bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
            dark:from-slate-800 dark:via-slate-700 dark:to-slate-800
            animate-pulse
          `}
        />
      ))}
    </div>
  );
}
```

**`src/components/ui/ProgressBar.tsx`**

```tsx
interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ value = 0, label, showLabel = true, size = 'md' }: ProgressBarProps) {
  const heightMap = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const clampedValue = Math.min(100, Math.max(0, value));
  const displayLabel = label || `${Math.round(clampedValue)}%`;

  return (
    <div className="space-y-1">
      <div
        className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${heightMap[size]}`}
      >
        <div
          className={`h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-600 dark:text-slate-400 text-right">{displayLabel}</p>
      )}
    </div>
  );
}
```

---

### 2. EMPTY STATES (Prioridade 🔴 ALTA)

**Problema:** Muitos componentes mostram nada quando não há dados

```tsx
// ❌ ANTES
{
  !data?.length && <p>Nenhum resultado</p>;
}

// ✅ DEPOIS
{
  !data?.length && (
    <EmptyState
      icon={Search}
      title="Nenhum resultado"
      description="Tente ajustar seus filtros ou criar um novo item"
      action={<button>Criar Novo</button>}
    />
  );
}
```

**`src/components/ui/EmptyState.tsx`**

```tsx
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  iconColor?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  iconColor = 'text-slate-400 dark:text-slate-500',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Icon size={48} className={`mb-4 ${iconColor}`} />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
```

---

### 3. TOAST/NOTIFICATIONS (Prioridade 🔴 ALTA)

**Problema:** Ações sem feedback imediato ao usuário

**Padrão standardizado:**

```tsx
// ✅ Padrão: Toda ação crítica deve ter feedback

// 1. Deletar
const handleDelete = async id => {
  try {
    await deleteAPI(id);
    toast.success('Item deletado com sucesso');
  } catch (error) {
    toast.error(`Erro ao deletar: ${error.message}`);
  }
};

// 2. Submeter formulário
const handleSubmit = async data => {
  try {
    await submitAPI(data);
    toast.success('Formulário salvo com sucesso');
    form.reset();
  } catch (error) {
    toast.error(error.message);
  }
};

// 3. Carregar arquivo
const handleUpload = async file => {
  const toastId = toast.info('Enviando arquivo...');
  try {
    const result = await uploadAPI(file);
    toast.success('Arquivo enviado com sucesso', { id: toastId });
  } catch (error) {
    toast.error('Erro ao enviar arquivo', { id: toastId });
  }
};
```

**Toast tipos padronizados:**

```tsx
type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number; // ms, null = indefinido
  position?: 'top' | 'bottom';
}
```

---

### 4. INLINE FEEDBACK & VALIDATION (Prioridade 🔴 ALTA)

**Padrão existente bom, expandir:**

```tsx
// ✅ Padrão: Validação em tempo real + feedback contextual

<div className="space-y-2">
  <label htmlFor="demand" className="text-sm font-medium">
    Demanda Média (kVA) <span className="text-red-500">*</span>
  </label>

  <div className="relative">
    <input
      id="demand"
      type="number"
      value={form.demand}
      onChange={e => handleChange('demand', Number(e.target.value))}
      onBlur={() => handleBlur('demand')}
      aria-describedby={errors.demand ? 'demand-error' : 'demand-hint'}
      className={`
        w-full px-3 py-2 rounded-lg border transition-colors
        ${
          errors.demand
            ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
            : touched.demand
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
              : 'border-slate-300 dark:border-slate-600'
        }
      `}
    />

    {/* Status indicator */}
    {touched.demand && (
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {errors.demand ? (
          <XCircle size={20} className="text-red-500" />
        ) : (
          <CheckCircle size={20} className="text-emerald-500" />
        )}
      </div>
    )}
  </div>

  {/* Feedback message */}
  {errors.demand ? (
    <p id="demand-error" className="text-xs text-red-600 dark:text-red-400">
      {errors.demand}
    </p>
  ) : (
    <p id="demand-hint" className="text-xs text-slate-500 dark:text-slate-400">
      Informe um valor numérico positivo
    </p>
  )}
</div>
```

---

### 5. MICRO-INTERACTIONS & ANIMATIONS (Prioridade 🟡 MÉDIA)

**Adicionar vida à interface sem distrair:**

```tsx
// ✅ Padrão: Transições suaves, feedback tátil

// 1. Hover states
<button className="
  bg-blue-600 hover:bg-blue-700
  transition-colors duration-200
  active:scale-95
  dark:bg-blue-700 dark:hover:bg-blue-600
">
  Clique aqui
</button>

// 2. Loading animation
<div className="animate-pulse">Salvando...</div>
<div className="animate-spin">⟳</div>
<div className="animate-bounce">↑</div>

// 3. Fade in quando aparecer
<div className="animate-in fade-in slide-in-from-top-4">
  Novo conteúdo
</div>

// 4. Status badge com animação
<span className="
  inline-flex items-center gap-2 px-3 py-1 rounded-full
  bg-emerald-100 text-emerald-700
  dark:bg-emerald-950/30 dark:text-emerald-300
  animate-in fade-in scale-95 duration-300
">
  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse" />
  Ativo
</span>
```

---

### 6. ERROR STATES (Prioridade 🔴 ALTA)

**Problema:** Erros genéricos sem contexto

```tsx
// ❌ ANTES
{
  error && <div className="bg-red-50 p-2 text-xs text-red-700">{error}</div>;
}

// ✅ DEPOIS: Com contexto e ação de recuperação
{
  error && (
    <ErrorAlert
      title="Não foi possível carregar"
      description="Verifique sua conexão e tente novamente"
      action={{
        label: 'Tentar Novamente',
        onClick: retry,
      }}
    />
  );
}
```

**`src/components/ui/ErrorAlert.tsx`**

```tsx
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function ErrorAlert({
  title,
  description,
  action,
  dismissible = true,
  onDismiss,
}: ErrorAlertProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/40 p-4">
      <div className="flex gap-3">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-red-900 dark:text-red-300">{title}</h3>
          {description && (
            <p className="text-sm text-red-800 dark:text-red-400 mt-1">{description}</p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              disabled={action.loading}
              className="mt-3 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 underline disabled:opacity-50"
            >
              {action.loading ? 'Carregando...' : action.label}
            </button>
          )}
        </div>
        {dismissible && (
          <button
            onClick={onDismiss}
            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
            aria-label="Fechar"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### 7. CONFIRMAÇÃO DE AÇÕES CRÍTICAS (Prioridade 🟡 MÉDIA)

**Padrão:** Dialog modal para ações destrutivas

```tsx
// ✅ Padrão: Sempre confirmar deletar, resetar, etc.

<ConfirmDialog
  title="Deletar item?"
  description="Esta ação não pode ser desfeita"
  actionLabel="Deletar"
  actionVariant="destructive"
  onConfirm={handleDelete}
  open={deleteConfirmOpen}
  onOpenChange={setDeleteConfirmOpen}
/>
```

---

## 🎨 COLOR PALETTE & TOKENS

**Tokens de cor definidos:**

```typescript
// Severidade
const colors = {
  // Status
  success: '#10b981', // Emerald
  error: '#ef4444', // Red
  warning: '#f59e0b', // Amber
  info: '#3b82f6', // Blue

  // Neutros
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Glass effect
  glass: {
    bg: 'rgba(15, 23, 42, 0.8)', // dark
    border: 'rgba(148, 163, 184, 0.2)',
  },
};

// Implementar como Tailwind tokens
// tailwind.config.ts
export const tailwindConfig = {
  theme: {
    extend: {
      colors: {
        'status-success': '#10b981',
        'status-error': '#ef4444',
        'surface-glass': 'rgba(15, 23, 42, 0.8)',
      },
    },
  },
};
```

---

## 📱 RESPONSIVIDADE & MOBILE-FIRST

**Checklist:**

- [ ] Modals têm height máximo em mobile
- [ ] Inputs têm 44px min-height (accessibility)
- [ ] Texto base 16px para evitar zoom automático
- [ ] Testado em portrait and landscape
- [ ] Touch targets mínimo 44x44px
- [ ] Sem hover-only interactions (use focus-visible)

---

## ♿ ACESSIBILIDADE - CHECKLIST COMPLETO

### Formulários

- [ ] Labels explícitas (`<label htmlFor>`)
- [ ] `aria-label` se label não visível
- [ ] `aria-describedby` para messages de erro/hint
- [ ] `aria-required="true"` em campos obrigatórios
- [ ] `aria-invalid="true"` em campos com erro
- [ ] Cores não como único indicador (icon + text)

### Navegação

- [ ] Ordem de tab lógica (use `tabindex`)
- [ ] Focus visible sempre visível (`:focus-visible`)
- [ ] Skip link no topo da página
- [ ] Breadcrumb com `aria-label="Breadcrumb"`

### Componentes

- [ ] Modals com focus trap e `role="dialog"`
- [ ] Combobox com `aria-expanded`, `aria-owns`
- [ ] Data tables com `<caption>`, `<th scope>`
- [ ] Live regions para updates dinâmicos (`aria-live="polite"`)

### Cores

- [ ] Contrast mínimo 4.5:1 (texto normal)
- [ ] Contrast mínimo 3:1 (texto grande, UI)
- [ ] Testar com WebAIM Contrast Checker

---

## 🚀 CHECKLIST DE IMPLEMENTAÇÃO UX

### Sprint 1: Componentes UI Base

- [ ] LoadingSpinner
- [ ] SkeletonLoader
- [ ] ProgressBar
- [ ] EmptyState
- [ ] ErrorAlert
- [ ] ConfirmDialog

**Tempo:** 2 dias  
**ROI:** Alto - Base para todos os componentes

### Sprint 2: Padrões de Formulário

- [ ] Validação inline padronizada
- [ ] Toast notifications em todas ações
- [ ] Confirmação de ações críticas
- [ ] Feedback visual consistente

**Tempo:** 2 dias  
**ROI:** Alto - Melhora UX de forms

### Sprint 3: Micro-interactions

- [ ] Transições suaves (Tailwind CSS)
- [ ] Animações de estado (spin, pulse, bounce)
- [ ] Hover/active/focus states
- [ ] Loading animations

**Tempo:** 1.5 dias  
**ROI:** Médio - Polimento

### Sprint 4: Acessibilidade Avançada

- [ ] Audit com axe DevTools
- [ ] Fix contrast issues
- [ ] Add aria-labels faltando
- [ ] Test com teclado e screen reader

**Tempo:** 2 dias  
**ROI:** Médio - Compliance + UX

---

## 📊 MÉTRICAS UX PÓS-IMPLEMENTAÇÃO

Medir com:

- **Google Lighthouse** - Accessibility score
- **axe DevTools** - WCAG violations
- **User testing** - Task completion rate
- **Session recordings** - Behavior analysis
- **Heatmaps** - Click patterns

Metas:

```
Métrica                      | Atual | Target
------------------------------------------
Lighthouse Accessibility     | 92    | 98+
axe Violations              | ~30   | <5
Form error rate             | 15%   | <5%
User satisfaction (NPS)     | 6.5   | 8+
Mobile usability score      | 85    | 95+
```

---

## 💡 PADRÕES INSPIRAÇÕES

- **Vercel/Nextjs UI:** Minimalista, clara, dark-mode first
- **Radix UI:** Acessibilidade + unstyled flexibility
- **Shadcn/ui:** Copy-paste components com Tailwind
- **Stripe Docs:** Excelente uso de Empty States + Error patterns
- **Figma:** Micro-interactions fluidas

---

## 📚 RECURSOS

- [Accessible Components (Inclusive Components)](https://inclusive-components.design/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Vitals](https://web.dev/vitals/)
- [Tailwind CSS Animations](https://tailwindcss.com/docs/animation)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives/overview/introduction)

---

**Versão:** 1.0  
**Próxima Revisão:** Após Sprint 2  
**Dúvidas?** Consulte o Design System ou FRONTEND_AUDIT_REPORT.md
