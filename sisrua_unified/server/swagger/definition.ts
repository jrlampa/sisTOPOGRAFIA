import { swaggerComponents } from './components.js';
import { swaggerPaths } from './paths.js';

export const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'sisRUA Unified API',
    version: '1.2.0'
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development'
    }
  ],
  components: swaggerComponents,
  paths: swaggerPaths
};
