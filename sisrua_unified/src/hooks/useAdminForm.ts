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
        if (field.startsWith('serviceTiers.')) {
          const index = parseInt(field.split('.')[1]);
          ServiceTierSchema.parse(form.serviceTiers[index]);
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
          const message = error.issues[0]?.message || 'Campo inválido';
          setErrors(prev => ({ ...prev, [field]: message }));
        }
        return false;
      }
    },
    [form]
  );

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      setForm((prev: AdminSettings) => {
        const keys = field.split('.');
        if (keys.length === 1) {
          return { ...prev, [field]: value } as AdminSettings;
        }

        // Suporta nested: "serviceTiers.0.supportHours"
        const newForm = { ...prev };
        let current: any = newForm;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          // Se for número, tratar como array index
          if (/^\d+$/.test(keys[i+1])) {
             current[key] = [...current[key]];
          } else {
             current[key] = { ...current[key] };
          }
          current = current[key];
        }
        current[keys[keys.length - 1]] = value;
        return newForm as AdminSettings;
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
      const fieldValue = field
        .split('.')
        .reduce<unknown>((obj, key) => {
          if (obj && typeof obj === 'object') {
            return (obj as Record<string, unknown>)[key];
          }
          return undefined;
        }, form as unknown);
      validateField(field, fieldValue);
    },
    [form, validateField]
  );

  const handleSubmit = useCallback(
    (onSubmit: (data: AdminSettings) => Promise<void>) => {
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
            error.issues.forEach(err => {
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
