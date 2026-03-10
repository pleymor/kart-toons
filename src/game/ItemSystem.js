import * as THREE from 'three';
import { getAudioEngine } from '../main.js';
import { GrapplinBoost } from '../characters/Rico.js';
import { MindSpike } from '../characters/Zyrx.js';
import { ChargeCornue } from '../characters/Krogash.js';
import { Overclock } from '../characters/D4sh.js';
import { NapalmTrail } from '../characters/Vermox.js';
import { HexClone } from '../characters/Sylvara.js';
import { SonarPulse } from '../characters/Sharko.js';
import { RootTrap } from '../characters/GrootX.js';

const SIGNATURE_WEAPONS = {
  'grapplin-boost': GrapplinBoost,
  'mind-spike': MindSpike,
  'charge-cornue': ChargeCornue,
  'overclock': Overclock,
  'napalm-trail': NapalmTrail,
  'hex-clone': HexClone,
  'sonar-pulse': SonarPulse,
  'root-trap': RootTrap
};

// Position-based probability weights (1=first, 8=last)
const ITEM_WEIGHTS = {
  'boost-nitro':       { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10 },
  'orbe-de-choc':      { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9 },
  'mine-magnetique':   { 1: 5, 2: 4, 3: 3, 4: 3, 5: 2, 6: 2, 7: 1, 8: 1 },
  'bouclier-orbital':  { 1: 6, 2: 5, 3: 4, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1 },
  'nappe-de-gel':      { 1: 4, 2: 3, 3: 3, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1 },
  'salve-de-debris':   { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 },
  'onde-emp':          { 1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6 },
  'traqueur-de-rang':  { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 3, 7: 5, 8: 7 },
  'cloak':             { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2 },
  'leurre':            { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1 },
  'levitateur':        { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3 },
  'teleporteur':       { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 3, 7: 5, 8: 8 },
  'phase-ghost':       { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4 },
  'mur-temporaire':    { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 0 },
  'faux-bonus':        { 1: 3, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0 },
  'pluie-asteroides':  { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 2, 7: 3, 8: 5 }
};

const ITEM_ICONS = {
  'boost-nitro': '\u{1F525}',        // 🔥
  'orbe-de-choc': '\u{26A1}',        // ⚡
  'mine-magnetique': '\u{1F4A3}',    // 💣
  'bouclier-orbital': '\u{1F6E1}',   // 🛡
  'nappe-de-gel': '\u{2744}',        // ❄
  'salve-de-debris': '\u{1F4A5}',    // 💥
  'onde-emp': '\u{1F300}',           // 🌀
  'traqueur-de-rang': '\u{1F3AF}',  // 🎯
  'cloak': '\u{1F47B}',              // 👻
  'leurre': '\u{1F916}',             // 🤖
  'levitateur': '\u{1F680}',         // 🚀
  'teleporteur': '\u{2728}',         // ✨
  'phase-ghost': '\u{1F30A}',        // 🌊
  'mur-temporaire': '\u{1F9F1}',     // 🧱
  'faux-bonus': '\u{2753}',          // ❓
  'pluie-asteroides': '\u{2604}',    // ☄
  'oeil-de-khaos': '\u{1F441}',       // 👁
  // Signature weapons
  'grapplin-boost': '\u{1FA9D}',     // 🪝
  'mind-spike': '\u{1F9E0}',         // 🧠
  'charge-cornue': '\u{1F98C}',      // 🦌
  'overclock': '\u{26A1}',           // ⚡
  'napalm-trail': '\u{1F525}',       // 🔥
  'hex-clone': '\u{1F52E}',          // 🔮
  'sonar-pulse': '\u{1F4E1}',        // 📡
  'root-trap': '\u{1FAB4}',          // 🪴
  'chaos-rift': '\u{1F30C}',         // 🌌
  'system-crash': '\u{1F4BB}'        // 💻
};

// SFX played at trap position when triggered
const TRAP_TRIGGER_SFX = {
  'mine': 'explosion',
  'gel': 'splash',
  'fake-crate': 'explosion',
  'wall': 'slam'
};

// Shared geometries for item meshes
const _crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
const _crateInnerGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
const _projectileGeo = new THREE.SphereGeometry(0.3, 8, 8);
const _mineGeo = new THREE.SphereGeometry(0.5, 8, 8);

