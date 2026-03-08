import * as THREE from 'three';

export const SylvaraPassive = {
  id: 'obstacle-jump',
  apply(kart) {
    // Small obstacles (<1m) don't cause collision slowdown
    // Handled in collision response: skip knockback for small obstacle colliders
  }
};

export const HexClone = {
  id: 'hex-clone',
  name: 'Hex Clone',
  use(user, participants, scene) {
    const kart = user.kartController;
    const clones = [];

    for (let i = 0; i < 2; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        0,
        (Math.random() - 0.5) * 6
      );
      const clonePos = kart.position.clone().add(offset);

      // Clone mesh - simplified kart shape with ghost appearance
      const group = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(2, 0.6, 3);
      const bodyMat = new THREE.MeshBasicMaterial({
        color: kart.character.kartColor,
        transparent: true,
        opacity: 0.6
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.5;
      group.add(body);
      group.position.copy(clonePos);
      scene.add(group);

      clones.push({
        mesh: group,
        position: clonePos,
        yaw: Math.random() * Math.PI * 2,
        speed: 15 + Math.random() * 10,
        alive: true
      });
    }

    return {
      type: 'clone',
      timer: 6,
      update(delta) {
        for (const clone of clones) {
          if (!clone.alive) continue;

          // Move randomly with slight steering
          clone.yaw += (Math.random() - 0.5) * 2 * delta;
          const fwd = new THREE.Vector3(Math.sin(clone.yaw), 0, Math.cos(clone.yaw));
          clone.position.add(fwd.multiplyScalar(clone.speed * delta));
          clone.mesh.position.copy(clone.position);
          clone.mesh.rotation.y = clone.yaw;

          // Check collision with opponents - explode
          for (const p of participants) {
            if (p.id === user.id) continue;
            const d = p.kartController.position.distanceTo(clone.position);
            if (d < 3) {
              // Explode on contact
              p.kartController.applyEffect({
                timer: 1.5,
                onStart: (k) => { k.speed *= 0.1; k.velocity.multiplyScalar(0.1); },
                onEnd: () => {}
              });
              clone.alive = false;
              scene.remove(clone.mesh);
              break;
            }
          }
        }
      },
      onExpire() {
        clones.forEach(c => { if (c.alive) scene.remove(c.mesh); });
      }
    };
  }
};
