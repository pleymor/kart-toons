export const CHARACTERS = {
  rico: {
    id: 'rico',
    name: 'Rico',
    stats: { speed: 4, acceleration: 5, handling: 5, weight: 3, special: 3 },
    kartPhysicsType: 'wheeled',
    kartColor: 0xcc2222,
    kartAccent: 0xff4444,
    description: 'The Human Stuntman',
    signatureWeapon: {
      id: 'grapplin-boost',
      name: "Grapplin'Boost",
      description: 'Grapples a kart ahead — pulls them back, boosts you forward',
      effectType: 'projectile'
    },
    passive: {
      id: 'drift-charge',
      description: 'Drifts charge 20% faster',
      triggerCondition: 'always',
      effectModifiers: { driftChargeRate: 1.2 }
    },
    unlockCondition: null,
    skins: [
      { primary: 0xcc2222, secondary: 0x333333, accent: 0xff4444 },
      { primary: 0x2222cc, secondary: 0x333333, accent: 0x4444ff },
      { primary: 0x22cc22, secondary: 0x333333, accent: 0x44ff44 },
      { primary: 0xcccc22, secondary: 0x333333, accent: 0xffff44 }
    ]
  },
  zyrx: {
    id: 'zyrx',
    name: 'Zyrx',
    stats: { speed: 5, acceleration: 3, handling: 4, weight: 2, special: 6 },
    kartPhysicsType: 'levitating',
    kartColor: 0x6622cc,
    kartAccent: 0xaa44ff,
    description: 'The Telepathic Alien',
    signatureWeapon: {
      id: 'mind-spike',
      name: 'Mind Spike',
      description: 'Reverses controls of 3 nearest opponents for 4s',
      effectType: 'debuff'
    },
    passive: {
      id: 'levitation-immunity',
      description: 'Immune to mud/ice grip penalties',
      triggerCondition: 'always',
      effectModifiers: { ignoreGripPenalty: true }
    },
    unlockCondition: null,
    skins: [
      { primary: 0x6622cc, secondary: 0x222222, accent: 0xaa44ff },
      { primary: 0x22cccc, secondary: 0x222222, accent: 0x44ffff },
      { primary: 0xcc22cc, secondary: 0x222222, accent: 0xff44ff },
      { primary: 0x222222, secondary: 0x666666, accent: 0x00ff00 }
    ]
  },
  krogash: {
    id: 'krogash',
    name: 'Krogash',
    stats: { speed: 3, acceleration: 2, handling: 3, weight: 8, special: 4 },
    kartPhysicsType: 'tracked',
    kartColor: 0x556b2f,
    kartAccent: 0x8fbc8f,
    description: 'The Armored Rhino',
    signatureWeapon: {
      id: 'charge-cornue',
      name: 'Charge Cornue',
      description: 'Uncontrollable straight-line charge — destroys everything, immune to damage',
      effectType: 'self-buff'
    },
    passive: {
      id: 'heavy-push',
      description: 'Pushes lighter karts away on side collision',
      triggerCondition: 'on-side-collision',
      effectModifiers: { pushForce: 1.5 }
    },
    unlockCondition: null,
    skins: [
      { primary: 0x556b2f, secondary: 0x333333, accent: 0x8fbc8f },
      { primary: 0x8b0000, secondary: 0x333333, accent: 0xff4500 },
      { primary: 0x4682b4, secondary: 0x333333, accent: 0x87ceeb },
      { primary: 0xdaa520, secondary: 0x333333, accent: 0xffd700 }
    ]
  },
  d4sh: {
    id: 'd4sh',
    name: 'D4SH',
    stats: { speed: 6, acceleration: 6, handling: 3, weight: 2, special: 3 },
    kartPhysicsType: 'wheeled',
    kartColor: 0xc0c0c0,
    kartAccent: 0x00ccff,
    description: 'The Overclocked Robot',
    signatureWeapon: {
      id: 'overclock',
      name: 'Overclock',
      description: '2x speed/accel for 5s, then forced 2s slowdown',
      effectType: 'self-buff'
    },
    passive: {
      id: 'fast-electronics',
      description: 'Electronic item crates respawn 2x faster for D4SH',
      triggerCondition: 'on-crate-pickup',
      effectModifiers: { crateRespawnMultiplier: 0.5 }
    },
    unlockCondition: null,
    skins: [
      { primary: 0xc0c0c0, secondary: 0x222222, accent: 0x00ccff },
      { primary: 0xff0000, secondary: 0x222222, accent: 0xff6666 },
      { primary: 0x00ff00, secondary: 0x222222, accent: 0x66ff66 },
      { primary: 0x000000, secondary: 0xffffff, accent: 0xff00ff }
    ]
  },
  vermox: {
    id: 'vermox',
    name: 'Vermox',
    stats: { speed: 4, acceleration: 4, handling: 4, weight: 4, special: 4 },
    kartPhysicsType: 'wheeled',
    kartColor: 0xcc4400,
    kartAccent: 0xff8800,
    description: 'The Dwarf Dragon',
    signatureWeapon: {
      id: 'napalm-trail',
      name: 'Napalm Trail',
      description: 'Fire trail behind kart for 3s — burns and slows opponents',
      effectType: 'trap'
    },
    passive: {
      id: 'smoke-screen',
      description: 'In rain, flames produce smoke hiding position on minimap',
      triggerCondition: 'weather-rain',
      effectModifiers: { hideOnMinimap: true }
    },
    unlockCondition: null,
    skins: [
      { primary: 0xcc4400, secondary: 0x442200, accent: 0xff8800 },
      { primary: 0x440044, secondary: 0x220022, accent: 0xff00ff },
      { primary: 0x004444, secondary: 0x002222, accent: 0x00ffff },
      { primary: 0x444400, secondary: 0x222200, accent: 0xffff00 }
    ]
  },
  sylvara: {
    id: 'sylvara',
    name: 'Sylvara',
    stats: { speed: 3, acceleration: 5, handling: 5, weight: 2, special: 5 },
    kartPhysicsType: 'hybrid',
    kartColor: 0x8844aa,
    kartAccent: 0xcc88ff,
    description: 'The Mechanical Witch',
    signatureWeapon: {
      id: 'hex-clone',
      name: 'Hex Clone',
      description: '2 decoy karts for 6s — drive randomly, explode on contact',
      effectType: 'clone'
    },
    passive: {
      id: 'obstacle-jump',
      description: 'Small obstacles cause no collision slowdown',
      triggerCondition: 'on-small-obstacle',
      effectModifiers: { ignoreSmallObstacles: true }
    },
    unlockCondition: null,
    skins: [
      { primary: 0x8844aa, secondary: 0x332244, accent: 0xcc88ff },
      { primary: 0x44aa44, secondary: 0x224422, accent: 0x88ff88 },
      { primary: 0xaa4444, secondary: 0x442222, accent: 0xff8888 },
      { primary: 0x4444aa, secondary: 0x222244, accent: 0x8888ff }
    ]
  },
  sharko: {
    id: 'sharko',
    name: 'Sharko',
    stats: { speed: 5, acceleration: 3, handling: 2, weight: 5, special: 5 },
    kartPhysicsType: 'wheeled',
    kartColor: 0x4488aa,
    kartAccent: 0x66ccff,
    description: 'The Mechanist Shark',
    signatureWeapon: {
      id: 'sonar-pulse',
      name: 'Sonar Pulse',
      description: 'Reveals hidden items on minimap for 8s, shows all opponents to team',
      effectType: 'area'
    },
    passive: {
      id: 'aquatic-boost',
      description: 'Gains +20% speed in water/mud sections instead of penalty',
      triggerCondition: 'on-water-surface',
      effectModifiers: { waterSpeedBonus: 0.2 }
    },
    unlockCondition: null,
    skins: [
      { primary: 0x4488aa, secondary: 0x223344, accent: 0x66ccff },
      { primary: 0xaa4444, secondary: 0x442222, accent: 0xff6666 },
      { primary: 0x44aa44, secondary: 0x224422, accent: 0x66ff66 },
      { primary: 0xaa8844, secondary: 0x443322, accent: 0xffcc66 }
    ]
  },
  grootx: {
    id: 'grootx',
    name: 'Groot-X',
    stats: { speed: 2, acceleration: 4, handling: 6, weight: 4, special: 4 },
    kartPhysicsType: 'wheeled',
    kartColor: 0x228844,
    kartAccent: 0x44cc66,
    description: 'The Plant Entity',
    signatureWeapon: {
      id: 'root-trap',
      name: 'Root Trap',
      description: '3 root traps on track for 15s — immobilize karts for 2s',
      effectType: 'trap'
    },
    passive: {
      id: 'regeneration',
      description: 'After 10s without damage, gain +10% handling',
      triggerCondition: 'no-damage-10s',
      effectModifiers: { handlingBonus: 0.1 }
    },
    unlockCondition: null,
    skins: [
      { primary: 0x228844, secondary: 0x114422, accent: 0x44cc66 },
      { primary: 0x884422, secondary: 0x442211, accent: 0xcc8844 },
      { primary: 0x882288, secondary: 0x441144, accent: 0xcc44cc },
      { primary: 0xdddddd, secondary: 0x888888, accent: 0xffffff }
    ]
  }
};

