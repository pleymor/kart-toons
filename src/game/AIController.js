import * as THREE from 'three';

const DIFFICULTY = {
  novice: { speedFactor: 0.7, errorRate: 0.3, itemDelay: 3.0, usesShortcuts: false },
  normal: { speedFactor: 0.85, errorRate: 0.1, itemDelay: 1.0, usesShortcuts: false },
  expert: { speedFactor: 1.0, errorRate: 0.02, itemDelay: 0.2, usesShortcuts: true }
};

// AI personality traits per character
const PERSONALITY = {
  rico:    { aggression: 0.5, driftFrequency: 0.8, shortcutPreference: 0.3, itemHoarding: 0.2 },
  zyrx:    { aggression: 0.3, driftFrequency: 0.4, shortcutPreference: 0.5, itemHoarding: 0.8 }, // holds items for critical moments
  krogash: { aggression: 0.9, driftFrequency: 0.2, shortcutPreference: 0.1, itemHoarding: 0.0 }, // drives straight, uses items immediately
  d4sh:    { aggression: 0.6, driftFrequency: 0.5, shortcutPreference: 0.5, itemHoarding: 0.3 },
  vermox:  { aggression: 0.5, driftFrequency: 0.5, shortcutPreference: 0.3, itemHoarding: 0.4 },
  sylvara: { aggression: 0.3, driftFrequency: 0.7, shortcutPreference: 0.9, itemHoarding: 0.2 }, // always takes shortcuts
  sharko:  { aggression: 0.6, driftFrequency: 0.3, shortcutPreference: 0.4, itemHoarding: 0.3 },
  grootx:  { aggression: 0.2, driftFrequency: 0.4, shortcutPreference: 0.2, itemHoarding: 0.5 }
};

export class AIController {
  constructor(kartController, circuit, difficulty = 'normal') {
    this.kart = kartController;
    this.waypoints = circuit.waypoints;
    this.config = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.currentWaypoint = 0;
    this.lookAhead = 3;

    // Character personality
    const charId = kartController.character?.id || 'rico';
    this.personality = PERSONALITY[charId] || PERSONALITY.rico;

    // Adjust behavior based on personality
    this.lookAhead = this.personality.aggression > 0.7 ? 2 : 3;

    // Error simulation
    this._errorTimer = 0;
    this._errorSteer = 0;

    // Item usage
    this._itemTimer = 0;

    // Rubberbanding
    this.rubberBandSpeedBonus = 0;

    this._tempVec = new THREE.Vector3();
    this._targetVec = new THREE.Vector3();
  }

  update(delta) {
    this._updateWaypoint();

    // Generate input
    const input = {
      steering: 0,
      throttle: 1.0,
      brake: false,
      drift: false,
      useItem: false,
      lookBehind: false,
      horn: false
    };

    // Steering toward waypoint
    const target = this._getTargetWaypoint();
    this._targetVec.copy(target).sub(this.kart.position);
    this._targetVec.y = 0;
    const distance = this._targetVec.length();
    this._targetVec.normalize();

    // Calculate angle to target
    const forward = this._tempVec.set(Math.sin(this.kart.yaw), 0, Math.cos(this.kart.yaw));
    const cross = forward.x * this._targetVec.z - forward.z * this._targetVec.x;
    const dot = forward.dot(this._targetVec);

    // Steer toward target
    let steer = Math.sign(cross) * Math.min(Math.abs(cross) * 2, 1.0);

    // Error injection (novice mode)
    this._errorTimer -= delta;
    if (this._errorTimer <= 0 && Math.random() < this.config.errorRate) {
      this._errorSteer = (Math.random() - 0.5) * 0.5;
      this._errorTimer = 0.5 + Math.random() * 1.0;
    }
    if (this._errorTimer > 0) {
      steer += this._errorSteer;
    }

    input.steering = Math.max(-1, Math.min(1, steer));

    // Brake before sharp turns
    const turnAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (turnAngle > 0.5 && this.kart.speed > this.kart.maxSpeed * 0.6) {
      input.brake = true;
      input.throttle = 0.3;
    }

    // Drift on sharp turns at speed
    if (turnAngle > 0.8 && this.kart.speed > this.kart.maxSpeed * 0.4) {
      input.drift = true;
    }

    // Speed factor
    input.throttle *= this.config.speedFactor + this.rubberBandSpeedBonus;

    // Item usage
    this._itemTimer += delta;
    if (this._itemTimer >= this.config.itemDelay) {
      input.useItem = true;
      this._itemTimer = 0;
    }

    this.kart.update(delta, input);
  }

  _updateWaypoint() {
    const wp = this.waypoints[this.currentWaypoint];
    const dx = this.kart.position.x - wp.x;
    const dz = this.kart.position.z - wp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 15) {
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    }
  }

  _getTargetWaypoint() {
    const idx = (this.currentWaypoint + this.lookAhead) % this.waypoints.length;
    return this.waypoints[idx];
  }

  setRubberBand(humanTimeLead) {
    // If human is >5s ahead, AI gets up to +15% speed
    if (humanTimeLead > 5) {
      this.rubberBandSpeedBonus = Math.min(0.15, (humanTimeLead - 5) * 0.03);
    } else {
      this.rubberBandSpeedBonus = 0;
    }
  }
}
