import * as THREE from 'three';
import { getCharacter, getCharacterIds } from '../characters/index.js';
import { getCircuit } from '../circuits/index.js';
import { KartController } from './KartController.js';
import { AIController } from './AIController.js';
import { RaceManager } from './RaceManager.js';
import { ItemSystem } from './ItemSystem.js';
import { WeatherSystem } from './WeatherSystem.js';
import { updateHUD } from '../ui/HUD.js';
import {
  setScene, setRaceState, setPaused, getPaused,
  getRenderer, getPhysics, getInputManager, getAudioEngine
} from '../main.js';
import { TurretController } from './TurretController.js';
import { Storage } from '../utils/Storage.js';
import groundVert from '../shaders/ground.vert.glsl';
import groundFrag from '../shaders/ground.frag.glsl';
import roadVert from '../shaders/road.vert.glsl';
import roadFrag from '../shaders/road.frag.glsl';

let animFrameId = null;
let raceCleanup = null;
let shaderUniforms = []; // all time-based shader uniforms to update each frame

export async function startRace(config) {
  const {
    characterId, characterIds, circuitId,
    mode = 'solo', difficulty = 'normal',
    playerCount = 1, splitOrientation = 'horizontal'
  } = config;

  const renderer = getRenderer();
  const physics = getPhysics();
  const inputManager = getInputManager();
  const audioEngine = getAudioEngine();

  const circuit = getCircuit(circuitId);
  if (!circuit) return;

  // Determine human character selections
  const humanCharIds = characterIds || [characterId];
  const humanCount = Math.min(humanCharIds.length, 4);

  // Clear existing scene objects (keep lights)
  const toRemove = [];
  renderer.scene.traverse(child => {
    if (child !== renderer.scene && child !== renderer.light && child !== renderer.ambient && child.type !== 'DirectionalLight' && child.type !== 'AmbientLight') {
      toRemove.push(child);
    }
  });
  toRemove.forEach(obj => renderer.scene.remove(obj));

  // Set lighting theme and build track
  renderer.setLightingTheme(circuit.theme);
  buildTrack(renderer, circuit);


  // Create participants
  const participants = [];
  const aiControllers = [];
  const humanKarts = [];
  const humanCameras = [];
  let turretController = null;
  const isCrewMode = mode === 'crew';

  // Direction toward second waypoint
  const dir = circuit.waypoints[1].clone().sub(circuit.waypoints[0]);
  const startYaw = Math.atan2(dir.x, dir.z);

  // Setup split-screen cameras
  if (isCrewMode) {
    // Crew: 2 viewports (driver left, gunner right)
    const cameras = renderer.setupSplitScreen(2, 'vertical');
    humanCameras.push(...cameras);
  } else if (humanCount > 1) {
    const cameras = renderer.setupSplitScreen(humanCount, splitOrientation);
    humanCameras.push(...cameras);
  } else {
    renderer.resetSinglePlayer();
    humanCameras.push(renderer.camera);
  }

  // Rearview mirror camera
  const rearviewCam = new THREE.PerspectiveCamera(95, 4, 0.1, 300);

  // Create human karts
  for (let i = 0; i < humanCount; i++) {
    const char = getCharacter(humanCharIds[i]);
    if (!char) continue;

    const gridPos = circuit.startGrid[i] || circuit.startGrid[0].clone().add(new THREE.Vector3(0, 0, -5 * i));
    const mesh = createKartMesh(renderer, char);
    const body = physics.createKinematicBody({ x: gridPos.x, y: gridPos.y, z: gridPos.z });
    physics.addBoxCollider(body, { x: 1, y: 0.5, z: 1.5 });

    const kart = new KartController(physics, char, mesh, body);
    kart._circuit = circuit;
    kart.setPosition(gridPos.x, gridPos.y, gridPos.z);
    kart.setYaw(startYaw);
    renderer.scene.add(mesh);

    humanKarts.push(kart);
    participants.push({ id: `player-${i}`, characterId: humanCharIds[i], kartController: kart, isHuman: true });
  }

  // Crew mode: attach turret to player kart
  if (isCrewMode && humanKarts.length > 0) {
    turretController = new TurretController(humanKarts[0]);
    turretController.attachTo(humanKarts[0].mesh);
  }

  // AI karts to fill up to 8 total
  const usedIds = new Set(humanCharIds);
  const availableIds = getCharacterIds().filter(id => !usedIds.has(id));
  const aiCount = Math.max(0, 8 - humanCount);

  for (let i = 0; i < aiCount && i < availableIds.length; i++) {
    const aiChar = getCharacter(availableIds[i]);
    const gridIdx = humanCount + i;
    const gridPos = circuit.startGrid[gridIdx] || circuit.startGrid[0].clone().add(new THREE.Vector3(0, 0, -5 * gridIdx));

    const aiMesh = createKartMesh(renderer, aiChar);
    const aiBody = physics.createKinematicBody({ x: gridPos.x, y: gridPos.y, z: gridPos.z });
    physics.addBoxCollider(aiBody, { x: 1, y: 0.5, z: 1.5 });

    const aiKart = new KartController(physics, aiChar, aiMesh, aiBody);
    aiKart._circuit = circuit;
    aiKart.setPosition(gridPos.x, gridPos.y, gridPos.z);
    aiKart.setYaw(startYaw);
    renderer.scene.add(aiMesh);

    const aiController = new AIController(aiKart, circuit, difficulty);
    aiControllers.push(aiController);
    participants.push({ id: `ai-${i}`, characterId: availableIds[i], kartController: aiKart, isHuman: false });
  }

  // Systems
  const raceManager = new RaceManager(circuit, participants);
  const itemSystem = new ItemSystem(renderer.scene, circuit, participants);
  const weatherSystem = new WeatherSystem(renderer.scene, circuit, renderer);

  // Set main.js state
  setRaceState({
    raceManagerInstance: raceManager,
    itemSystemInstance: itemSystem,
    playerKartInstance: humanKarts[0],
    aiControllerInstances: aiControllers
  });

  setScene('race');
  audioEngine.loadRaceMusic(Math.floor(Math.random() * 2));
  audioEngine.startMusic();
  audioEngine.startEngine();

  // Load and apply settings
  const settings = Storage.getSettings();
  const { applySettings } = await import('../ui/PauseMenu.js');
  applySettings(settings);
  const { init: initPause } = await import('../ui/PauseMenu.js');
  initPause();

  // Snap cameras to initial position (avoid slow lerp from origin)
  for (let i = 0; i < humanKarts.length; i++) {
    const kart = humanKarts[i];
    const cam = humanCameras[i];
    const behind = new THREE.Vector3(
      -Math.sin(kart.yaw) * 12, 6, -Math.cos(kart.yaw) * 12
    );
    cam.position.copy(kart.position).add(behind);
    cam.lookAt(kart.position.x, kart.position.y + 1.5, kart.position.z);
  }

  let lastTime = performance.now();

  function raceLoop(now) {
    const delta = Math.min((now - lastTime) / 1000, 1 / 20);
    lastTime = now;

    inputManager.update();

    if (getPaused()) {
      renderer.render();
      animFrameId = requestAnimationFrame(raceLoop);
      return;
    }

    if (raceManager.isRacing()) {
      // Update all human karts
      for (let i = 0; i < humanKarts.length; i++) {
        const pInput = inputManager.getPlayerState(i);
        humanKarts[i].update(delta, pInput);

        if (!isCrewMode && pInput.useItem) {
          itemSystem.useItem(`player-${i}`);
        }

      }

      // Crew mode: driver uses item with P1 input, gunner fires with P2 input
      if (isCrewMode && turretController) {
        const driverInput = inputManager.getPlayerState(0);
        const gunnerInput = inputManager.getPlayerState(1);
        if (driverInput.useItem) {
          itemSystem.useItem('player-0');
        }
        turretController.update(delta, {
          aimX: gunnerInput.steering,
          aimY: gunnerInput.throttle - (gunnerInput.brake ? 1 : 0),
          fire: gunnerInput.useItem
        });
        if (gunnerInput.useItem) {
          itemSystem.useItem('player-0'); // gunner uses shared slot for now
        }
      }

      // AI
      for (let i = 0; i < aiControllers.length; i++) {
        const ai = aiControllers[i];
        ai.update(delta);
        if (ai.input?.useItem) {
          itemSystem.useItem(`ai-${i}`);
        }
      }

      // Kart-to-kart collisions
      resolveKartCollisions(participants);

      // Systems
      itemSystem.update(delta);
      weatherSystem.update(delta, participants);
      raceManager.update(delta);

      // Rubberbanding for AI
      for (const p of participants) {
        if (!p.isHuman) {
          const playerData = raceManager.getParticipantData('player-0');
          const aiData = raceManager.getParticipantData(p.id);
          if (playerData && aiData) {
            const timeLead = (playerData.lapCount - aiData.lapCount) * 30 + (playerData.lapProgress - aiData.lapProgress) * 30;
            const aiCtrl = aiControllers.find(a => a.kart === p.kartController);
            if (aiCtrl) aiCtrl.setRubberBand(timeLead);
          }
        }
      }
    } else if (raceManager.isCountdown()) {
      raceManager.update(delta);
    } else if (raceManager.isFinished()) {
      audioEngine.stopEngine();
      audioEngine.stopMusic();
      const playerPos = raceManager.getPosition('player-0');
      audioEngine.playFinishMusic(playerPos);
      weatherSystem.dispose();
      const results = raceManager.getResults();
      renderer.resetSinglePlayer();
      setScene('results', { ...results, circuitId, mode });
      return;
    }

    physics.step(delta);

    // Update shader time uniforms
    for (const u of shaderUniforms) {
      u.time.value += delta;
    }

    // Update cameras
    if (isCrewMode && turretController) {
      const driverInput = inputManager.getPlayerState(0);
      updateCockpitCamera(humanCameras[0], humanKarts[0], driverInput?.lookBehind);
      // Gunner: FPS cam at turret
      const turretPos = turretController.getWorldPosition();
      const turretDir = turretController.getWorldDirection();
      humanCameras[1].position.copy(turretPos);
      humanCameras[1].lookAt(turretPos.clone().add(turretDir));
    } else {
      for (let i = 0; i < humanKarts.length; i++) {
        const pInput = inputManager.getPlayerState(i);
        updateCockpitCamera(humanCameras[i], humanKarts[i], pInput?.lookBehind);
      }
    }

    // Shadow light follows player
    renderer.updateLightTarget(humanKarts[0].position);

    renderer.render();

    // Rearview mirror render
    if (humanKarts.length > 0) {
      const kart = humanKarts[0];
      rearviewCam.position.set(kart.position.x, kart.position.y + 1.6, kart.position.z);
      _rearviewLookAt.set(
        kart.position.x - Math.sin(kart.yaw) * 50,
        kart.position.y + 1.2,
        kart.position.z - Math.cos(kart.yaw) * 50
      );
      rearviewCam.lookAt(_rearviewLookAt);
      const cw = renderer.canvas.width;
      const ch = renderer.canvas.height;
      const mw = Math.round(Math.min(cw * 0.3, 320));
      const mh = Math.round(mw * 0.25);
      const mx = Math.round((cw - mw) / 2);
      const my = ch - mh - Math.round(ch * 0.01);
      renderer.renderRearview(rearviewCam, { x: mx, y: my, w: mw, h: mh });
    }

    // HUD (show P1 data for now, multi-player HUD is per-viewport overlay)
    const pData = raceManager.getParticipantData('player-0');
    updateHUD({
      position: raceManager.getPosition('player-0'),
      lap: pData?.lapCount || 0,
      maxLaps: circuit.defaultLaps,
      timer: raceManager.timer,
      speed: humanKarts[0].speed,
      itemName: itemSystem.getItemName(itemSystem.getHeldItem('player-0')),
      countdown: raceManager.isCountdown() ? raceManager.countdown : undefined,
      participants,
      waypoints: circuit.waypoints
    });

    audioEngine.updateMusicContext(
      raceManager.getPosition('player-0'),
      participants.length,
      (pData?.lapCount || 0) >= circuit.defaultLaps - 1
    );
    audioEngine.updateEngineSound(humanKarts[0].speed, humanKarts[0].maxSpeed);

    animFrameId = requestAnimationFrame(raceLoop);
  }

  animFrameId = requestAnimationFrame(raceLoop);

  raceCleanup = () => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    audioEngine.stopEngine();
    audioEngine.stopMusic();
    itemSystem.dispose();
    weatherSystem.dispose();
    renderer.resetSinglePlayer();
  };
}

