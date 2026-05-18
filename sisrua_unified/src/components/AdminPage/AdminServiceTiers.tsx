import { FormGroup } from '../forms/FormGroup';
import { NumberInput } from '../forms/NumberInput';
import { SelectInput } from '../forms/SelectInput';
import { ServiceTierForm } from '../../types';

interface AdminServiceTiersProps {
  tiers: ServiceTierForm[];
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  onTierChange: (index: number, tier: ServiceTierForm) => void;
  onTierBlur: (index: number) => void;
}

export function AdminServiceTiers({
  tiers,
  errors,
  touched,
  onTierChange,
  onTierBlur,
}: AdminServiceTiersProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        Perfis de Serviço (SLA/SLO)
      </h2>

      {tiers.map((tier, index) => (
        <div key={index} className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700 first:border-0 first:pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormGroup 
              label="Nome do Serviço" 
              error={touched[`serviceTiers.${index}.serviceName`] ? errors[`serviceTiers.${index}.serviceName`] : undefined}
            >
              <input
                type="text"
                value={tier.serviceName}
                onChange={e => onTierChange(index, { ...tier, serviceName: e.target.value })}
                onBlur={() => onTierBlur(index)}
                className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                placeholder="Ex: API Geoprocessamento"
              />
            </FormGroup>

            <FormGroup 
              label="Tier" 
              error={touched[`serviceTiers.${index}.tier`] ? errors[`serviceTiers.${index}.tier`] : undefined}
            >
              <SelectInput
                value={tier.tier}
                onChange={e => onTierChange(index, { ...tier, tier: e.target.value as any })}
                onBlur={() => onTierBlur(index)}
                options={[
                  { value: 'bronze', label: '🟤 Bronze' },
                  { value: 'silver', label: '🥈 Silver' },
                  { value: 'gold', label: '🥇 Gold' },
                  { value: 'platinum', label: '💎 Platinum' },
                ]}
              />
            </FormGroup>

            <FormGroup 
              label="SLA Disponibilidade (%)" 
              error={touched[`serviceTiers.${index}.slaAvailabilityPct`] ? errors[`serviceTiers.${index}.slaAvailabilityPct`] : undefined}
            >
              <NumberInput
                value={tier.slaAvailabilityPct}
                onChange={v => onTierChange(index, { ...tier, slaAvailabilityPct: v })}
                onBlur={() => onTierBlur(index)}
                min={0}
                max={100}
                decimals={3}
              />
            </FormGroup>

            <FormGroup 
              label="SLO Latência P95 (ms)" 
              error={touched[`serviceTiers.${index}.sloLatencyP95Ms`] ? errors[`serviceTiers.${index}.sloLatencyP95Ms`] : undefined}
            >
              <NumberInput
                value={tier.sloLatencyP95Ms}
                onChange={v => onTierChange(index, { ...tier, sloLatencyP95Ms: v })}
                onBlur={() => onTierBlur(index)}
                min={0}
                decimals={0}
              />
            </FormGroup>

            <FormGroup 
              label="Horas de Suporte" 
              error={touched[`serviceTiers.${index}.supportHours`] ? errors[`serviceTiers.${index}.supportHours`] : undefined}
            >
              <input
                type="text"
                value={tier.supportHours}
                onChange={e => onTierChange(index, { ...tier, supportHours: e.target.value })}
                onBlur={() => onTierBlur(index)}
                className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                placeholder="Ex: 24x7 ou 8x5"
              />
            </FormGroup>

            <FormGroup 
              label="Canal de Suporte" 
              error={touched[`serviceTiers.${index}.supportChannel`] ? errors[`serviceTiers.${index}.supportChannel`] : undefined}
            >
              <input
                type="text"
                value={tier.supportChannel}
                onChange={e => onTierChange(index, { ...tier, supportChannel: e.target.value })}
                onBlur={() => onTierBlur(index)}
                className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                placeholder="Ex: Email, Slack, Telefone"
              />
            </FormGroup>
          </div>
        </div>
      ))}
    </div>
  );
}
