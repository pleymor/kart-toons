import * as THREE from 'three';
import { getTrackWidthAtSegment } from '../utils/TrackWidth.js';

const DRIFT_STATE = { NONE: 0, CHARGING: 1 };
const BOOST_TIERS = [
  { threshold: 0.5, power: 1.3, duration: 1.5 },
  { threshold: 1.2, power: 1.6, duration: 2.4 },
  { threshold: 2.0, power: 2.0, duration: 3.6 }
];

export class KartController {
  constructor(physics, characterData, mesh, body) {
    this.physics = physics;
    this.character = characterData;
    this.mesh = mesh;
    this.body = body;

    // Stats → physics parameters
    const s = characterData.stats;
    this.baseMaxSpeed = 100 + s.speed * 16;   // 116-260 units/s
    this.maxSpeed = this.baseMaxSpeed;
    this.accelForce = 50 + s.acceleration * 10;
    this._throttleTime = 0; // continuous throttle duration for log speed curve
    this.handling = 0.5 + s.handling * 0.12;  // turn rate
    this.weightFactor = s.weight;
    this.drag = 0.98;
    this.brakePower = 40;
    this.kartPhysicsType = characterData.kartPhysicsType || 'wheeled';

    // Physics type adjustments
    if (this.kartPhysicsType === 'levitating') {
      this.hoverHeight = 0.4;
      this.drag = 0.975; // slightly more drift
    } else if (this.kartPhysicsType === 'tracked') {
      this.handling *= 0.8; // slower turning for tracks
      this.drag = 0.985;   // more momentum
    } else if (this.kartPhysicsType === 'hybrid') {
      this.handling *= 1.1; // drift-assisted turning
    }

    // State
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.yaw = 0;
    this.steerAngle = 0;
    this.grounded = true;
    this.surfaceFriction = 1.0;
    this.surfaceType = 'road';
    this.falling = false;
    this.airborne = false; // true when launched (levitateur, ramps)
    this._groundY = 0;    // track surface Y at current position
    this.slopeGrade = 0;  // positive = uphill, negative = downhill
    this._prevSlopeGrade = 0; // previous frame slope for crest detection
    this.pitchAngle = 0;  // tilt forward/back from slope
    this._targetPitch = 0;
    this._respawnPos = new THREE.Vector3();
    this._respawnYaw = 0;

    // Trick animations (backflip, barrel roll)
    this._trickType = null;  // 'backflip' | 'barrelroll' | null
    this._trickAngle = 0;    // accumulated rotation during trick
    this._trickSpeed = 0;    // radians per second

    // Drift
    this.driftState = DRIFT_STATE.NONE;
    this.driftTimer = 0;
    this.driftDirection = 0;
    this.driftChargeRate = characterData.passive?.effectModifiers?.driftChargeRate || 1.0;

    // Boost
    this.boostTimer = 0;
    this.boostMultiplier = 1.0;

    // Item effects
    this.speedMultiplier = 1.0;
    this.controlsReversed = false;
    this.immobilized = false;
    this.phaseGhost = false;
    this.invulnerable = false;

    // Active effects with timers
    this.activeEffects = [];

    // Forward direction
    this._forward = new THREE.Vector3();
    this._tempVec = new THREE.Vector3();
  }

