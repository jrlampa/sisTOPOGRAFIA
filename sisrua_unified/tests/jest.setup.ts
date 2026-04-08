// Jest setup for backend tests
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Mock external services
jest.mock('../server/services/topodataService');
jest.mock('../server/services/geocodingService');

// Setup global test utilities
global.testHelper = {
  async waitFor(condition: () => boolean, timeout = 5000) {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!condition()) throw new Error('Timeout waiting for condition');
  },
};

// Suppress logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
