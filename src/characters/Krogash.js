export const KrogashPassive = {
  id: 'heavy-push',
  apply(kart) {
    // On collision callback: push lighter karts away
    // This is handled in the collision system by comparing weight stats
  }
};

export const ChargeCornue = {
  id: 'charge-cornue',
  name: 'Charge Cornue',
  use(user) {
    const kart = user.kartController;
    const savedHandling = kart.handling;

    kart.applyEffect({
      timer: 5,
      onStart: (k) => {
        k.speedMultiplier = 2.0;
        k.invulnerable = true;
        k.handling = 0.05; // nearly unsteerable
      },
      onEnd: (k) => {
        k.speedMultiplier = 1.0;
        k.invulnerable = false;
        k.handling = savedHandling;
      }
    });

    return null;
  }
};
