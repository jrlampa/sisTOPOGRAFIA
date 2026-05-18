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
    
    // Omit problematic standard HTML animation props that conflict with framer-motion
    const { onAnimationStart: _onAnimationStart, onDrag: _onDrag, onDragStart: _onDragStart, onDragEnd: _onDragEnd, ...restProps } = props as any;

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
        {...restProps}
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
