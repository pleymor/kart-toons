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

  // Add small bumps — coral ridges
  points[10].y += 0.4;
  points[28].y += 0.6;
  points[50].y += 0.5;

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
  let side = 1;
  for (let i = 6; i < waypoints.length; i += 7) {
    const wp = waypoints[i];
    const next = waypoints[(i + 1) % waypoints.length];
    const dx = next.x - wp.x;
    const dz = next.z - wp.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const perpX = -dz / len;
    const perpZ = dx / len;
    const offset = side * (2 + Math.random());
    side *= -1;
    spawns.push(new THREE.Vector3(wp.x + perpX * offset, wp.y + 1.2, wp.z + perpZ * offset));
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
  trackWidth: 17,
  trackWidths: (() => {
    const w = new Array(72).fill(17);
    // Wider sections (open reef basins)
    for (let i = 8; i <= 15; i++) w[i] = 17 * 1.3;
    for (let i = 40; i <= 48; i++) w[i] = 17 * 1.4;
    for (let i = 60; i <= 65; i++) w[i] = 17 * 1.25;
    // Narrower sections (coral canyons)
    for (let i = 22; i <= 28; i++) w[i] = 17 * 0.75;
    for (let i = 52; i <= 57; i++) w[i] = 17 * 0.7;
    return w;
  })(),
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
