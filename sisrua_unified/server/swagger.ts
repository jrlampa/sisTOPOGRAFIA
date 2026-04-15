import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerDefinition } from './swagger/definition.js';

const specs = swaggerJsdoc({
    definition: swaggerDefinition,
    apis: []
});

export { specs };