// Shared materials for crates (created once)
const _shellMat = new THREE.MeshPhongMaterial({
  color: 0xffaa00, emissive: 0xff6600, emissiveIntensity: 0.4,
  transparent: true, opacity: 0.55, side: THREE.DoubleSide
});
const _coreMat = new THREE.MeshPhongMaterial({
  color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.8
});
// "?" canvas texture (shared by all crates)
let _questionTexture = null;
function _getQuestionTexture() {
  if (_questionTexture) return _questionTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 32, 30);
  _questionTexture = new THREE.CanvasTexture(canvas);
  return _questionTexture;
}

export class ItemSystem {
  constructor(scene, circuit, participants) {
    this.scene = scene;
    this.circuit = circuit;
    this.participants = participants; // [{ id, kartController }]
    this.listenerPos = null; // set externally to player kart position for 3D audio

    // Item crates
    this.crates = [];
    this._initCrates();

    // Active projectiles/effects on track
    this.activeItems = [];

    // Held items per participant
    this.heldItems = new Map();
    for (const p of participants) {
      this.heldItems.set(p.id, null);
    }
  }

  _initCrates() {
    const spawns = this.circuit.itemCrateSpawns || [];
    for (const pos of spawns) {
      const crate = this._createCrateMesh(pos);
      this.crates.push({
        mesh: crate,
        position: pos.clone(),
        active: true,
        respawnTimer: 0
      });
      this.scene.add(crate);
    }
  }

  _createCrateMesh(position) {
    const group = new THREE.Group();

    // Outer translucent shell (shared material — clone for per-crate opacity pulse)
    const shell = new THREE.Mesh(_crateGeo, _shellMat.clone());
    group.add(shell);

    // Inner glowing core
    const core = new THREE.Mesh(_crateInnerGeo, _coreMat);
    group.add(core);

    // "?" sprite on top
    const tex = _getQuestionTexture();
    const spriteMat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.0, 1.0, 1);
    sprite.position.set(0, 1.2, 0);
    group.add(sprite);

