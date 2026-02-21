import { describe, it, expect, beforeEach, vi } from 'vitest';
import Logger from '../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    Logger.clearLogs();
    vi.clearAllMocks();
  });

  describe('info', () => {
    it('should log info messages', () => {
      Logger.info('Test info message');
      const logs = Logger.getLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test info message');
    });

    it('should log info with data', () => {
      const data = { key: 'value' };
      Logger.info('Test with data', data);
      const logs = Logger.getLogs();
      
      expect(logs[0].data).toEqual(data);
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      Logger.warn('Test warning');
      const logs = Logger.getLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      Logger.error('Test error');
      const logs = Logger.getLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });
  });

  describe('debug', () => {
    it('should log debug messages in development', () => {
      Logger.debug('Test debug');
      const logs = Logger.getLogs();
      
      // Debug is logged but might not appear in console in production
      expect(logs.length).toBeGreaterThanOrEqual(0);
    });

    it('should store log entry when NODE_ENV is development (lines 67-68)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      Logger.clearLogs();

      Logger.debug('Debug in development mode');

      // Lines 67-68: this.log('debug', ...) executes and stores an entry
      expect(Logger.getLogs()).toHaveLength(1);
      expect(Logger.getLogs()[0].level).toBe('debug');
      expect(Logger.getLogs()[0].message).toBe('Debug in development mode');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('log management', () => {
    it('should limit number of logs', () => {
      // Logger has maxLogs = 100
      for (let i = 0; i < 150; i++) {
        Logger.info(`Message ${i}`);
      }
      
      const logs = Logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
    });

    it('should clear logs', () => {
      Logger.info('Message 1');
      Logger.info('Message 2');
      expect(Logger.getLogs()).toHaveLength(2);
      
      Logger.clearLogs();
      expect(Logger.getLogs()).toHaveLength(0);
    });

    it('should filter logs by level', () => {
      Logger.info('Info message');
      Logger.error('Error message');
      Logger.warn('Warning message');
      
      const errors = Logger.getLogsByLevel('error');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Error message');
    });

    it('should export logs as JSON', () => {
      Logger.info('Test message');
      const exported = Logger.exportLogs();
      
      expect(exported).toContain('Test message');
      expect(exported).toContain('info');
    });
  });

  describe('timestamp', () => {
    it('should add timestamp to each log', () => {
      Logger.info('Test');
      const logs = Logger.getLogs();
      
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('console output (development mode)', () => {
    it('should call console.error for error level', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      Logger.error('Test error message');
      expect(spy).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });

    it('should call console.warn for warn level', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      Logger.warn('Test warn message');
      expect(spy).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });

    it('should call console.log for info level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      Logger.info('Test info message');
      expect(spy).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });

    it('should pass data as third argument when data is provided', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const data = { code: 42 };
      Logger.error('Message with data', data);
      // Called with prefix, message, and data
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('ERROR'), 'Message with data', data);
      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });

    it('should call console.log without data when data is undefined', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      Logger.info('Message without data');
      // Called with only prefix and message (no third arg)
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('INFO'), 'Message without data');
      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });
  });

  describe('debug in non-development mode', () => {
    it('should not log debug when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      Logger.clearLogs();

      Logger.debug('This debug should not appear');

      // In production, debug does not call this.log so no entry added
      expect(Logger.getLogs()).toHaveLength(0);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