const _cockpitLookAt = new THREE.Vector3();
const _rearviewLookAt = new THREE.Vector3();

function updateCockpitCamera(camera, kart, lookBehind) {
  const sign = lookBehind ? -1 : 1;
  camera.position.set(
    kart.position.x,
    kart.position.y + 1.6,
    kart.position.z
  );
  _cockpitLookAt.set(
    kart.position.x + sign * Math.sin(kart.yaw) * 50,
    kart.position.y + 1.2,
    kart.position.z + sign * Math.cos(kart.yaw) * 50
  );
  camera.lookAt(_cockpitLookAt);
  camera.fov = 85;
  camera.updateProjectionMatrix();
}

// --- Shared kart geometries ---
// Wheels
const _wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
const _bigWheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12);
const _trackWheelGeo = new THREE.BoxGeometry(0.4, 0.3, 2.4);
// Bodies
const _standardBodyGeo = new THREE.BoxGeometry(2, 0.6, 3);
const _sleekBodyGeo = new THREE.BoxGeometry(1.6, 0.4, 3.4);
const _heavyBodyGeo = new THREE.BoxGeometry(2.4, 0.8, 3.2);
const _wideBodyGeo = new THREE.BoxGeometry(2.2, 0.5, 2.8);
// Cockpits
const _standardCockpitGeo = new THREE.BoxGeometry(1.2, 0.5, 1.0);
const _sportCockpitGeo = new THREE.BoxGeometry(1.0, 0.4, 0.8);
const _domeGeo = new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
// Details
const _spoilerGeo = new THREE.BoxGeometry(1.8, 0.08, 0.4);
const _spoilerPostGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
const _exhaustGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 8);
const _noseGeo = new THREE.ConeGeometry(0.3, 0.8, 6);
const _sideSkirtGeo = new THREE.BoxGeometry(0.15, 0.2, 2.6);
const _hoverPadGeo = new THREE.CylinderGeometry(0.6, 0.5, 0.12, 8);
const _antennaGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4);
const _antennaTipGeo = new THREE.SphereGeometry(0.08, 6, 6);
const _engineBlockGeo = new THREE.BoxGeometry(1.0, 0.4, 0.6);
const _rollBarGeo = new THREE.TorusGeometry(0.5, 0.04, 6, 12, Math.PI);
const _bumperGeo = new THREE.BoxGeometry(2.0, 0.2, 0.15);
const _finGeo = new THREE.BoxGeometry(0.06, 0.5, 0.8);

