import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerDefinition } from './swagger/definition.js';

const isTestEnv = process.env.NODE_ENV === 'test';

const specs = isTestEnv
  ? swaggerDefinition
  : swaggerJsdoc({
      definition: swaggerDefinition,
      apis: ['./server/routes/*.ts', './server/app.ts'],
    });

export { specs };
