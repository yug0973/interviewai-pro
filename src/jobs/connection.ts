import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * BullMQ requires its own ioredis connection (it manages blocking commands
 * internally) rather than sharing the app's general-purpose `redis` client
 * from config/redis.ts. `maxRetriesPerRequest: null` is mandatory for BullMQ -
 * without it, long-polling blocking commands get killed mid-flight.
 */
export function createBullConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
}