// Hidden characters
const HIDDEN_CHARACTERS = {
  chaos: {
    id: 'chaos',
    name: 'CHAOS',
    stats: { speed: 5, acceleration: 5, handling: 5, weight: 5, special: 5 },
    kartPhysicsType: 'wheeled',
    kartColor: 0xff0000,
    kartAccent: 0xff8800,
    description: 'The Perfect Balance',
    signatureWeapon: {
      id: 'chaos-rift',
      name: 'Chaos Rift',
      description: 'Opens a rift that randomly teleports all nearby karts',
      effectType: 'area'
    },
    passive: {
      id: 'chaos-luck',
      description: 'Items have 20% chance to be upgraded to next tier',
      triggerCondition: 'item-pickup',
      effectModifiers: { itemUpgradeChance: 0.2 }
    },
    unlockCondition: 'Win 1st place with all 8 base characters',
    hidden: true,
    skins: [
      { primary: 0xff0000, secondary: 0x880000, accent: 0xff8800 },
      { primary: 0x0000ff, secondary: 0x000088, accent: 0x0088ff },
      { primary: 0xffffff, secondary: 0x888888, accent: 0xff00ff },
      { primary: 0x000000, secondary: 0x222222, accent: 0xff4400 }
    ]
  },
  glitch: {
    id: 'glitch',
    name: 'GL1TCH',
    stats: { speed: 10, acceleration: 1, handling: 1, weight: 10, special: 3 },
    kartPhysicsType: 'tracked',
    kartColor: 0x00ff00,
    kartAccent: 0x00ffaa,
    description: 'The System Error',
    signatureWeapon: {
      id: 'system-crash',
      name: 'System Crash',
      description: 'Freezes all opponents for 3s — screen glitch effect',
      effectType: 'global'
    },
    passive: {
      id: 'glitch-phase',
      description: 'Randomly phase through walls for 0.5s every 20s',
      triggerCondition: 'timer-20s',
      effectModifiers: { randomPhase: true }
    },
    unlockCondition: 'Complete Grand Prix in 1st place',
    hidden: true,
    skins: [
      { primary: 0x00ff00, secondary: 0x008800, accent: 0x00ffaa },
      { primary: 0xff00ff, secondary: 0x880088, accent: 0xff88ff },
      { primary: 0xffff00, secondary: 0x888800, accent: 0xffffff },
      { primary: 0x00ffff, secondary: 0x008888, accent: 0x88ffff }
    ]
  }
};

export function getCharacter(id) {
  return CHARACTERS[id] || HIDDEN_CHARACTERS[id] || null;
}

export function getAllCharacters(includeHidden = false) {
  const chars = Object.values(CHARACTERS);
  if (includeHidden) {
    chars.push(...Object.values(HIDDEN_CHARACTERS));
  }
  return chars;
}

export function getUnlockedCharacters(unlockedIds) {
  return getAllCharacters(true).filter(c => unlockedIds.includes(c.id));
}

export function getCharacterIds() {
  return Object.keys(CHARACTERS);
}