    group.position.copy(position);
    return group;
  }

  update(delta) {
    this._crateTime = (this._crateTime || 0) + delta;
    // Animate crates: spin, bob, pulse glow
    for (let i = 0; i < this.crates.length; i++) {
      const crate = this.crates[i];
      if (crate.active) {
        crate.mesh.rotation.y += delta * 1.5;
        // Gentle bob up/down
        const bob = Math.sin(this._crateTime * 2 + i * 1.7) * 0.3;
        crate.mesh.position.y = crate.position.y + bob;
        // Pulse the shell opacity and glow
        const pulse = 0.4 + Math.sin(this._crateTime * 3 + i * 2.1) * 0.15;
        const shell = crate.mesh.children[0];
        if (shell?.material) shell.material.opacity = pulse;
        crate.mesh.visible = true;
      } else {
        crate.mesh.visible = false;
        crate.respawnTimer -= delta;
        if (crate.respawnTimer <= 0) {
          crate.active = true;
        }
      }
    }

    // Check crate pickups
    for (const p of this.participants) {
      if (this.heldItems.get(p.id) !== null) continue;

      const kartPos = p.kartController.position;
      for (const crate of this.crates) {
        if (!crate.active) continue;
        const dx = kartPos.x - crate.position.x;
        const dy = kartPos.y - crate.position.y;
        const dz = kartPos.z - crate.position.z;
        if (dx * dx + dy * dy + dz * dz < 9) { // 3m radius
          this._collectCrate(p, crate);
          break;
        }
      }
    }

    // Update active items
    for (let i = this.activeItems.length - 1; i >= 0; i--) {
      const item = this.activeItems[i];
      item.timer -= delta;

      if (item.update) item.update(delta);

      if (item.timer <= 0) {
        if (item.mesh) this.scene.remove(item.mesh);
        if (item.onExpire) item.onExpire();
        this.activeItems.splice(i, 1);
      }
    }
  }

  _collectCrate(participant, crate) {
    crate.active = false;
    crate.respawnTimer = 12;
    const audio = getAudioEngine();
    if (audio) audio.playSFX('item-pickup');

    // 10% chance for character's signature weapon
    const charData = participant.kartController?.character;
    if (charData?.signatureWeapon && Math.random() < 0.1) {
      this.heldItems.set(participant.id, charData.signatureWeapon.id);
      return;
    }

    // Roll item based on position
    const position = this._getParticipantPosition(participant.id);
    const itemId = this._rollItem(position);
    this.heldItems.set(participant.id, itemId);
  }

  _rollItem(racePosition) {
    const pos = Math.max(1, Math.min(8, racePosition));
    let totalWeight = 0;
    const entries = [];

    for (const [id, weights] of Object.entries(ITEM_WEIGHTS)) {
      const w = weights[pos] || 0;
      totalWeight += w;
      entries.push({ id, weight: w });
    }

    let roll = Math.random() * totalWeight;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.id;
    }
    return 'boost-nitro'; // fallback
  }

  useItem(participantId) {
    const itemId = this.heldItems.get(participantId);
    if (!itemId) return false;

    const participant = this.participants.find(p => p.id === participantId);
    if (!participant) return false;

    this.heldItems.set(participantId, null);
    this._playItemSFX(itemId);
    this._applyItemEffect(itemId, participant);
    return true;
  }

  _playItemSFX(itemId) {
    const audio = getAudioEngine();
    if (!audio) return;
    const sfxMap = {
      'boost-nitro': 'boost',
      'orbe-de-choc': 'projectile',
      'salve-de-debris': 'projectile',
      'onde-emp': 'emp',
      'traqueur-de-rang': 'laser',
      'bouclier-orbital': 'shield',
      'cloak': 'shield',
      'leurre': 'teleport',
      'levitateur': 'boost',
      'teleporteur': 'teleport',
      'phase-ghost': 'teleport',
      'pluie-asteroides': 'explosion',
      'oeil-de-khaos': 'emp'
    };
    audio.playSFX(sfxMap[itemId] || 'projectile');
  }

  _applyItemEffect(itemId, user) {
    const kart = user.kartController;

    switch (itemId) {
      case 'boost-nitro': {
        // Progressive nitro boost: ramps up, holds, fades out
        const nitroMult = 1.5;
        const totalDur = 3;
        const boostForce = kart.maxSpeed * 0.3;
        kart.applyEffect({
          timer: totalDur,
          keepMomentum: true,
          onStart() {},
          onTick(k, dt) {
            const elapsed = totalDur - this.timer;
            const fadeStart = totalDur * 0.7;
            let t;
            if (elapsed < fadeStart) {
              t = 1.0; // full power immediately
            } else {
              t = 1.0 - (elapsed - fadeStart) / (totalDur - fadeStart); // linear fade
            }
            k.speedMultiplier = Math.max(k.speedMultiplier, 1 + (nitroMult - 1) * t);
            // Active forward push
            const fwd = new THREE.Vector3(Math.sin(k.yaw), 0, Math.cos(k.yaw));
            k.velocity.add(fwd.multiplyScalar(boostForce * t * dt));
          },
          onEnd() {}
        });
        break;
      }

      case 'orbe-de-choc': {
        // Find nearest opponent ahead
        const target = this._findNearestAhead(user);
        if (target) {
          this._spawnProjectile(kart.position, target.kartController.position, (hitKart) => {
            hitKart.applyEffect({
              timer: 1.5,
              onStart: (k) => { k.speed *= 0.2; k.velocity.multiplyScalar(0.2); },
              onEnd: () => {}
            });
          });
        }
        break;
      }

      case 'mine-magnetique': {
        const dropPos = kart.position.clone();
        dropPos.y += 0.3;
        const forward = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
        dropPos.add(forward.multiplyScalar(-3));

        const mat = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x330000 });
        const mesh = new THREE.Mesh(_mineGeo, mat);
        mesh.position.copy(dropPos);
        this.scene.add(mesh);

        let mineArmed = false;
        const mineArmDelay = 1.5;
        let mineArmTimer = 0;
        let mineTriggered = false;
        const mineItem = {
          type: 'mine',
          position: dropPos.clone(),
          mesh,
          timer: 30,
          ownerId: user.id,
          update: (dt) => {
            if (mineTriggered) return;
            mineArmTimer += dt;
            if (!mineArmed && mineArmTimer >= mineArmDelay) mineArmed = true;
            for (const p of this.participants) {
              if (p.id === user.id && !mineArmed) continue;
              const d = p.kartController.position.distanceTo(dropPos);
              if (d < 3) {
                p.kartController.applyEffect({
                  timer: 1.5,
                  onStart: (k) => { k.speed *= 0.1; k.velocity.multiplyScalar(0.1); },
                  onEnd: () => {}
                });
                this._playTrapTriggerSFX('mine', dropPos);
                mineTriggered = true;
                mineItem.timer = 0; // remove on next update cycle
                this.scene.remove(mesh);
                return;
              }
            }
          }
        };
        this.activeItems.push(mineItem);
        break;
      }

      case 'bouclier-orbital': {
        // Visible rotating shield around kart + invulnerability + knockback
        const shieldGeo = new THREE.TorusGeometry(2.5, 0.15, 8, 24);
        const shieldMat = new THREE.MeshBasicMaterial({
          color: 0x00ccff, transparent: true, opacity: 0.5,
          side: THREE.DoubleSide
        });
        const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        shieldMesh.rotation.x = Math.PI / 2;
        kart.mesh.add(shieldMesh);

        kart.applyEffect({
          timer: 10,
          onStart: (k) => { k.invulnerable = true; },
          onEnd: (k) => {
            k.invulnerable = false;
            if (k.mesh) k.mesh.remove(shieldMesh);
          }
        });

        // Active shield that knocks back nearby opponents
        this.activeItems.push({
          type: 'shield',
          timer: 10,
          update: (delta) => {
            shieldMesh.rotation.z += delta * 3;
            shieldMat.opacity = 0.3 + 0.2 * Math.sin(Date.now() * 0.005);
            for (const p of this.participants) {
              if (p.id === user.id) continue;
              const d = p.kartController.position.distanceTo(kart.position);
              if (d < 3.5 && !p.kartController.phaseGhost) {
                const pushDir = p.kartController.position.clone().sub(kart.position).normalize();
                p.kartController.applyKnockback(pushDir, 20);
              }
            }
          }
        });
        break;
      }

      case 'nappe-de-gel': {
        const gelPos = kart.position.clone();
        const forward = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
        gelPos.add(forward.multiplyScalar(-4));

        const geo = new THREE.PlaneGeometry(10, 10);
        const mat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(gelPos);
        mesh.position.y += 0.05;
        this.scene.add(mesh);

        let gelArmed = false;
        let gelArmTimer = 0;
        const gelArmDelay = 1.5;
        const gelHitIds = new Set();
        this.activeItems.push({
          type: 'gel',
          position: gelPos,
          mesh,
          timer: 15,
          update: (dt) => {
            gelArmTimer += dt;
            if (!gelArmed && gelArmTimer >= gelArmDelay) gelArmed = true;
            for (const p of this.participants) {
              if (p.id === user.id && !gelArmed) continue;
              const d = p.kartController.position.distanceTo(gelPos);
              if (d < 6) {
                if (!gelHitIds.has(p.id)) {
                  gelHitIds.add(p.id);
                  this._playTrapTriggerSFX('gel', gelPos);
                }
                p.kartController.surfaceFriction = 0.2;
              } else {
                gelHitIds.delete(p.id);
              }
            }
          },
          onExpire: () => {}
        });
        break;
      }

      case 'salve-de-debris': {
        // 3 spread projectiles forward
        const fwd = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
        for (let i = -1; i <= 1; i++) {
          const angle = kart.yaw + i * 0.3;
          const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
          this._spawnProjectile(kart.position, kart.position.clone().add(dir.multiplyScalar(50)), (hitKart) => {
            hitKart.applyEffect({
              timer: 1,
              onStart: (k) => { k.speed *= 0.3; k.velocity.multiplyScalar(0.3); },
              onEnd: () => {}
            });
          });
        }
        break;
      }

      case 'onde-emp':
        // Disable nearby karts within 15m
        for (const p of this.participants) {
          if (p.id === user.id) continue;
          if (p.kartController.position.distanceTo(kart.position) < 15) {
            p.kartController.applyEffect({
              timer: 2,
              onStart: (k) => { k.immobilized = true; },
              onEnd: (k) => { k.immobilized = false; }
            });
          }
        }
        break;

      case 'traqueur-de-rang': {
        // Target 1st place
        const leader = this.participants.find(p => p.id !== user.id);
        if (leader) {
          this._spawnProjectile(kart.position, leader.kartController.position, (hitKart) => {
            hitKart.applyEffect({
              timer: 2,
              onStart: (k) => { k.speed *= 0.1; k.velocity.multiplyScalar(0.1); },
              onEnd: () => {}
            });
          });
        }
        break;
      }

      case 'cloak':
        kart.applyEffect({
          timer: 8,
          onStart: (k) => {
            k._cloaked = true;
            if (k.mesh) k.mesh.traverse(c => {
              if (c.material) { c.material._prevOpacity = c.material.opacity; c.material._prevTransparent = c.material.transparent; c.material.transparent = true; c.material.opacity = 0.15; }
            });
          },
          onEnd: (k) => {
            k._cloaked = false;
            if (k.mesh) k.mesh.traverse(c => {
              if (c.material) { c.material.opacity = c.material._prevOpacity ?? 1; c.material.transparent = c.material._prevTransparent ?? false; }
            });
          }
        });
        break;

      case 'leurre': {
        // Spawn decoy kart
        const decoyPos = kart.position.clone();
        decoyPos.z -= 5;
        const geo = new THREE.BoxGeometry(2, 0.6, 3);
        const mat = new THREE.MeshBasicMaterial({ color: kart.character?.kartColor || 0xcccccc, transparent: true, opacity: 0.7 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(decoyPos);
        this.scene.add(mesh);
        this.activeItems.push({ type: 'decoy', mesh, timer: 10, update() {} });
        break;
      }

      case 'levitateur':
        kart.velocity.y = 20;
        kart.grounded = false;
        kart.airborne = true;
        break;

      case 'teleporteur': {
        // Warp 3 positions ahead (simplified: move forward along track)
        const fwd2 = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
        kart.position.add(fwd2.multiplyScalar(40));
        break;
      }

      case 'phase-ghost':
        kart.applyEffect({
          timer: 4,
          onStart: (k) => {
            k.phaseGhost = true;
            if (k.mesh) { k.mesh.traverse(c => { if (c.material) { c.material.transparent = true; c.material.opacity = 0.3; } }); }
          },
          onEnd: (k) => {
            k.phaseGhost = false;
            if (k.mesh) { k.mesh.traverse(c => { if (c.material) { c.material.transparent = false; c.material.opacity = 1.0; } }); }
          }
        });
        break;

      case 'mur-temporaire': {
        const wallPos = kart.position.clone();
        const fwd3 = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
        wallPos.add(fwd3.multiplyScalar(-3));
        const wGeo = new THREE.BoxGeometry(8, 3, 0.5);
        const wMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
        const wMesh = new THREE.Mesh(wGeo, wMat);
        wMesh.position.copy(wallPos);
        wMesh.position.y += 1.5;
        wMesh.rotation.y = kart.yaw;
        this.scene.add(wMesh);
        const wallHitIds = new Set();
        this.activeItems.push({
          type: 'wall', mesh: wMesh, timer: 5, position: wallPos,
          update: () => {
            for (const p of this.participants) {
              if (p.id === user.id) continue;
              if (p.kartController.position.distanceTo(wallPos) < 5) {
                if (!wallHitIds.has(p.id)) {
                  wallHitIds.add(p.id);
                  this._playTrapTriggerSFX('wall', wallPos);
                }
                p.kartController.speed *= 0.2;
                p.kartController.velocity.multiplyScalar(0.2);
              }
            }
          }
        });
        break;
      }

      case 'faux-bonus': {
        // Place fake crate
        const fakePos = kart.position.clone();
        const fw = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
        fakePos.add(fw.multiplyScalar(-4));
        fakePos.y += 1;
        const fMat = new THREE.MeshPhongMaterial({ color: 0xffcc00, emissive: 0x553300 });
        const fMesh = new THREE.Mesh(_crateGeo, fMat);
        fMesh.position.copy(fakePos);
        this.scene.add(fMesh);
        let fakeTriggered = false;
        const fakeItem = {
          type: 'fake-crate', mesh: fMesh, timer: 30, position: fakePos,
          update: (delta) => {
            if (fakeTriggered) return;
            fMesh.rotation.y += delta * 2;
            for (const p of this.participants) {
              if (p.id === user.id) continue;
              if (p.kartController.position.distanceTo(fakePos) < 3) {
                p.kartController.applyEffect({
                  timer: 1.5,
                  onStart: (k) => { k.speed *= 0.1; k.velocity.multiplyScalar(0.1); },
                  onEnd: () => {}
                });
                this._playTrapTriggerSFX('fake-crate', fakePos);
                fakeTriggered = true;
                fakeItem.timer = 0;
                this.scene.remove(fMesh);
                return;
              }
            }
          }
        };
        this.activeItems.push(fakeItem);
        break;
      }

      case 'pluie-asteroides':
        // 5 random impacts on top 3 positions
        for (let i = 0; i < 5; i++) {
          const targetIdx = Math.floor(Math.random() * Math.min(3, this.participants.length));
          const target = this.participants[targetIdx];
          if (target && target.id !== user.id) {
            setTimeout(() => {
              target.kartController.applyEffect({
                timer: 1,
                onStart: (k) => { k.speed *= 0.3; k.velocity.multiplyScalar(0.3); },
                onEnd: () => {}
              });
            }, i * 400);
          }
        }
        break;

      case 'oeil-de-khaos':
        // Slow ALL opponents to 30% for 10s
        for (const p of this.participants) {
          if (p.id === user.id) continue;
          p.kartController.applyEffect({
            timer: 10,
            onStart: (k) => { k.speedMultiplier = 0.3; },
            onEnd: (k) => { k.speedMultiplier = 1.0; }
          });
        }
        break;

      default: {
        // Check signature weapons
        const sigWeapon = SIGNATURE_WEAPONS[itemId];
        if (sigWeapon) {
          const result = sigWeapon.use(user, this.participants, this.scene);
          if (result) this.activeItems.push(result);
        } else {
          console.log(`Item ${itemId} used (unrecognized)`);
        }
        break;
      }
    }
  }

  _findNearestAhead(user) {
    const userPos = user.kartController.position;
    const forward = new THREE.Vector3(Math.sin(user.kartController.yaw), 0, Math.cos(user.kartController.yaw));
    let nearest = null;
    let nearestDist = Infinity;

    for (const p of this.participants) {
      if (p.id === user.id) continue;
      const diff = p.kartController.position.clone().sub(userPos);
      diff.y = 0;
      const dot = diff.normalize().dot(forward);
      if (dot > 0.3) { // must be ahead
        const dist = userPos.distanceTo(p.kartController.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }
    }
    return nearest;
  }

  fireTurretShot(from, direction, ownerKart) {
    const weight = ownerKart.weightFactor || 3;
    // Heavy karts = bigger, heavier balls; light karts = small, fast balls
    const mass = 0.5 + weight * 0.3;
    const scale = 0.6 + weight * 0.15;
    const target = from.clone().add(direction.clone().multiplyScalar(80));
    this._spawnTurretProjectile(from, target, ownerKart, mass, scale);
  }

  _spawnTurretProjectile(from, toward, ownerKart, mass = 1, scale = 1) {
    const dir = toward.clone().sub(from).normalize();
    const mat = new THREE.MeshPhongMaterial({ color: 0xff6600, emissive: 0x662200 });
    const mesh = new THREE.Mesh(_projectileGeo, mat);
    mesh.scale.setScalar(scale);
    mesh.position.copy(from);
    this.scene.add(mesh);

    const speed = 40;
    const vel = dir.clone().multiplyScalar(speed);
    const gravity = 25;
    const pos = mesh.position.clone();

    this.activeItems.push({
      type: 'projectile',
      mesh,
      timer: 5,
      update: (delta) => {
        vel.y -= gravity * delta;
        pos.add(vel.clone().multiplyScalar(delta));
        mesh.position.copy(pos);
        // Destroy on ground contact
        if (pos.y < (ownerKart._groundPlaneY ?? -2)) {
          mesh.visible = false;
          this.scene.remove(mesh);
          return;
        }
        for (const p of this.participants) {
          if (p.kartController === ownerKart) continue;
          if (p.kartController.invulnerable || p.kartController.phaseGhost) continue;
          const d = p.kartController.position.distanceTo(pos);
          if (d < 2.5) {
            // Knockback: E = mv², force proportional to mass and ball speed squared
            const ballSpeed = vel.length();
            const energy = mass * ballSpeed * ballSpeed * 0.02;
            p.kartController.applyKnockback(vel.clone().normalize(), energy);
            // Explosion VFX
            this._spawnImpactExplosion(pos.clone(), scale);
            // SFX
            const audio = getAudioEngine();
            if (audio) audio.playSFX3D('collision', pos, this.listenerPos);
            mesh.visible = false;
            this.scene.remove(mesh);
            return;
          }
        }
      }
    });
  }

  _spawnImpactExplosion(pos, size = 1) {
    // Expanding sphere + particles
    const explosionMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.8
    });
    const explosionMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 * size, 8, 6), explosionMat
    );
    explosionMesh.position.copy(pos);
    this.scene.add(explosionMesh);

    // Spark particles
    const sparkCount = 8;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVel = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = pos.x;
      sparkPos[i * 3 + 1] = pos.y;
      sparkPos[i * 3 + 2] = pos.z;
      sparkVel.push({
        x: (Math.random() - 0.5) * 12,
        y: Math.random() * 8,
        z: (Math.random() - 0.5) * 12
      });
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffaa00, size: 0.3 * size, transparent: true, opacity: 1
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    this.scene.add(sparks);

    let elapsed = 0;
    this.activeItems.push({
      type: 'vfx',
      mesh: explosionMesh,
      timer: 0.5,
      update: (delta) => {
        elapsed += delta;
        const t = elapsed / 0.5;
        // Expand and fade
        const s = (1 + t * 3) * size;
        explosionMesh.scale.setScalar(s);
        explosionMat.opacity = 0.8 * (1 - t);
        explosionMesh.material.color.lerp(new THREE.Color(0x331100), delta * 3);
        // Sparks
        const positions = sparkGeo.attributes.position.array;
        for (let i = 0; i < sparkCount; i++) {
          sparkVel[i].y -= 15 * delta;
          positions[i * 3] += sparkVel[i].x * delta;
          positions[i * 3 + 1] += sparkVel[i].y * delta;
          positions[i * 3 + 2] += sparkVel[i].z * delta;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkMat.opacity = 1 - t;
        if (t >= 1) {
          this.scene.remove(explosionMesh);
          this.scene.remove(sparks);
          sparkGeo.dispose();
          sparkMat.dispose();
          explosionMat.dispose();
        }
      }
    });
  }

  _spawnProjectile(from, toward, onHit) {
    const dir = toward.clone().sub(from).normalize();
    const mat = new THREE.MeshPhongMaterial({ color: 0xff6600, emissive: 0x662200 });
    const mesh = new THREE.Mesh(_projectileGeo, mat);
    mesh.position.copy(from);
    mesh.position.y += 1;
    this.scene.add(mesh);

    const speed = 60;
    const pos = mesh.position.clone();

    this.activeItems.push({
      type: 'projectile',
      mesh,
      timer: 5,
      update: (delta) => {
        pos.add(dir.clone().multiplyScalar(speed * delta));
        mesh.position.copy(pos);

        // Check hits
        for (const p of this.participants) {
          if (p.kartController.invulnerable || p.kartController.phaseGhost) continue;
          const d = p.kartController.position.distanceTo(pos);
          if (d < 2.5) {
            onHit(p.kartController);
            mesh.visible = false;
            return;
          }
        }
      }
    });
  }

  _getParticipantPosition(participantId) {
    // Simplified: use standings from race manager if available
    const idx = this.participants.findIndex(p => p.id === participantId);
    return idx + 1;
  }

  getHeldItem(participantId) {
    return this.heldItems.get(participantId);
  }

  getItemIcon(itemId) {
    return ITEM_ICONS[itemId] || '';
  }

  // Keep for backward compat
  getItemName(itemId) {
    return ITEM_ICONS[itemId] || itemId;
  }

  _playTrapTriggerSFX(trapType, position) {
    const sfxName = TRAP_TRIGGER_SFX[trapType];
    if (!sfxName) return;
    const audio = getAudioEngine();
    if (!audio) return;
    audio.playSFX3D(sfxName, position, this.listenerPos);
  }

  dispose() {
    for (const crate of this.crates) {
      this.scene.remove(crate.mesh);
    }
    for (const item of this.activeItems) {
      if (item.mesh) this.scene.remove(item.mesh);
    }
  }
}
