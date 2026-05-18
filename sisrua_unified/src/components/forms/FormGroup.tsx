import React, { useId } from 'react';

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
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement, { id } as any)
        : children}

      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