function createKartMesh(renderer, character) {
  const type = character.kartPhysicsType || 'wheeled';
  const col = character.kartColor;
  const acc = character.kartAccent;
  const w = character.stats?.weight || 4;

  switch (type) {
    case 'levitating': return buildHoverKart(renderer, col, acc);
    case 'tracked': return buildTrackedKart(renderer, col, acc, w);
    case 'hybrid': return buildHybridKart(renderer, col, acc);
    default: return buildWheeledKart(renderer, col, acc, w);
  }
}

function buildWheeledKart(renderer, col, acc, weight) {
  const group = new THREE.Group();
  const heavy = weight >= 6;
  const light = weight <= 3;

  // Body: heavy=big tank, light=sleek racer, mid=standard
  const bodyGeo = heavy ? _heavyBodyGeo : (light ? _sleekBodyGeo : _standardBodyGeo);
  const body = renderer.createToonMesh(bodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = heavy ? 0.55 : 0.5;
  group.add(body);

  // Cockpit
  const cockpitGeo = light ? _sportCockpitGeo : _standardCockpitGeo;
  const cockpit = renderer.createToonMesh(cockpitGeo, acc, { outlineWidth: 0.03 });
  cockpit.position.set(0, heavy ? 1.15 : 1.0, -0.2);
  group.add(cockpit);

  // Wheels: bigger for heavy
  const wGeo = heavy ? _bigWheelGeo : _wheelGeo;
  const positions = heavy
    ? [[-1.1, 0.45, 1.1], [1.1, 0.45, 1.1], [-1.1, 0.45, -1.1], [1.1, 0.45, -1.1]]
    : [[-0.9, 0.35, 1.0], [0.9, 0.35, 1.0], [-0.9, 0.35, -1.0], [0.9, 0.35, -1.0]];
  for (const [x, y, z] of positions) {
    const wheel = renderer.createToonMesh(wGeo, 0x222222, { outlineWidth: 0.02 });
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  // Light karts: spoiler + side skirts
  if (light) {
    const spoiler = renderer.createToonMesh(_spoilerGeo, acc, { outlineWidth: 0.02 });
    spoiler.position.set(0, 1.15, -1.5);
    group.add(spoiler);
    for (const side of [-0.7, 0.7]) {
      const post = renderer.createToonMesh(_spoilerPostGeo, acc, { outlineWidth: 0.01 });
      post.position.set(side, 0.95, -1.5);
      group.add(post);
    }
    for (const side of [-0.85, 0.85]) {
      const skirt = renderer.createToonMesh(_sideSkirtGeo, col, { outlineWidth: 0.01 });
      skirt.position.set(side, 0.35, 0);
      group.add(skirt);
    }
  }

  // Heavy karts: bumper + engine block + exhaust pipes
  if (heavy) {
    const bumper = renderer.createToonMesh(_bumperGeo, 0x333333, { outlineWidth: 0.02 });
    bumper.position.set(0, 0.4, 1.65);
    group.add(bumper);
    const engine = renderer.createToonMesh(_engineBlockGeo, 0x444444, { outlineWidth: 0.02 });
    engine.position.set(0, 1.15, -1.2);
    group.add(engine);
    for (const side of [-0.35, 0.35]) {
      const exhaust = renderer.createToonMesh(_exhaustGeo, 0x333333, { outlineWidth: 0.01 });
      exhaust.rotation.x = -Math.PI / 4;
      exhaust.position.set(side, 1.1, -1.7);
      group.add(exhaust);
    }
  }

  // Mid-weight: roll bar + exhaust
  if (!heavy && !light) {
    const rollBar = renderer.createToonMesh(_rollBarGeo, 0x555555, { outlineWidth: 0.02 });
    rollBar.rotation.y = Math.PI / 2;
    rollBar.position.set(0, 1.2, -0.2);
    group.add(rollBar);
    const exhaust = renderer.createToonMesh(_exhaustGeo, 0x333333, { outlineWidth: 0.01 });
    exhaust.rotation.x = -Math.PI / 5;
    exhaust.position.set(0.5, 0.7, -1.6);
    group.add(exhaust);
  }

  group.castShadow = true;
  return group;
}

function buildHoverKart(renderer, col, acc) {
  const group = new THREE.Group();

  // Sleek flat body
  const body = renderer.createToonMesh(_sleekBodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = 0.7;
  group.add(body);

  // Dome cockpit
  const dome = renderer.createToonMesh(_domeGeo, acc, { outlineWidth: 0.03 });
  dome.position.set(0, 1.1, -0.1);
  group.add(dome);

  // Hover pads (no wheels)
  const padPositions = [[-0.7, 0.35, 1.0], [0.7, 0.35, 1.0], [-0.7, 0.35, -1.0], [0.7, 0.35, -1.0]];
  for (const [x, y, z] of padPositions) {
    const pad = renderer.createToonMesh(_hoverPadGeo, acc, { outlineWidth: 0.02 });
    pad.position.set(x, y, z);
    group.add(pad);
  }

  // Side fins
  for (const side of [-0.85, 0.85]) {
    const fin = renderer.createToonMesh(_finGeo, acc, { outlineWidth: 0.01 });
    fin.position.set(side, 0.9, -1.2);
    group.add(fin);
  }

  // Antenna
  const antenna = renderer.createToonMesh(_antennaGeo, 0x888888, { outlineWidth: 0.01 });
  antenna.position.set(0, 1.6, -0.5);
  group.add(antenna);
  const tip = renderer.createToonMesh(_antennaTipGeo, acc, { outlineWidth: 0.01 });
  tip.position.set(0, 2.0, -0.5);
  group.add(tip);

  // Nose cone
  const nose = renderer.createToonMesh(_noseGeo, acc, { outlineWidth: 0.02 });
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.7, 1.9);
  group.add(nose);

  group.castShadow = true;
  return group;
}

function buildTrackedKart(renderer, col, acc, weight) {
  const group = new THREE.Group();

  // Wide heavy body
  const body = renderer.createToonMesh(_heavyBodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = 0.6;
  group.add(body);

  // Boxy cockpit
  const cockpit = renderer.createToonMesh(_standardCockpitGeo, acc, { outlineWidth: 0.03 });
  cockpit.position.set(0, 1.2, -0.1);
  group.add(cockpit);

  // Tank treads (left and right)
  for (const side of [-1.2, 1.2]) {
    const track = renderer.createToonMesh(_trackWheelGeo, 0x222222, { outlineWidth: 0.02 });
    track.position.set(side, 0.3, 0);
    group.add(track);
    // Tread detail: small cylinders as rollers
    for (let z = -0.9; z <= 0.9; z += 0.6) {
      const roller = renderer.createToonMesh(_wheelGeo, 0x333333, { outlineWidth: 0.01 });
      roller.rotation.z = Math.PI / 2;
      roller.position.set(side, 0.3, z);
      group.add(roller);
    }
  }

  // Bumper
  const bumper = renderer.createToonMesh(_bumperGeo, 0x444444, { outlineWidth: 0.02 });
  bumper.position.set(0, 0.35, 1.65);
  group.add(bumper);

  // Dual exhaust
  for (const side of [-0.4, 0.4]) {
    const exhaust = renderer.createToonMesh(_exhaustGeo, 0x333333, { outlineWidth: 0.01 });
    exhaust.rotation.x = -Math.PI / 3;
    exhaust.position.set(side, 1.1, -1.7);
    group.add(exhaust);
  }

  // Engine block on top
  const engine = renderer.createToonMesh(_engineBlockGeo, 0x444444, { outlineWidth: 0.02 });
  engine.position.set(0, 1.25, -1.0);
  group.add(engine);

  group.castShadow = true;
  return group;
}

function buildHybridKart(renderer, col, acc) {
  const group = new THREE.Group();

  // Rounded-ish body (slightly wide)
  const body = renderer.createToonMesh(_wideBodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = 0.5;
  group.add(body);

  // Dome cockpit
  const dome = renderer.createToonMesh(_domeGeo, acc, { outlineWidth: 0.03 });
  dome.position.set(0, 1.0, -0.1);
  group.add(dome);

  // Front: normal wheels, back: hover pads
  const frontWheels = [[-0.9, 0.35, 1.0], [0.9, 0.35, 1.0]];
  for (const [x, y, z] of frontWheels) {
    const wheel = renderer.createToonMesh(_wheelGeo, 0x222222, { outlineWidth: 0.02 });
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }
  const rearPads = [[-0.8, 0.3, -1.0], [0.8, 0.3, -1.0]];
  for (const [x, y, z] of rearPads) {
    const pad = renderer.createToonMesh(_hoverPadGeo, acc, { outlineWidth: 0.02 });
    pad.position.set(x, y, z);
    group.add(pad);
  }

  // Spoiler
  const spoiler = renderer.createToonMesh(_spoilerGeo, acc, { outlineWidth: 0.02 });
  spoiler.position.set(0, 1.05, -1.3);
  group.add(spoiler);
  for (const side of [-0.6, 0.6]) {
    const post = renderer.createToonMesh(_spoilerPostGeo, acc, { outlineWidth: 0.01 });
    post.position.set(side, 0.85, -1.3);
    group.add(post);
  }

  // Side fins
  for (const side of [-1.1, 1.1]) {
    const fin = renderer.createToonMesh(_finGeo, acc, { outlineWidth: 0.01 });
    fin.position.set(side, 0.7, -0.5);
    group.add(fin);
  }

  // Nose
  const nose = renderer.createToonMesh(_noseGeo, acc, { outlineWidth: 0.02 });
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.5, 1.6);
  group.add(nose);

  group.castShadow = true;
  return group;
}

function getThemeBiome(theme) {
  if (theme.includes('forest') || theme.includes('crystal')) return 0; // grass
  if (theme.includes('volcan') || theme.includes('lava')) return 1; // lava
  if (theme.includes('ocean') || theme.includes('reef') || theme.includes('water')) return 2; // water
  if (theme.includes('neon') || theme.includes('cyber')) return 3; // neon
  if (theme.includes('stone') || theme.includes('ruin')) return 4; // stone
  return 0; // default grass
}

function getThemeColors(theme, palette) {
  const biome = getThemeBiome(theme);
  const defaults = [
    { base: [0.16, 0.23, 0.06], accent: [0.1, 0.4, 0.05] },  // grass
    { base: [0.25, 0.1, 0.03], accent: [1.0, 0.3, 0.0] },     // lava
    { base: [0.04, 0.1, 0.17], accent: [0.1, 0.4, 0.6] },      // water
    { base: [0.07, 0.07, 0.13], accent: [0.0, 1.0, 0.8] },     // neon
    { base: [0.2, 0.18, 0.15], accent: [0.15, 0.25, 0.1] },    // stone
  ];
  const d = defaults[biome] || defaults[0];

  // Convert palette hex to vec3 if available
  function hexToVec3(hex) {
    return new THREE.Vector3(
      ((hex >> 16) & 0xff) / 255,
      ((hex >> 8) & 0xff) / 255,
      (hex & 0xff) / 255
    );
  }

  const baseColor = palette?.ground
    ? hexToVec3(palette.ground)
    : new THREE.Vector3(d.base[0], d.base[1], d.base[2]);
  const accentColor = palette?.accent
    ? hexToVec3(palette.accent)
    : new THREE.Vector3(d.accent[0], d.accent[1], d.accent[2]);

  return { biome, baseColor, accentColor };
}

function buildTrack(renderer, circuit) {
  const waypoints = circuit.waypoints;
  if (waypoints.length < 2) return;

  shaderUniforms = [];
  const trackWidth = circuit.trackWidth || 12;
  const theme = circuit.theme?.toLowerCase() || '';
  const { biome, baseColor, accentColor } = getThemeColors(theme, circuit.palette);

  // Road shader uniforms (shared across all segments)
  const roadUniforms = {
    baseColor: { value: new THREE.Vector3(0.33, 0.33, 0.33) },
    lineColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    time: { value: 0 },
    roadStyle: { value: biome }
  };

  // Override road base color from palette
  if (circuit.palette?.road) {
    const rc = circuit.palette.road;
    roadUniforms.baseColor.value.set(
      ((rc >> 16) & 0xff) / 255,
      ((rc >> 8) & 0xff) / 255,
      (rc & 0xff) / 255
    );
  }

  shaderUniforms.push(roadUniforms);

  const roadMat = new THREE.ShaderMaterial({
    vertexShader: roadVert,
    fragmentShader: roadFrag,
    uniforms: roadUniforms,
    side: THREE.DoubleSide
  });

  // Build a single continuous track mesh with smooth corners
  const trackMesh = buildContinuousTrackMesh(waypoints, trackWidth, roadMat);
  trackMesh.receiveShadow = true;
  renderer.scene.add(trackMesh);

  // Ground plane with procedural shader
  const groundUniforms = {
    baseColor: { value: baseColor },
    accentColor: { value: accentColor },
    time: { value: 0 },
    biome: { value: biome }
  };
  shaderUniforms.push(groundUniforms);

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: groundVert,
    fragmentShader: groundFrag,
    uniforms: groundUniforms,
    side: THREE.DoubleSide
  });

  // Place ground below the lowest waypoint
  let minY = Infinity;
  for (const wp of waypoints) {
    if (wp.y < minY) minY = wp.y;
  }

  const groundGeo = new THREE.PlaneGeometry(2000, 2000, 200, 200);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = minY - 2;
  ground.receiveShadow = true;
  renderer.scene.add(ground);

  // Scenery
  buildScenery(renderer, circuit, waypoints, trackWidth);

  // Track-side point lights for varied lighting
  buildTrackLights(renderer, circuit, waypoints, trackWidth);

  if (circuit.palette?.sky) {
    renderer.renderer.setClearColor(circuit.palette.sky.zenith);
  }
}

// --- Track-side lighting ---

const _lampPostGeo = new THREE.CylinderGeometry(0.08, 0.12, 5, 6);
const _lampHeadGeo = new THREE.SphereGeometry(0.25, 8, 6);

function buildTrackLights(renderer, circuit, waypoints, trackWidth) {
  const theme = (circuit.theme || '').toLowerCase();
  const n = waypoints.length;
  const rng = mulberry32((circuit.id?.length || 3) + 99);

  // Theme-specific light configs
  let lightColor, lightIntensity, lightDist, lampColor, emitColor;
  let useLampPost = true;

  if (theme.includes('neon') || theme.includes('cyber')) {
    lightIntensity = 8;
    lightDist = 25;
    lampColor = 0x222233;
    // Alternating neon colors
    const neonColors = [0x00ffcc, 0xff00ff, 0x00aaff, 0xffaa00];
    lightColor = () => neonColors[Math.floor(rng() * neonColors.length)];
    emitColor = lightColor;
  } else if (theme.includes('volcan') || theme.includes('lava')) {
    lightColor = () => rng() > 0.5 ? 0xff4400 : 0xff8800;
    lightIntensity = 6;
    lightDist = 20;
    lampColor = 0x443322;
    emitColor = () => 0xff4400;
    useLampPost = false; // lava pools, no posts
  } else if (theme.includes('ocean') || theme.includes('reef')) {
    lightColor = () => rng() > 0.5 ? 0x00ccff : 0x44ffaa;
    lightIntensity = 5;
    lightDist = 22;
    lampColor = 0x334455;
    emitColor = lightColor;
    useLampPost = false; // bioluminescent, no posts
  } else if (theme.includes('forest') || theme.includes('crystal')) {
    const forestColors = [0xffdd44, 0x88ff66, 0xaaddff];
    lightColor = () => forestColors[Math.floor(rng() * forestColors.length)];
    lightIntensity = 4;
    lightDist = 18;
    lampColor = 0x5a3a1a;
    emitColor = () => 0xffdd44;
  } else {
    // Ruins / default: torches
    lightColor = () => rng() > 0.3 ? 0xffaa44 : 0xff8833;
    lightIntensity = 5;
    lightDist = 20;
    lampColor = 0x3a2a3a;
    emitColor = () => 0xffaa44;
  }

  // Place lights every ~4 waypoints on alternating sides
  const spacing = Math.max(3, Math.floor(n / 20));
  for (let i = 0; i < n; i += spacing) {
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % n];
    const dx = next.x - curr.x;
    const dz = next.z - curr.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const sideX = -dz / len;
    const sideZ = dx / len;

    // Alternate sides
    const side = (i / spacing) % 2 === 0 ? 1 : -1;
    const dist = trackWidth * 0.6 + 1;
    const lx = curr.x + sideX * dist * side;
    const lz = curr.z + sideZ * dist * side;
    const ly = curr.y;

    const col = typeof lightColor === 'function' ? lightColor() : lightColor;

    // Point light
    const pointLight = new THREE.PointLight(col, lightIntensity, lightDist);
    pointLight.position.set(lx, ly + 4, lz);
    renderer.scene.add(pointLight);

    // Visual lamp post / light source mesh
    if (useLampPost) {
      const post = renderer.createToonMesh(_lampPostGeo, lampColor, { outlineWidth: 0.01 });
      post.position.set(lx, ly + 2.5, lz);
      renderer.scene.add(post);
    }

    const emCol = typeof emitColor === 'function' ? emitColor() : emitColor;
    const headMat = new THREE.MeshBasicMaterial({ color: emCol });
    const head = new THREE.Mesh(_lampHeadGeo, headMat);
    head.position.set(lx, ly + (useLampPost ? 5.1 : 1.5), lz);
    renderer.scene.add(head);
  }
}

