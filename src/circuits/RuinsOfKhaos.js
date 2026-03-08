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
  trackWidth: 13,
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
