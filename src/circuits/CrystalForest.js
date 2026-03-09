import * as THREE from 'three';

function generateWaypoints() {
  const points = [];
  const segments = 75;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Sinuous path
    const r = 90 + Math.sin(t * 3) * 25 + Math.cos(t * 5) * 15;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    let y = Math.sin(t * 4) * 2 + Math.max(0, Math.sin(t * 2) * 4);
    points.push(new THREE.Vector3(x, y, z));
  }

  // Add small bumps at specific waypoints
  points[12].y += 0.5;
  points[30].y += 0.7;
  points[55].y += 0.4;

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
  let side = 1; // alternate left/right
  for (let i = 7; i < waypoints.length; i += 7) {
    const wp = waypoints[i];
    const next = waypoints[(i + 1) % waypoints.length];
    // Track direction and perpendicular offset
    const dx = next.x - wp.x;
    const dz = next.z - wp.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    // Perpendicular: rotate direction 90 degrees
    const perpX = -dz / len;
    const perpZ = dx / len;
    const offset = side * (2 + Math.random()); // 2-3 units left or right
    side *= -1;
    spawns.push(new THREE.Vector3(wp.x + perpX * offset, wp.y + 1.2, wp.z + perpZ * offset));
  }
  return spawns;
}

export const CrystalForest = {
  id: 'crystal-forest',
  name: 'Crystal Forest',
  theme: 'Enchanted forest, giant crystals, frozen rivers, bioluminescent mushrooms',
  elevationProfile: 'low',
  defaultLaps: 3,
  mutatesPerLap: false,
  waypoints,
  startGrid: generateStartGrid(),
  itemCrateSpawns: generateCrateSpawns(),
  turretCrateSpawns: [],
  legendaryCrateSpawn: waypoints[40].clone().add(new THREE.Vector3(0, 1.5, 0)),
  trackWidth: 16,
  trackWidths: (() => {
    const w = new Array(75).fill(16);
    // Wider sections
    for (let i = 5; i <= 12; i++) w[i] = 16 * 1.3;   // wide opening
    for (let i = 35; i <= 42; i++) w[i] = 16 * 1.4;   // broadest stretch
    for (let i = 58; i <= 63; i++) w[i] = 16 * 1.25;  // wide before finish
    // Narrower sections
    for (let i = 20; i <= 25; i++) w[i] = 16 * 0.75;  // tight forest passage
    for (let i = 48; i <= 53; i++) w[i] = 16 * 0.7;   // crystal corridor
    return w;
  })(),
  shortcuts: [
    {
      id: 'frozen-river',
      entryPoint: waypoints[20].clone(),
      exitPoint: waypoints[28].clone(),
      accessCondition: 'universal',
      requiredItemId: null,
      requiredCharacterId: null,
      timeSaved: 4,
      riskFactor: 'Extremely slippery, loss of control'
    },
    {
      id: 'crystal-tunnel',
      entryPoint: waypoints[50].clone(),
      exitPoint: waypoints[60].clone(),
      accessCondition: 'item-gated',
      requiredItemId: 'crystal-breaker',
      requiredCharacterId: null,
      timeSaved: 12,
      riskFactor: 'Requires rare item Crystal Breaker'
    }
  ],
  weatherPool: [
    { type: 'blizzard', gripModifier: -0.6, visibilityModifier: 0.5, duration: 45, specialEffect: 'Ice on entire track' },
    { type: 'crystal-rain', gripModifier: -0.1, visibilityModifier: 0.9, duration: 30, specialEffect: 'Minor damage without shield' }
  ],
  hazards: [],
  palette: {
    ground: 0x2a3a2a,
    walls: 0x3a4a3a,
    sky: { horizon: 0x88bbff, zenith: 0x2244aa },
    accent: 0x88ddff,
    crystal: 0xaaeeff
  }
};
