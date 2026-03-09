import * as THREE from 'three';

function generateWaypoints() {
  const points = [];
  const segments = 80;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Floating ruins: sharp elevation changes
    const r = 110 + Math.sin(t * 2) * 30;
    const x = Math.cos(t) * r + Math.cos(t * 5) * 15;
    const z = Math.sin(t) * r + Math.sin(t * 3) * 15;
    // Extreme elevation with gravity-inverted sections
    let y = Math.sin(t * 4) * 10 + Math.cos(t * 6) * 5;
    // Gravity flip sections (top of the track)
    if (i > segments * 0.3 && i < segments * 0.45) {
      y = 20 + Math.sin((t - Math.PI * 0.6) * 10) * 3;
    }
    points.push(new THREE.Vector3(x, Math.max(0, y), z));
  }

  // Add small bumps — crumbling ruins
  points[10].y += 0.7;
  points[35].y += 0.5;
  points[58].y += 0.8;

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
  for (let i = 7; i < waypoints.length; i += 8) {
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

export const RuinsOfKhaos = {
  id: 'ruins-of-khaos',
  name: 'Ruins of Khaos',
  theme: 'Floating ancient ruins, dimensional portals, altered gravity',
  elevationProfile: 'extreme',
  defaultLaps: 3,
  mutatesPerLap: true,
  waypoints,
  startGrid: generateStartGrid(),
  itemCrateSpawns: generateCrateSpawns(),
  turretCrateSpawns: [],
  legendaryCrateSpawn: waypoints[60].clone().add(new THREE.Vector3(0, 1.5, 0)),
  trackWidth: 18,
  trackWidths: (() => {
    const w = new Array(80).fill(18);
    // Wider sections (open ruins courtyards)
    for (let i = 5; i <= 12; i++) w[i] = 18 * 1.35;
    for (let i = 38; i <= 46; i++) w[i] = 18 * 1.4;
    for (let i = 68; i <= 74; i++) w[i] = 18 * 1.25;
    // Narrower sections (crumbling corridors)
    for (let i = 20; i <= 26; i++) w[i] = 18 * 0.7;
    for (let i = 52; i <= 58; i++) w[i] = 18 * 0.75;
    return w;
  })(),
  shortcuts: [
    {
      id: 'teleport-portal',
      entryPoint: waypoints[25].clone(),
      exitPoint: null, // random among 3 points
      exitOptions: [waypoints[30].clone(), waypoints[35].clone(), waypoints[40].clone()],
      accessCondition: 'universal',
      requiredItemId: null,
      requiredCharacterId: null,
      timeSaved: 10, // average
      riskFactor: 'Random exit — could gain or lose time'
    },
    {
      id: 'floating-platform',
      entryPoint: waypoints[55].clone(),
      exitPoint: waypoints[65].clone(),
      accessCondition: 'universal',
      requiredItemId: null,
      requiredCharacterId: null,
      timeSaved: 15,
      riskFactor: 'Must jump at exact timing, platform moves slowly'
    }
  ],
  weatherPool: [
    { type: 'dimensional-storm', gripModifier: -0.1, visibilityModifier: 0.8, duration: 30, specialEffect: 'Items teleport randomly on use' },
    { type: 'gravity-shift', gripModifier: 0, visibilityModifier: 1.0, duration: 20, specialEffect: 'All karts jump higher' }
  ],
  hazards: [
    { type: 'portal-mutation', interval: [0, 0], damage: 'none', description: 'Track section changes each lap via active/inactive portal' }
  ],
  palette: {
    ground: 0x2a1a2a,
    walls: 0x3a2a3a,
    sky: { horizon: 0x330066, zenith: 0x110033 },
    accent: 0xcc44ff,
    energy: 0x8800ff
  }
};
