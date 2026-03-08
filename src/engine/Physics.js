import RAPIER from '@dimforge/rapier3d-compat';

export class Physics {
  constructor() {
    this.world = null;
    this.RAPIER = null;
    this.eventQueue = null;
    this.collisionCallbacks = new Map();
  }

  async init() {
    await RAPIER.init();
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  step(delta) {
    if (!this.world) return;
    this.world.timestep = delta;
    this.world.step(this.eventQueue);
    this._processCollisions();
  }

  createKinematicBody(position = { x: 0, y: 0, z: 0 }) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z);
    return this.world.createRigidBody(bodyDesc);
  }

  createDynamicBody(position = { x: 0, y: 0, z: 0 }, mass = 1.0) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setAdditionalMass(mass);
    return this.world.createRigidBody(bodyDesc);
  }

  createStaticBody(position = { x: 0, y: 0, z: 0 }) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z);
    return this.world.createRigidBody(bodyDesc);
  }

  addBoxCollider(body, halfExtents, options = {}) {
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    if (options.sensor) colliderDesc.setSensor(true);
    if (options.friction !== undefined) colliderDesc.setFriction(options.friction);
    if (options.restitution !== undefined) colliderDesc.setRestitution(options.restitution);
    colliderDesc.setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
    return this.world.createCollider(colliderDesc, body);
  }

  addSphereCollider(body, radius, options = {}) {
    const colliderDesc = this.RAPIER.ColliderDesc.ball(radius);
    if (options.sensor) colliderDesc.setSensor(true);
    colliderDesc.setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
    return this.world.createCollider(colliderDesc, body);
  }

  castRay(origin, direction, maxDist = 50) {
    if (!this.world) return null;
    const ray = new this.RAPIER.Ray(origin, direction);
    const hit = this.world.castRay(ray, maxDist, true);
    if (hit) {
      const point = ray.pointAt(hit.timeOfImpact);
      return {
        point: { x: point.x, y: point.y, z: point.z },
        distance: hit.timeOfImpact,
        collider: hit.collider
      };
    }
    return null;
  }

  onCollision(colliderHandle, callback) {
    this.collisionCallbacks.set(colliderHandle, callback);
  }

  _processCollisions() {
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      const cb1 = this.collisionCallbacks.get(handle1);
      const cb2 = this.collisionCallbacks.get(handle2);
      if (cb1) cb1(handle2, started);
      if (cb2) cb2(handle1, started);
    });
  }

  removeBody(body) {
    if (body && this.world) {
      this.world.removeRigidBody(body);
    }
  }

  dispose() {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
  }
}
