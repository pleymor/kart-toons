import * as THREE from 'three';
import { getAudioEngine } from '../main.js';

const RACE_STATE = { COUNTDOWN: 'countdown', RACING: 'racing', FINISHED: 'finished' };

export class RaceManager {
  constructor(circuit, participants) {
    this.circuit = circuit;
    this.participants = participants; // [{ id, characterId, kartController, isHuman }]
    this.state = RACE_STATE.COUNTDOWN;
    this.timer = 0;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.maxLaps = circuit.defaultLaps || 3;

    // Per-participant tracking
    this.participantData = new Map();
    for (const p of participants) {
      this.participantData.set(p.id, {
        lapCount: 0,
        lapProgress: 0,
        lastWaypointIndex: 0,
        finished: false,
        finishTime: null,
        currentItem: null
      });
    }

    this.standings = participants.map(p => p.id);
    this.finishOrder = [];

    // Waypoint data for progress
    this.waypointCount = circuit.waypoints.length;
    this._waypointPositions = circuit.waypoints;
  }

  update(delta) {
    switch (this.state) {
      case RACE_STATE.COUNTDOWN:
        this._updateCountdown(delta);
        break;
      case RACE_STATE.RACING:
        this.timer += delta;
        this._updateProgress();
        this._updateStandings();
        break;
      case RACE_STATE.FINISHED:
        break;
    }
  }

  _updateCountdown(delta) {
    const prevCountdown = this.countdown;
    this.countdownTimer += delta;
    this.countdown = Math.max(0, 3 - Math.floor(this.countdownTimer));

    // Play countdown SFX on transitions
    const audio = getAudioEngine();
    if (audio && this.countdown !== prevCountdown) {
      if (this.countdown === 2) audio.playSFX('countdown-3');
      else if (this.countdown === 1) audio.playSFX('countdown-2');
      else if (this.countdown === 0) audio.playSFX('countdown-go');
    }
    if (prevCountdown === 1 && this.countdown === 0) {
      if (audio) audio.playSFX('countdown-1');
    }

    if (this.countdownTimer >= 4) {
      this.state = RACE_STATE.RACING;
    }
  }

  _updateProgress() {
    for (const p of this.participants) {
      const data = this.participantData.get(p.id);
      if (data.finished) continue;

      const kartPos = p.kartController.position;

      // Find nearest waypoint
      let nearestIdx = data.lastWaypointIndex;
      let nearestDist = Infinity;

      // Search within a window around last known position
      const searchRadius = 5;
      for (let offset = -2; offset <= searchRadius; offset++) {
        const idx = (data.lastWaypointIndex + offset + this.waypointCount) % this.waypointCount;
        const wp = this._waypointPositions[idx];
        const dx = kartPos.x - wp.x;
        const dz = kartPos.z - wp.z;
        const dist = dx * dx + dz * dz;
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = idx;
        }
      }

      // Detect forward progress (must be moving forward through waypoints)
      const prevIdx = data.lastWaypointIndex;
      const forwardDist = (nearestIdx - prevIdx + this.waypointCount) % this.waypointCount;

      if (forwardDist > 0 && forwardDist < this.waypointCount / 2) {
        // Check for lap completion
        if (prevIdx > this.waypointCount * 0.8 && nearestIdx < this.waypointCount * 0.2) {
          data.lapCount++;

          if (data.lapCount >= this.maxLaps) {
            data.finished = true;
            data.finishTime = this.timer;
            this.finishOrder.push({
              id: p.id,
              time: this.timer,
              characterId: p.characterId
            });

            // Check if all finished
            if (this.finishOrder.length >= this.participants.length) {
              this.state = RACE_STATE.FINISHED;
            }
          }
        }
        data.lastWaypointIndex = nearestIdx;
      }

      // Calculate progress within current lap
      data.lapProgress = nearestIdx / this.waypointCount;
    }
  }

  _updateStandings() {
    this.standings.sort((aId, bId) => {
      const a = this.participantData.get(aId);
      const b = this.participantData.get(bId);

      // Finished karts first, by finish time
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;

      // By lap count, then lap progress
      if (a.lapCount !== b.lapCount) return b.lapCount - a.lapCount;
      return b.lapProgress - a.lapProgress;
    });
  }

  getPosition(participantId) {
    return this.standings.indexOf(participantId) + 1;
  }

  getParticipantData(participantId) {
    return this.participantData.get(participantId);
  }

  isRacing() {
    return this.state === RACE_STATE.RACING;
  }

  isCountdown() {
    return this.state === RACE_STATE.COUNTDOWN;
  }

  isFinished() {
    return this.state === RACE_STATE.FINISHED;
  }

  getResults() {
    return {
      finishOrder: this.finishOrder,
      timer: this.timer,
      standings: this.standings
    };
  }
}

// Ghost recording/playback for Time Trial
export class GhostRecorder {
  constructor() {
    this.frames = [];
    this._timer = 0;
    this._interval = 0.1; // Record every 100ms
    this._nextCapture = 0;
  }

  update(delta, kart) {
    this._timer += delta;
    if (this._timer >= this._nextCapture) {
      this.frames.push({
        t: this._timer,
        x: kart.position.x,
        y: kart.position.y,
        z: kart.position.z,
        yaw: kart.yaw
      });
      this._nextCapture += this._interval;
    }
  }

  getData() {
    return this.frames;
  }
}

export class GhostPlayer {
  constructor(frames, mesh) {
    this.frames = frames;
    this.mesh = mesh;
    this._timer = 0;
    this._frameIdx = 0;
  }

  update(delta) {
    this._timer += delta;

    // Find surrounding frames
    while (this._frameIdx < this.frames.length - 1 && this.frames[this._frameIdx + 1].t < this._timer) {
      this._frameIdx++;
    }

    if (this._frameIdx >= this.frames.length - 1) return;

    const a = this.frames[this._frameIdx];
    const b = this.frames[this._frameIdx + 1];
    const t = (this._timer - a.t) / (b.t - a.t);

    this.mesh.position.set(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    );
    this.mesh.rotation.y = a.yaw + (b.yaw - a.yaw) * t;
  }
}

// Grand Prix manager
export class GrandPrixManager {
  constructor(circuitIds, participants) {
    this.circuitIds = circuitIds;
    this.currentRaceIndex = 0;
    this.points = new Map(); // participantId -> total points
    this.raceResults = [];

    for (const p of participants) {
      this.points.set(p, 0);
    }
  }

  static POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

  getCurrentCircuitId() {
    return this.circuitIds[this.currentRaceIndex];
  }

  recordResult(finishOrder) {
    this.raceResults.push(finishOrder);
    for (let i = 0; i < finishOrder.length; i++) {
      const pts = GrandPrixManager.POINTS[i] || 0;
      const current = this.points.get(finishOrder[i].id) || 0;
      this.points.set(finishOrder[i].id, current + pts);
    }
    this.currentRaceIndex++;
  }

  isComplete() {
    return this.currentRaceIndex >= this.circuitIds.length;
  }

  getStandings() {
    return Array.from(this.points.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, pts]) => ({ id, points: pts }));
  }

  getRaceCount() {
    return this.circuitIds.length;
  }
}
