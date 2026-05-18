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
