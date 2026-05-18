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
