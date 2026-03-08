import { io } from 'socket.io-client';

export class NetworkClient {
  constructor() {
    this.socket = null;
    this.state = 'disconnected'; // connecting, connected, disconnected, reconnecting
    this.roomCode = null;
    this.reconnectToken = null;
    this.listeners = new Map();
    this._inputInterval = null;
  }

  connect(serverUrl = 'http://localhost:3000') {
    this.state = 'connecting';
    this.socket = io(serverUrl, { transports: ['websocket'] });

    this.socket.on('connect', () => {
      this.state = 'connected';
      this._emit('stateChange', this.state);

      if (this.reconnectToken) {
        this.socket.emit('room:reconnect', { token: this.reconnectToken }, (res) => {
          if (res.ok) {
            this.roomCode = res.roomCode;
            this._emit('reconnected', res);
          }
        });
      }
    });

    this.socket.on('disconnect', () => {
      this.state = 'reconnecting';
      this._emit('stateChange', this.state);
    });

    this.socket.on('room:update', (data) => this._emit('roomUpdate', data));
    this.socket.on('room:chat', (data) => this._emit('chat', data));
    this.socket.on('room:starting', (data) => this._emit('starting', data));
    this.socket.on('race:start', (data) => this._emit('raceStart', data));
    this.socket.on('race:snapshot', (data) => this._emit('snapshot', data));
  }

  createRoom(settings) {
    return new Promise((resolve) => {
      this.socket.emit('room:create', settings, (res) => {
        if (res.ok) {
          this.roomCode = res.room.code;
          this.reconnectToken = res.reconnectToken;
        }
        resolve(res);
      });
    });
  }

  joinRoom(code, name) {
    return new Promise((resolve) => {
      this.socket.emit('room:join', { code, name }, (res) => {
        if (res.ok) {
          this.roomCode = res.room.code;
          this.reconnectToken = res.reconnectToken;
        }
        resolve(res);
      });
    });
  }

  selectCharacter(characterId) {
    this.socket.emit('room:select-character', { code: this.roomCode, characterId });
  }

  setReady(ready) {
    this.socket.emit('room:ready', { code: this.roomCode, ready });
  }

  sendChat(message) {
    this.socket.emit('room:chat', { code: this.roomCode, message });
  }

  startRace() {
    this.socket.emit('room:start', { code: this.roomCode });
  }

  updateSettings(settings) {
    this.socket.emit('room:settings', { code: this.roomCode, settings });
  }

  startSendingInput(inputManager, playerIndex = 0) {
    this._inputInterval = setInterval(() => {
      const input = inputManager.getPlayerState(playerIndex);
      if (input) {
        this.socket.volatile.emit('player:input', {
          steering: input.steering,
          throttle: input.throttle,
          brake: input.brake,
          drift: input.drift,
          useItem: input.useItem
        });
      }
    }, 1000 / 60);
  }

  stopSendingInput() {
    if (this._inputInterval) {
      clearInterval(this._inputInterval);
      this._inputInterval = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  _emit(event, data) {
    const list = this.listeners.get(event);
    if (list) list.forEach(cb => cb(data));
  }

  disconnect() {
    this.stopSendingInput();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.state = 'disconnected';
  }
}