// Shared scenery geometries
const _treeGeo = new THREE.ConeGeometry(2, 6, 6);
const _trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 2, 6);
const _rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
const _pillarGeo = new THREE.CylinderGeometry(0.8, 1.0, 8, 6);
const _buildingGeo = new THREE.BoxGeometry(4, 8, 4);
const _crystalGeo = new THREE.OctahedronGeometry(2, 0);
const _coralGeo = new THREE.CylinderGeometry(0.2, 0.8, 4, 5);
const _mushroomCapGeo = new THREE.SphereGeometry(1.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const _mushroomStemGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);

function buildScenery(renderer, circuit, waypoints, trackWidth) {
  const theme = circuit.theme?.toLowerCase() || '';
  const p = circuit.palette || {};
  const rng = mulberry32(circuit.id?.length || 7);

  // Place props along the track sides
  for (let i = 0; i < waypoints.length; i += 2) {
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % waypoints.length];
    const dx = next.x - curr.x;
    const dz = next.z - curr.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    // Perpendicular (side) direction
    const sideX = -dz / len;
    const sideZ = dx / len;

    // Place on both sides
    for (const side of [-1, 1]) {
      if (rng() > 0.6) continue; // skip some for variation
      const dist = trackWidth * 0.7 + rng() * 15;
      const x = curr.x + sideX * dist * side;
      const z = curr.z + sideZ * dist * side;
      const y = curr.y;

      placeSceneryProp(renderer, theme, p, x, y, z, rng);
    }
  }

  // Scatter distant props
  const center = waypoints.reduce((acc, wp) => { acc.x += wp.x; acc.z += wp.z; return acc; }, { x: 0, z: 0 });
  center.x /= waypoints.length;
  center.z /= waypoints.length;

  for (let i = 0; i < 80; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 100 + rng() * 200;
    const x = center.x + Math.cos(angle) * dist;
    const z = center.z + Math.sin(angle) * dist;
    placeSceneryProp(renderer, theme, p, x, -1, z, rng);
  }
}

