const TICK_RATE = 20; // 20Hz
const TICK_MS = 1000 / TICK_RATE;

export class GameSimulation {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.tick = 0;
    this.interval = null;
    this.playerInputs = new Map();
    this.state = new Map(); // playerId -> { x, y, z, yaw, speed, lap, progress }

    // Initialize state for each player
    const circuit = room.settings;
    let idx = 0;
    for (const [id] of room.players) {
      this.state.set(id, {
        x: idx * 4, y: 0, z: 0,
        yaw: 0, speed: 0,
        lap: 0, progress: 0,
        item: null
      });
      this.playerInputs.set(id, { steering: 0, throttle: 0, brake: false, drift: false, useItem: false });
      idx++;
    }
  }

  start() {
    this.room.state = 'racing';
    this.interval = setInterval(() => this.update(), TICK_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  receiveInput(playerId, input) {
    this.playerInputs.set(playerId, input);
  }

  update() {
    this.tick++;

    // Simplified server physics (move karts based on input)
    for (const [id, input] of this.playerInputs) {
      const s = this.state.get(id);
      if (!s) continue;

      // Simple arcade movement
      const accel = input.throttle * 50;
      const brake = input.brake ? 30 : 0;
      s.speed = Math.max(0, Math.min(80, s.speed + (accel - brake - s.speed * 0.5) * (TICK_MS / 1000)));

      const handling = 2.0;
      s.yaw += input.steering * handling * (TICK_MS / 1000);

      s.x += Math.sin(s.yaw) * s.speed * (TICK_MS / 1000);
      s.z += Math.cos(s.yaw) * s.speed * (TICK_MS / 1000);
    }

    // Broadcast snapshot
    const snapshot = {
      tick: this.tick,
      timestamp: Date.now(),
      players: {}
    };
    for (const [id, s] of this.state) {
      snapshot.players[id] = { x: s.x, y: s.y, z: s.z, yaw: s.yaw, speed: s.speed };
    }

    this.io.to(this.room.code).emit('race:snapshot', snapshot);
  }

  getState() {
    return Object.fromEntries(this.state);
  }
}
