/**
 * Converte string formatada em pt-BR (ex: "1.234,56") para número (ex: 1234.56).
 */
export const parseBr = (val: string): number => {
  if (!val) return 0;
  // Remove pontos de milhar e troca vírgula decimal por ponto
  const clean = val.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean);
};

/**
 * Converte número para string formatada em pt-BR.
 */
export const formatBr = (val: number, decimals: number = 2): string => {
  if (val === undefined || val === null || isNaN(val)) return '';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
