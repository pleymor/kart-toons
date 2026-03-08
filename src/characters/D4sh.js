export const D4shPassive = {
  id: 'fast-electronics',
  apply(kart) {
    // Handled in ItemSystem: crate respawn timer halved for D4SH
  }
};

export const Overclock = {
  id: 'overclock',
  name: 'Overclock',
  use(user) {
    const kart = user.kartController;
    const savedMax = kart.maxSpeed;
    const savedAccel = kart.accelForce;

    // Phase 1: Overclock boost (5s)
    kart.applyEffect({
      timer: 5,
      onStart: (k) => {
        k.maxSpeed = savedMax * 2;
        k.accelForce = savedAccel * 2;
        k.speedMultiplier = 1.5;
      },
      onEnd: (k) => {
        k.maxSpeed = savedMax;
        k.accelForce = savedAccel;
        k.speedMultiplier = 1.0;
        // Phase 2: Overheat slowdown (2s)
        k.applyEffect({
          timer: 2,
          onStart: (k2) => { k2.speedMultiplier = 0.3; },
          onEnd: (k2) => { k2.speedMultiplier = 1.0; }
        });
      }
    });

    return null;
  }
};
