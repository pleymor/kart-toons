import * as THREE from 'three';

const BUFFER_SIZE = 3;
const INTERP_DELAY = 100; // ms

export class Interpolation {
  constructor() {
    this.buffers = new Map(); // playerId -> [{timestamp, x, y, z, yaw, speed}]
  }

  addSnapshot(playerId, snapshot) {
    if (!this.buffers.has(playerId)) {
      this.buffers.set(playerId, []);
    }
    const buffer = this.buffers.get(playerId);
    buffer.push(snapshot);
    if (buffer.length > BUFFER_SIZE + 1) {
      buffer.shift();
    }
  }

  getInterpolatedState(playerId, now) {
    const buffer = this.buffers.get(playerId);
    if (!buffer || buffer.length < 2) {
      return buffer?.[0] || null;
    }

    const renderTime = now - INTERP_DELAY;

    // Find two snapshots surrounding renderTime
    let from = buffer[0];
    let to = buffer[1];
    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i].timestamp >= renderTime) {
        from = buffer[i - 1];
        to = buffer[i];
        break;
      }
      from = buffer[i - 1];
      to = buffer[i];
    }

    const duration = to.timestamp - from.timestamp;
    if (duration <= 0) return to;

    const t = Math.max(0, Math.min(1, (renderTime - from.timestamp) / duration));

    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
      yaw: this._lerpAngle(from.yaw, to.yaw, t),
      speed: from.speed + (to.speed - from.speed) * t
    };
  }

  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  clear() {
    this.buffers.clear();
  }
}
