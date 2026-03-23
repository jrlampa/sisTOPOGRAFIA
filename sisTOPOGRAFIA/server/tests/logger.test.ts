// Bypass the global mock from setup.ts so we can test the real logger
jest.unmock('../utils/logger');

import { logger } from '../utils/logger';

describe('logger (real winston instance)', () => {
    it('has an info method', () => {
        expect(typeof logger.info).toBe('function');
    });
    it('has a warn method', () => {
        expect(typeof logger.warn).toBe('function');
    });
    it('has an error method', () => {
        expect(typeof logger.error).toBe('function');
    });
    it('has a debug method', () => {
        expect(typeof logger.debug).toBe('function');
    });
    it('can call info without throwing', () => {
        expect(() => logger.info('test message')).not.toThrow();
    });
    it('can call warn without throwing', () => {
        expect(() => logger.warn('test warning')).not.toThrow();
    });
    it('can call error without throwing', () => {
        expect(() => logger.error('test error')).not.toThrow();
    });
    it('can call debug without throwing', () => {
        expect(() => logger.debug('test debug')).not.toThrow();
    });
});
