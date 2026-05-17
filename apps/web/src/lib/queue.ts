import IORedis, { type Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@accessiblewebsite/shared';
import { env } from '../env';

// Lazy singletons. Astro instantiates the module once per worker; we want a
// single Redis connection and a single Queue across requests.
let _redis: Redis | null = null;
let _scanQueue: Queue | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  _redis = new IORedis(env().REDIS_URL, { maxRetriesPerRequest: null });
  return _redis;
}

export function getScanQueue(): Queue {
  if (_scanQueue) return _scanQueue;
  _scanQueue = new Queue(QUEUE_NAMES.scan, { connection: getRedis() });
  return _scanQueue;
}
