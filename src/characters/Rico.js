import * as THREE from 'three';

export const RicoPassive = {
  id: 'drift-charge',
  apply(kart) {
    kart.driftChargeRate = 1.2;
  }
};

// Reusable rope geometry
const _ropeSegments = 20;
const _ropeGeo = new THREE.BufferGeometry();
const _ropePositions = new Float32Array((_ropeSegments + 1) * 3);
_ropeGeo.setAttribute('position', new THREE.BufferAttribute(_ropePositions, 3));

export const GrapplinBoost = {
  id: 'grapplin-boost',
  name: "Grapplin'Boost",
  use(user, participants, scene) {
    const target = findNearestAhead(user, participants);
    if (!target) return false;

    const userKart = user.kartController;
    const targetKart = target.kartController;
    const from = userKart.position.clone();
    const to = targetKart.position.clone();
    const dir = to.clone().sub(from).normalize();

    // Grapple hook projectile
    const hookGeo = new THREE.ConeGeometry(0.15, 0.5, 5);
    const hookMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.copy(from);
    hook.position.y += 1;

    // Rope line connecting user to hook/target
    const ropeMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 });
    const ropeGeo = new THREE.BufferGeometry();
    const ropePositions = new Float32Array((_ropeSegments + 1) * 3);
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePositions, 3));
    const rope = new THREE.Line(ropeGeo, ropeMat);
    rope.frustumCulled = false;

    // Group both as one mesh for cleanup
    const group = new THREE.Group();
    group.add(hook);
    group.add(rope);
    scene.add(group);

    const projectileSpeed = 90;
    let phase = 'flying'; // flying → towing
    let towTimer = 0;
    const towDuration = 5;
    const pullForce = 8; // units/s² toward target
    const maxRange = 60; // rope snaps if karts are further apart

    return {
      type: 'projectile',
      mesh: group,
      timer: towDuration + 3, // flight time + tow time
      update(delta) {
        const userPos = userKart.position;
        const targetPos = targetKart.position;

        if (phase === 'flying') {
          // Fly hook toward target
          const toTarget = targetPos.clone().sub(hook.position);
          toTarget.y = 0;
          const d = toTarget.length();

          if (d > maxRange) {
            // Too far — miss
            this.timer = 0;
            return;
          } else if (d < 3) {
            // Hit — start towing
            phase = 'towing';
            hook.visible = false;
          } else {
            // Track toward current target position
            const flyDir = toTarget.normalize();
            hook.position.add(flyDir.multiplyScalar(projectileSpeed * delta));
            hook.position.y = targetPos.y + 1;
            hook.lookAt(targetPos);
          }

          // Update rope: from user to hook
          updateRope(ropePositions, userPos, hook.position, _ropeSegments);
          ropeGeo.attributes.position.needsUpdate = true;

        } else if (phase === 'towing') {
          towTimer += delta;

          const toTarget = targetPos.clone().sub(userPos);
          toTarget.y = 0;
          const dist = toTarget.length();

          // Snap rope if too far or time's up
          if (dist > maxRange || towTimer >= towDuration) {
            this.timer = 0; // expire
            return;
          }

          if (dist > 2) {
            const pullDir = toTarget.normalize();
            // Gentle traction toward the target, scaled by delta
            userKart.velocity.x += pullDir.x * pullForce * delta;
            userKart.velocity.z += pullDir.z * pullForce * delta;
          }

          // Keep speed elevated while towed
          userKart.speedMultiplier = Math.max(userKart.speedMultiplier, 1.3);

          // Rope always visible between the two karts
          const anchor = targetPos.clone();
          anchor.y += 0.8;
          const userAnchor = userPos.clone();
          userAnchor.y += 0.8;
          updateRope(ropePositions, userAnchor, anchor, _ropeSegments);
          ropeGeo.attributes.position.needsUpdate = true;
        }
      },
      onExpire() {
        userKart.speedMultiplier = 1.0;
      }
    };
  }
};

// Update rope positions with a slight catenary sag
function updateRope(positions, from, to, segments) {
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    // Catenary sag: parabola peaking at middle
    const sag = -Math.sin(t * Math.PI) * 1.2;
    const y = from.y + (to.y - from.y) * t + sag;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
}

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
