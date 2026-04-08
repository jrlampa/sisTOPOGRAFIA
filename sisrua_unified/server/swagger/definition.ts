import { swaggerComponents } from './components';
import { swaggerPaths } from './paths';

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
