import { createClient, type RedisClientType } from 'redis';

let publisher: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;

export async function getRedisPub(): Promise<RedisClientType> {
  if (publisher) return publisher;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  publisher = createClient({ url });
  if (!publisher.isOpen) await publisher.connect();
  return publisher;
}

export async function getRedisSub(): Promise<RedisClientType> {
  if (subscriber) return subscriber;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  subscriber = createClient({ url });
  if (!subscriber.isOpen) await subscriber.connect();
  return subscriber;
}
