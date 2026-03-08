import * as THREE from 'three';

export const RicoPassive = {
  id: 'drift-charge',
  apply(kart) {
    kart.driftChargeRate = 1.2;
  }
};

export const GrapplinBoost = {
  id: 'grapplin-boost',
  name: "Grapplin'Boost",
  use(user, participants, scene) {
    const target = findNearestAhead(user, participants);
    if (!target) return false;

    const from = user.kartController.position.clone();
    const to = target.kartController.position.clone();
    const dir = to.clone().sub(from).normalize();

    // Spawn grapple projectile visual
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    mesh.position.y += 1;
    scene.add(mesh);

    const speed = 80;
    let hit = false;

    return {
      type: 'projectile',
      mesh,
      timer: 3,
      update(delta) {
        if (hit) return;
        const pos = mesh.position;
        pos.add(dir.clone().multiplyScalar(speed * delta));

        // Track toward target
        const toTarget = target.kartController.position.clone().sub(pos);
        toTarget.y = 0;
        if (toTarget.length() < 3) {
          hit = true;
          // Pull target back
          target.kartController.applyKnockback(dir.clone().negate(), 15);
          // Boost Rico forward
          user.kartController.applyEffect({
            timer: 1.5,
            onStart: (k) => { k.speedMultiplier = 1.8; },
            onEnd: (k) => { k.speedMultiplier = 1.0; }
          });
          mesh.visible = false;
        }
      }
    };
  }
};

function findNearestAhead(user, participants) {
  const pos = user.kartController.position;
  const fwd = new THREE.Vector3(Math.sin(user.kartController.yaw), 0, Math.cos(user.kartController.yaw));
  let best = null, bestDist = Infinity;
  for (const p of participants) {
    if (p.id === user.id) continue;
    const diff = p.kartController.position.clone().sub(pos);
    diff.y = 0;
    if (diff.normalize().dot(fwd) > 0.3) {
      const d = pos.distanceTo(p.kartController.position);
      if (d < bestDist) { bestDist = d; best = p; }
    }
  }
  return best;
}
