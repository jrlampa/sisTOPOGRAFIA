import React from 'react';
import { BtEdge, BtPoleNode, BtTransformer } from '../../types';
import { LEGACY_ID_ENTROPY } from '../../constants/magicNumbers';
import type { BtClandestinoDisplay } from '../../services/btDerivedService';

export type BtEdgeChangeFlag = NonNullable<BtEdge['edgeChangeFlag']>;
export type BtPoleChangeFlag = NonNullable<BtPoleNode['nodeChangeFlag']>;
export type BtTransformerChangeFlag = NonNullable<BtTransformer['transformerChangeFlag']>;

export const getEdgeChangeFlag = (edge: BtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }

  return edge.removeOnExecution ? 'remove' : 'existing';
};

export const getPoleChangeFlag = (pole: BtPoleNode): BtPoleChangeFlag => pole.nodeChangeFlag ?? 'existing';
export const getTransformerChangeFlag = (transformer: BtTransformer): BtTransformerChangeFlag => transformer.transformerChangeFlag ?? 'existing';

export const NORMAL_CLIENT_RAMAL_TYPES = [
  '5 CC',
  '8 CC',
  '13 CC',
  '21 CC',
  '33 CC',
  '53 CC',
  '67 CC',
  '85 CC',
  '107 CC',
  '127 CC',
  '253 CC',
  '13 DX 6 AWG',
  '13 TX 6 AWG',
  '13 QX 6 AWG',
  '21 QX 4 AWG',
  '53 QX 1/0',
  '85 QX 3/0',
  '107 QX 4/0',
  '70 MMX',
  '185 MMX'
];

export const CLANDESTINO_RAMAL_TYPE = 'Clandestino';

export const CONDUCTOR_NAMES = [
  '70 Al - MX',
  '185 Al - MX',
  '240 Al - MX',
  '25 Al - Arm',
  '50 Al - Arm',
  '95 Al - Arm',
  '150 Al - Arm',
  '240 Al - Arm',
  '25 Al',
  '35 Cu',
  '70 Cu',
  '95 Al',
  '120 Cu',
  '240 Al',
  '240 Cu',
  '500 Cu',
  '10 Cu_CONC_bi',
  '10 Cu_CONC_Tri',
  '16 Al_CONC_bi',
  '16 Al_CONC_Tri',
  '13 Al - DX',
  '13 Al - TX',
  '13 Al - QX',
  '21 Al - QX',
  '53 Al - QX',
  '6 AWG',
  '2 AWG',
  '1/0 AWG',
  '3/0 AWG',
  '4/0 AWG'
];

export const numberFromInput = (value: string, decimals?: number): number => {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (decimals === undefined) {
    return parsed;
  }

  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
};

export const selectAllInputText = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
  e.currentTarget.select();
};

export const normalizeNumericClipboardText = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const cleaned = trimmed.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');
  if (!cleaned) {
    return '';
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandSeparator = decimalSeparator === ',' ? '.' : ',';
    const withoutThousands = cleaned.split(thousandSeparator).join('');
    return decimalSeparator === ','
      ? withoutThousands.replace(',', '.')
      : withoutThousands;
  }

  if (lastComma !== -1) {
    return cleaned.replace(',', '.');
  }

  return cleaned;
};

export const formatBr = (n: number, decimals = 2): string =>
  n.toFixed(decimals).replace('.', ',');

export const parseBr = (s: string): number => {
  const normalized = normalizeNumericClipboardText(s.trim());
  return parseFloat(normalized);
};

export const nextId = (prefix: string): string => `${prefix}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`;

export function deriveBtPanelViewModel(args: {
  projectType: 'ramais' | 'geral' | 'clandestino';
  clandestinoDisplay: BtClandestinoDisplay;
  transformers: BtTransformer[];
  totalClandestinoClients: number;
}) {
  const { projectType, clandestinoDisplay, transformers, totalClandestinoClients } = args;
  const isNormalProject = projectType !== 'clandestino';
  const transformersWithReadings = transformers.filter((transformer) => transformer.readings.length > 0).length;
  const transformersWithoutReadings = Math.max(0, transformers.length - transformersWithReadings);

  const clandestinoDemandKw = projectType === 'clandestino' ? clandestinoDisplay.demandKw : 0;
  const clandestinoAreaRange = { min: clandestinoDisplay.areaMin, max: clandestinoDisplay.areaMax };
  const clandestinoDemandKva = projectType === 'clandestino' ? clandestinoDisplay.demandKva : null;
  const clandestinoDiversificationFactor = projectType === 'clandestino' ? clandestinoDisplay.diversificationFactor : null;
  const clandestinoFinalDemandKva = projectType === 'clandestino' ? clandestinoDisplay.finalDemandKva : 0;

  const pointDemandCardClass = projectType === 'clandestino'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
    : transformers.length === 0 || transformersWithReadings === 0
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : transformersWithoutReadings > 0
        ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
        : 'border-emerald-300 bg-emerald-50 text-emerald-900';

  const pointDemandStatus = !isNormalProject
    ? null
    : transformers.length === 0
      ? 'Sem transformador cadastrado. A demanda ficará zerada até inserir ao menos 1 trafo.'
      : transformersWithReadings === 0
        ? 'Sem leituras de trafo. Preencha as leituras para calcular a demanda por ponto.'
        : transformersWithoutReadings > 0
          ? `Demanda parcial: ${transformersWithReadings}/${transformers.length} trafo(s) com leituras.`
          : 'Demanda consolidada com leituras em todos os trafos.';

  return {
    isNormalProject,
    transformersWithReadings,
    transformersWithoutReadings,
    clandestinoDemandKw,
    clandestinoAreaRange,
    clandestinoDemandKva,
    clandestinoDiversificationFactor,
    clandestinoFinalDemandKva,
    totalClandestinoClients,
    pointDemandCardClass,
    pointDemandStatus,
  };
}

export function NumericTextInput({
  value,
  decimals = 2,
  onChange,
  className,
  title,
  placeholder,
}: {
  value: number;
  decimals?: number;
  onChange: (val: number) => void;
  className?: string;
  title?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editDisplay, setEditDisplay] = React.useState('');

  const display = editing ? editDisplay : formatBr(value, decimals);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      title={title}
      aria-label={title}
      placeholder={placeholder}
      onFocus={(e) => {
        setEditing(true);
        setEditDisplay(formatBr(value, decimals));
        e.target.select();
      }}
      onBlur={() => {
        setEditing(false);
      }}
      onClick={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.target.value;
        setEditDisplay(raw);
        const parsed = parseBr(raw);
        if (Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }}
      className={className}
    />
  );
}
