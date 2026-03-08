import * as THREE from 'three';

export const GrootXPassive = {
  id: 'regeneration',
  apply(kart) {
    let noDamageTimer = 0;
    let bonusApplied = false;
    const baseHandling = kart.handling;

    const origUpdate = kart._updateEffects.bind(kart);
    kart._updateEffects = function(delta) {
      origUpdate(delta);

      // Track time since last damage
      noDamageTimer += delta;

      // Reset on any new knockback/effect
      if (this.activeEffects.length > 0 && !bonusApplied) {
        noDamageTimer = 0;
        if (bonusApplied) {
          this.handling = baseHandling;
          bonusApplied = false;
        }
      }

      // After 10s no damage, gain handling bonus
      if (noDamageTimer >= 10 && !bonusApplied) {
        this.handling = baseHandling * 1.1;
        bonusApplied = true;
      }
    };
  }
};

export const RootTrap = {
  id: 'root-trap',
  name: 'Root Trap',
  use(user, participants, scene) {
    const kart = user.kartController;
    const traps = [];

    for (let i = 0; i < 3; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        0,
        -3 - i * 4
      );
      // Rotate offset by kart yaw
      const cos = Math.cos(kart.yaw);
      const sin = Math.sin(kart.yaw);
      const rx = offset.x * cos - offset.z * sin;
      const rz = offset.x * sin + offset.z * cos;

      const trapPos = kart.position.clone().add(new THREE.Vector3(rx, 0.1, rz));

      const geo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0x225522, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(trapPos);
      scene.add(mesh);

      traps.push({ mesh, position: trapPos, active: true });
    }

    return {
      type: 'trap',
      timer: 15,
      update(delta) {
        for (const trap of traps) {
          if (!trap.active) continue;

          for (const p of participants) {
            if (p.id === user.id) continue;
            const d = p.kartController.position.distanceTo(trap.position);
            if (d < 2) {
              // Immobilize for 2s
              p.kartController.applyEffect({
                timer: 2,
                onStart: (k) => { k.immobilized = true; },
                onEnd: (k) => { k.immobilized = false; }
              });
              trap.active = false;
              scene.remove(trap.mesh);
              break;
            }
          }
        }
      },
      onExpire() {
        traps.forEach(t => { if (t.active) scene.remove(t.mesh); });
      }
    };
  }
};
