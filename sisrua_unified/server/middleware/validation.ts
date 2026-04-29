import { Request, Response, NextFunction } from "express";
import { body, validationResult, ValidationChain } from "express-validator";
import { createError } from "../errorHandler.js";

/**
 * Middleware to validate express-validator results.
 * Throws a standardized ApiError if validation fails.
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const details = {
      errors: errors.array().map((err: any) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    };

    // Propagate to global error handler
    return next(createError.validation("Falha na validação dos dados de entrada", details));
  };
};

/**
 * Common Validators for sisRUA
 */
export const validators = {
  // DXF Generation Request
  dxfRequest: [
    body("polygon").isArray().withMessage("Polygon must be an array of points"),
    body("polygon.*.lat").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
    body("polygon.*.lon").isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
    body("utm_zone").optional().isInt({ min: 1, max: 60 }).withMessage("Invalid UTM zone"),
  ],

  // BT Topology Validation
  topology: [
    body("poles").isArray().withMessage("Poles must be an array"),
    body("edges").isArray().withMessage("Edges must be an array"),
  ],

  // Admin User Role Update
  userRole: [
    body("papel").isIn(["admin", "technician", "viewer", "guest"]).withMessage("Papel inválido"),
    body("atribuidoPor").isString().notEmpty().withMessage("Identificação do atribuidor é obrigatória"),
  ]
};
