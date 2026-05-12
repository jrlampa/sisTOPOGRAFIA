# 🛠️ UI/UX QUICK START - IMPLEMENTAÇÕES PRÁTICAS

## 1️⃣ CRIAR ATOMIC COMPONENTS LIBRARY

### Passo 1: Estrutura de Pastas

```bash
mkdir -p src/components/ui/
touch src/components/ui/{Button,Input,Card,Badge,Modal,Drawer}.tsx
touch src/components/ui/index.ts
```

### Passo 2: Button.tsx Completo

```tsx
import React from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/theme/motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary: `
    bg-brand-600 hover:bg-brand-700 text-white
    disabled:bg-brand-400
  `,
  secondary: `
    bg-surface-glass border border-glass-border
    hover:bg-glass-hover-bg hover:border-glass-border-hover
    text-current
    disabled:opacity-50
  `,
  ghost: `
    text-current hover:bg-surface-soft
    disabled:opacity-50
  `,
  danger: `
    bg-severity-critical hover:bg-red-700 text-white
    disabled:opacity-50
  `,
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-2",
  md: "px-4 py-2 text-base gap-2.5",
  lg: "px-6 py-3 text-lg gap-3",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      icon,
      iconPosition = "left",
      fullWidth = false,
      children,
      className = "",
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        whileHover={!prefersReducedMotion && !disabled ? { scale: 1.02 } : {}}
        whileTap={!prefersReducedMotion && !disabled ? { scale: 0.98 } : {}}
        disabled={isLoading || disabled}
        className={`
          flex items-center justify-center
          rounded-lg font-medium transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 
          focus-visible:ring-brand-500 focus-visible:ring-offset-1
          dark:focus-visible:ring-offset-slate-900
          disabled:cursor-not-allowed
          ${VARIANT_STYLES[variant]}
          ${SIZE_STYLES[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {isLoading && (
          <Loader2 size={size === "sm" ? 14 : 18} className="animate-spin" />
        )}
        {!isLoading && icon && iconPosition === "left" && icon}
        {!isLoading && <span>{children}</span>}
        {!isLoading && icon && iconPosition === "right" && icon}
      </motion.button>
    );
  },
);