  update(delta, input) {
    if (this.immobilized) {
      this._updateEffects(delta);
      this._syncMesh();
      return;
    }

    // Ground detection
    this._checkGround();

    // Steering
    let steerInput = input?.steering || 0;
    if (this.controlsReversed) steerInput *= -1;

    const speedFactor = Math.min(this.speed / (this.maxSpeed * 0.5), 1.0);
    const turnRate = this.handling * (1.0 - speedFactor * 0.4);

    if (this.driftState === DRIFT_STATE.CHARGING) {
      // Drifting: tighter turn in drift direction, less responsive to counter-steer
      this.yaw -= this.driftDirection * turnRate * 1.4 * delta;
      this.yaw -= steerInput * turnRate * 0.4 * delta;
    } else {
      this.yaw -= steerInput * turnRate * delta;
    }

    this.steerAngle = steerInput;

    // Forward vector
    this._forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    // Throttle (slope affects acceleration)
    const throttle = input?.throttle || 0;
    if (throttle > 0 && (this.grounded || this.airborne)) {
      this._throttleTime += delta;
      // Logarithmic speed curve: maxSpeed grows unbounded with sustained throttle
      // baseMaxSpeed is reached quickly, then it keeps climbing slowly
      this.maxSpeed = this.baseMaxSpeed * (1 + 0.3 * Math.log(1 + this._throttleTime));

      // slopeGrade > 0 = uphill (less accel), < 0 = downhill (more accel)
      const slopeFactor = 1.0 - this.slopeGrade * 3.0;
      // Acceleration decreases as speed approaches current maxSpeed (soft limit)
      const speedRatio = this.speed / (this.maxSpeed * this.speedMultiplier * this.boostMultiplier || 1);
      const accelFalloff = Math.max(0.05, 1.0 - speedRatio * 0.8);
      const accel = this.accelForce * throttle * this.surfaceFriction * Math.max(0.2, slopeFactor) * accelFalloff;
      this.velocity.add(this._tempVec.copy(this._forward).multiplyScalar(accel * delta));
    } else {
      // Reset throttle time when not accelerating
      this._throttleTime = Math.max(0, this._throttleTime - delta * 3);
      this.maxSpeed = this.baseMaxSpeed * (1 + 0.3 * Math.log(1 + this._throttleTime));
    }

    // Gravity along slope (push kart downhill even without throttle)
    if (this.grounded && Math.abs(this.slopeGrade) > 0.01) {
      const gravityForce = -this.slopeGrade * 20;
      this.velocity.add(this._tempVec.copy(this._forward).multiplyScalar(gravityForce * delta));
    }

    // Braking / reverse (only when grounded)
    if (input?.brake && this.grounded) {
      if (this.speed > 0.5) {
        // Braking
        const brakeForce = this.brakePower * delta;
        this.speed = Math.max(0, this.speed - brakeForce);
        this.velocity.copy(this._forward).multiplyScalar(this.speed);
      } else {
        // Reverse
        const reverseMax = this.baseMaxSpeed * 0.3;
        const reverseAccel = this.accelForce * 0.4 * delta;
        this.speed = Math.min(reverseMax, this.speed + reverseAccel);
        this.velocity.copy(this._forward).multiplyScalar(-this.speed);
      }
    }

    // Drift logic
    this._updateDrift(delta, input);

    // Boost
    this._updateBoost(delta);

    // Lateral grip: blend velocity toward forward direction
    // Low handling + high speed + heavy = more oversteer (slide)
    // High handling + light = snappy, velocity follows yaw quickly
    const grip = this.handling * 0.6 / Math.max(this.weightFactor * 0.25, 1);
    const gripFactor = Math.min(grip * delta * 8, 1.0);
    const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (currentSpeed > 0.1) {
      this._tempVec.copy(this._forward).multiplyScalar(currentSpeed);
      this.velocity.x += (this._tempVec.x - this.velocity.x) * gripFactor;
      this.velocity.z += (this._tempVec.z - this.velocity.z) * gripFactor;
    }

    // Apply drag
    this.velocity.multiplyScalar(this.drag);

    // Update speed (no hard cap — drag and accel falloff are the only limits)
    const hSpeedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
    this.speed = Math.sqrt(hSpeedSq);

    if (this.falling || this.airborne) {
      // Apply gravity — 18 for a floaty arcade feel, not stone-drop 30
      this.velocity.y -= 18 * delta;
    } else {
      // Grounded: vertical velocity follows the slope
      this.velocity.y = this.speed * this.slopeGrade;
    }

    // Move
    this.position.add(this._tempVec.copy(this.velocity).multiplyScalar(delta));

    // Off-road: respawn quickly after falling
    if (this.falling) {
      this._offRoadTimer = (this._offRoadTimer || 0) + delta;
      if (this._offRoadTimer >= 2.0 || this.position.y < -50) {
        // Respawn back on track
        this.position.copy(this._respawnPos);
        this.yaw = this._respawnYaw;
        this.velocity.set(0, 0, 0);
        this.speed = 0;
        this.falling = false;
        this.grounded = true;
        this.surfaceFriction = 1.0;
        this._offRoadTimer = 0;
      }
    } else {
      this._offRoadTimer = 0;
    }

    // Update effects
    this._updateEffects(delta);

    // Sync physics body and mesh
    this._syncBody();
    this._syncMesh();
  }

