const ROOM_STATES = { LOBBY: 'lobby', STARTING: 'starting', RACING: 'racing', RESULTS: 'results' };

class Room {
  constructor(code, hostId, settings = {}) {
    this.code = code;
    this.hostId = hostId;
    this.state = ROOM_STATES.LOBBY;
    this.players = new Map();
    this.settings = {
      circuitId: settings.circuitId || 'volcan-peak',
      laps: settings.laps || 3,
      weather: settings.weather || 'random',
      itemsEnabled: settings.itemsEnabled !== false,
      crewMode: settings.crewMode || false,
      maxPlayers: 8,
      ...settings
    };
    this.createdAt = Date.now();
    this.disposeTimer = null;
  }

  addPlayer(socketId, name) {
    if (this.players.size >= this.settings.maxPlayers) return false;
    if (this.state !== ROOM_STATES.LOBBY) return false;
    this.players.set(socketId, {
      id: socketId,
      name: name || `Player ${this.players.size + 1}`,
      characterId: null,
      ready: false,
      reconnectToken: null
    });
    this.clearDisposeTimer();
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.players.size === 0) {
      this.startDisposeTimer();
    }
    if (socketId === this.hostId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value;
    }
  }

  startDisposeTimer() {
    this.disposeTimer = setTimeout(() => {
      this._onDispose?.();
    }, 30000);
  }

  clearDisposeTimer() {
    if (this.disposeTimer) {
      clearTimeout(this.disposeTimer);
      this.disposeTimer = null;
    }
  }

  allReady() {
    if (this.players.size < 2) return false;
    for (const p of this.players.values()) {
      if (!p.ready || !p.characterId) return false;
    }
    return true;
  }

  toJSON() {
    return {
      code: this.code,
      hostId: this.hostId,
      state: this.state,
      settings: this.settings,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id, name: p.name, characterId: p.characterId, ready: p.ready
      }))
    };
  }
}

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  generateCode() {
    let code;
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(socketId, settings) {
    const code = this.generateCode();
    const room = new Room(code, socketId, settings);
    room._onDispose = () => this.rooms.delete(code);
    room.addPlayer(socketId, settings?.playerName);
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, socketId, name) {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (!room.addPlayer(socketId, name)) return null;
    return room;
  }

  leaveRoom(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.removePlayer(socketId);
    if (room.players.size === 0) {
      room.clearDisposeTimer();
      this.rooms.delete(code);
    }
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  getRoomByPlayer(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return null;
  }

  setCharacter(code, socketId, characterId) {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.get(socketId);
    if (player) player.characterId = characterId;
    return room;
  }

  setReady(code, socketId, ready) {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.get(socketId);
    if (player) player.ready = ready;
    return room;
  }

  updateSettings(code, socketId, settings) {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== socketId) return null;
    Object.assign(room.settings, settings);
    return room;
  }
}
