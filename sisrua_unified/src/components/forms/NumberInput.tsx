import { forwardRef } from 'react';
import { parseBr, formatBr } from '../../utils/numericFormatting';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
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
