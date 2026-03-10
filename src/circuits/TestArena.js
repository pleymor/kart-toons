import * as THREE from 'three';

// Simple flat circular track for item testing
function generateWaypoints() {
  const points = [];
  const segments = 40;
  const radius = 60;

  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    points.push(new THREE.Vector3(x, 0, z));
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
      const pos = start.clone()
        .add(dir.clone().multiplyScalar(-row * 5 - 3))
        .add(side.clone().multiplyScalar((col - 0.5) * 4));
      pos.y = 0.5;
      grid.push(pos);
    }
  }
  return grid;
}

function generateCrateSpawns() {
  const spawns = [];
  // Lots of crates for testing
  for (let i = 0; i < waypoints.length; i += 3) {
    const wp = waypoints[i];
    const next = waypoints[(i + 1) % waypoints.length];
    const dx = next.x - wp.x;
    const dz = next.z - wp.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const perpX = -dz / len;
    const perpZ = dx / len;
    spawns.push(new THREE.Vector3(wp.x + perpX * 3, wp.y + 1.2, wp.z + perpZ * 3));
    spawns.push(new THREE.Vector3(wp.x - perpX * 3, wp.y + 1.2, wp.z - perpZ * 3));
  }
  return spawns;
}

export const TestArena = {
  id: 'test-arena',
  name: 'Test Arena',
  theme: 'Space station, zero gravity, stars, nebula',
  elevationProfile: 'flat',
  defaultLaps: 9999,
  mutatesPerLap: false,

  waypoints,
  startGrid: generateStartGrid(),
  itemCrateSpawns: generateCrateSpawns(),
  turretCrateSpawns: [],
  legendaryCrateSpawn: waypoints[20].clone().add(new THREE.Vector3(0, 1.5, 0)),

  trackWidth: 20,
  trackWidths: new Array(40).fill(20),

  shortcuts: [],
  weatherPool: [],
  hazards: [],

  palette: {
    ground: 0x111122,
    walls: 0x222244,
    sky: { horizon: 0x0a0a2e, zenith: 0x000011 },
    accent: 0x4466ff,
    road: 0x333355
  }
};
