import type { InlineValidationState } from "../utils/validation";

type ValidationPalette = "dark" | "light";

type FormFieldMessageProps = {
  id?: string;
  message?: string;
  tone?: InlineValidationState;
  palette?: ValidationPalette;
  className?: string;
};

const inputToneClasses: Record<
  ValidationPalette,
  Record<InlineValidationState, string>
> = {
  dark: {
    default:
      "border-white/5 text-white placeholder-slate-600 focus:ring-blue-500/50 group-hover:border-white/10",
    success:
      "border-emerald-500/60 text-emerald-100 placeholder-emerald-200/40 focus:ring-emerald-500/40",
    error:
      "border-rose-500/60 text-rose-100 placeholder-rose-200/40 focus:ring-rose-500/40",
  },
  light: {
    default:
      "border-slate-300 text-slate-800 placeholder-slate-400 focus:ring-blue-500/30",
    success:
      "border-emerald-500/60 text-slate-900 placeholder-emerald-300/70 focus:ring-emerald-500/30",
    error:
      "border-rose-500/60 text-slate-900 placeholder-rose-300/70 focus:ring-rose-500/30",
  },
};

const messageToneClasses: Record<
  ValidationPalette,
  Record<InlineValidationState, string>
> = {
  dark: {
    default: "text-slate-400",
    success: "text-emerald-300",
    error: "text-rose-300",
  },
  light: {
    default: "text-slate-500",
    success: "text-emerald-700",
    error: "text-rose-600",
  },
};

const panelToneClasses: Record<
  ValidationPalette,
  Record<InlineValidationState, string>
> = {
  dark: {
    default: "border-slate-700 text-slate-400 hover:border-slate-500",
    success: "border-emerald-400 bg-emerald-500/10 text-emerald-200",
    error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  },
  light: {
    default: "border-slate-300 text-slate-600 hover:border-slate-400",
    success: "border-emerald-500/50 bg-emerald-50 text-emerald-700",
    error: "border-rose-500/50 bg-rose-50 text-rose-600",
  },
};

export function getValidationInputClassName(
  tone: InlineValidationState,
  palette: ValidationPalette = "dark",
): string {
  return inputToneClasses[palette][tone];
}

export function getValidationPanelClassName(
  tone: InlineValidationState,
  palette: ValidationPalette = "dark",
): string {
  return panelToneClasses[palette][tone];
}

export function FormFieldMessage({
  id,
  message,
  tone = "default",
  palette = "dark",
  className = "",
}: FormFieldMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      className={`text-[11px] leading-4 ${messageToneClasses[palette][tone]} ${className}`.trim()}
    >
      {message}
    </p>
  );
}
