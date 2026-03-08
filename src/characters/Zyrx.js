export const ZyrxPassive = {
  id: 'levitation-immunity',
  apply(kart) {
    // Override surface friction — immune to mud/ice
    const origCheck = kart._checkGround.bind(kart);
    kart._checkGround = function() {
      origCheck();
      // Hover offset for levitating kart
      if (this.grounded) {
        this.position.y += 0.4; // hover above ground
      }
      // Ignore grip penalties
      if (this.character.passive?.effectModifiers?.ignoreGripPenalty) {
        this.surfaceFriction = Math.max(this.surfaceFriction, 1.0);
      }
    };
  }
};

export const MindSpike = {
  id: 'mind-spike',
  name: 'Mind Spike',
  use(user, participants) {
    // Find 3 nearest opponents
    const pos = user.kartController.position;
    const others = participants
      .filter(p => p.id !== user.id)
      .map(p => ({ p, dist: pos.distanceTo(p.kartController.position) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    for (const { p } of others) {
      p.kartController.applyEffect({
        timer: 4,
        onStart: (k) => { k.controlsReversed = true; },
        onEnd: (k) => { k.controlsReversed = false; }
      });
    }

    return null; // instant effect, no active item
  }
};
