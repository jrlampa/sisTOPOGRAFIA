/**
 * server/utils/sanitizer.ts
 * 
 * Utilidades para sanitização de dados sensíveis antes de logging ou transmissão.
 */

export type SanitizeLevel = 'strict' | 'moderate' | 'minimal';

/**
 * Lista de chaves consideradas sensíveis em nível STRICT
 */
const SENSITIVE_KEYS_STRICT = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'bearer',
  'groq_api_key',
  'redis_password',
  'database_url',
  'connection_string',
  'private_key',
  'privatekey',
  'access_token',
  'refresh_token',
  'session_token',
  'jwt',
  'oauth_token',
  'github_token',
  'slack_token',
  'stripe_key',
  'aws_secret',
  'gcp_key',
  'firebase_key',
]);

/**
 * Lista de chaves sensíveis em nível MODERATE
 */
const SENSITIVE_KEYS_MODERATE = new Set([
  ...SENSITIVE_KEYS_STRICT,
  'email',
  'phone',
  'ssn',
  'cpf',
  'credit_card',
  'card_number',
  'cvv',
  'user_id',
  'username',
]);

/**
 * Sanitiza um objeto removendo valores sensíveis.
 * 
 * @param obj - Objeto a sanitizar (pode ser aninhado)
 * @param level - Nível de sanitização ('strict', 'moderate', 'minimal')
 * @param maxDepth - Profundidade máxima de recursão (padrão: 10)
 * @returns Cópia do objeto com valores sensíveis substituídos
 * 
 * Exemplo:
 * ```typescript
 * const user = { username: "john", password: "secret123" };
 * logger.info("User created", sanitizeForLogging(user));
 * // Output: { username: "john", password: "***REDACTED***" }
 * ```
 */
export function sanitizeForLogging(
  obj: any,
  level: SanitizeLevel = 'strict',
  maxDepth: number = 10,
  _currentDepth: number = 0
): any {
  // Proteção contra deep recursion
  if (_currentDepth > maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  // Tipos primitivos: retornar como está
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Selecionar conjunto de chaves sensíveis
  const sensitiveKeys =
    level === 'strict'
      ? SENSITIVE_KEYS_STRICT
      : level === 'moderate'
        ? SENSITIVE_KEYS_MODERATE
        : new Set<string>(); // minimal: nenhuma sanitização

  // Arrays: processar cada item
  if (Array.isArray(obj)) {
    return obj.map(item =>
      sanitizeForLogging(item, level, maxDepth, _currentDepth + 1)
    );
  }

  // Objetos: processar cada propriedade
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Se a chave é sensível, redactar valor
    if (sensitiveKeys.has(lowerKey)) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      // Recursivamente sanitizar objetos aninhados
      sanitized[key] = sanitizeForLogging(
        value,
        level,
        maxDepth,
        _currentDepth + 1
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Cria uma versão "segura" de um objeto para logging.
 * Mais prática que sanitizeForLogging para uso em cadeia.
 */
export function safe(obj: any, level: SanitizeLevel = 'strict'): any {
  return sanitizeForLogging(obj, level);
}

/**
 * Sanitiza um erro, removendo mensagens potencialmente sensíveis.
 */
export function sanitizeError(error: any, level: SanitizeLevel = 'strict'): any {
  if (!(error instanceof Error)) {
    return sanitizeForLogging(error, level);
  }

  const sanitized = {
    name: error.name,
    message: sanitizeForLogging(error.message, level),
    code: (error as any).code,
    statusCode: (error as any).statusCode,
  };

  // Em development, incluir stack trace sanitizado
  if (process.env.NODE_ENV === 'development' && error.stack) {
    sanitized.stack = sanitizeForLogging(error.stack, level);
  }

  return sanitized;
}

/**
 * Redacta strings sensíveis (ex: API keys, passwords).
 * Mantém apenas primeiros e últimos caracteres para identificação.
 * 
 * Exemplo:
 * - Input: "sk-1234567890abcdefgh"
 * - Output: "sk-1234...efgh"
 */
export function partialRedact(value: string | undefined | null, visibleChars: number = 4): string {
  if (!value) return '';

  if (value.length <= visibleChars * 2 + 3) {
    return '***REDACTED***';
  }

  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  return `${start}...${end}`;
}

/**
 * Exemplo de uso prático em logger
 */
export function createLogContext(ctx: any, level: SanitizeLevel = 'strict'): any {
  return {
    ...ctx,
    // Manter requestId, pero sanitizar user data
    userData: sanitizeForLogging(ctx.userData, level),
    config: sanitizeForLogging(ctx.config, level),
    response: sanitizeForLogging(ctx.response, level),
  };
}
