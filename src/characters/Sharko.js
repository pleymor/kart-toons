export const SharkoPassive = {
  id: 'aquatic-boost',
  apply(kart) {
    // Override surface check: in water/mud, gain speed instead of penalty
    const origCheck = kart._checkGround.bind(kart);
    kart._checkGround = function() {
      origCheck();
      if (this.surfaceType === 'water' || this.surfaceType === 'mud') {
        this.surfaceFriction = 1.2; // bonus instead of penalty
      }
    };
  }
};

export const SonarPulse = {
  id: 'sonar-pulse',
  name: 'Sonar Pulse',
  use(user, participants) {
    // Reveal all hidden items on minimap for 8s
    // Show all opponent positions (effect handled in HUD)
    user.kartController.applyEffect({
      timer: 8,
      sonarActive: true,
      onStart: () => {
        // Mark sonar active on user for HUD to pick up
        user._sonarActive = true;
      },
      onEnd: () => {
        user._sonarActive = false;
      }
    });

    return null;
  }
};
