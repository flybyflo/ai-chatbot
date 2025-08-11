import { config } from 'dotenv';
import { createClient } from 'redis';
import { Server } from 'socket.io';

config({ path: '.env.local' });

const PORT = Number(process.env.PORT || 3030);
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const io = new Server(PORT, {
  cors: { origin: CORS_ORIGIN },
  transports: ['websocket'],
});
// eslint-disable-next-line no-console
console.log(`[Gateway] Socket.IO listening on ${PORT}`);

const sub = createClient({ url: REDIS_URL });
const pub = createClient({ url: REDIS_URL });

async function start(): Promise<void> {
  await sub.connect();
  await pub.connect();
  // eslint-disable-next-line no-console
  console.log('[Gateway] Connected to Redis');

  await sub.subscribe('rt:events', (raw: string) => {
    try {
      const evt = JSON.parse(raw);
      // eslint-disable-next-line no-console
      console.log('[Gateway] broadcasting event', evt?.type || typeof evt);
      io.emit('event', evt);
    } catch {
      // ignore
    }
  });

  io.on('connection', (socket) => {
    console.log('[Gateway] client connected', socket.id);
    socket.on('elicitation_response', async (msg: unknown) => {
      try {
        await pub.publish(
          'rt:elicitation:response',
          JSON.stringify({ type: 'elicitation_response', ...(msg as object) }),
        );
      } catch {
        // ignore
      }
    });
    socket.on('sampling_response', async (msg: unknown) => {
      try {
        await pub.publish(
          'rt:sampling:response',
          JSON.stringify({ type: 'sampling_response', ...(msg as object) }),
        );
      } catch {
        // ignore
      }
    });
    socket.on('sampling_response', async (msg: unknown) => {
      try {
        await pub.publish(
          'rt:sampling:response',
          JSON.stringify({ type: 'sampling_response', ...(msg as object) }),
        );
      } catch {
        // ignore
      }
    });
    socket.on('disconnect', (reason) => {
      console.log('[Gateway] client disconnected', socket.id, reason);
    });
  });
}

start().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[Gateway] startup error', e);
  process.exit(1);
});
