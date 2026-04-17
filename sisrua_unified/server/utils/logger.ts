import winston from "winston";
import "winston-daily-rotate-file";
import { config } from "../config.js";
import path from "path";
import fs from "fs";

const logDir = "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Storage for request-specific context (like requestId)
import { requestContext } from "./requestContext.js";

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
      const context = requestContext.getStore();
      if (context) {
        const requestId = context.get("requestId");
        if (requestId) {
          info.requestId = requestId;
        }

        const operationId = context.get("operation_id");
        const projetoId = context.get("projeto_id");
        const pontoId = context.get("ponto_id");

        if (operationId) {
          info.operation_id = operationId;
        }
        if (projetoId) {
          info.projeto_id = projetoId;
        }
        if (pontoId) {
          info.ponto_id = pontoId;
        }
      }
      return info;
    })(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, requestId, ...meta }) => {
            const idPart = requestId ? ` [${requestId}]` : "";
            const metaPart = Object.keys(meta).length
              ? ` ${JSON.stringify(meta)}`
              : "";
            return `${timestamp} ${level}:${idPart} ${message}${metaPart}`;
          },
        ),
      ),
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d",
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
});

export { logger };
