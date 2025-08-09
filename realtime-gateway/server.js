const { createClient } = require('redis');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 3030);
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const io = new Server(PORT, {
  cors: { origin: CORS_ORIGIN },
  transports: ['websocket'],
});
console.log(`[Gateway] Socket.IO listening on ${PORT}`);

const sub = createClient({ url: REDIS_URL });
const pub = createClient({ url: REDIS_URL });

async function start() {
  await sub.connect();
  await pub.connect();
  console.log('[Gateway] Connected to Redis');

  await sub.subscribe('rt:events', (raw) => {
    try {
      const evt = JSON.parse(raw);
      io.emit('event', evt);
    } catch {}
  });

  io.on('connection', (socket) => {
    console.log('[Gateway] client connected', socket.id);
    socket.on('elicitation_response', async (msg) => {
      try {
        await pub.publish(
          'rt:elicitation:response',
          JSON.stringify({ type: 'elicitation_response', ...msg }),
        );
      } catch {}
    });
    socket.on('disconnect', (reason) => {
      console.log('[Gateway] client disconnected', socket.id, reason);
    });
  });
}

start().catch((e) => {
  console.error('[Gateway] startup error', e);
  process.exit(1);
});