function placeSceneryProp(renderer, theme, palette, x, y, z, rng) {
  const scale = 0.6 + rng() * 1.5;
  const rotY = rng() * Math.PI * 2;

  if (theme.includes('forest') || theme.includes('crystal')) {
    // Trees, crystals, mushrooms
    const r = rng();
    if (r < 0.35) {
      // Tree
      const trunk = renderer.createToonMesh(_trunkGeo, 0x5a3a1a, { outlineWidth: 0.02 });
      trunk.position.set(x, y + 1, z);
      trunk.scale.setScalar(scale);
      renderer.scene.add(trunk);
      const foliage = renderer.createToonMesh(_treeGeo, 0x226622, { outlineWidth: 0.03 });
      foliage.position.set(x, y + 4 * scale, z);
      foliage.scale.setScalar(scale);
      renderer.scene.add(foliage);
    } else if (r < 0.6) {
      // Crystal
      const crystal = renderer.createToonMesh(_crystalGeo, palette.crystal || palette.accent || 0x88ddff, { outlineWidth: 0.03 });
      crystal.position.set(x, y + 2 * scale, z);
      crystal.scale.set(scale * 0.6, scale * 1.5, scale * 0.6);
      crystal.rotation.y = rotY;
      renderer.scene.add(crystal);
    } else if (r < 0.8) {
      // Mushroom
      const stem = renderer.createToonMesh(_mushroomStemGeo, 0xccbb99, { outlineWidth: 0.02 });
      stem.position.set(x, y + 1 * scale, z);
      stem.scale.setScalar(scale);
      renderer.scene.add(stem);
      const cap = renderer.createToonMesh(_mushroomCapGeo, 0xcc3344, { outlineWidth: 0.02 });
      cap.position.set(x, y + 2.2 * scale, z);
      cap.scale.setScalar(scale * 1.2);
      renderer.scene.add(cap);
    } else {
      // Rock
      const rock = renderer.createToonMesh(_rockGeo, palette.walls || 0x555555, { outlineWidth: 0.02 });
      rock.position.set(x, y + 0.5 * scale, z);
      rock.scale.set(scale, scale * 0.7, scale);
      rock.rotation.set(rng(), rotY, rng() * 0.3);
      renderer.scene.add(rock);
    }
  } else if (theme.includes('neon') || theme.includes('cyber')) {
    // Buildings, neon pillars
    const r = rng();
    if (r < 0.5) {
      const h = 4 + rng() * 16;
      const building = renderer.createToonMesh(_buildingGeo, palette.walls || 0x333344, { outlineWidth: 0.03 });
      building.position.set(x, y + h / 2, z);
      building.scale.set(1 + rng(), h / 8, 1 + rng());
      renderer.scene.add(building);
    } else {
      const pillar = renderer.createToonMesh(_pillarGeo, palette.neon || palette.accent || 0x00ffcc, { outlineWidth: 0.03 });
      pillar.position.set(x, y + 4 * scale, z);
      pillar.scale.setScalar(scale * 0.6);
      renderer.scene.add(pillar);
    }
  } else if (theme.includes('volcan') || theme.includes('lava')) {
    // Rocks, lava pillars
    const r = rng();
    if (r < 0.6) {
      const rock = renderer.createToonMesh(_rockGeo, 0x443322, { outlineWidth: 0.02 });
      rock.position.set(x, y + 0.5 * scale, z);
      rock.scale.set(scale * 1.2, scale * 0.8, scale);
      rock.rotation.set(rng() * 0.3, rotY, 0);
      renderer.scene.add(rock);
    } else {
      const pillar = renderer.createToonMesh(_pillarGeo, palette.lava || 0xff3300, { outlineWidth: 0.03 });
      pillar.position.set(x, y + 3 * scale, z);
      pillar.scale.set(scale * 0.5, scale * 0.8, scale * 0.5);
      renderer.scene.add(pillar);
    }
  } else if (theme.includes('ocean') || theme.includes('reef') || theme.includes('water')) {
    // Coral, rocks, bubbles
    const r = rng();
    if (r < 0.5) {
      const coral = renderer.createToonMesh(_coralGeo, palette.accent || 0x00ccff, { outlineWidth: 0.02 });
      coral.position.set(x, y + 2 * scale, z);
      coral.scale.set(scale * 0.8, scale, scale * 0.8);
      renderer.scene.add(coral);
    } else {
      const rock = renderer.createToonMesh(_rockGeo, palette.walls || 0x2a3a4a, { outlineWidth: 0.02 });
      rock.position.set(x, y + 0.5 * scale, z);
      rock.scale.set(scale, scale * 0.6, scale);
      rock.rotation.y = rotY;
      renderer.scene.add(rock);
    }
  } else {
    // Ruins / generic: pillars, rocks
    const r = rng();
    if (r < 0.4) {
      const pillar = renderer.createToonMesh(_pillarGeo, palette.walls || 0x3a2a3a, { outlineWidth: 0.03 });
      pillar.position.set(x, y + 4 * scale, z);
      pillar.scale.setScalar(scale * 0.7);
      pillar.rotation.z = rng() * 0.2 - 0.1; // slightly tilted
      renderer.scene.add(pillar);
    } else {
      const rock = renderer.createToonMesh(_rockGeo, palette.walls || 0x555555, { outlineWidth: 0.02 });
      rock.position.set(x, y + 0.5 * scale, z);
      rock.scale.set(scale, scale * 0.7, scale);
      rock.rotation.y = rotY;
      renderer.scene.add(rock);
    }
  }
}

