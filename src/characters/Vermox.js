import * as THREE from 'three';

export const VermoxPassive = {
  id: 'smoke-screen',
  apply(kart) {
    // In rain weather, Vermox hides from minimap when flames active
    // Handled in WeatherSystem/HUD minimap rendering
  }
};

export const NapalmTrail = {
  id: 'napalm-trail',
  name: 'Napalm Trail',
  use(user, participants, scene) {
    const kart = user.kartController;
    const trailSegments = [];
    let elapsed = 0;
    const duration = 3;

    return {
      type: 'trail',
      timer: duration + 10, // trail persists after creation
      update(delta) {
        elapsed += delta;

        // Drop fire segments for 3 seconds
        if (elapsed <= duration && elapsed % 0.15 < delta) {
          const pos = kart.position.clone();
          pos.y += 0.1;
          const fwd = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
          pos.add(fwd.multiplyScalar(-2));

          const geo = new THREE.PlaneGeometry(2, 2);
          const mat = new THREE.MeshBasicMaterial({
            color: 0xff4400, transparent: true, opacity: 0.7, side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.copy(pos);
          scene.add(mesh);

          trailSegments.push({ mesh, position: pos, lifeTime: 8 });
        }

        // Check opponents touching fire
        for (const seg of trailSegments) {
          if (seg.lifeTime <= 0) continue;
          seg.lifeTime -= delta;
          seg.mesh.material.opacity = Math.max(0, seg.lifeTime / 8) * 0.7;

          for (const p of participants) {
            if (p.id === user.id) continue;
            const d = p.kartController.position.distanceTo(seg.position);
            if (d < 2) {
              p.kartController.applyEffect({
                timer: 1.5,
                onStart: (k) => { k.speedMultiplier = 0.5; },
                onEnd: (k) => { k.speedMultiplier = 1.0; }
              });
            }
          }

          if (seg.lifeTime <= 0) {
            scene.remove(seg.mesh);
          }
        }
      },
      onExpire() {
        trailSegments.forEach(s => scene.remove(s.mesh));
      }
    };
  }
};
