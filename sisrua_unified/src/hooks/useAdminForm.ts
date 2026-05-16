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
        // Validar campo individual ou objeto de tier
        if (field.startsWith("serviceTiers.")) {
          const parts = field.split(".");
          // Se for "serviceTiers.0", o value é o objeto completo do tier
          if (parts.length === 2) {
            ServiceTierSchema.parse(value);
          } else {
            // Se for "serviceTiers.0.fieldName", extrair subField
            const index = parseInt(parts[1]);
            const subField = parts[2];
            const tierData = { ...form.serviceTiers[index], [subField]: value };
            ServiceTierSchema.parse(tierData);
          }
        } else {
          // Validar todo o form
          SettingsSchema.parse({ ...form, [field]: value });
        }

        // Remover erro se validação passou
        setErrors(prev => {
          const next = { ...prev };
          // Se for objeto, remover todos os erros filhos
          if (field.split('.').length === 2) {
             Object.keys(next).forEach(k => {
               if (k.startsWith(`${field}.`)) delete next[k];
             });
          } else {
             delete next[field];
          }
          return next;
        });
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          if (field.split('.').length === 2) {
            // Mapear erros do objeto para caminhos completos
            const newErrors: Record<string, string> = {};
            error.issues.forEach(err => {
              const fullPath = `${field}.${err.path.join('.')}`;
              newErrors[fullPath] = err.message;
            });
            setErrors(prev => ({ ...prev, ...newErrors }));
          } else {
            const message = error.issues[0]?.message || 'Campo inválido';
            setErrors(prev => ({ ...prev, [field]: message }));
          }
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

      // Validar sempre para feedback imediato (ou após primeiro toque)
      validateField(field, value);
    },
    [validateField]
  );

  const handleBlur = useCallback(
    (field: string) => {
      setTouched(prev => ({ ...prev, [field]: true }));
    },
    []
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