// --- Continuous track mesh builder ---

function buildContinuousTrackMesh(waypoints, trackWidth, material) {
  const n = waypoints.length;
  const halfW = trackWidth * 0.5;
  const CORNER_SUBDIVS = 6; // subdivisions per corner for smooth curves

  // 1. Compute smoothed perpendicular at each waypoint (average of adjacent segments)
  const perps = []; // { x, z } normalized perpendicular at each waypoint
  const segDirs = []; // direction vectors for each segment
  for (let i = 0; i < n; i++) {
    const next = waypoints[(i + 1) % n];
    const dx = next.x - waypoints[i].x;
    const dz = next.z - waypoints[i].z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    segDirs.push({ x: dx / len, z: dz / len });
  }

  for (let i = 0; i < n; i++) {
    const prev = segDirs[(i - 1 + n) % n];
    const curr = segDirs[i];
    // Average of incoming and outgoing direction
    let ax = prev.x + curr.x;
    let az = prev.z + curr.z;
    const al = Math.sqrt(ax * ax + az * az) || 1;
    ax /= al;
    az /= al;
    // Perpendicular (rotate 90°)
    perps.push({ x: -az, z: ax });
  }

  // 2. Generate the strip of vertices: for each waypoint, add subdivision points
  //    around the corner, then a cross-section at each sub-point
  const positions = [];
  const uvs = [];
  const indices = [];
  let vAlong = 0; // running V coordinate

  // Cross-section: multiple points across the width for smooth shading
  const CROSS_DIVS = 4; // divisions across width

  function addCrossSection(px, py, pz, perpX, perpZ, v) {
    for (let c = 0; c <= CROSS_DIVS; c++) {
      const t = c / CROSS_DIVS; // 0 = left, 1 = right
      const offset = (t - 0.5) * trackWidth;
      positions.push(
        px + perpX * offset,
        py + 0.02,
        pz + perpZ * offset
      );
      uvs.push(t, v);
    }
  }

  function addStripIndices(baseIdx) {
    // Connect current cross-section row to previous
    const stride = CROSS_DIVS + 1;
    const prev = baseIdx - stride;
    for (let c = 0; c < CROSS_DIVS; c++) {
      const bl = prev + c;
      const br = prev + c + 1;
      const tl = baseIdx + c;
      const tr = baseIdx + c + 1;
      indices.push(bl, tl, br);
      indices.push(br, tl, tr);
    }
  }

  // Start with first waypoint
  addCrossSection(
    waypoints[0].x, waypoints[0].y, waypoints[0].z,
    perps[0].x, perps[0].z, 0
  );
  let vertCount = CROSS_DIVS + 1;

  for (let i = 0; i < n; i++) {
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % n];
    const segLen = curr.distanceTo(next);

    // Subdivide the straight segment
    const straightDivs = Math.max(1, Math.ceil(segLen / 10));
    for (let s = 1; s <= straightDivs; s++) {
      const t = s / straightDivs;
      const px = curr.x + (next.x - curr.x) * t;
      const py = curr.y + (next.y - curr.y) * t;
      const pz = curr.z + (next.z - curr.z) * t;

      // Interpolate perpendicular
      const pi = perps[i];
      const pn = perps[(i + 1) % n];
      const lerpX = pi.x + (pn.x - pi.x) * t;
      const lerpZ = pi.z + (pn.z - pi.z) * t;
      const ll = Math.sqrt(lerpX * lerpX + lerpZ * lerpZ) || 1;

      vAlong += segLen / straightDivs / trackWidth; // UV scale relative to width

      addCrossSection(px, py, pz, lerpX / ll, lerpZ / ll, vAlong);
      addStripIndices(vertCount);
      vertCount += CROSS_DIVS + 1;
    }
  }

  // Close the loop: connect last row back to first row
  const stride = CROSS_DIVS + 1;
  const lastBase = vertCount - stride;
  for (let c = 0; c < CROSS_DIVS; c++) {
    const bl = lastBase + c;
    const br = lastBase + c + 1;
    const tl = c;
    const tr = c + 1;
    indices.push(bl, tl, br);
    indices.push(br, tl, tr);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return new THREE.Mesh(geo, material);
}