Button.displayName = "Button";
```

### Passo 3: Input.tsx Completo

```tsx
import React from "react";
import { AlertCircle } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      required = false,
      icon,
      iconPosition = "left",
      className = "",
      ...props
    },
    ref,
  ) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-app-title">
            {label}
            {required && <span className="text-severity-critical ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && iconPosition === "left" && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-app-subtle">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            className={`
              w-full px-4 py-2 rounded-lg
              border transition-all duration-200
              bg-app-shell-bg text-app-shell-fg
              placeholder:text-app-subtle
              
              border-app-panel-border
              hover:border-app-panel-border hover:bg-surface-soft
              focus:outline-none focus:ring-2 focus:ring-brand-500 
              focus:border-transparent
              
              disabled:opacity-50 disabled:cursor-not-allowed
              
              ${icon && iconPosition === "left" ? "pl-10" : ""}
              ${icon && iconPosition === "right" ? "pr-10" : ""}
              ${error ? "border-severity-critical focus:ring-severity-critical" : ""}
              ${className}
            `}
            {...props}
          />

          {icon && iconPosition === "right" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-app-subtle">
              {icon}
            </div>
          )}
        </div>

        {error ? (
          <div className="flex items-center gap-1.5 text-xs text-severity-critical">
            <AlertCircle size={14} />
            {error}
          </div>
        ) : hint ? (
          <p className="text-xs text-app-subtle">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
```

### Passo 4: Exportar do index.ts

```tsx
// src/components/ui/index.ts
export { Button } from "./Button";
export { Input } from "./Input";
export { Card } from "./Card";
export { Badge } from "./Badge";
export { Modal } from "./Modal";
export { Drawer } from "./Drawer";

export type { ButtonProps } from "./Button";
export type { InputProps } from "./Input";
// ... etc
```

---

## 2️⃣ MOBILE NAVIGATION DRAWER

### Implementação Completa

```tsx
// src/components/ui/Drawer.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: "left" | "right";
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "max-w-xs",
  md: "max-w-sm",
  lg: "max-w-md",
};

export function Drawer({
  isOpen,
  onClose,
  title,
  position = "left",
  children,
  size = "md",
}: DrawerProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const slideDirection = position === "left" ? -256 : 256;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            className={`
              fixed inset-y-0 ${position}-0
              ${SIZE_MAP[size]} w-full
              bg-app-shell-bg border-r border-app-sidebar-border
              z-50 md:hidden
              flex flex-col
            `}
            initial={{ x: slideDirection }}
            animate={{ x: 0 }}
            exit={{ x: slideDirection }}
            transition={{ type: "spring", damping: 20 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-app-panel-border">
              {title && <h2 className="font-semibold text-lg">{title}</h2>}
              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="p-2 hover:bg-surface-soft rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### Uso em AppShellLayout

```tsx
// src/components/AppShellLayout.tsx - PARCIAL
export function AppShellLayout(props: Props) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex flex-col h-screen md:flex-row">
      {/* Header */}
      <header className="order-1 md:order-none h-16 border-b">
        <AppHeader
          {...props.appHeaderProps}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
        />
      </header>

      {/* Mobile Drawer */}
      <Drawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        title="Menu"
        position="left"
      >
        <SidebarWorkspace {...props.sidebarWorkspaceProps} />
      </Drawer>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block md:w-72 border-r overflow-y-auto">
        <SidebarWorkspace {...props.sidebarWorkspaceProps} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <MainMapWorkspace {...props.mainMapWorkspaceProps} />
      </main>
    </div>
  );
}
```

---

## 3️⃣ ACCESSIBILITY HOOKS

### useFocusTrap.ts

```tsx
// src/hooks/useFocusTrap.ts
import React from "react";

export function useFocusTrap(
  elementRef: React.RefObject<HTMLElement>,
  options: { initialFocus?: HTMLElement } = {},
) {
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const FOCUSABLE_SELECTOR = `
      button,
      [href],
      input,
      select,
      textarea,
      [tabindex]:not([tabindex="-1"])
    `;

    const focusableElements = Array.from(
      element.querySelectorAll(FOCUSABLE_SELECTOR),
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const firstElement = options.initialFocus || focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    element.addEventListener("keydown", handleKeyDown);
    firstElement.focus();

    return () => {
      element.removeEventListener("keydown", handleKeyDown);
    };
  }, [elementRef, options]);
}
```

### useAriaAnnounce.ts

```tsx
// src/hooks/useAriaAnnounce.ts
import React from "react";

export function useAriaAnnounce() {
  const announceRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Create aria-live region if doesn't exist
    if (!document.getElementById("aria-announce-region")) {
      const region = document.createElement("div");
      region.id = "aria-announce-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      region.className = "sr-only";
      document.body.appendChild(region);
      announceRef.current = region;
    }
  }, []);

  const announce = (message: string) => {
    const region =
      announceRef.current || document.getElementById("aria-announce-region");
    if (region) {
      region.textContent = message;
    }
  };

  return announce;
}
```

### useReducedMotion.ts (Melhorado)

```tsx
// src/theme/motion.ts - MELHORADO
import React from "react";

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReduced;
}

// Export para uso global
export const MOTION_CONFIG = {
  transition: { type: "spring", damping: 20, stiffness: 60 },
  fast: { duration: 0.15 },
  normal: { duration: 0.3 },
  slow: { duration: 0.5 },
};
```

---

## 4️⃣ VALIDATION & ERROR HANDLING

### FormError Component

```tsx
// src/components/ui/FormError.tsx
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

type ErrorSeverity = "error" | "warning" | "info";

interface FormErrorProps {
  message?: string | string[];
  severity?: ErrorSeverity;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function FormError({
  message,
  severity = "error",
  dismissible = false,
  onDismiss,
}: FormErrorProps) {
  if (!message) return null;

  const messages = Array.isArray(message) ? message : [message];
  const icons = {
    error: <AlertCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <Info size={16} />,
  };

  const styles = {
    error:
      "bg-severity-critical/10 border-severity-critical/30 text-severity-critical",
    warning: "bg-severity-warn/10 border-severity-warn/30 text-severity-warn",
    info: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300",
  };

  return (
    <div
      className={`
      flex gap-2 p-3 rounded-lg border
      ${styles[severity]}
    `}
    >
      {icons[severity]}
      <div className="flex-1 space-y-1 text-sm">
        {messages.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

### Toast System

```tsx
// src/hooks/useToast.ts
import React from "react";

type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoClose?: number;
}

const ToastContext = React.createContext<{
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
}>({
  toasts: [],
  addToast: () => "",
  removeToast: () => {},
});

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = Date.now().toString();
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    if (toast.autoClose !== false) {
      setTimeout(() => {
        removeToast(id);
      }, toast.autoClose || 5000);
    }

    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
```

---

## 5️⃣ CHECKLIST DE IMPLEMENTAÇÃO

### ✅ Imediato (1-2 horas)

- [ ] Criar `src/components/ui/` folder
- [ ] Implementar Button component
- [ ] Implementar Input component
- [ ] Exportar do index.ts
- [ ] Adicionar ARIA labels basics

### ✅ Curto Prazo (1 semana)

- [ ] Criar Card, Badge, Modal components
- [ ] Implementar useFocusTrap hook
- [ ] Criar FormError component
- [ ] Setup Storybook básico

### ✅ Médio Prazo (2-4 semanas)

- [ ] Criar Drawer/Mobile navigation
- [ ] Accessibility audit completo
- [ ] Toast system
- [ ] Design System documentation

### ✅ Longo Prazo (4-8 semanas)

- [ ] Migrar componentes existentes para usar UI lib
- [ ] Responsive design overhaul
- [ ] Performance optimization
- [ ] Lighthouse 90+

---

## 📝 ARQUIVO PACKAGE.JSON DEPENDENCIES

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.2",
    "tailwindcss": "^4.2.4",
    "framer-motion": "^12.0.0",
    "lucide-react": "^latest",
    "@hookform/resolvers": "^3.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@storybook/react": "^8.x",
    "@storybook/addon-a11y": "^8.x",
    "@storybook/addon-essentials": "^8.x",
    "@axe-core/react": "^4.x",
    "typescript": "^6.0.3"
  }
}
```

---

## 🎨 TAILWIND EXTEND UPDATE

```js
// tailwind.config.js - ADD THESE
theme: {
  extend: {
    // ... existing
    spacing: {
      // Enforce spacing scale
      'xs': '4px',
      'sm': '8px',
      'md': '16px',
      'lg': '24px',
      'xl': '32px',
    },
    zIndex: {
      'flat': '0',
      'raised': '10',
      'floating': '20',
      'sticky': '30',
      'modal': '40',
    },
  },
}
```

---

**Próximos passos:** Comece implementando os `Quick Wins` da estratégia! 🚀
