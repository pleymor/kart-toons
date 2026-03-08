import * as THREE from 'three';

// Generate a closed-loop track as a series of waypoints
function generateWaypoints() {
  const points = [];
  const segments = 80;
  const baseRadius = 120;

  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;

    // Elongated oval with curves
    const r = baseRadius + Math.sin(t * 2) * 30 + Math.cos(t * 3) * 15;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;

    // Elevation: spiral ascent first half, descent second half
    let y = 0;
    if (i < segments / 2) {
      y = (i / (segments / 2)) * 25; // ascend to 25m
    } else {
      y = 25 - ((i - segments / 2) / (segments / 2)) * 25; // descend
    }
    // Add terrain variation
    y += Math.sin(t * 4) * 3;

    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

const waypoints = generateWaypoints();

// Start grid: 8 positions, 2 wide, 4 deep behind the first waypoint
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
      pos.y = start.y + 0.5;
      grid.push(pos);
    }
  }
  return grid;
}

// Item crate positions along the track
function generateCrateSpawns() {
  const spawns = [];
  for (let i = 5; i < waypoints.length; i += 4) {
    const p = waypoints[i].clone();
    p.y += 1.2;
    spawns.push(p);
  }
  return spawns;
}

export const VolcanPeak = {
  id: 'volcan-peak',
  name: 'Volcan Peak',
  theme: 'Active volcano, molten lava, ash, suspended bridges',
  elevationProfile: 'high',
  defaultLaps: 3,
  mutatesPerLap: false,

  waypoints,
  startGrid: generateStartGrid(),
  itemCrateSpawns: generateCrateSpawns(),
  turretCrateSpawns: [],
  legendaryCrateSpawn: waypoints[Math.floor(waypoints.length * 0.6)].clone().add(new THREE.Vector3(0, 1.5, 0)),

  trackWidth: 12,

  shortcuts: [
    {
      id: 'geyser-jump',
      entryPoint: waypoints[20].clone(),
      exitPoint: waypoints[28].clone(),
      accessCondition: 'item-gated',
      requiredItemId: 'levitateur',
      requiredCharacterId: null,
      timeSaved: 8,
      riskFactor: 'Misaligned jump leads to fall'
    },
    {
      id: 'lava-tunnel',
      entryPoint: waypoints[50].clone(),
      exitPoint: waypoints[58].clone(),
      accessCondition: 'universal',
      requiredItemId: null,
      requiredCharacterId: null,
      timeSaved: 4,
      riskFactor: 'Heat degrades speed progressively'
    }
  ],

  weatherPool: [
    {
      type: 'ash',
      gripModifier: -0.15,
      visibilityModifier: 0.8,
      duration: 30,
      specialEffect: 'Ash particles reduce visibility'
    },
    {
      type: 'eruption',
      gripModifier: -0.1,
      visibilityModifier: 0.9,
      duration: 20,
      specialEffect: 'Lava zone blocks part of circuit'
    }
  ],

  hazards: [
    {
      type: 'falling-rocks',
      interval: [8, 15], // random seconds between spawns
      damage: 'slowdown',
      description: 'Falling rock blocks on track'
    }
  ],

  // Visual config
  palette: {
    ground: 0x3a2a1a,
    walls: 0x554433,
    sky: { horizon: 0xff6633, zenith: 0x220000 },
    accent: 0xff4400,
    lava: 0xff3300
  }
};
