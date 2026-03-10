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

    // Rope as a visible tube mesh
    const ropeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const ropeGeo = new THREE.BufferGeometry();
    const ropePositions = new Float32Array((_ropeSegments + 1) * 3);
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePositions, 3));
    // Thin tube around the rope path
    const _tubeRadius = 0.06;
    const _tubeSides = 4;
    const tubeVertCount = (_ropeSegments + 1) * _tubeSides;
    const tubePositions = new Float32Array(tubeVertCount * 3);
    const tubeIndices = [];
    for (let i = 0; i < _ropeSegments; i++) {
      for (let j = 0; j < _tubeSides; j++) {
        const a = i * _tubeSides + j;
        const b = i * _tubeSides + (j + 1) % _tubeSides;
        const c = (i + 1) * _tubeSides + j;
        const d = (i + 1) * _tubeSides + (j + 1) % _tubeSides;
        tubeIndices.push(a, c, b, b, c, d);
      }
    }
    const tubeGeo = new THREE.BufferGeometry();
    tubeGeo.setAttribute('position', new THREE.BufferAttribute(tubePositions, 3));
    tubeGeo.setIndex(tubeIndices);
    const rope = new THREE.Mesh(tubeGeo, ropeMat);
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
          updateRope(tubePositions, userPos, hook.position, _ropeSegments, _tubeRadius, _tubeSides);
          tubeGeo.attributes.position.needsUpdate = true;

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
          anchor.y += 1.8;
          const userAnchor = userPos.clone();
          userAnchor.y += 1.8;
          updateRope(tubePositions, userAnchor, anchor, _ropeSegments, _tubeRadius, _tubeSides);
          tubeGeo.attributes.position.needsUpdate = true;
        }
      },
      onExpire() {
        userKart.speedMultiplier = 1.0;
      }
    };
  }
};

// Update tube geometry from rope path with catenary sag
function updateRope(tubePositions, from, to, segments, radius, sides) {
  // First compute the spine points
  const spine = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const sag = -Math.sin(t * Math.PI) * 0.5;
    const y = from.y + (to.y - from.y) * t + sag;
    spine.push(x, y, z);
  }

  // Build tube vertices around each spine point
  for (let i = 0; i <= segments; i++) {
    // Tangent direction
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(segments, i + 1);
    const tx = spine[i1 * 3] - spine[i0 * 3];
    const ty = spine[i1 * 3 + 1] - spine[i0 * 3 + 1];
    const tz = spine[i1 * 3 + 2] - spine[i0 * 3 + 2];
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    const dx = tx / tLen, dy = ty / tLen, dz = tz / tLen;

    // Build a perpendicular frame (cross with up, then cross again)
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(dy) > 0.99) { ux = 1; uy = 0; uz = 0; }
    // Right = tangent × up
    let rx = dy * uz - dz * uy, ry = dz * ux - dx * uz, rz = dx * uy - dy * ux;
    const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rLen; ry /= rLen; rz /= rLen;
    // Actual up = right × tangent
    ux = ry * dz - rz * dy; uy = rz * dx - rx * dz; uz = rx * dy - ry * dx;

    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const cos = Math.cos(angle) * radius;
      const sin = Math.sin(angle) * radius;
      const vi = (i * sides + j) * 3;
      tubePositions[vi] = spine[i * 3] + rx * cos + ux * sin;
      tubePositions[vi + 1] = spine[i * 3 + 1] + ry * cos + uy * sin;
      tubePositions[vi + 2] = spine[i * 3 + 2] + rz * cos + uz * sin;
    }
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