  _checkGround() {
    // Use circuit waypoints for ground height, interpolated for smooth slopes
    if (this._circuit) {
      const wps = this._circuit.waypoints;
      // Find the closest segment (pair of consecutive waypoints)
      let bestDist = Infinity;
      let bestY = 0;
      let bestSegIdx = 0;
      let bestT = 0;
      for (let i = 0; i < wps.length; i++) {
        const a = wps[i];
        const b = wps[(i + 1) % wps.length];
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const apx = this.position.x - a.x;
        const apz = this.position.z - a.z;
        const abLenSq = abx * abx + abz * abz;
        const t = abLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq)) : 0;
        const cx = a.x + abx * t;
        const cz = a.z + abz * t;
        const dx = this.position.x - cx;
        const dz = this.position.z - cz;
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          bestY = a.y + (b.y - a.y) * t;
          bestSegIdx = i;
          bestT = t;
        }
      }

      const lateralDist = Math.sqrt(bestDist);
      const trackHalf = getTrackWidthAtSegment(this._circuit, bestSegIdx, bestT) * 0.5;

      // Save last valid on-road position for respawn
      if (lateralDist <= trackHalf) {
        const a = wps[bestSegIdx];
        const b = wps[(bestSegIdx + 1) % wps.length];
        this._respawnPos.set(
          a.x + (b.x - a.x) * bestT,
          bestY,
          a.z + (b.z - a.z) * bestT
        );
        this._respawnYaw = Math.atan2(b.x - a.x, b.z - a.z);
      }

      this._groundY = bestY;

      // Compute slope: how much the kart is going uphill or downhill
      const segA = wps[bestSegIdx];
      const segB = wps[(bestSegIdx + 1) % wps.length];
      const segDx = segB.x - segA.x;
      const segDz = segB.z - segA.z;
      const segDy = segB.y - segA.y;
      const segHLen = Math.sqrt(segDx * segDx + segDz * segDz) || 1;
      // Slope angle as rise/run
      const segSlope = segDy / segHLen;
      // Dot with kart forward to determine if going up or down
      const dotFwd = (this._forward.x * segDx + this._forward.z * segDz) / segHLen;
      this.slopeGrade = segSlope * dotFwd; // positive = uphill, negative = downhill
      // Pitch angle: atan of rise/run along kart direction
      this._targetPitch = -Math.atan2(segDy * dotFwd, segHLen * Math.abs(dotFwd) || 1);

      if (lateralDist <= trackHalf + 2) {
        // On or near road
        if (this.airborne) {
          // Launched in the air: only land when falling back down onto the surface
          if (this.position.y <= bestY && this.velocity.y <= 0) {
            // Coming down and hit the surface — land
            this.airborne = false;
            this.grounded = true;
            this.falling = false;
            this.position.y = bestY;
            this.velocity.y = 0;
          } else if (this.position.y < bestY) {
            // Still going up but clipping through surface — push up
            this.position.y = bestY;
          } else {
            this.grounded = false;
          }
        } else if (this._prevSlopeGrade > 0.03 && this.slopeGrade <= 0 && this.speed > 10) {
          // Crest detection: slope transitioned from uphill to flat/downhill at speed
          this.airborne = true;
          this.grounded = false;
          // Launch velocity proportional to previous uphill slope and current speed
          this.velocity.y = this.speed * this._prevSlopeGrade * 0.7;
        } else if (this.position.y > bestY + 0.05 && this.speed > 5) {
          // Fallback: position above track (e.g. from external launch)
          this.airborne = true;
          this.grounded = false;
        } else {
          // Normal: snap to surface
          this.grounded = true;
          this.falling = false;
          this.position.y = bestY;
        }
        this._prevSlopeGrade = this.slopeGrade;
        this.surfaceFriction = lateralDist <= trackHalf ? 1.0 : 0.6;
        return;
      }

      // Off road: gentle arc down, preserve some momentum
      if (!this.falling) {
        // First frame off-road: keep current horizontal momentum
        this.falling = true;
        this.grounded = false;
        // Give a slight upward nudge based on forward speed for a natural arc
        if (this.velocity.y === 0) {
          this.velocity.y = Math.min(this.speed * 0.15, 5);
        }
      }
      this.surfaceFriction = 0.05;
      // Gentle deceleration (not instant kill) — air drag
      const airDrag = 0.98;
      this.speed *= airDrag;
      this.velocity.x *= airDrag;
      this.velocity.z *= airDrag;
      return;
    }

    // Last resort: keep grounded at current Y
    this.grounded = true;
    this.surfaceFriction = 1.0;
  }

  _updateDrift(delta, input) {
    const driftPressed = input?.drift || false;

    if (driftPressed && this.driftState === DRIFT_STATE.NONE && this.speed > this.maxSpeed * 0.3) {
      this.driftState = DRIFT_STATE.CHARGING;
      this.driftDirection = this.steerAngle >= 0 ? 1 : -1;
      this.driftTimer = 0;
    }

    if (this.driftState === DRIFT_STATE.CHARGING) {
      this.driftTimer += delta * this.driftChargeRate;

      if (!driftPressed) {
        // Release: apply boost based on charge tier
        let tier = null;
        for (let i = BOOST_TIERS.length - 1; i >= 0; i--) {
          if (this.driftTimer >= BOOST_TIERS[i].threshold) {
            tier = BOOST_TIERS[i];
            break;
          }
        }
        if (tier) {
          this.boostTimer = tier.duration;
          this.boostMultiplier = tier.power;
        }

        this.driftState = DRIFT_STATE.NONE;
        this.driftTimer = 0;
        this.driftDirection = 0;
      }
    }
  }

  _updateBoost(delta) {
    if (this.boostTimer > 0) {
      this.boostTimer -= delta;
      if (this.boostTimer <= 0) {
        this.boostTimer = 0;
        // Start fade-out instead of instant cut
        this._boostFadeTarget = this.boostMultiplier;
      }
    }
    // Gradual fade-out after drift boost ends
    if (this.boostTimer <= 0 && this.boostMultiplier > 1.0) {
      this.boostMultiplier = Math.max(1.0, this.boostMultiplier - delta * 0.3);
    }
  }

  _updateEffects(delta) {
    // Reset speedMultiplier each frame — effects push it up via Math.max
    this.speedMultiplier = 1.0;
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      if (effect.onTick) effect.onTick(this, delta);
      effect.timer -= delta;
      if (effect.timer <= 0) {
        if (effect.onEnd) effect.onEnd(this);
        this.activeEffects.splice(i, 1);
      }
    }
  }

  applyEffect(effect) {
    if (effect.onStart) effect.onStart(this);
    this.activeEffects.push(effect);
    if (!effect.keepMomentum) this._throttleTime = 0;
  }

  applyKnockback(direction, force) {
    this._throttleTime = 0;
    this._tempVec.copy(direction).multiplyScalar(force / Math.max(this.weightFactor, 1));
    this.velocity.add(this._tempVec);
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this._syncBody();
    this._syncMesh();
  }

  setYaw(yaw) {
    this.yaw = yaw;
    this._syncMesh();
  }

  _syncBody() {
    if (this.body) {
      this.body.setTranslation({ x: this.position.x, y: this.position.y, z: this.position.z }, true);
    }
  }

  _syncMesh() {
    if (this.mesh) {
      this.mesh.position.copy(this.position);

      // Trick animation progress — cap at one full rotation
      if (this._trickType && (this.airborne || this.falling)) {
        if (this._trickAngle < Math.PI * 2) {
          this._trickAngle = Math.min(Math.PI * 2, this._trickAngle + this._trickSpeed * (1 / 60));
        }
      }
      // End trick on landing
      if (this._trickType && this.grounded) {
        this._trickType = null;
        this._trickAngle = 0;
        this._trickSpeed = 0;
      }

      // In the air: pitch follows vertical velocity (nose up on launch, nose down on fall)
      if ((this.airborne || this.falling) && !this._trickType) {
        const hSpeed = Math.max(this.speed, 1);
        this._targetPitch = Math.atan2(this.velocity.y, hSpeed) * 0.6;
      }

      // Smooth pitch toward target
      this.pitchAngle += (this._targetPitch - this.pitchAngle) * 0.15;

      this.mesh.rotation.order = 'YXZ';
      this.mesh.rotation.y = this.yaw;

      if (this._trickType === 'backflip') {
        this.mesh.rotation.x = -this._trickAngle;
        this.mesh.rotation.z = 0;
      } else if (this._trickType === 'barrelroll') {
        this.mesh.rotation.x = this.pitchAngle;
        this.mesh.rotation.z = this._trickAngle;
      } else {
        this.mesh.rotation.x = this.pitchAngle;
        this.mesh.rotation.z = 0;
      }
    }
  }

  getState() {
    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      speed: this.speed,
      yaw: this.yaw,
      steerAngle: this.steerAngle,
      drifting: this.driftState === DRIFT_STATE.CHARGING,
      grounded: this.grounded
    };
  }
}
