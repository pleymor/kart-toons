import { randomUUID } from 'crypto';

export class PlayerSession {
  constructor() {
    this.sessions = new Map(); // socketId -> session
    this.tokens = new Map();   // reconnectToken -> session
    this.graceTimers = new Map(); // socketId -> timer
  }

  create(socketId, roomCode) {
    const token = randomUUID();
    const session = {
      socketId,
      roomCode,
      reconnectToken: token,
      connected: true,
      lastInput: null
    };
    this.sessions.set(socketId, session);
    this.tokens.set(token, session);
    return token;
  }

  onDisconnect(socketId, onGraceExpired) {
    const session = this.sessions.get(socketId);
    if (!session) return null;
    session.connected = false;

    const timer = setTimeout(() => {
      this.graceTimers.delete(socketId);
      this.sessions.delete(socketId);
      this.tokens.delete(session.reconnectToken);
      onGraceExpired?.(session);
    }, 10000);

    this.graceTimers.set(socketId, timer);
    return session;
  }

  tryReconnect(newSocketId, token) {
    const session = this.tokens.get(token);
    if (!session || session.connected) return null;

    // Clear grace timer
    const timer = this.graceTimers.get(session.socketId);
    if (timer) {
      clearTimeout(timer);
      this.graceTimers.delete(session.socketId);
    }

    // Transfer session
    this.sessions.delete(session.socketId);
    session.socketId = newSocketId;
    session.connected = true;
    this.sessions.set(newSocketId, session);

    return session;
  }

  get(socketId) {
    return this.sessions.get(socketId);
  }

  remove(socketId) {
    const session = this.sessions.get(socketId);
    if (!session) return;
    const timer = this.graceTimers.get(socketId);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(socketId);
    this.sessions.delete(socketId);
    this.tokens.delete(session.reconnectToken);
  }
}
