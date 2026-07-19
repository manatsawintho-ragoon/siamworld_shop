import { logger } from '../utils/logger';
import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error('[Redis]', err.message);
});
