/**
 * Middleware de validação de schema Zod para rotas Express.
 *
 * Valida req.body contra um schema Zod antes de passar ao handler.
 * Retorna 400 com lista de erros em caso de falha de validação.
 */

import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";
import { logger } from "../utils/logger.js";

/**
 * Cria middleware Express que valida req.body contra o schema fornecido.
 *
 * @param schema - Schema Zod a ser usado na validação
 * @returns Middleware Express
 */
export function schemaValidator(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = (result.error as any).errors.map((e: any) => ({
        path: e.path.join("."),
        message: e.message,
      }));

      logger.warn("Validação de schema falhou", {
        url: req.url,
        method: req.method,
        errors,
      });

      res.status(400).json({
        success: false,
        error: "Dados de entrada inválidos",
        details: errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
