import * as THREE from 'three';

function generateWaypoints() {
  const points = [];
  const segments = 72;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const r = 100 + Math.sin(t * 2) * 20;
    const x = Math.cos(t) * r + Math.sin(t * 4) * 12;
    const z = Math.sin(t) * r + Math.cos(t * 3) * 10;
    // Underwater: slight depth variations simulating currents
    const y = Math.sin(t * 3) * 5 + Math.cos(t * 7) * 2;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

const waypoints = generateWaypoints();

function generateStartGrid() {
  const start = waypoints[0].clone();
  const dir = waypoints[1].clone().sub(start).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const grid = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      grid.push(start.clone().add(dir.clone().multiplyScalar(-row * 5 - 3)).add(side.clone().multiplyScalar((col - 0.5) * 4)));
    }
  }
  return grid;
}

function generateCrateSpawns() {
  const spawns = [];
  for (let i = 4; i < waypoints.length; i += 4) {
    spawns.push(waypoints[i].clone().add(new THREE.Vector3(0, 1.2, 0)));
  }
  return spawns;
}

export const AbyssalReef = {
  id: 'abyssal-reef',
  name: 'Abyssal Reef',
  theme: 'Ocean floor, underwater domes, giant creatures, water currents',
  elevationProfile: 'medium',
  defaultLaps: 3,
  mutatesPerLap: false,
  waypoints,
  startGrid: generateStartGrid(),
  itemCrateSpawns: generateCrateSpawns(),
  turretCrateSpawns: [],
  legendaryCrateSpawn: waypoints[36].clone().add(new THREE.Vector3(0, 1.5, 0)),
  trackWidth: 12,
  shortcuts: [
    {
      id: 'fast-current',
      entryPoint: waypoints[18].clone(),
      exitPoint: waypoints[26].clone(),
      accessCondition: 'character-gated',
      requiredItemId: null,
      requiredCharacterId: 'sharko',
      timeSaved: 6,
      riskFactor: 'Sharko accelerates, others are slowed'
    },
    {
      id: 'whale-back',
      entryPoint: waypoints[50].clone(),
      exitPoint: waypoints[58].clone(),
      accessCondition: 'item-gated',
      requiredItemId: 'grapplin-boost',
      requiredCharacterId: null,
      timeSaved: 8,
      riskFactor: 'Periodic - whale must be present, requires grapple or perfect jump'
    }
  ],
  weatherPool: [
    { type: 'underwater-storm', gripModifier: -0.2, visibilityModifier: 0.7, duration: 40, specialEffect: 'Strong currents deviate trajectories' },
    { type: 'bioluminescence', gripModifier: 0, visibilityModifier: 1.0, duration: 15, specialEffect: 'Items become invisible' }
  ],
  hazards: [
    { type: 'air-bubbles', interval: [6, 12], damage: 'none', description: 'Air bubbles launch karts upward like trampolines' }
  ],
  palette: {
    ground: 0x1a2a3a,
    walls: 0x2a3a4a,
    sky: { horizon: 0x0044aa, zenith: 0x001133 },
    accent: 0x00ccff,
    water: 0x0066cc
  }
};
