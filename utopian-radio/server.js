const Fastify = require('fastify');
const { Server } = require('socket.io');
const path = require('path');

const fastify = Fastify({ logger: true });
fastify.register(require('@fastify/static'), { root: path.join(__dirname, 'public') });

const rooms = new Map(); // roomId -> { queue: [], playing: {item, startedAt} | null, users: Set, votes: Map(userId->'like'|'skip') }
const SKIP_RATIO = 0.5;

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { queue: [], playing: null, users: new Set(), votes: new Map() });
  return rooms.get(roomId);
}
function nextTrack(room) {
  const next = room.queue.find(q => q.status === 'pending');
  if (!next) { room.playing = null; return null; }
  next.status = 'playing';
  room.playing = { item: next, startedAt: Date.now() };
  room.votes.clear();
  return next;
}
function positionSec(room) {
  if (!room.playing) return 0;
  return Math.max(0, Math.floor((Date.now() - room.playing.startedAt) / 1000));
}

fastify.get('/healthz', async () => ({ ok: true }));

const start = async () => {
  await fastify.listen({ port: 3000, host: '0.0.0.0' });
  const io = new Server(fastify.server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    let currentRoom = null;
    const userId = socket.id; // MVP: user = socket

    socket.on('join-room', ({ roomId }) => {
      currentRoom = roomId;
      const room = ensureRoom(roomId);
      room.users.add(userId);
      socket.join(roomId);

      socket.emit('queue-updated', { roomId, queue: room.queue });
      if (room.playing) {
        const { item, startedAt } = room.playing;
        socket.emit('now-playing', {
          queueId: item.id, url: item.url, title: item.title,
          startedAt, duration: item.duration
        });
        socket.emit('sync', { queueId: item.id, position: positionSec(room) });
      }
    });

    socket.on('enqueue', ({ roomId, url, title, duration }) => {
      const room = ensureRoom(roomId);
      const qi = {
        id: 'q_' + Math.random().toString(36).slice(2),
        url, title: title || url, duration: Number(duration) || 180,
        status: 'pending'
      };
      room.queue.push(qi);
      io.to(roomId).emit('queue-updated', { roomId, queue: room.queue });

      if (!room.playing) {
        const started = nextTrack(room);
        if (started) {
          io.to(roomId).emit('now-playing', {
            queueId: started.id, url: started.url, title: started.title,
            startedAt: room.playing.startedAt, duration: started.duration
          });
        }
      }
    });

    socket.on('vote', ({ queueId, type }) => {
      if (!currentRoom) return;
      const room = ensureRoom(currentRoom);
      if (!['like', 'skip'].includes(type)) return;
      room.votes.set(userId, type);

      const online = room.users.size || 1;
      const skips = [...room.votes.values()].filter(v => v === 'skip').length;
      const likes = [...room.votes.values()].filter(v => v === 'like').length;
      io.to(currentRoom).emit('votes-updated', { queueId, likes, skips });

      if (room.playing && room.playing.item.id === queueId && skips >= Math.ceil(online * SKIP_RATIO)) {
        room.playing.item.status = 'skipped';
        const started = nextTrack(room);
        if (started) {
          io.to(currentRoom).emit('now-playing', {
            queueId: started.id, url: started.url, title: started.title,
            startedAt: room.playing.startedAt, duration: started.duration
          });
        } else {
          io.to(currentRoom).emit('queue-updated', { roomId: currentRoom, queue: room.queue });
        }
      }
    });

    socket.on('disconnect', () => {
      if (!currentRoom) return;
      const room = ensureRoom(currentRoom);
      room.users.delete(userId);
    });
  });

  // Тикер: sync + автопереход
  setInterval(() => {
    for (const [roomId, room] of rooms) {
      if (!room.playing) continue;
      const pos = positionSec(room);
      const dur = room.playing.item.duration;
      io.to(roomId).emit('sync', { queueId: room.playing.item.id, position: pos });
      if (pos >= dur) {
        room.playing.item.status = 'done';
        const started = nextTrack(room);
        if (started) {
          io.to(roomId).emit('now-playing', {
            queueId: started.id, url: started.url, title: started.title,
            startedAt: room.playing.startedAt, duration: started.duration
          });
        } else {
          io.to(roomId).emit('queue-updated', { roomId, queue: room.queue });
        }
      }
    }
  }, 1000);

  fastify.log.info('Utopian Radio ready on http://localhost:3000');
};
start().catch((e) => { fastify.log.error(e); process.exit(1); });

