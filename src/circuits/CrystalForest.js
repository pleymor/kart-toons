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
    const y = Math.sin(t * 4) * 2 + Math.max(0, Math.sin(t * 2) * 4);
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
  trackWidth: 11,
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
