import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerDefinition } from './swagger/definition.js';

const specs = swaggerJsdoc({
    definition: swaggerDefinition,
    apis: ["./server/routes/*.ts", "./server/app.ts"]
});

export { specs };
