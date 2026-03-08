import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager.js';
import { PlayerSession } from './PlayerSession.js';
import { GameSimulation } from './GameSimulation.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const roomManager = new RoomManager(io);
const playerSessions = new PlayerSession();
const activeGames = new Map(); // roomCode -> GameSimulation

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Room creation
  socket.on('room:create', (settings, callback) => {
    const room = roomManager.createRoom(socket.id, settings);
    socket.join(room.code);
    const token = playerSessions.create(socket.id, room.code);
    callback?.({ ok: true, room: room.toJSON(), reconnectToken: token });
  });

  // Room join
  socket.on('room:join', ({ code, name }, callback) => {
    const room = roomManager.joinRoom(code, socket.id, name);
    if (!room) {
      callback?.({ ok: false, error: 'Room not found or full' });
      return;
    }
    socket.join(code);
    const token = playerSessions.create(socket.id, code);
    io.to(code).emit('room:update', room.toJSON());
    callback?.({ ok: true, room: room.toJSON(), reconnectToken: token });
  });

  // Character selection
  socket.on('room:select-character', ({ code, characterId }) => {
    const room = roomManager.setCharacter(code, socket.id, characterId);
    if (room) io.to(code).emit('room:update', room.toJSON());
  });

  // Ready toggle
  socket.on('room:ready', ({ code, ready }) => {
    const room = roomManager.setReady(code, socket.id, ready);
    if (room) io.to(code).emit('room:update', room.toJSON());
  });

  // Chat
  socket.on('room:chat', ({ code, message }) => {
    if (!message || message.length > 200) return;
    const room = roomManager.getRoom(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    io.to(code).emit('room:chat', {
      from: player?.name || 'Unknown',
      message: message.slice(0, 200),
      timestamp: Date.now()
    });
  });

  // Start race
  socket.on('room:start', ({ code }) => {
    const room = roomManager.getRoom(code);
    if (!room || room.hostId !== socket.id) return;
    if (!room.allReady()) return;

    room.state = 'starting';
    io.to(code).emit('room:starting', room.toJSON());

    // Start game simulation after 3s countdown
    setTimeout(() => {
      const sim = new GameSimulation(room, io);
      activeGames.set(code, sim);
      sim.start();
      io.to(code).emit('race:start', { tick: 0 });
    }, 3000);
  });

  // Player input during race
  socket.on('player:input', (input) => {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const sim = activeGames.get(session.roomCode);
    if (sim) sim.receiveInput(socket.id, input);
  });

  // Update room settings
  socket.on('room:settings', ({ code, settings }) => {
    const room = roomManager.updateSettings(code, socket.id, settings);
    if (room) io.to(code).emit('room:update', room.toJSON());
  });

  // Reconnection
  socket.on('room:reconnect', ({ token }, callback) => {
    const session = playerSessions.tryReconnect(socket.id, token);
    if (!session) {
      callback?.({ ok: false, error: 'Invalid or expired token' });
      return;
    }
    const room = roomManager.getRoom(session.roomCode);
    if (room) {
      socket.join(session.roomCode);
      io.to(session.roomCode).emit('room:update', room.toJSON());
    }
    callback?.({ ok: true, roomCode: session.roomCode });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    const room = roomManager.getRoomByPlayer(socket.id);
    if (room) {
      if (room.state === 'racing') {
        // Grace period
        playerSessions.onDisconnect(socket.id, (session) => {
          roomManager.leaveRoom(room.code, socket.id);
          io.to(room.code).emit('room:update', room.toJSON());
        });
      } else {
        playerSessions.remove(socket.id);
        roomManager.leaveRoom(room.code, socket.id);
        io.to(room.code).emit('room:update', room.toJSON());

        // Stop game if racing and room empty
        if (room.players.size === 0) {
          const sim = activeGames.get(room.code);
          if (sim) { sim.stop(); activeGames.delete(room.code); }
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`KHAOS KART server running on port ${PORT}`);
});

export { io, httpServer };
