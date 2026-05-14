import React from "react";

type ToastType = "success" | "error" | "warning" | "info" | "alert";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoClose?: number | false;
}

const ToastContext = React.createContext<{
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
} | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
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
