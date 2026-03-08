import * as THREE from 'three';

function generateWaypoints() {
  const points = [];
  const segments = 70;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Rectangular layout with rounded corners
    const phase = (t / (Math.PI * 2)) * 4;
    let x, z, y;
    if (phase < 1) {
      x = -80 + phase * 160; z = -60; y = 0;
    } else if (phase < 2) {
      x = 80; z = -60 + (phase - 1) * 120; y = (phase - 1) * 8;
    } else if (phase < 3) {
      x = 80 - (phase - 2) * 160; z = 60; y = 8 - (phase - 2) * 4;
    } else {
      x = -80; z = 60 - (phase - 3) * 120; y = 4 - (phase - 3) * 4;
    }
    // Smooth with sine
    x += Math.sin(t * 3) * 10;
    z += Math.cos(t * 5) * 8;
    y += Math.sin(t * 6) * 2;
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

export const NeonCity = {
  id: 'neon-city',
  name: 'Neon City Underground',
  theme: 'Cyberpunk night, giant sewers, elevated highways, holograms',
  elevationProfile: 'medium',
  defaultLaps: 3,
  mutatesPerLap: false,
  waypoints,
  startGrid: generateStartGrid(),
  itemCrateSpawns: generateCrateSpawns(),
  turretCrateSpawns: [],
  legendaryCrateSpawn: waypoints[35].clone().add(new THREE.Vector3(0, 1.5, 0)),
  trackWidth: 14,
  shortcuts: [
    {
      id: 'metro-fan',
      entryPoint: waypoints[15].clone(),
      exitPoint: waypoints[22].clone(),
      accessCondition: 'universal',
      requiredItemId: null,
      requiredCharacterId: null,
      timeSaved: 5,
      riskFactor: 'Must pass at right timing'
    },
    {
      id: 'rooftop',
      entryPoint: waypoints[45].clone(),
      exitPoint: waypoints[52].clone(),
      accessCondition: 'item-gated',
      requiredItemId: 'levitateur',
      requiredCharacterId: null,
      timeSaved: 7,
      riskFactor: 'Fall if miss the rooftop'
    }
  ],
  weatherPool: [
    { type: 'acid-rain', gripModifier: -0.3, visibilityModifier: 0.85, duration: 60, specialEffect: 'Reduced grip on asphalt' },
    { type: 'blackout', gripModifier: 0, visibilityModifier: 0.3, duration: 10, specialEffect: 'No lighting in zone' }
  ],
  hazards: [
    { type: 'traffic', interval: [5, 10], damage: 'collision', description: 'AI traffic vehicles crossing track' }
  ],
  palette: {
    ground: 0x222233,
    walls: 0x333344,
    sky: { horizon: 0x1a0033, zenith: 0x000011 },
    accent: 0x00ffcc,
    neon: 0xff00ff
  }
};
