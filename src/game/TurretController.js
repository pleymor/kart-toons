import * as THREE from 'three';

export class TurretController {
  constructor(kart) {
    this.kart = kart;
    this.yaw = 0;      // relative to kart forward
    this.pitch = 0;
    this.yawSpeed = 3.0;
    this.pitchSpeed = 2.0;
    this.maxYaw = Math.PI * 2 / 3;   // ±120 degrees
    this.maxPitch = Math.PI / 6;     // ±30 degrees

    // Turret mesh
    this.mesh = new THREE.Group();
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    const barrelMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.6;
    this.mesh.add(barrel);

    const basGeo = new THREE.SphereGeometry(0.25, 8, 6);
    const basMat = new THREE.MeshPhongMaterial({ color: 0x666666 });
    this.mesh.add(new THREE.Mesh(basGeo, basMat));

    // Position relative to kart (rear)
    this.mesh.position.set(0, 1.3, -1.2);
  }

  update(delta, input) {
    // input: { aimX: -1..1, aimY: -1..1, fire: bool }
    //    or: { mouseDX, mouseDY, fire: bool } for mouse control
    if (!input) return;

    if (input.mouseDX !== undefined) {
      // Mouse: direct delta in pixels → radians
      const sensitivity = 0.003;
      this.yaw -= input.mouseDX * sensitivity;
      this.pitch -= input.mouseDY * sensitivity;
    } else {
      this.yaw += input.aimX * this.yawSpeed * delta;
      this.pitch += input.aimY * this.pitchSpeed * delta;
    }

    this.yaw = Math.max(-this.maxYaw, Math.min(this.maxYaw, this.yaw));
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

    this.mesh.rotation.y = this.yaw;
    this.mesh.children.forEach(child => {
      if (child.geometry?.type === 'CylinderGeometry') {
        child.rotation.x = Math.PI / 2 + this.pitch;
      }
    });
  }

  getWorldDirection() {
    // Compute world-space fire direction from turret orientation + kart rotation
    const kartYaw = this.kart.yaw;
    const totalYaw = kartYaw + this.yaw;
    const dir = new THREE.Vector3(
      Math.sin(totalYaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(totalYaw) * Math.cos(this.pitch)
    );
    return dir.normalize();
  }

  getWorldPosition() {
    const pos = this.kart.position.clone();
    pos.y += 1.3;
    pos.x -= Math.sin(this.kart.yaw) * 1.2;
    pos.z -= Math.cos(this.kart.yaw) * 1.2;
    return pos;
  }

  attachTo(kartGroup) {
    kartGroup.add(this.mesh);
  }
}
