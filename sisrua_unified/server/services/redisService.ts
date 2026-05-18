import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (redisClient) return redisClient;

  const redisHost = config.REDIS_HOST || 'localhost';
  const redisPort = config.REDIS_PORT || 6379;
  const redisPassword = config.REDIS_PASSWORD;

  const tlsOptions: any = {};
  
  // In production or if explicitly configured, use TLS
  if (config.NODE_ENV === 'production' || config.REDIS_TLS === 'true') {
    tlsOptions.rejectUnauthorized = false; // Self-signed in dev
    
    // If certificates are provided via secrets (standard Docker pattern)
    if (fs.existsSync('/run/secrets/redis_tls_ca')) {
       tlsOptions.ca = fs.readFileSync('/run/secrets/redis_tls_ca');
       tlsOptions.cert = fs.readFileSync('/run/secrets/redis_tls_cert');
       tlsOptions.key = fs.readFileSync('/run/secrets/redis_tls_key');
    } else if (fs.existsSync('./secrets/redis_ca.pem')) {
       // Fallback for local development
       tlsOptions.ca = fs.readFileSync('./secrets/redis_ca.pem');
       tlsOptions.cert = fs.readFileSync('./secrets/redis_cert.pem');
       tlsOptions.key = fs.readFileSync('./secrets/redis_key.pem');
    }
  }

  try {
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      tls: Object.keys(tlsOptions).length > 0 ? tlsOptions : undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err: Error) => {
      logger.error('Redis error', { err });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    return redisClient;
  } catch (err) {
    logger.error('Failed to initialize Redis client', { err });
    return null;
  }
};

export const redisService = {
  get: async (key: string): Promise<string | null> => {
    const client = getRedisClient();
    if (!client) return null;
    return client.get(key);
  },
  
  set: async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
  },
  
  del: async (key: string): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;
    await client.del(key);
  },
  
  clear: async (): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;
    await client.flushall();
  },

  getJobKeys: async (): Promise<string[]> => {
    const client = getRedisClient();
    if (!client) return [];
    return client.keys('job:*');
  },

  getKeys: async (pattern: string): Promise<string[]> => {
    const client = getRedisClient();
    if (!client) return [];
    return client.keys(pattern);
  }
};
