/**
 * Validação numérica centralizada (Item 10).
 * Garante tratamento consistente de inputs numéricos em todo o app.
 * 
 * Problema: App.tsx:1077-1091 tem validações espalhadas sem padrão.
 * Solução: Funções validadoras com mensagens de erro claras.
 */

export interface NumericValidationError {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * Validar e parsear um número inteiro positivo.
 * Usado para: IDs, counts, sequências.
 */
export function validatePositiveInteger(
  input: string | number,
  fieldName: string = 'field',
  max?: number
): NumericValidationError {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: `${fieldName} deve ser um número válido`,
    };
  }
  
  if (!Number.isInteger(num)) {
    return {
      valid: false,
      error: `${fieldName} deve ser um número inteiro`,
    };
  }
  
  if (num < 0) {
    return {
      valid: false,
      error: `${fieldName} não pode ser negativo`,
    };
  }
  
  if (max !== undefined && num > max) {
    return {
      valid: false,
      error: `${fieldName} não pode exceder ${max}`,
    };
  }
  
  return { valid: true, value: num };
}

/**
 * Validar coordenada em graus (latitude ou longitude).
 * Latitude: [-90, 90]
 * Longitude: [-180, 180]
 */
export function validateCoordinate(
  value: number,
  type: 'latitude' | 'longitude'
): NumericValidationError {
  const [min, max] = type === 'latitude' ? [-90, 90] : [-180, 180];
  
  if (isNaN(value)) {
    return {
      valid: false,
      error: `${type} deve ser um número válido`,
    };
  }
  
  if (value < min || value > max) {
    return {
      valid: false,
      error: `${type} deve estar entre ${min} e ${max}`,
    };
  }
  
  return { valid: true, value };
}

/**
 * Validar raio em metros.
 * Intervalo típico: [100m, 50km]
 */
export function validateRadius(radiusMeters: number): NumericValidationError {
  const MIN_RADIUS = 100;
  const MAX_RADIUS = 50000;
  
  if (isNaN(radiusMeters)) {
    return {
      valid: false,
      error: 'Raio deve ser um número válido',
    };
  }
  
  if (radiusMeters < MIN_RADIUS) {
    return {
      valid: false,
      error: `Raio mínimo é ${MIN_RADIUS}m`,
    };
  }
  
  if (radiusMeters > MAX_RADIUS) {
    return {
      valid: false,
      error: `Raio máximo é ${MAX_RADIUS}m`,
    };
  }
  
  return { valid: true, value: radiusMeters };
}

/**
 * Validar número decimal (ex: fator de diversificação, potência).
 * Intervalo: [min, max]
 */
export function validateDecimal(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'field'
): NumericValidationError {
  if (isNaN(value)) {
    return {
      valid: false,
      error: `${fieldName} deve ser um número válido`,
    };
  }
  
  if (value < min || value > max) {
    return {
      valid: false,
      error: `${fieldName} deve estar entre ${min} e ${max}`,
    };
  }
  
  return { valid: true, value };
}

/**
 * Validar múltiplos campos numéricos com regras diferentes.
 * Aplicável em formulários complexos.
 * 
 * @example
 * validateNumbericFields({
 *   'lat': { value: -22.9, min: -90, max: 90 },
 *   'lng': { value: -43.1, min: -180, max: 180 },
 *   'radius': { value: 5000, min: 100, max: 50000 },
 * })
 */
export function validateNumericFields(
  fields: Record<string, { value: number; min: number; max: number }>
): Record<string, NumericValidationError> {
  const results: Record<string, NumericValidationError> = {};
  
  for (const [fieldName, { value, min, max }] of Object.entries(fields)) {
    results[fieldName] = validateDecimal(value, min, max, fieldName);
  }
  
  return results;
}

/**
 * Converter string de entrada do usuário para número com validação.
 * Aplicável em inputs de coordenadas ou raio.
 * 
 * @example
 * parseUserInputNumber('123.45', 0, 1000)
 * // { valid: true, value: 123.45 }
 */
export function parseUserInputNumber(
  input: string,
  min: number,
  max: number,
  fieldName: string = 'Number'
): NumericValidationError {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {
      valid: false,
      error: `${fieldName} é obrigatório`,
    };
  }
  
  const num = parseFloat(trimmed);
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: `${fieldName} deve ser numérico`,
    };
  }
  
  return validateDecimal(num, min, max, fieldName);
}