// --- Kart-to-kart collision resolution ---
const KART_RADIUS = 1.8; // collision radius per kart
const _collisionNormal = new THREE.Vector3();

function resolveKartCollisions(participants) {
  for (let i = 0; i < participants.length; i++) {
    const a = participants[i].kartController;
    if (a.phaseGhost) continue;

    for (let j = i + 1; j < participants.length; j++) {
      const b = participants[j].kartController;
      if (b.phaseGhost) continue;

      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const distSq = dx * dx + dz * dz;
      const minDist = KART_RADIUS * 2;

      if (distSq < minDist * minDist && distSq > 0.001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;

        // Collision normal from a to b
        _collisionNormal.set(dx / dist, 0, dz / dist);

        // Weight-based push ratio: lighter kart gets pushed more
        const wA = Math.max(a.weightFactor, 1);
        const wB = Math.max(b.weightFactor, 1);
        const totalW = wA + wB;
        const ratioA = wB / totalW; // how much A gets pushed (inverse of A's weight)
        const ratioB = wA / totalW;

        // Separate positions
        a.position.x -= _collisionNormal.x * overlap * ratioA;
        a.position.z -= _collisionNormal.z * overlap * ratioA;
        b.position.x += _collisionNormal.x * overlap * ratioB;
        b.position.z += _collisionNormal.z * overlap * ratioB;

        // Velocity exchange (elastic-ish bump)
        const relVelX = a.velocity.x - b.velocity.x;
        const relVelZ = a.velocity.z - b.velocity.z;
        const relDot = relVelX * _collisionNormal.x + relVelZ * _collisionNormal.z;

        // Only resolve if karts are moving toward each other
        if (relDot > 0) {
          const impulse = relDot * 0.8; // 0.8 = bounciness
          a.velocity.x -= _collisionNormal.x * impulse * ratioA;
          a.velocity.z -= _collisionNormal.z * impulse * ratioA;
          b.velocity.x += _collisionNormal.x * impulse * ratioB;
          b.velocity.z += _collisionNormal.z * impulse * ratioB;
        }

        // Sync meshes after position correction
        a._syncBody();
        a._syncMesh();
        b._syncBody();
        b._syncMesh();
      }
    }
  }
}

// Seedable PRNG for consistent scenery
function mulberry32(seed) {
  let t = seed;
  return function () {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function cleanupRace() {
  if (raceCleanup) raceCleanup();
}
