import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
import { getTrackWidthAtSegment } from '../utils/TrackWidth.js';

let animFrameId = null;
let raceCleanup = null;
let shaderUniforms = []; // all time-based shader uniforms to update each frame
let _fogOriginals = { near: 150, far: 400 }; // saved fog values for toggle
let _fogEnabled = true;
let volcanoParticles = []; // { points, velocities, origins, type } for animated volcano effects

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
  const { trackElements, groundPlaneY } = buildTrack(renderer, circuit);


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
    const cameras = renderer.setupSplitScreen(2, splitOrientation);
    humanCameras.push(...cameras);
  } else if (humanCount > 1) {
    const cameras = renderer.setupSplitScreen(humanCount, splitOrientation);
    humanCameras.push(...cameras);
  } else {
    renderer.resetSinglePlayer();
    humanCameras.push(renderer.camera);
  }

  // Rearview mirror camera (short far plane — only nearby karts matter)
  const rearviewCam = new THREE.PerspectiveCamera(95, 4, 0.1, 100);
  let rearviewFrameCounter = 0;

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

  // Set ground plane Y on all karts for off-road ground collision
  for (const p of participants) {
    p.kartController._groundPlaneY = groundPlaneY;
  }

  // Systems
  const raceManager = new RaceManager(circuit, participants);
  const itemSystem = new ItemSystem(renderer.scene, circuit, participants);
  itemSystem.listenerPos = humanKarts[0]?.position || null;
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

  // Crew mode: request pointer lock on click, attach weapon model, show HUD
  if (isCrewMode) {
    const canvas = document.getElementById('game-canvas');
    const _requestLock = () => { inputManager.requestPointerLock(); };
    canvas?.addEventListener('click', _requestLock);

    // Attach FPS weapon barrel to gunner camera
    const gunCam = humanCameras[1];
    const wpnBarrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
    const wpnBarrelMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const wpnBarrel = new THREE.Mesh(wpnBarrelGeo, wpnBarrelMat);
    wpnBarrel.rotation.x = Math.PI / 2;
    wpnBarrel.position.set(0.15, -0.25, -0.8);
    gunCam.add(wpnBarrel);
    renderer.scene.add(gunCam);

    // Hide the kart-attached turret mesh (we use the FPS weapon model instead)
    turretController.mesh.visible = false;

    // Gunner HUD — get viewport config for P2
    const vp = renderer.viewports[1];
    _createGunnerHUD(vp);
  }

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
  const _hudData = {
    position: 1, lap: 0, maxLaps: circuit.defaultLaps, timer: 0,
    speed: 0, itemName: '', countdown: undefined, participants, waypoints: circuit.waypoints
  };

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

      // Crew mode: driver uses P1 keyboard, gunner aims with mouse
      if (isCrewMode && turretController) {
        const driverInput = inputManager.getPlayerState(0);
        if (driverInput.useItem) {
          itemSystem.useItem('player-0');
        }
        // Mouse delta drives gunner camera yaw/pitch (stored on turret)
        const mouse = inputManager.getMouseState();
        const mouseDelta = inputManager.consumeMouseDelta();
        if (mouse.locked) {
          const sens = 0.003;
          turretController.yaw = Math.max(-turretController.maxYaw,
            Math.min(turretController.maxYaw, turretController.yaw - mouseDelta.dx * sens));
          turretController.pitch = Math.max(-turretController.maxPitch,
            Math.min(turretController.maxPitch, turretController.pitch - mouseDelta.dy * sens));
        }
        // Sync turret mesh to yaw/pitch
        turretController.mesh.rotation.y = turretController.yaw;
        turretController.mesh.children.forEach(child => {
          if (child.geometry?.type === 'CylinderGeometry') {
            child.rotation.x = Math.PI / 2 + turretController.pitch;
          }
        });
        // Fire on click (only when pointer is locked), rate limited by kart weight
        turretController._fireCooldown = (turretController._fireCooldown || 0) - delta;
        if (mouse.locked && mouse.leftButton && !turretController._wasFiring && turretController._fireCooldown <= 0) {
          _fireTurret(turretController, itemSystem);
          // Heavy karts: slower fire rate, light karts: faster
          const weight = turretController.kart.weightFactor || 3;
          turretController._fireCooldown = 0.3 + weight * 0.15;
        }
        turretController._wasFiring = mouse.leftButton;
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

      // Track elements (ramps, boosts, slowdowns)
      checkTrackElements(trackElements, participants, delta);

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

    // Animate volcano particles
    for (const vp of volcanoParticles) {
      _updateVolcanoParticles(vp, delta);
    }

    // Update cameras
    if (isCrewMode && turretController) {
      const driverInput = inputManager.getPlayerState(0);
      updateCockpitCamera(humanCameras[0], humanKarts[0], driverInput);
      // Gunner camera: positioned at turret, looking along turret direction
      const kart = humanKarts[0];
      const gunCam = humanCameras[1];
      const turretPos = turretController.getWorldPosition();
      gunCam.position.copy(turretPos);
      // Camera rotation: kart yaw + turret yaw, turret pitch
      gunCam.rotation.order = 'YXZ';
      gunCam.rotation.set(turretController.pitch, kart.yaw + turretController.yaw + Math.PI, 0);
      gunCam.fov = 70;
      gunCam.updateProjectionMatrix();
      // Update gunner HUD
      _updateGunnerHUD(turretController, itemSystem.heldItems.get('player-0'));
    } else {
      for (let i = 0; i < humanKarts.length; i++) {
        const pInput = inputManager.getPlayerState(i);
        updateCockpitCamera(humanCameras[i], humanKarts[i], pInput);
      }
    }

    // Shadow light follows player
    renderer.updateLightTarget(humanKarts[0].position);

    renderer.render();

    // Rearview mirror render (every 3rd frame, hide weather particles)
    rearviewFrameCounter++;
    if (humanKarts.length > 0 && rearviewFrameCounter % 3 === 0) {
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
      if (weatherSystem.particles) weatherSystem.particles.visible = false;
      renderer.renderRearview(rearviewCam, { x: mx, y: my, w: mw, h: mh });
      if (weatherSystem.particles) weatherSystem.particles.visible = true;
    }

    // HUD (show P1 data for now, multi-player HUD is per-viewport overlay)
    const pData = raceManager.getParticipantData('player-0');
    _hudData.position = raceManager.getPosition('player-0');
    _hudData.lap = pData?.lapCount || 0;
    _hudData.timer = raceManager.timer;
    _hudData.speed = humanKarts[0].speed;
    _hudData.itemName = itemSystem.getItemName(itemSystem.getHeldItem('player-0'));
    _hudData.countdown = raceManager.isCountdown() ? raceManager.countdown : undefined;
    updateHUD(_hudData);

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

const _rearviewLookAt = new THREE.Vector3();
const _camEuler = new THREE.Euler();
const _camOffset = new THREE.Vector3();

function updateCockpitCamera(camera, kart, input) {
  const lookBehind = input?.lookBehind || false;
  const lookX = input?.lookX || 0;
  const lookY = input?.lookY || 0;
  const pitch = kart.pitchAngle || 0;
  const yaw = kart.yaw;

  // Copy orientation directly from kart mesh (YXZ order like the mesh)
  _camEuler.set(pitch, yaw, 0, 'YXZ');

  // Offset camera up in kart's local space, then to world
  _camOffset.set(0, 1.8, 0);
  _camOffset.applyEuler(_camEuler);
  camera.position.set(
    kart.position.x + _camOffset.x,
    kart.position.y + _camOffset.y,
    kart.position.z + _camOffset.z
  );

  // Apply kart rotation + stick look offsets + look behind
  const behind = lookBehind;
  const yawFlip = behind ? 0 : Math.PI;
  const pitchSign = behind ? 1 : -1;
  camera.rotation.order = 'YXZ';
  camera.rotation.set(pitchSign * pitch - lookY * 0.8, yaw + yawFlip - lookX * 2.1, 0);

  // Fish-eye effect: FOV increases with speed
  const speedRatio = Math.min((kart.speed || 0) / (kart.baseMaxSpeed * 0.5 || 80), 2.0);
  const baseFov = 70;
  const maxFovBoost = 100;
  camera.fov = Math.min(150, baseFov + speedRatio * maxFovBoost);
  camera.updateProjectionMatrix();
}

// --- Shared kart geometries ---
// Wheels & rims
const _wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
const _bigWheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12);
const _trackWheelGeo = new THREE.BoxGeometry(0.4, 0.3, 2.4);
const _rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.26, 6);
const _bigRimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 6);
const _hubCapGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8);
const _wheelArchGeo = new THREE.TorusGeometry(0.38, 0.06, 4, 8, Math.PI);
const _bigWheelArchGeo = new THREE.TorusGeometry(0.48, 0.07, 4, 8, Math.PI);
// Bodies
const _standardBodyGeo = new THREE.BoxGeometry(2, 0.6, 3);
const _sleekBodyGeo = new THREE.BoxGeometry(1.6, 0.4, 3.4);
const _heavyBodyGeo = new THREE.BoxGeometry(2.4, 0.8, 3.2);
const _wideBodyGeo = new THREE.BoxGeometry(2.2, 0.5, 2.8);
// Cockpits
const _standardCockpitGeo = new THREE.BoxGeometry(1.2, 0.5, 1.0);
const _sportCockpitGeo = new THREE.BoxGeometry(1.0, 0.4, 0.8);
const _domeGeo = new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
// Lights
const _headlightGeo = new THREE.SphereGeometry(0.1, 6, 6);
const _taillightGeo = new THREE.BoxGeometry(0.25, 0.12, 0.06);
const _brakeLightGeo = new THREE.BoxGeometry(0.8, 0.08, 0.04);
// Grille & intake
const _grilleGeo = new THREE.BoxGeometry(1.2, 0.25, 0.08);
const _grilleSlotGeo = new THREE.BoxGeometry(0.18, 0.04, 0.09);
const _airIntakeGeo = new THREE.BoxGeometry(0.5, 0.2, 0.3);
const _scoopGeo = new THREE.BoxGeometry(0.4, 0.15, 0.5);
// Windshield & mirrors
const _windshieldGeo = new THREE.BoxGeometry(1.1, 0.5, 0.06);
const _sportWindshieldGeo = new THREE.BoxGeometry(0.9, 0.35, 0.05);
const _mirrorArmGeo = new THREE.BoxGeometry(0.3, 0.04, 0.04);
const _mirrorGeo = new THREE.BoxGeometry(0.15, 0.1, 0.04);
// Dashboard
const _dashboardGeo = new THREE.BoxGeometry(1.0, 0.15, 0.4);
const _steeringWheelGeo = new THREE.TorusGeometry(0.12, 0.02, 4, 8);
const _steeringColumnGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 4);
const _gaugeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8);
// Details
const _spoilerGeo = new THREE.BoxGeometry(1.8, 0.08, 0.4);
const _spoilerPostGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
const _exhaustGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 8);
const _smallExhaustGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.35, 6);
const _noseGeo = new THREE.ConeGeometry(0.3, 0.8, 6);
const _sideSkirtGeo = new THREE.BoxGeometry(0.15, 0.2, 2.6);
const _hoverPadGeo = new THREE.CylinderGeometry(0.6, 0.5, 0.12, 8);
const _hoverGlowGeo = new THREE.CylinderGeometry(0.45, 0.35, 0.04, 8);
const _antennaGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4);
const _antennaTipGeo = new THREE.SphereGeometry(0.08, 6, 6);
const _engineBlockGeo = new THREE.BoxGeometry(1.0, 0.4, 0.6);
const _enginePipeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
const _engineRibGeo = new THREE.BoxGeometry(1.05, 0.06, 0.08);
const _rollBarGeo = new THREE.TorusGeometry(0.5, 0.04, 6, 12, Math.PI);
const _bumperGeo = new THREE.BoxGeometry(2.0, 0.2, 0.15);
const _rearBumperGeo = new THREE.BoxGeometry(1.8, 0.15, 0.1);
const _finGeo = new THREE.BoxGeometry(0.06, 0.5, 0.8);
const _panelLineGeo = new THREE.BoxGeometry(0.02, 0.02, 2.6);
const _hoodScoopGeo = new THREE.BoxGeometry(0.4, 0.12, 0.6);
const _floorPanGeo = new THREE.BoxGeometry(1.8, 0.04, 2.8);
const _seatGeo = new THREE.BoxGeometry(0.5, 0.5, 0.4);
const _seatBackGeo = new THREE.BoxGeometry(0.5, 0.5, 0.08);
const _treadSegGeo = new THREE.BoxGeometry(0.42, 0.06, 0.15);
const _trackGuardGeo = new THREE.BoxGeometry(0.5, 0.15, 2.5);
const _turretRingGeo = new THREE.TorusGeometry(0.3, 0.04, 6, 10);
const _thruNozzleGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
const _energyRingGeo = new THREE.TorusGeometry(0.5, 0.03, 6, 12);
const _sideVentGeo = new THREE.BoxGeometry(0.08, 0.15, 0.4);

/**
 * Merge all meshes in a kart group by material color to reduce draw calls.
 * ~40-60 meshes per kart → ~5-10 merged meshes (one per unique color).
 */
const _mergeMatrix = new THREE.Matrix4();
function mergeKartGroup(renderer, group) {
  const byColor = new Map(); // hex -> [BufferGeometry]

  // Collect all meshes, handling both direct Mesh children and Group wrappers
  for (const child of group.children) {
    const meshes = [];
    if (child.isMesh) {
      meshes.push(child);
    } else if (child.isGroup) {
      // Preview renderer wraps each mesh in a Group (main + outline)
      for (const sub of child.children) {
        if (sub.isMesh && sub.material.side !== THREE.BackSide) meshes.push(sub);
      }
    }
    for (const mesh of meshes) {
      if (!mesh.geometry || !mesh.material.color) continue;
      const hex = mesh.material.color.getHex();
      if (!byColor.has(hex)) byColor.set(hex, []);
      const geo = mesh.geometry.clone();
      // Build world matrix from mesh + its parent (if in a sub-group)
      mesh.updateMatrix();
      if (mesh.parent !== group) {
        mesh.parent.updateMatrix();
        _mergeMatrix.copy(mesh.parent.matrix).multiply(mesh.matrix);
      } else {
        _mergeMatrix.copy(mesh.matrix);
      }
      geo.applyMatrix4(_mergeMatrix);
      byColor.get(hex).push(geo);
    }
  }

  // Remove all old children
  while (group.children.length) group.remove(group.children[0]);

  // Create one merged mesh per color
  for (const [hex, geos] of byColor) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!merged) continue;
    const mesh = renderer.createToonMesh(merged, hex);
    group.add(mesh);
  }

  group.castShadow = true;
  return group;
}

export function createKartMesh(renderer, character) {
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

  // Floor pan
  const floor = renderer.createToonMesh(_floorPanGeo, 0x1a1a1a, { outlineWidth: 0.01 });
  floor.position.y = 0.22;
  group.add(floor);

  // Body
  const bodyGeo = heavy ? _heavyBodyGeo : (light ? _sleekBodyGeo : _standardBodyGeo);
  const body = renderer.createToonMesh(bodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = heavy ? 0.55 : 0.5;
  group.add(body);

  // Panel lines (body seams)
  for (const side of [-0.45, 0.45]) {
    const line = renderer.createToonMesh(_panelLineGeo, 0x111111, { outlineWidth: 0 });
    line.position.set(side, heavy ? 0.86 : 0.81, 0);
    group.add(line);
  }

  // Hood scoop (front top)
  if (!light) {
    const scoop = renderer.createToonMesh(_hoodScoopGeo, col, { outlineWidth: 0.02 });
    scoop.position.set(0, heavy ? 0.96 : 0.82, 0.7);
    group.add(scoop);
  }

  // Front grille
  const grille = renderer.createToonMesh(_grilleGeo, 0x111111, { outlineWidth: 0.02 });
  grille.position.set(0, heavy ? 0.45 : 0.4, heavy ? 1.61 : (light ? 1.71 : 1.51));
  group.add(grille);
  // Grille slots
  for (let i = -2; i <= 2; i++) {
    const slot = renderer.createToonMesh(_grilleSlotGeo, 0x080808, { outlineWidth: 0 });
    slot.position.set(i * 0.22, grille.position.y, grille.position.z + 0.01);
    group.add(slot);
  }

  // Headlights
  for (const side of [-0.5, 0.5]) {
    const hl = renderer.createToonMesh(_headlightGeo, 0xffffcc, { outlineWidth: 0.01 });
    hl.position.set(side, heavy ? 0.65 : 0.55, grille.position.z + 0.02);
    group.add(hl);
  }

  // Taillights
  for (const side of [-0.4, 0.4]) {
    const tl = renderer.createToonMesh(_taillightGeo, 0xcc0000, { outlineWidth: 0.01 });
    tl.position.set(side, heavy ? 0.65 : 0.55, heavy ? -1.61 : (light ? -1.71 : -1.51));
    group.add(tl);
  }
  // Center brake light
  const brake = renderer.createToonMesh(_brakeLightGeo, 0xaa0000, { outlineWidth: 0.01 });
  brake.position.set(0, heavy ? 0.96 : 0.81, heavy ? -1.61 : (light ? -1.71 : -1.51));
  group.add(brake);

  // Rear bumper
  const rBumper = renderer.createToonMesh(_rearBumperGeo, 0x333333, { outlineWidth: 0.01 });
  rBumper.position.set(0, 0.28, heavy ? -1.62 : (light ? -1.72 : -1.52));
  group.add(rBumper);

  // Windshield
  const wsGeo = light ? _sportWindshieldGeo : _windshieldGeo;
  const ws = renderer.createToonMesh(wsGeo, 0x88aacc, { outlineWidth: 0.01 });
  ws.rotation.x = -0.25;
  ws.position.set(0, heavy ? 1.3 : 1.15, 0.3);
  group.add(ws);

  // Side mirrors
  for (const side of [-0.65, 0.65]) {
    const arm = renderer.createToonMesh(_mirrorArmGeo, 0x333333, { outlineWidth: 0 });
    arm.position.set(side * 1.3, heavy ? 1.0 : 0.85, 0.3);
    group.add(arm);
    const mirror = renderer.createToonMesh(_mirrorGeo, 0x88aacc, { outlineWidth: 0.01 });
    mirror.position.set(side * 1.45, heavy ? 1.0 : 0.85, 0.3);
    group.add(mirror);
  }

  // Dashboard
  const dash = renderer.createToonMesh(_dashboardGeo, 0x222222, { outlineWidth: 0.01 });
  dash.position.set(0, heavy ? 1.05 : 0.9, 0.2);
  group.add(dash);
  // Steering wheel
  const stCol = renderer.createToonMesh(_steeringColumnGeo, 0x333333, { outlineWidth: 0 });
  stCol.rotation.x = -0.5;
  stCol.position.set(0, heavy ? 1.15 : 1.0, 0.15);
  group.add(stCol);
  const stWheel = renderer.createToonMesh(_steeringWheelGeo, 0x222222, { outlineWidth: 0.01 });
  stWheel.rotation.x = -0.5;
  stWheel.position.set(0, heavy ? 1.22 : 1.07, 0.1);
  group.add(stWheel);
  // Gauges
  for (const gx of [-0.2, 0.0, 0.2]) {
    const gauge = renderer.createToonMesh(_gaugeGeo, 0x115533, { outlineWidth: 0 });
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(gx, heavy ? 1.13 : 0.98, 0.35);
    group.add(gauge);
  }

  // Seat
  const seat = renderer.createToonMesh(_seatGeo, 0x222222, { outlineWidth: 0.01 });
  seat.position.set(0, heavy ? 0.95 : 0.8, -0.4);
  group.add(seat);
  const seatBack = renderer.createToonMesh(_seatBackGeo, 0x222222, { outlineWidth: 0.01 });
  seatBack.position.set(0, heavy ? 1.2 : 1.05, -0.56);
  group.add(seatBack);

  // Wheels with rims and arches
  const wGeo = heavy ? _bigWheelGeo : _wheelGeo;
  const rGeo = heavy ? _bigRimGeo : _rimGeo;
  const archGeo = heavy ? _bigWheelArchGeo : _wheelArchGeo;
  const positions = heavy
    ? [[-1.1, 0.45, 1.1], [1.1, 0.45, 1.1], [-1.1, 0.45, -1.1], [1.1, 0.45, -1.1]]
    : [[-0.9, 0.35, 1.0], [0.9, 0.35, 1.0], [-0.9, 0.35, -1.0], [0.9, 0.35, -1.0]];
  for (const [x, y, z] of positions) {
    const wheel = renderer.createToonMesh(wGeo, 0x222222, { outlineWidth: 0.02 });
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
    // Rim
    const rim = renderer.createToonMesh(rGeo, 0x999999, { outlineWidth: 0.01 });
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x > 0 ? x + 0.02 : x - 0.02, y, z);
    group.add(rim);
    // Hub cap
    const hub = renderer.createToonMesh(_hubCapGeo, acc, { outlineWidth: 0 });
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x > 0 ? x + 0.13 : x - 0.13, y, z);
    group.add(hub);
    // Wheel arch
    const arch = renderer.createToonMesh(archGeo, col, { outlineWidth: 0.01 });
    arch.rotation.z = x > 0 ? 0 : Math.PI;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x > 0 ? x - 0.15 : x + 0.15, y + 0.1, z);
    group.add(arch);
  }

  // Side vents
  for (const side of [-1.0, 1.0]) {
    for (let i = 0; i < 3; i++) {
      const vent = renderer.createToonMesh(_sideVentGeo, 0x111111, { outlineWidth: 0 });
      vent.position.set(side * (heavy ? 1.21 : 1.01), heavy ? 0.6 : 0.5, -0.2 + i * 0.25);
      group.add(vent);
    }
  }

  // Light karts: spoiler + side skirts + air intake
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
    // Rear air intake
    const intake = renderer.createToonMesh(_airIntakeGeo, 0x222222, { outlineWidth: 0.01 });
    intake.position.set(0, 0.95, -1.2);
    group.add(intake);
  }

  // Heavy karts: bumper + engine block + exhaust pipes + engine ribs
  if (heavy) {
    const bumper = renderer.createToonMesh(_bumperGeo, 0x333333, { outlineWidth: 0.02 });
    bumper.position.set(0, 0.4, 1.65);
    group.add(bumper);
    const engine = renderer.createToonMesh(_engineBlockGeo, 0x444444, { outlineWidth: 0.02 });
    engine.position.set(0, 1.15, -1.2);
    group.add(engine);
    // Engine ribs
    for (let i = -1; i <= 1; i++) {
      const rib = renderer.createToonMesh(_engineRibGeo, 0x555555, { outlineWidth: 0 });
      rib.position.set(0, 1.36, -1.2 + i * 0.15);
      group.add(rib);
    }
    // Engine pipes
    for (const side of [-0.35, 0.35]) {
      const pipe = renderer.createToonMesh(_enginePipeGeo, 0x666666, { outlineWidth: 0.01 });
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(side, 1.25, -0.9);
      group.add(pipe);
    }
    for (const side of [-0.35, 0.35]) {
      const exhaust = renderer.createToonMesh(_exhaustGeo, 0x333333, { outlineWidth: 0.01 });
      exhaust.rotation.x = -Math.PI / 4;
      exhaust.position.set(side, 1.1, -1.7);
      group.add(exhaust);
    }
  }

  // Mid-weight: roll bar + exhaust + scoop
  if (!heavy && !light) {
    const rollBar = renderer.createToonMesh(_rollBarGeo, 0x555555, { outlineWidth: 0.02 });
    rollBar.rotation.y = Math.PI / 2;
    rollBar.position.set(0, 1.2, -0.2);
    group.add(rollBar);
    const exhaust = renderer.createToonMesh(_exhaustGeo, 0x333333, { outlineWidth: 0.01 });
    exhaust.rotation.x = -Math.PI / 5;
    exhaust.position.set(0.5, 0.7, -1.6);
    group.add(exhaust);
    // Second exhaust
    const exhaust2 = renderer.createToonMesh(_smallExhaustGeo, 0x333333, { outlineWidth: 0.01 });
    exhaust2.rotation.x = -Math.PI / 5;
    exhaust2.position.set(-0.5, 0.7, -1.6);
    group.add(exhaust2);
    // Top scoop
    const scoop = renderer.createToonMesh(_scoopGeo, acc, { outlineWidth: 0.01 });
    scoop.position.set(0, 1.05, 0.6);
    group.add(scoop);
  }

  return mergeKartGroup(renderer, group);
}

function buildHoverKart(renderer, col, acc) {
  const group = new THREE.Group();

  // Floor pan
  const floor = renderer.createToonMesh(_floorPanGeo, 0x1a1a1a, { outlineWidth: 0.01 });
  floor.position.y = 0.52;
  group.add(floor);

  // Sleek flat body
  const body = renderer.createToonMesh(_sleekBodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = 0.7;
  group.add(body);

  // Panel lines
  for (const side of [-0.35, 0.35]) {
    const line = renderer.createToonMesh(_panelLineGeo, 0x111111, { outlineWidth: 0 });
    line.position.set(side, 0.91, 0);
    group.add(line);
  }

  // (dome cockpit removed — obstructs cockpit camera and preview)

  // Windshield (curved, angled)
  const ws = renderer.createToonMesh(_sportWindshieldGeo, 0x88ccee, { outlineWidth: 0.01 });
  ws.rotation.x = -0.3;
  ws.position.set(0, 1.15, 0.35);
  group.add(ws);

  // Dashboard
  const dash = renderer.createToonMesh(_dashboardGeo, 0x222222, { outlineWidth: 0.01 });
  dash.position.set(0, 0.95, 0.2);
  group.add(dash);
  // Gauges (holographic style)
  for (const gx of [-0.15, 0.15]) {
    const gauge = renderer.createToonMesh(_gaugeGeo, 0x00ffaa, { outlineWidth: 0 });
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(gx, 1.03, 0.35);
    group.add(gauge);
  }

  // Seat
  const seat = renderer.createToonMesh(_seatGeo, 0x333333, { outlineWidth: 0.01 });
  seat.position.set(0, 0.85, -0.35);
  group.add(seat);
  const seatBack = renderer.createToonMesh(_seatBackGeo, 0x333333, { outlineWidth: 0.01 });
  seatBack.position.set(0, 1.1, -0.52);
  group.add(seatBack);

  // Hover pads with glow rings
  const padPositions = [[-0.7, 0.35, 1.0], [0.7, 0.35, 1.0], [-0.7, 0.35, -1.0], [0.7, 0.35, -1.0]];
  for (const [x, y, z] of padPositions) {
    const pad = renderer.createToonMesh(_hoverPadGeo, acc, { outlineWidth: 0.02 });
    pad.position.set(x, y, z);
    group.add(pad);
    // Glow underside
    const glow = renderer.createToonMesh(_hoverGlowGeo, 0x00ffff, { outlineWidth: 0 });
    glow.position.set(x, y - 0.08, z);
    group.add(glow);
  }

  // Energy ring (central hover ring under body)
  const eRing = renderer.createToonMesh(_energyRingGeo, 0x00ffcc, { outlineWidth: 0.01 });
  eRing.position.set(0, 0.4, 0);
  group.add(eRing);

  // Headlights
  for (const side of [-0.45, 0.45]) {
    const hl = renderer.createToonMesh(_headlightGeo, 0xccffee, { outlineWidth: 0.01 });
    hl.position.set(side, 0.75, 1.72);
    group.add(hl);
  }

  // Taillights (glowing bars)
  for (const side of [-0.35, 0.35]) {
    const tl = renderer.createToonMesh(_taillightGeo, 0x00aaff, { outlineWidth: 0.01 });
    tl.position.set(side, 0.75, -1.72);
    group.add(tl);
  }

  // Side fins (taller, with accent stripe)
  for (const side of [-0.85, 0.85]) {
    const fin = renderer.createToonMesh(_finGeo, acc, { outlineWidth: 0.01 });
    fin.position.set(side, 0.9, -1.2);
    group.add(fin);
    // Accent stripe on fin
    const stripe = renderer.createToonMesh(
      new THREE.BoxGeometry(0.07, 0.08, 0.6), 0x00ffcc, { outlineWidth: 0 }
    );
    stripe.position.set(side, 1.1, -1.2);
    group.add(stripe);
  }

  // Thruster nozzles (rear)
  for (const side of [-0.3, 0.3]) {
    const nozzle = renderer.createToonMesh(_thruNozzleGeo, 0x555555, { outlineWidth: 0.01 });
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side, 0.65, -1.8);
    group.add(nozzle);
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

  // Side vents (energy slits)
  for (const side of [-0.81, 0.81]) {
    for (let i = 0; i < 2; i++) {
      const vent = renderer.createToonMesh(_sideVentGeo, 0x00ddaa, { outlineWidth: 0 });
      vent.position.set(side, 0.7, 0.3 + i * 0.35);
      group.add(vent);
    }
  }

  return mergeKartGroup(renderer, group);
}

function buildTrackedKart(renderer, col, acc, weight) {
  const group = new THREE.Group();

  // Floor pan
  const floor = renderer.createToonMesh(_floorPanGeo, 0x1a1a1a, { outlineWidth: 0.01 });
  floor.position.y = 0.22;
  group.add(floor);

  // Wide heavy body
  const body = renderer.createToonMesh(_heavyBodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = 0.6;
  group.add(body);

  // Panel lines
  for (const side of [-0.55, 0.55]) {
    const line = renderer.createToonMesh(_panelLineGeo, 0x111111, { outlineWidth: 0 });
    line.position.set(side, 1.01, 0);
    group.add(line);
  }

  // Hood scoop (armored look)
  const scoop = renderer.createToonMesh(_hoodScoopGeo, 0x444444, { outlineWidth: 0.02 });
  scoop.position.set(0, 1.02, 0.8);
  group.add(scoop);

  // Front grille (heavy armored)
  const grille = renderer.createToonMesh(_grilleGeo, 0x111111, { outlineWidth: 0.02 });
  grille.position.set(0, 0.5, 1.61);
  group.add(grille);

  // Headlights (armored, inset)
  for (const side of [-0.55, 0.55]) {
    const hl = renderer.createToonMesh(_headlightGeo, 0xffeeaa, { outlineWidth: 0.01 });
    hl.position.set(side, 0.7, 1.62);
    group.add(hl);
  }

  // Taillights
  for (const side of [-0.5, 0.5]) {
    const tl = renderer.createToonMesh(_taillightGeo, 0xcc0000, { outlineWidth: 0.01 });
    tl.position.set(side, 0.7, -1.62);
    group.add(tl);
  }

  // (armored cockpit removed — obstructs cockpit camera and preview)

  // Windshield (narrow slit, armored)
  const ws = renderer.createToonMesh(new THREE.BoxGeometry(1.0, 0.25, 0.06), 0x88aacc, { outlineWidth: 0.01 });
  ws.rotation.x = -0.15;
  ws.position.set(0, 1.38, 0.35);
  group.add(ws);

  // Dashboard
  const dash = renderer.createToonMesh(_dashboardGeo, 0x222222, { outlineWidth: 0.01 });
  dash.position.set(0, 1.1, 0.2);
  group.add(dash);
  const stWheel = renderer.createToonMesh(_steeringWheelGeo, 0x222222, { outlineWidth: 0.01 });
  stWheel.rotation.x = -0.4;
  stWheel.position.set(0, 1.22, 0.1);
  group.add(stWheel);

  // Seat
  const seat = renderer.createToonMesh(_seatGeo, 0x222222, { outlineWidth: 0.01 });
  seat.position.set(0, 1.0, -0.35);
  group.add(seat);
  const seatBack = renderer.createToonMesh(_seatBackGeo, 0x222222, { outlineWidth: 0.01 });
  seatBack.position.set(0, 1.25, -0.52);
  group.add(seatBack);

  // Tank treads (left and right) with tread segments
  for (const side of [-1.2, 1.2]) {
    const track = renderer.createToonMesh(_trackWheelGeo, 0x222222, { outlineWidth: 0.02 });
    track.position.set(side, 0.3, 0);
    group.add(track);
    // Track guard (fender over tread)
    const guard = renderer.createToonMesh(_trackGuardGeo, col, { outlineWidth: 0.02 });
    guard.position.set(side, 0.53, 0);
    group.add(guard);
    // Tread segments on top
    for (let z = -1.0; z <= 1.0; z += 0.3) {
      const seg = renderer.createToonMesh(_treadSegGeo, 0x333333, { outlineWidth: 0 });
      seg.position.set(side, 0.47, z);
      group.add(seg);
    }
    // Rollers
    for (let z = -0.9; z <= 0.9; z += 0.6) {
      const roller = renderer.createToonMesh(_wheelGeo, 0x333333, { outlineWidth: 0.01 });
      roller.rotation.z = Math.PI / 2;
      roller.position.set(side, 0.3, z);
      group.add(roller);
    }
    // Drive sprocket (front and rear of track)
    for (const tz of [-1.15, 1.15]) {
      const sprocket = renderer.createToonMesh(_hubCapGeo, 0x555555, { outlineWidth: 0.01 });
      sprocket.rotation.z = Math.PI / 2;
      sprocket.position.set(side, 0.3, tz);
      group.add(sprocket);
    }
  }

  // Front bumper (heavy, armored)
  const bumper = renderer.createToonMesh(_bumperGeo, 0x444444, { outlineWidth: 0.02 });
  bumper.position.set(0, 0.35, 1.65);
  group.add(bumper);
  // Rear bumper
  const rBumper = renderer.createToonMesh(_rearBumperGeo, 0x444444, { outlineWidth: 0.01 });
  rBumper.position.set(0, 0.35, -1.62);
  group.add(rBumper);

  // Turret ring on top (decorative)
  const turret = renderer.createToonMesh(_turretRingGeo, 0x555555, { outlineWidth: 0.01 });
  turret.position.set(0, 1.46, -0.1);
  group.add(turret);

  // Dual exhaust (thick, industrial)
  for (const side of [-0.4, 0.4]) {
    const exhaust = renderer.createToonMesh(_exhaustGeo, 0x333333, { outlineWidth: 0.01 });
    exhaust.rotation.x = -Math.PI / 3;
    exhaust.position.set(side, 1.1, -1.7);
    group.add(exhaust);
  }

  // Engine block on top with ribs and pipes
  const engine = renderer.createToonMesh(_engineBlockGeo, 0x444444, { outlineWidth: 0.02 });
  engine.position.set(0, 1.25, -1.0);
  group.add(engine);
  for (let i = -1; i <= 1; i++) {
    const rib = renderer.createToonMesh(_engineRibGeo, 0x555555, { outlineWidth: 0 });
    rib.position.set(0, 1.46, -1.0 + i * 0.15);
    group.add(rib);
  }
  for (const side of [-0.4, 0.4]) {
    const pipe = renderer.createToonMesh(_enginePipeGeo, 0x666666, { outlineWidth: 0.01 });
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(side, 1.35, -0.7);
    group.add(pipe);
  }

  // Side vents (industrial)
  for (const side of [-1.21, 1.21]) {
    for (let i = 0; i < 3; i++) {
      const vent = renderer.createToonMesh(_sideVentGeo, 0x111111, { outlineWidth: 0 });
      vent.position.set(side, 0.65, -0.3 + i * 0.3);
      group.add(vent);
    }
  }

  return mergeKartGroup(renderer, group);
}

function buildHybridKart(renderer, col, acc) {
  const group = new THREE.Group();

  // Floor pan
  const floor = renderer.createToonMesh(_floorPanGeo, 0x1a1a1a, { outlineWidth: 0.01 });
  floor.position.y = 0.22;
  group.add(floor);

  // Rounded-ish body (slightly wide)
  const body = renderer.createToonMesh(_wideBodyGeo, col, { outlineWidth: 0.04 });
  body.position.y = 0.5;
  group.add(body);

  // Panel lines
  for (const side of [-0.5, 0.5]) {
    const line = renderer.createToonMesh(_panelLineGeo, 0x111111, { outlineWidth: 0 });
    line.position.set(side, 0.76, 0);
    group.add(line);
  }

  // Front grille (sporty)
  const grille = renderer.createToonMesh(_grilleGeo, 0x111111, { outlineWidth: 0.02 });
  grille.position.set(0, 0.4, 1.41);
  group.add(grille);

  // Headlights
  for (const side of [-0.5, 0.5]) {
    const hl = renderer.createToonMesh(_headlightGeo, 0xffffff, { outlineWidth: 0.01 });
    hl.position.set(side, 0.55, 1.42);
    group.add(hl);
  }

  // Taillights (split between traditional and energy-style)
  for (const side of [-0.4, 0.4]) {
    const tl = renderer.createToonMesh(_taillightGeo, 0xcc3300, { outlineWidth: 0.01 });
    tl.position.set(side, 0.55, -1.42);
    group.add(tl);
  }
  // Center energy brake light
  const brakeLt = renderer.createToonMesh(_brakeLightGeo, 0x00aaff, { outlineWidth: 0.01 });
  brakeLt.position.set(0, 0.76, -1.42);
  group.add(brakeLt);

  // (dome cockpit removed — obstructs cockpit camera and preview)

  // Windshield
  const ws = renderer.createToonMesh(_sportWindshieldGeo, 0x88bbdd, { outlineWidth: 0.01 });
  ws.rotation.x = -0.3;
  ws.position.set(0, 1.05, 0.35);
  group.add(ws);

  // Side mirrors
  for (const side of [-0.6, 0.6]) {
    const arm = renderer.createToonMesh(_mirrorArmGeo, 0x333333, { outlineWidth: 0 });
    arm.position.set(side * 1.4, 0.8, 0.3);
    group.add(arm);
    const mirror = renderer.createToonMesh(_mirrorGeo, 0x88bbdd, { outlineWidth: 0.01 });
    mirror.position.set(side * 1.55, 0.8, 0.3);
    group.add(mirror);
  }

  // Dashboard
  const dash = renderer.createToonMesh(_dashboardGeo, 0x222222, { outlineWidth: 0.01 });
  dash.position.set(0, 0.85, 0.2);
  group.add(dash);
  const stWheel = renderer.createToonMesh(_steeringWheelGeo, 0x222222, { outlineWidth: 0.01 });
  stWheel.rotation.x = -0.5;
  stWheel.position.set(0, 0.97, 0.1);
  group.add(stWheel);
  // Gauges
  for (const gx of [-0.15, 0.15]) {
    const gauge = renderer.createToonMesh(_gaugeGeo, 0x115533, { outlineWidth: 0 });
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(gx, 0.93, 0.35);
    group.add(gauge);
  }

  // Seat
  const seat = renderer.createToonMesh(_seatGeo, 0x333333, { outlineWidth: 0.01 });
  seat.position.set(0, 0.75, -0.35);
  group.add(seat);
  const seatBack = renderer.createToonMesh(_seatBackGeo, 0x333333, { outlineWidth: 0.01 });
  seatBack.position.set(0, 1.0, -0.52);
  group.add(seatBack);

  // Front: normal wheels with rims
  const frontWheels = [[-0.9, 0.35, 1.0], [0.9, 0.35, 1.0]];
  for (const [x, y, z] of frontWheels) {
    const wheel = renderer.createToonMesh(_wheelGeo, 0x222222, { outlineWidth: 0.02 });
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
    const rim = renderer.createToonMesh(_rimGeo, 0x999999, { outlineWidth: 0.01 });
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x > 0 ? x + 0.02 : x - 0.02, y, z);
    group.add(rim);
    const hub = renderer.createToonMesh(_hubCapGeo, acc, { outlineWidth: 0 });
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x > 0 ? x + 0.13 : x - 0.13, y, z);
    group.add(hub);
    // Wheel arch
    const arch = renderer.createToonMesh(_wheelArchGeo, col, { outlineWidth: 0.01 });
    arch.rotation.z = x > 0 ? 0 : Math.PI;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x > 0 ? x - 0.15 : x + 0.15, y + 0.1, z);
    group.add(arch);
  }

  // Rear: hover pads with glow
  const rearPads = [[-0.8, 0.3, -1.0], [0.8, 0.3, -1.0]];
  for (const [x, y, z] of rearPads) {
    const pad = renderer.createToonMesh(_hoverPadGeo, acc, { outlineWidth: 0.02 });
    pad.position.set(x, y, z);
    group.add(pad);
    const glow = renderer.createToonMesh(_hoverGlowGeo, 0x00ccff, { outlineWidth: 0 });
    glow.position.set(x, y - 0.08, z);
    group.add(glow);
  }

  // Rear energy ring
  const eRing = renderer.createToonMesh(_energyRingGeo, 0x00aaff, { outlineWidth: 0.01 });
  eRing.position.set(0, 0.35, -0.8);
  group.add(eRing);

  // Spoiler
  const spoiler = renderer.createToonMesh(_spoilerGeo, acc, { outlineWidth: 0.02 });
  spoiler.position.set(0, 1.05, -1.3);
  group.add(spoiler);
  for (const side of [-0.6, 0.6]) {
    const post = renderer.createToonMesh(_spoilerPostGeo, acc, { outlineWidth: 0.01 });
    post.position.set(side, 0.85, -1.3);
    group.add(post);
  }

  // Side fins with accent stripes
  for (const side of [-1.1, 1.1]) {
    const fin = renderer.createToonMesh(_finGeo, acc, { outlineWidth: 0.01 });
    fin.position.set(side, 0.7, -0.5);
    group.add(fin);
    const stripe = renderer.createToonMesh(
      new THREE.BoxGeometry(0.07, 0.08, 0.6), 0x00aaff, { outlineWidth: 0 }
    );
    stripe.position.set(side, 0.9, -0.5);
    group.add(stripe);
  }

  // Side vents
  for (const side of [-1.11, 1.11]) {
    for (let i = 0; i < 2; i++) {
      const vent = renderer.createToonMesh(_sideVentGeo, 0x111111, { outlineWidth: 0 });
      vent.position.set(side, 0.5, 0.2 + i * 0.3);
      group.add(vent);
    }
  }

  // Nose
  const nose = renderer.createToonMesh(_noseGeo, acc, { outlineWidth: 0.02 });
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.5, 1.6);
  group.add(nose);

  // Exhaust (single, offset)
  const exhaust = renderer.createToonMesh(_smallExhaustGeo, 0x333333, { outlineWidth: 0.01 });
  exhaust.rotation.x = -Math.PI / 5;
  exhaust.position.set(0.4, 0.6, -1.5);
  group.add(exhaust);

  // Air intake scoop
  const scoop = renderer.createToonMesh(_scoopGeo, acc, { outlineWidth: 0.01 });
  scoop.position.set(0, 0.95, 0.6);
  group.add(scoop);

  return mergeKartGroup(renderer, group);
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

  // Fog parameters per theme
  let fogColor, fogNear, fogFar;
  if (theme.includes('volcan') || theme.includes('lava')) {
    fogColor = new THREE.Vector3(0.2, 0.13, 0.07); fogNear = 120; fogFar = 350;
  } else if (theme.includes('ocean') || theme.includes('reef')) {
    fogColor = new THREE.Vector3(0.04, 0.13, 0.27); fogNear = 100; fogFar = 300;
  } else if (theme.includes('neon') || theme.includes('cyber')) {
    fogColor = new THREE.Vector3(0.07, 0.0, 0.13); fogNear = 100; fogFar = 320;
  } else if (theme.includes('forest') || theme.includes('crystal')) {
    fogColor = new THREE.Vector3(0.53, 0.67, 0.8); fogNear = 150; fogFar = 400;
  } else {
    fogColor = new THREE.Vector3(0.4, 0.47, 0.53); fogNear = 150; fogFar = 400;
  }

  // Save original fog values for toggle
  _fogOriginals = { near: fogNear, far: fogFar };

  // Road shader uniforms (shared across all segments)
  const roadUniforms = {
    baseColor: { value: new THREE.Vector3(0.33, 0.33, 0.33) },
    lineColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    time: { value: 0 },
    roadStyle: { value: biome },
    fogColor: { value: fogColor },
    fogNear: { value: fogNear },
    fogFar: { value: fogFar }
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
    side: THREE.DoubleSide,
    transparent: false
  });

  // Build a single continuous track mesh with smooth corners
  const trackMesh = buildContinuousTrackMesh(waypoints, trackWidth, roadMat, circuit);
  trackMesh.receiveShadow = true;
  renderer.scene.add(trackMesh);

  // Ground plane with procedural shader
  const groundUniforms = {
    baseColor: { value: baseColor },
    accentColor: { value: accentColor },
    time: { value: 0 },
    biome: { value: biome },
    fogColor: { value: fogColor },
    fogNear: { value: fogNear },
    fogFar: { value: fogFar }
  };
  shaderUniforms.push(groundUniforms);

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: groundVert,
    fragmentShader: groundFrag,
    uniforms: groundUniforms,
    side: THREE.DoubleSide
  });

  // Compute min Y for fallback ground plane
  let minY = Infinity;
  for (const wp of waypoints) {
    if (wp.y < minY) minY = wp.y;
  }

  const groundGeo = new THREE.PlaneGeometry(2000, 2000, 200, 200);

  // Deform ground vertices to follow circuit elevation
  // PlaneGeometry is in XY plane; after rotation -PI/2 around X:
  // local X → world X, local Y → world -Z, local Z → world Y
  const posAttr = groundGeo.getAttribute('position');
  const verts = posAttr.array;
  const wps = waypoints;
  const nWps = wps.length;
  const tw = circuit.trackWidth || 12;

  for (let vi = 0; vi < posAttr.count; vi++) {
    const lx = verts[vi * 3];
    const ly = verts[vi * 3 + 1];
    const wx = lx;
    const wz = -ly;

    // Find nearest circuit segment
    let bestDistSq = Infinity;
    let bestY = 0;
    for (let i = 0; i < nWps; i++) {
      const a = wps[i];
      const b = wps[(i + 1) % nWps];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const apx = wx - a.x;
      const apz = wz - a.z;
      const abLenSq = abx * abx + abz * abz;
      const t = abLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq)) : 0;
      const cx = a.x + abx * t;
      const cz = a.z + abz * t;
      const cy = a.y + (b.y - a.y) * t;
      const dx = wx - cx;
      const dz = wz - cz;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestY = cy;
      }
    }

    const dist = Math.sqrt(bestDistSq);
    const blendStart = tw * 0.5 + 5;
    const blendEnd = tw * 0.5 + 200;
    const blendT = Math.min(1, Math.max(0, (dist - blendStart) / (blendEnd - blendStart)));

    // Near track: below road to prevent ground shader noise poking through (+3 max)
    const nearY = bestY - 4;
    const farY = bestY - dist * 0.04 - 5;
    const targetY = nearY * (1 - blendT) + farY * blendT;

    verts[vi * 3 + 2] = targetY;
  }
  posAttr.needsUpdate = true;
  groundGeo.computeVertexNormals();

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  renderer.scene.add(ground);

  // Scenery
  buildScenery(renderer, circuit, waypoints);

  // Track-side point lights for varied lighting
  buildTrackLights(renderer, circuit, waypoints);

  // Set clear color to fog color for seamless horizon
  const fogHex = (Math.round(fogColor.x * 255) << 16) | (Math.round(fogColor.y * 255) << 8) | Math.round(fogColor.z * 255);
  renderer.renderer.setClearColor(fogHex);

  // Sky dome
  buildSkyDome(renderer, circuit, shaderUniforms);

  // Track elements: ramps, boosts, slowdowns
  const trackElements = buildTrackElements(renderer, circuit, waypoints);
  return { trackElements, groundPlaneY: minY - 2 };
}

// --- Track elements: ramps, boosts, slowdowns ---

/** Merge children of a Group by material color. Works with any material type. */
function mergeGroupChildren(group) {
  const byColor = new Map();
  for (const child of group.children) {
    if (!child.isMesh || !child.geometry || !child.material) continue;
    const key = child.material.color.getHex();
    if (!byColor.has(key)) byColor.set(key, { mat: child.material, geos: [] });
    const geo = child.geometry.clone();
    child.updateMatrix();
    geo.applyMatrix4(child.matrix);
    byColor.get(key).geos.push(geo);
  }
  while (group.children.length) group.remove(group.children[0]);
  for (const { mat, geos } of byColor.values()) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!merged) continue;
    group.add(new THREE.Mesh(merged, mat));
  }
  return group;
}

function buildTrackElements(renderer, circuit, waypoints) {
  const elements = [];
  const n = waypoints.length;
  const trackWidth = circuit.trackWidth || 12;

  // Deterministic seed from circuit id
  let seed = 0;
  for (let i = 0; i < (circuit.id || '').length; i++) seed += circuit.id.charCodeAt(i);
  const rng = mulberry32(seed + 42);

  // Ramps: 3-4 per circuit, every ~18-22 waypoints
  // Skip ramps near the volcanic crest (waypoints 10-14)
  const skipRampZone = circuit.id === 'volcan-peak' ? [10, 14] : null;
  const rampStep = Math.floor(n / 4);
  for (let k = 0; k < 3; k++) {
    const idx = Math.min(n - 2, Math.floor(rampStep * (k + 0.5) + rng() * 4 - 2));
    if (skipRampZone && idx >= skipRampZone[0] && idx <= skipRampZone[1]) continue;
    const wp = waypoints[idx];
    const next = waypoints[(idx + 1) % n];
    const dx = next.x - wp.x;
    const dz = next.z - wp.z;
    const segLen = Math.sqrt(dx * dx + dz * dz) || 1;
    const yaw = Math.atan2(dx, dz);

    // Ramp mesh: a tilted box (wedge)
    const rampGroup = new THREE.Group();
    const rampGeo = new THREE.BoxGeometry(4, 0.3, 3);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.6 });
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.rotation.x = -0.25; // tilt upward
    rampMesh.position.y = 0.6;
    rampGroup.add(rampMesh);

    // Stripes on ramp
    for (let s = -1; s <= 1; s++) {
      const stripeGeo = new THREE.BoxGeometry(0.3, 0.32, 3.02);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -0.25;
      stripe.position.set(s * 1.2, 0.62, 0);
      rampGroup.add(stripe);
    }

    mergeGroupChildren(rampGroup);
    rampGroup.position.set(wp.x, wp.y, wp.z);
    rampGroup.rotation.y = yaw;
    renderer.scene.add(rampGroup);

    elements.push({
      type: 'ramp',
      position: wp.clone(),
      radius: 3.5,
      mesh: rampGroup,
      launchVelocity: 28
    });
  }

  // Boost arrows: 2-3 per circuit
  const boostStep = Math.floor(n / 3);
  for (let k = 0; k < 3; k++) {
    const idx = Math.min(n - 2, Math.floor(boostStep * (k + 0.3) + rng() * 3));
    const wp = waypoints[idx];
    const next = waypoints[(idx + 1) % n];
    const dx = next.x - wp.x;
    const dy = next.y - wp.y;
    const dz = next.z - wp.z;
    const hDist = Math.sqrt(dx * dx + dz * dz);
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(dy, hDist);

    // Blue chevrons (3 V-shapes in a row, following road slope)
    const chevronGroup = new THREE.Group();
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0x2288ff, emissive: 0x1166dd, emissiveIntensity: 1.0,
      roughness: 0.2, side: THREE.DoubleSide
    });

    for (let c = 0; c < 3; c++) {
      // Each chevron = 2 angled planes forming a V
      for (const side of [-1, 1]) {
        const stripGeo = new THREE.PlaneGeometry(2.0, 0.5);
        const strip = new THREE.Mesh(stripGeo, chevronMat);
        strip.rotation.x = -Math.PI / 2;
        strip.rotation.z = side * 0.5; // angle to form V
        strip.position.set(side * 0.85, 0.25, -c * 2.0);
        chevronGroup.add(strip);
      }
    }

    mergeGroupChildren(chevronGroup);
    chevronGroup.position.set(wp.x, wp.y, wp.z);
    chevronGroup.lookAt(next.x, next.y, next.z);
    renderer.scene.add(chevronGroup);

    elements.push({
      type: 'boost',
      position: wp.clone(),
      radius: 3.5,
      mesh: chevronGroup,
      speedMultiplier: 1.6,
      duration: 3.0
    });
  }

  // Slowdown zones: 2-3 per circuit
  const slowStep = Math.floor(n / 3);
  for (let k = 0; k < 2; k++) {
    // Offset from boosts so they don't overlap
    const idx = Math.min(n - 2, Math.floor(slowStep * (k + 0.8) + rng() * 3));
    const wp = waypoints[idx];
    const next = waypoints[(idx + 1) % n];
    const dx = next.x - wp.x;
    const dz = next.z - wp.z;
    const yaw = Math.atan2(dx, dz);

    const slowGroup = new THREE.Group();

    // Red/white striped rumble strip (partial width, offset to one side)
    const stripCount = 5;
    const stripW = trackWidth * 0.25;
    const lateralOffset = (rng() > 0.5 ? 1 : -1) * trackWidth * 0.15;
    for (let s = 0; s < stripCount; s++) {
      const stripGeo = new THREE.PlaneGeometry(stripW, 0.6);
      const isRed = s % 2 === 0;
      const stripMat = new THREE.MeshStandardMaterial({
        color: isRed ? 0xdd2222 : 0xeeeeee, roughness: 0.7, side: THREE.DoubleSide
      });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(lateralOffset, 0.04, (s - 2) * 0.7);
      slowGroup.add(strip);
    }

    mergeGroupChildren(slowGroup);
    slowGroup.position.set(wp.x, wp.y, wp.z);
    slowGroup.rotation.y = yaw;
    renderer.scene.add(slowGroup);

    elements.push({
      type: 'slowdown',
      position: wp.clone(),
      radius: trackWidth * 0.5,
      mesh: slowGroup,
      speedFactor: 0.7
    });
  }

  return elements;
}

// Cooldown tracker for track element interactions (per kart, per element)
const _elementCooldowns = new WeakMap();

let _boostBlinkTime = 0;
function checkTrackElements(elements, participants, delta) {
  if (!elements || elements.length === 0) return;

  // Blink boost chevrons between two blues
  _boostBlinkTime += delta;
  const blinkT = Math.sin(_boostBlinkTime * 6) * 0.5 + 0.5; // 0→1 oscillation
  for (const el of elements) {
    if (el.type === 'boost' && el.mesh) {
      el.mesh.traverse(c => {
        if (c.material && c.material.emissive) {
          // Lerp between light blue (0x2288ff) and deep blue (0x0044aa)
          c.material.color.setRGB(0.13 + blinkT * 0.12, 0.27 + blinkT * 0.27, 0.67 + blinkT * 0.33);
          c.material.emissive.setRGB(0.07 + blinkT * 0.06, 0.27 + blinkT * 0.13, 0.53 + blinkT * 0.33);
        }
      });
    }
  }

  for (const p of participants) {
    const kart = p.kartController;
    if (!kart) continue;

    // Get or create cooldown map for this kart
    if (!_elementCooldowns.has(kart)) _elementCooldowns.set(kart, new Map());
    const cooldowns = _elementCooldowns.get(kart);

    // Tick down cooldowns
    for (const [key, val] of cooldowns) {
      cooldowns.set(key, val - delta);
      if (val - delta <= 0) cooldowns.delete(key);
    }

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const dx = kart.position.x - el.position.x;
      const dz = kart.position.z - el.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > el.radius) continue;

      // Check cooldown to avoid repeated triggering
      const cooldownKey = i;
      if (cooldowns.has(cooldownKey)) continue;

      if (el.type === 'ramp') {
        // Launch kart — strong upward velocity for a satisfying jump
        kart.airborne = true;
        kart.grounded = false;
        const speedRatio = Math.max(0.5, kart.speed / (kart.baseMaxSpeed || 50));
        kart.velocity.y = Math.max(12, el.launchVelocity * speedRatio);
        cooldowns.set(cooldownKey, 2.0); // 2s cooldown

      } else if (el.type === 'boost') {
        // Progressive boost: ramps up, holds, fades out
        const mult = el.speedMultiplier;
        const totalDur = el.duration;
        const boostForce = kart.maxSpeed * 0.25;
        kart.applyEffect({
          timer: totalDur,
          keepMomentum: true,
          onStart() {},
          onTick(k, dt) {
            const elapsed = totalDur - this.timer;
            const fadeStart = totalDur * 0.7;
            let t;
            if (elapsed < fadeStart) {
              t = 1.0; // full power immediately
            } else {
              t = 1.0 - (elapsed - fadeStart) / (totalDur - fadeStart); // linear fade
            }
            // Raise speed cap
            k.speedMultiplier = Math.max(k.speedMultiplier, 1 + (mult - 1) * t);
            // Active forward push
            k._tempVec.set(Math.sin(k.yaw), 0, Math.cos(k.yaw));
            k.velocity.add(k._tempVec.multiplyScalar(boostForce * t * dt));
          },
          onEnd() {}
        });
        cooldowns.set(cooldownKey, el.duration + 0.5);

      } else if (el.type === 'slowdown') {
        // Reduce speed and cancel any active boost effects
        kart.speed *= el.speedFactor;
        kart.velocity.x *= el.speedFactor;
        kart.velocity.z *= el.speedFactor;
        for (let ei = kart.activeEffects.length - 1; ei >= 0; ei--) {
          if (kart.activeEffects[ei].keepMomentum) {
            if (kart.activeEffects[ei].onEnd) kart.activeEffects[ei].onEnd(kart);
            kart.activeEffects.splice(ei, 1);
          }
        }
        cooldowns.set(cooldownKey, 1.5);
      }
    }
  }
}

// --- Track-side lighting ---

const _lampPostGeo = new THREE.CylinderGeometry(0.08, 0.12, 5, 6);
const _lampHeadGeo = new THREE.SphereGeometry(0.25, 8, 6);

function buildTrackLights(renderer, circuit, waypoints) {
  const trackWidth = circuit.trackWidth || 12;
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
    const localWidth = getTrackWidthAtSegment(circuit, i, 0);
    const dist = localWidth * 0.6 + 1;
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

// --- Sky Dome ---

function buildSkyDome(renderer, circuit, shaderUniforms) {
  const sky = circuit.palette?.sky || { horizon: 0x88aacc, zenith: 0x1a1a2e };
  const theme = (circuit.theme || '').toLowerCase();

  const skyUniforms = {
    time: { value: 0 },
    zenithColor: { value: new THREE.Color(sky.zenith) },
    horizonColor: { value: new THREE.Color(sky.horizon) },
    biome: { value: theme.includes('neon') ? 3 : theme.includes('volcan') ? 1 : theme.includes('ocean') ? 2 : theme.includes('ruin') ? 4 : 0 }
  };
  shaderUniforms.push(skyUniforms);

  const skyGeo = new THREE.SphereGeometry(800, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 zenithColor;
      uniform vec3 horizonColor;
      uniform float time;
      uniform int biome;

      varying vec3 vWorldPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
      float fbm6(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = dir.y * 0.5 + 0.5; // 0=horizon, 1=zenith

        // Add noise variation to break up the base gradient
        float gradientNoise = fbm(dir.xz * 2.0 + 0.5) * 0.06;
        float hPerturbed = clamp(h + gradientNoise, 0.0, 1.0);

        // Gradient with noise perturbation
        vec3 col = mix(horizonColor, zenithColor, smoothstep(0.0, 0.7, hPerturbed));

        // Sun/moon glow
        vec3 sunDir = normalize(vec3(0.4, 0.6, 0.3));
        float sunDot = max(dot(dir, sunDir), 0.0);

        if (biome == 1) {
          // Volcano: fiery sky, slow drifting smoke
          col += vec3(0.8, 0.2, 0.0) * pow(sunDot, 8.0) * 0.6;
          // Lava glow from below (horizon tint)
          col += vec3(0.6, 0.15, 0.0) * smoothstep(0.3, 0.0, h) * 0.4;
          // Slow smoke clouds (no flicker — fbm with very slow time)
          float smoke = fbm(dir.xz * 3.0 + time * 0.008);
          col = mix(col, vec3(0.15, 0.08, 0.05), smoke * 0.5 * smoothstep(0.3, 0.8, h));
          // Subtle heat haze (smooth, no step)
          float haze = fbm(dir.xz * 6.0 + time * 0.015);
          col += vec3(0.3, 0.08, 0.0) * haze * 0.15 * smoothstep(0.1, 0.5, h);
        } else if (biome == 2) {
          // Ocean: underwater caustic light rays
          float caustic = fbm(dir.xz * 5.0 + time * 0.05);
          col += vec3(0.0, 0.3, 0.5) * caustic * 0.3 * smoothstep(0.5, 1.0, h);
          // Light rays from above
          float ray = pow(max(dir.y, 0.0), 3.0);
          col += vec3(0.1, 0.25, 0.4) * ray * 0.5;
          // Floating particles
          float particles = step(0.985, hash(dir.xz * 80.0 + time * 0.03));
          col += vec3(0.2, 0.6, 0.8) * particles;
        } else if (biome == 3) {
          // Neon: dark sky with neon aurora bands
          float aurora = sin(dir.x * 4.0 + time * 0.3) * cos(dir.z * 3.0 + time * 0.2);
          aurora = smoothstep(0.3, 0.8, aurora * 0.5 + 0.5);
          vec3 auroraCol = mix(vec3(0.0, 1.0, 0.8), vec3(1.0, 0.0, 1.0), sin(dir.x * 2.0 + time * 0.1) * 0.5 + 0.5);
          col += auroraCol * aurora * 0.2 * smoothstep(0.4, 0.9, h);
          // Stars
          float star = step(0.992, hash(floor(dir.xz * 200.0)));
          float twinkle = sin(time * 3.0 + hash(floor(dir.xz * 200.0)) * 20.0) * 0.5 + 0.5;
          col += vec3(1.0) * star * twinkle * 0.6;
        } else if (biome == 4) {
          // Ruins: eerie purple, dimensional cracks
          col += vec3(0.4, 0.0, 0.6) * pow(sunDot, 4.0) * 0.4;
          float crack = step(0.93, fbm(dir.xz * 8.0 + time * 0.01));
          col += vec3(0.5, 0.0, 1.0) * crack * 0.6;
          // Floating runes
          float rune = step(0.99, hash(floor(dir.xz * 100.0) + floor(time * 0.5)));
          col += vec3(0.8, 0.4, 1.0) * rune * 0.4;
        } else {
          // Forest: sunny sky with fluffy clouds
          col += vec3(1.0, 0.9, 0.7) * pow(sunDot, 32.0) * 0.8; // sun
          col += vec3(0.8, 0.7, 0.5) * pow(sunDot, 4.0) * 0.2;  // halo

          // Main cumulus clouds (6-octave fbm for more detail)
          vec2 cloudUV = dir.xz / max(dir.y, 0.01) * 0.15;
          float cloud = fbm6(cloudUV + time * 0.008);
          cloud = smoothstep(0.35, 0.7, cloud);
          float cloudMask = cloud * 0.75 * smoothstep(0.2, 0.6, h);

          // Cloud shadows: darken areas below clouds slightly
          float cloudShadow = fbm6(cloudUV * 0.9 + vec2(0.02, 0.04) + time * 0.008);
          cloudShadow = smoothstep(0.4, 0.75, cloudShadow);
          col *= 1.0 - cloudShadow * 0.12 * smoothstep(0.15, 0.45, h);

          // Apply main clouds on top
          col = mix(col, vec3(1.0, 0.98, 0.95), cloudMask);

          // High-altitude cirrus wisps (thin, stretched)
          vec2 cirrusUV = dir.xz / max(dir.y, 0.01) * 0.04;
          float cirrus = fbm6(cirrusUV * vec2(3.0, 1.0) + time * 0.012);
          cirrus = smoothstep(0.48, 0.65, cirrus) * smoothstep(0.55, 0.85, h);
          col = mix(col, vec3(1.0, 0.99, 0.96), cirrus * 0.35);

          // Secondary wispy layer at different scale
          float wisp = fbm(cirrusUV * vec2(5.0, 1.5) + vec2(time * 0.006, 3.0));
          wisp = smoothstep(0.52, 0.68, wisp) * smoothstep(0.6, 0.9, h);
          col = mix(col, vec3(1.0, 0.98, 0.94), wisp * 0.2);
        }

        // Horizon fog/haze band for depth (enhanced)
        vec3 hazeColor = horizonColor * 1.15 + vec3(0.05, 0.05, 0.08);
        float hazeBand = smoothstep(0.18, 0.0, h);
        float hazeNoise = fbm(dir.xz * 4.0 + time * 0.005) * 0.15;
        col = mix(col, hazeColor, (hazeBand + hazeNoise * smoothstep(0.25, 0.0, h)) * 0.6);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  renderer.scene.add(skyMesh);
}

// Shared scenery geometries
const _treeGeo = new THREE.ConeGeometry(2, 6, 6);
const _treeBigGeo = new THREE.ConeGeometry(3, 9, 7);
const _treeBushGeo = new THREE.SphereGeometry(2, 6, 5);
const _trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 2, 6);
const _trunkTallGeo = new THREE.CylinderGeometry(0.25, 0.6, 4, 6);
const _rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
const _rockSmallGeo = new THREE.DodecahedronGeometry(0.6, 0);
const _pillarGeo = new THREE.CylinderGeometry(0.8, 1.0, 8, 6);
const _buildingGeo = new THREE.BoxGeometry(4, 8, 4);
const _buildingTallGeo = new THREE.BoxGeometry(3, 16, 3);
const _crystalGeo = new THREE.OctahedronGeometry(2, 0);
const _crystalSmallGeo = new THREE.OctahedronGeometry(0.8, 0);
const _coralGeo = new THREE.CylinderGeometry(0.2, 0.8, 4, 5);
const _coralBranchGeo = new THREE.CylinderGeometry(0.1, 0.3, 2.5, 4);
const _seaweedGeo = new THREE.CylinderGeometry(0.05, 0.15, 3, 4);
const _mushroomCapGeo = new THREE.SphereGeometry(1.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const _mushroomStemGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
const _archGeo = new THREE.TorusGeometry(3, 0.4, 6, 12, Math.PI);
const _fencePostGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.5, 5);
const _bannerGeo = new THREE.PlaneGeometry(1.5, 0.8);
const _crateStackGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
const _signGeo = new THREE.BoxGeometry(1.5, 1.0, 0.1);
const _hologramGeo = new THREE.IcosahedronGeometry(1.5, 0);
const _volcanoConeGeo = new THREE.ConeGeometry(1, 1.6, 8);
const _volcanoCraterGeo = new THREE.TorusGeometry(0.35, 0.12, 6, 8);
const _volcanoRimGeo = new THREE.CylinderGeometry(0.4, 0.55, 0.2, 8);

/**
 * Collects scenery mesh instances during building, then flushes them as
 * InstancedMesh objects (one per unique geometry) with per-instance color.
 * Reduces ~160+ individual draw calls to ~15-20.
 */
const _flushMatrix = new THREE.Matrix4();
const _flushQuat = new THREE.Quaternion();
const _flushColor = new THREE.Color();

class SceneryCollector {
  constructor() {
    this._byColor = new Map(); // colorHex → [cloned+transformed BufferGeometry]
    this.scene = { add: (proxy) => this._record(proxy) };
  }

  createToonMesh(geometry, color, _options = {}) {
    return {
      _geo: geometry,
      _color: color,
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      scale: new THREE.Vector3(1, 1, 1),
      children: [],
      material: null
    };
  }

  _record(proxy) {
    if (!proxy._geo) return;
    const hex = proxy._color | 0;
    if (!this._byColor.has(hex)) this._byColor.set(hex, []);
    const geo = proxy._geo.clone();
    _flushQuat.setFromEuler(proxy.rotation);
    _flushMatrix.compose(proxy.position, _flushQuat, proxy.scale);
    geo.applyMatrix4(_flushMatrix);
    this._byColor.get(hex).push(geo);
  }

  flush(renderer) {
    for (const [hex, geos] of this._byColor) {
      if (geos.length === 0) continue;
      const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
      if (!merged) continue;
      const mesh = renderer.createToonMesh(merged, hex);
      // Merged scenery spans the whole track — disable shadow casting
      // to prevent a giant shadow covering everything in the shadow map
      mesh.castShadow = false;
      renderer.scene.add(mesh);
    }
    this._byColor.clear();
  }
}

function buildScenery(renderer, circuit, waypoints) {
  const trackWidth = circuit.trackWidth || 12;
  const theme = circuit.theme?.toLowerCase() || '';
  const p = circuit.palette || {};
  const rng = mulberry32(circuit.id?.length || 7);
  const collector = new SceneryCollector();

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
      const localWidth = getTrackWidthAtSegment(circuit, i, 0);
      const baseDist = localWidth * 0.9 + 3;
      const dist = baseDist + 4 + rng() * 18;
      const x = curr.x + sideX * dist * side;
      const z = curr.z + sideZ * dist * side;
      // Fade prop height toward ground when far from track to avoid floating objects
      const distRatio = Math.min(1, (dist - baseDist) / 20);
      const y = curr.y * (1 - distRatio * 0.85);

      placeSceneryProp(collector, theme, p, x, y, z, rng);
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
    placeSceneryProp(collector, theme, p, x, -1, z, rng);
  }

  // Volcano mountains (distant only, lava biome)
  volcanoParticles = [];
  if (theme.includes('volcan') || theme.includes('lava')) {
    for (let i = 0; i < 8; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 150 + rng() * 250;
      const x = center.x + Math.cos(angle) * dist;
      const z = center.z + Math.sin(angle) * dist;
      const vScale = 8 + rng() * 16;
      const cone = collector.createToonMesh(_volcanoConeGeo, 0x3a2a1a);
      cone.position.set(x, vScale * 0.8, z);
      cone.scale.set(vScale, vScale, vScale);
      collector.scene.add(cone);
      const rim = collector.createToonMesh(_volcanoRimGeo, 0x2a1a0a);
      rim.position.set(x, vScale * 1.58, z);
      rim.scale.set(vScale * 0.7, vScale * 0.5, vScale * 0.7);
      collector.scene.add(rim);
      const crater = collector.createToonMesh(_volcanoCraterGeo, 0xff3300);
      crater.position.set(x, vScale * 1.55, z);
      crater.rotation.x = Math.PI / 2;
      crater.scale.set(vScale * 0.6, vScale * 0.6, vScale * 0.4);
      collector.scene.add(crater);

      // Lava eruption particles
      const lavaCount = 30;
      const lavaPos = new Float32Array(lavaCount * 3);
      const lavaVel = new Float32Array(lavaCount * 3);
      const craterY = vScale * 1.6;
      for (let j = 0; j < lavaCount; j++) {
        _initLavaParticle(lavaPos, lavaVel, j, x, craterY, z, vScale);
      }
      const lavaGeo = new THREE.BufferGeometry();
      lavaGeo.setAttribute('position', new THREE.BufferAttribute(lavaPos, 3));
      const lavaMat = new THREE.PointsMaterial({ color: 0xff4400, size: 1.5, transparent: true, opacity: 0.9 });
      const lavaPoints = new THREE.Points(lavaGeo, lavaMat);
      renderer.scene.add(lavaPoints);
      volcanoParticles.push({ points: lavaPoints, velocities: lavaVel, origin: { x, y: craterY, z }, scale: vScale, type: 'lava', count: lavaCount });

      // Smoke particles
      const smokeCount = 20;
      const smokePos = new Float32Array(smokeCount * 3);
      const smokeVel = new Float32Array(smokeCount * 3);
      for (let j = 0; j < smokeCount; j++) {
        _initSmokeParticle(smokePos, smokeVel, j, x, craterY, z, vScale);
      }
      const smokeGeo = new THREE.BufferGeometry();
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
      const smokeMat = new THREE.PointsMaterial({ color: 0x555555, size: 4, transparent: true, opacity: 0.35 });
      const smokePoints = new THREE.Points(smokeGeo, smokeMat);
      renderer.scene.add(smokePoints);
      volcanoParticles.push({ points: smokePoints, velocities: smokeVel, origin: { x, y: craterY, z }, scale: vScale, type: 'smoke', count: smokeCount });
    }
  }

  // Flush all collected scenery instances as InstancedMesh objects
  collector.flush(renderer);
}

function _initLavaParticle(pos, vel, i, ox, oy, oz, scale) {
  const spread = scale * 0.15;
  pos[i * 3] = ox + (Math.random() - 0.5) * spread;
  pos[i * 3 + 1] = oy + Math.random() * scale * 0.5;
  pos[i * 3 + 2] = oz + (Math.random() - 0.5) * spread;
  vel[i * 3] = (Math.random() - 0.5) * 3;
  vel[i * 3 + 1] = 4 + Math.random() * 8;
  vel[i * 3 + 2] = (Math.random() - 0.5) * 3;
}

function _initSmokeParticle(pos, vel, i, ox, oy, oz, scale) {
  const spread = scale * 0.3;
  pos[i * 3] = ox + (Math.random() - 0.5) * spread;
  pos[i * 3 + 1] = oy + Math.random() * scale * 1.5;
  pos[i * 3 + 2] = oz + (Math.random() - 0.5) * spread;
  vel[i * 3] = (Math.random() - 0.5) * 1.5;
  vel[i * 3 + 1] = 2 + Math.random() * 3;
  vel[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
}

function _updateVolcanoParticles(vp, delta) {
  const pos = vp.points.geometry.attributes.position.array;
  const vel = vp.velocities;
  const o = vp.origin;
  const maxH = o.y + vp.scale * 2.5;

  for (let i = 0; i < vp.count; i++) {
    pos[i * 3] += vel[i * 3] * delta;
    pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
    pos[i * 3 + 2] += vel[i * 3 + 2] * delta;

    if (vp.type === 'lava') {
      // Gravity
      vel[i * 3 + 1] -= 6 * delta;
      // Reset when fallen below crater
      if (pos[i * 3 + 1] < o.y - 2) {
        _initLavaParticle(pos, vel, i, o.x, o.y, o.z, vp.scale);
      }
    } else {
      // Smoke: slow drift, expand, reset at top
      vel[i * 3] += (Math.random() - 0.5) * 0.5 * delta;
      vel[i * 3 + 2] += (Math.random() - 0.5) * 0.5 * delta;
      if (pos[i * 3 + 1] > maxH) {
        _initSmokeParticle(pos, vel, i, o.x, o.y, o.z, vp.scale);
      }
    }
  }
  vp.points.geometry.attributes.position.needsUpdate = true;
}

function placeSceneryProp(renderer, theme, palette, x, y, z, rng) {
  const scale = 0.6 + rng() * 1.5;
  const rotY = rng() * Math.PI * 2;

  if (theme.includes('forest') || theme.includes('crystal')) {
    const r = rng();
    if (r < 0.22) {
      // Tall tree with layered foliage
      const trunk = renderer.createToonMesh(_trunkTallGeo, 0x5a3a1a, { outlineWidth: 0.02 });
      trunk.position.set(x, y + 2 * scale, z);
      trunk.scale.setScalar(scale);
      renderer.scene.add(trunk);
      for (let i = 0; i < 3; i++) {
        const s = scale * (1.2 - i * 0.25);
        const foliage = renderer.createToonMesh(_treeGeo, 0x226622 + i * 0x001100, { outlineWidth: 0.03 });
        foliage.position.set(x, y + (4.5 + i * 2) * scale, z);
        foliage.scale.setScalar(s);
        renderer.scene.add(foliage);
      }
    } else if (r < 0.38) {
      // Round bush tree
      const trunk = renderer.createToonMesh(_trunkGeo, 0x5a3a1a, { outlineWidth: 0.02 });
      trunk.position.set(x, y + 1, z);
      trunk.scale.setScalar(scale * 0.8);
      renderer.scene.add(trunk);
      const bush = renderer.createToonMesh(_treeBushGeo, 0x2a7722, { outlineWidth: 0.03 });
      bush.position.set(x, y + 3.5 * scale, z);
      bush.scale.setScalar(scale);
      renderer.scene.add(bush);
    } else if (r < 0.55) {
      // Crystal cluster
      const crystalCol = palette.crystal || palette.accent || 0x88ddff;
      for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
        const geo = i === 0 ? _crystalGeo : _crystalSmallGeo;
        const crystal = renderer.createToonMesh(geo, crystalCol, { outlineWidth: 0.03 });
        const ox = (rng() - 0.5) * 2;
        const oz = (rng() - 0.5) * 2;
        const s = i === 0 ? scale : scale * (0.4 + rng() * 0.4);
        crystal.position.set(x + ox, y + 1.5 * s, z + oz);
        crystal.scale.set(s * 0.6, s * 1.5, s * 0.6);
        crystal.rotation.set(rng() * 0.3, rotY + i, rng() * 0.3);
        renderer.scene.add(crystal);
      }
    } else if (r < 0.7) {
      // Mushroom cluster
      for (let i = 0; i < 1 + Math.floor(rng() * 3); i++) {
        const ms = scale * (0.5 + rng() * 0.6);
        const ox = (rng() - 0.5) * 2.5;
        const oz = (rng() - 0.5) * 2.5;
        const stem = renderer.createToonMesh(_mushroomStemGeo, 0xccbb99, { outlineWidth: 0.02 });
        stem.position.set(x + ox, y + 1 * ms, z + oz);
        stem.scale.setScalar(ms);
        renderer.scene.add(stem);
        const cap = renderer.createToonMesh(_mushroomCapGeo, rng() > 0.5 ? 0xcc3344 : 0xdd8844, { outlineWidth: 0.02 });
        cap.position.set(x + ox, y + 2.2 * ms, z + oz);
        cap.scale.setScalar(ms * 1.2);
        renderer.scene.add(cap);
      }
    } else if (r < 0.82) {
      // Fallen log
      const log = renderer.createToonMesh(_trunkTallGeo, 0x5a3a1a, { outlineWidth: 0.02 });
      log.position.set(x, y + 0.4, z);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rotY;
      log.scale.set(scale * 0.8, scale, scale * 0.8);
      renderer.scene.add(log);
    } else {
      // Rock cluster
      for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
        const geo = i === 0 ? _rockGeo : _rockSmallGeo;
        const rock = renderer.createToonMesh(geo, palette.walls || 0x555555, { outlineWidth: 0.02 });
        const ox = (rng() - 0.5) * 3;
        const oz = (rng() - 0.5) * 3;
        const rs = i === 0 ? scale : scale * (0.3 + rng() * 0.4);
        rock.position.set(x + ox, y + 0.4 * rs, z + oz);
        rock.scale.set(rs, rs * 0.7, rs);
        rock.rotation.set(rng() * 0.3, rotY, rng() * 0.2);
        renderer.scene.add(rock);
      }
    }
  } else if (theme.includes('neon') || theme.includes('cyber')) {
    const r = rng();
    if (r < 0.3) {
      // Tall building with roof antenna
      const h = 8 + rng() * 20;
      const building = renderer.createToonMesh(_buildingTallGeo, palette.walls || 0x333344, { outlineWidth: 0.03 });
      building.position.set(x, y + h / 2, z);
      building.scale.set(1 + rng(), h / 16, 1 + rng());
      renderer.scene.add(building);
      const antenna = renderer.createToonMesh(_antennaGeo, 0x888888, { outlineWidth: 0.01 });
      antenna.position.set(x, y + h + 0.5, z);
      antenna.scale.set(1, 2, 1);
      renderer.scene.add(antenna);
      const tip = renderer.createToonMesh(_antennaTipGeo, palette.neon || 0xff00ff, { outlineWidth: 0.01 });
      tip.position.set(x, y + h + 1.3, z);
      tip.scale.setScalar(2);
      renderer.scene.add(tip);
    } else if (r < 0.5) {
      // Short building cluster
      for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
        const h = 4 + rng() * 10;
        const ox = (rng() - 0.5) * 6;
        const oz = (rng() - 0.5) * 6;
        const building = renderer.createToonMesh(_buildingGeo, palette.walls || 0x333344, { outlineWidth: 0.03 });
        building.position.set(x + ox, y + h / 2, z + oz);
        building.scale.set(0.8 + rng() * 0.6, h / 8, 0.8 + rng() * 0.6);
        renderer.scene.add(building);
      }
    } else if (r < 0.7) {
      // Neon pillar
      const pillar = renderer.createToonMesh(_pillarGeo, palette.neon || palette.accent || 0x00ffcc, { outlineWidth: 0.03 });
      pillar.position.set(x, y + 4 * scale, z);
      pillar.scale.setScalar(scale * 0.6);
      renderer.scene.add(pillar);
    } else if (r < 0.85) {
      // Hologram
      const holo = renderer.createToonMesh(_hologramGeo, palette.neon || 0x00ffcc, { outlineWidth: 0.02 });
      holo.position.set(x, y + 4 + rng() * 3, z);
      holo.scale.setScalar(scale * 0.8);
      holo.rotation.set(rng(), rotY, rng());
      if (holo.children[0]?.material) {
        holo.children[0].material.transparent = true;
        holo.children[0].material.opacity = 0.4;
      }
      renderer.scene.add(holo);
    } else {
      // Neon sign
      const sign = renderer.createToonMesh(_signGeo, palette.neon || 0xff00ff, { outlineWidth: 0.02 });
      sign.position.set(x, y + 3 + rng() * 2, z);
      sign.rotation.y = rotY;
      sign.scale.set(scale * 1.5, scale, 1);
      renderer.scene.add(sign);
    }
  } else if (theme.includes('volcan') || theme.includes('lava')) {
    const r = rng();
    if (r < 0.4) {
      // Rock cluster with small debris
      const rock = renderer.createToonMesh(_rockGeo, 0x443322, { outlineWidth: 0.02 });
      rock.position.set(x, y + 0.5 * scale, z);
      rock.scale.set(scale * 1.2, scale * 0.8, scale);
      rock.rotation.set(rng() * 0.3, rotY, 0);
      renderer.scene.add(rock);
      for (let i = 0; i < 3; i++) {
        const sm = renderer.createToonMesh(_rockSmallGeo, 0x332211, { outlineWidth: 0.01 });
        sm.position.set(x + (rng() - 0.5) * 4, y + 0.2, z + (rng() - 0.5) * 4);
        sm.scale.setScalar(0.4 + rng() * 0.6);
        sm.rotation.set(rng(), rng(), rng());
        renderer.scene.add(sm);
      }
    } else if (r < 0.7) {
      // Obsidian spike
      const spike = renderer.createToonMesh(_crystalGeo, 0x111111, { outlineWidth: 0.03 });
      spike.position.set(x, y + 2 * scale, z);
      spike.scale.set(scale * 0.4, scale * 2, scale * 0.4);
      renderer.scene.add(spike);
    } else {
      // Volcanic arch
      const arch = renderer.createToonMesh(_archGeo, 0x553322, { outlineWidth: 0.03 });
      arch.position.set(x, y, z);
      arch.rotation.y = rotY;
      arch.scale.setScalar(scale);
      renderer.scene.add(arch);
    }
  } else if (theme.includes('ocean') || theme.includes('reef') || theme.includes('water')) {
    const r = rng();
    if (r < 0.25) {
      // Coral cluster with branches
      const coral = renderer.createToonMesh(_coralGeo, palette.accent || 0x00ccff, { outlineWidth: 0.02 });
      coral.position.set(x, y + 2 * scale, z);
      coral.scale.set(scale * 0.8, scale, scale * 0.8);
      renderer.scene.add(coral);
      for (let i = 0; i < 3; i++) {
        const branch = renderer.createToonMesh(_coralBranchGeo, rng() > 0.5 ? 0xff6688 : 0xffaa44, { outlineWidth: 0.01 });
        branch.position.set(x + (rng() - 0.5) * 2, y + 1.5 * scale, z + (rng() - 0.5) * 2);
        branch.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.4);
        branch.scale.setScalar(scale * 0.8);
        renderer.scene.add(branch);
      }
    } else if (r < 0.45) {
      // Seaweed patch
      for (let i = 0; i < 4 + Math.floor(rng() * 5); i++) {
        const sw = renderer.createToonMesh(_seaweedGeo, 0x228844 + Math.floor(rng() * 0x002200), { outlineWidth: 0.01 });
        sw.position.set(x + (rng() - 0.5) * 4, y + 1.5 * scale, z + (rng() - 0.5) * 4);
        sw.rotation.set(rng() * 0.3, rng() * Math.PI, rng() * 0.3);
        sw.scale.set(scale * 0.6, scale * (0.6 + rng()), scale * 0.6);
        renderer.scene.add(sw);
      }
    } else if (r < 0.65) {
      // Sea rock with small corals
      const rock = renderer.createToonMesh(_rockGeo, palette.walls || 0x2a3a4a, { outlineWidth: 0.02 });
      rock.position.set(x, y + 0.5 * scale, z);
      rock.scale.set(scale, scale * 0.6, scale);
      rock.rotation.y = rotY;
      renderer.scene.add(rock);
      const miniCoral = renderer.createToonMesh(_coralBranchGeo, 0xff4466, { outlineWidth: 0.01 });
      miniCoral.position.set(x + 0.5, y + scale * 0.8, z);
      miniCoral.scale.setScalar(scale * 0.5);
      renderer.scene.add(miniCoral);
    } else {
      // Anemone
      const stem = renderer.createToonMesh(_mushroomStemGeo, 0x44aa88, { outlineWidth: 0.02 });
      stem.position.set(x, y + 0.8 * scale, z);
      stem.scale.setScalar(scale * 0.7);
      renderer.scene.add(stem);
      const top = renderer.createToonMesh(_mushroomCapGeo, 0xff66aa, { outlineWidth: 0.02 });
      top.position.set(x, y + 1.8 * scale, z);
      top.scale.setScalar(scale * 0.6);
      renderer.scene.add(top);
    }
  } else {
    // Ruins / generic
    const r = rng();
    if (r < 0.25) {
      // Ruined arch
      const arch = renderer.createToonMesh(_archGeo, palette.walls || 0x3a2a3a, { outlineWidth: 0.03 });
      arch.position.set(x, y, z);
      arch.rotation.y = rotY;
      arch.rotation.z = rng() * 0.15;
      arch.scale.setScalar(scale * 0.8);
      renderer.scene.add(arch);
    } else if (r < 0.45) {
      // Broken pillar pair
      for (let i = 0; i < 2; i++) {
        const h = 0.4 + rng() * 0.7;
        const pillar = renderer.createToonMesh(_pillarGeo, palette.walls || 0x3a2a3a, { outlineWidth: 0.03 });
        pillar.position.set(x + (i - 0.5) * 3, y + 4 * h * scale, z);
        pillar.scale.set(scale * 0.5, scale * h, scale * 0.5);
        pillar.rotation.z = (rng() - 0.5) * 0.2;
        renderer.scene.add(pillar);
      }
    } else if (r < 0.65) {
      // Floating rune stone
      const rune = renderer.createToonMesh(_crystalGeo, palette.energy || 0x8800ff, { outlineWidth: 0.03 });
      rune.position.set(x, y + 3 + rng() * 4, z);
      rune.scale.setScalar(scale * 0.5);
      rune.rotation.set(rng(), rotY, rng());
      if (rune.children[0]?.material) {
        rune.children[0].material.transparent = true;
        rune.children[0].material.opacity = 0.6;
      }
      renderer.scene.add(rune);
    } else {
      // Rock debris pile
      for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
        const geo = rng() > 0.5 ? _rockGeo : _rockSmallGeo;
        const rock = renderer.createToonMesh(geo, palette.walls || 0x555555, { outlineWidth: 0.02 });
        const ox = (rng() - 0.5) * 4;
        const oz = (rng() - 0.5) * 4;
        const rs = (rng() > 0.5 ? 1 : 0.4) * scale;
        rock.position.set(x + ox, y + 0.3 * rs, z + oz);
        rock.scale.set(rs, rs * 0.6, rs);
        rock.rotation.set(rng(), rng(), rng() * 0.3);
        renderer.scene.add(rock);
      }
    }
  }
}

// --- Continuous track mesh builder ---

function buildContinuousTrackMesh(waypoints, trackWidth, material, circuit) {
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

  function addCrossSection(px, py, pz, perpX, perpZ, v, localWidth) {
    const w = localWidth != null ? localWidth : trackWidth;
    for (let c = 0; c <= CROSS_DIVS; c++) {
      const t = c / CROSS_DIVS; // 0 = left, 1 = right
      const offset = (t - 0.5) * w;
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
    perps[0].x, perps[0].z, 0,
    circuit ? getTrackWidthAtSegment(circuit, 0, 0) : trackWidth
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

      const localW = circuit ? getTrackWidthAtSegment(circuit, i, t) : trackWidth;
      vAlong += segLen / straightDivs / localW; // UV scale relative to width

      addCrossSection(px, py, pz, lerpX / ll, lerpZ / ll, vAlong, localW);
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

// --- Turret firing ---

function _fireTurret(turretController, itemSystem) {
  const pos = turretController.getWorldPosition();
  const dir = turretController.getWorldDirection();
  itemSystem.fireTurretShot(pos, dir, turretController.kart);
}

// --- Gunner HUD for crew mode ---

let _gunnerHUD = null;

function _createGunnerHUD(vp) {
  _removeGunnerHUD();
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;

  // vp = { x, y, w, h } in 0-1 GL coords (y=0 is bottom)
  // Convert to CSS percentages (top=0 is top of screen)
  const vpX = vp?.x ?? 0.5;
  const vpY = vp?.y ?? 0;
  const vpW = vp?.w ?? 0.5;
  const vpH = vp?.h ?? 1;
  // Center of viewport in screen-space percentages
  const centerX = (vpX + vpW / 2) * 100;
  const centerY = (1 - vpY - vpH / 2) * 100;

  // Absolute screen-space center of the P2 viewport
  const screenCenterX = centerX;
  const screenCenterY = centerY;

  const hud = document.createElement('div');
  hud.id = 'gunner-hud';
  hud.style.cssText = `
    position:absolute;left:0;top:0;width:100%;height:100%;
    pointer-events:none;font-family:'Rajdhani',sans-serif;color:white;
  `;
  hud.innerHTML = `
    <!-- Crosshair (absolute screen center of P2 viewport) -->
    <div id="gunner-crosshair" style="
      position:absolute;top:${screenCenterY}%;left:${screenCenterX}%;transform:translate(-50%,-50%);
      width:40px;height:40px;
    ">
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:2px;height:12px;background:#ff4400;"></div>
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:2px;height:12px;background:#ff4400;"></div>
      <div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:12px;height:2px;background:#ff4400;"></div>
      <div style="position:absolute;right:0;top:50%;transform:translateY(-50%);width:12px;height:2px;background:#ff4400;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;border-radius:50%;border:1px solid #ff4400;"></div>
    </div>
    <!-- Turret angle indicator -->
    <div id="gunner-angle" style="
      position:absolute;top:${(1 - vpY) * 100 - 3}%;left:${screenCenterX}%;transform:translateX(-50%);
      font-size:14px;color:#aaa;letter-spacing:1px;
    ">TURRET 0°</div>
    <!-- Click to lock hint -->
    <div id="gunner-lock-hint" style="
      position:absolute;top:${screenCenterY + 3}%;left:${screenCenterX}%;transform:translate(-50%,0);
      font-size:13px;color:#ff6633;letter-spacing:1px;text-align:center;
      font-family:'Press Start 2P',monospace;
    ">CLICK TO AIM</div>
    <!-- Role label -->
    <div style="
      position:absolute;top:${(1 - vpY - vpH) * 100 + 1}%;left:${screenCenterX}%;transform:translateX(-50%);
      font-family:'Press Start 2P',monospace;font-size:11px;
      color:#ff6633;letter-spacing:2px;
    ">GUNNER</div>
  `;
  overlay.appendChild(hud);
  _gunnerHUD = hud;

  // Driver label on P1 viewport
  const driverLabel = document.createElement('div');
  driverLabel.id = 'driver-label';
  const drvLeft = (vp?.x === 0.5) ? 25 : 50; // left half or top half
  const drvTop = (vp?.y === 0.5) ? 'top:calc(12px)' : 'top:12px';
  driverLabel.style.cssText = `
    position:absolute;${drvTop};left:${drvLeft}%;transform:translateX(-50%);
    font-family:'Press Start 2P',monospace;font-size:11px;
    color:#ff6633;letter-spacing:2px;pointer-events:none;
  `;
  driverLabel.textContent = 'DRIVER';
  overlay.appendChild(driverLabel);
}

function _updateGunnerHUD(turretController, heldItem) {
  if (!_gunnerHUD) return;

  // Angle display
  const angleEl = _gunnerHUD.querySelector('#gunner-angle');
  if (angleEl) {
    const deg = Math.round(turretController.yaw * 180 / Math.PI);
    angleEl.textContent = `TURRET ${deg > 0 ? '+' : ''}${deg}°`;
  }

  // Item slot
  const itemEl = _gunnerHUD.querySelector('#gunner-item');
  if (itemEl) {
    const hasItem = heldItem && heldItem !== '-';
    itemEl.textContent = hasItem ? heldItem : '-';
    itemEl.style.borderColor = hasItem ? '#ff4400' : '#555';
  }

  // Lock hint: hide when pointer is locked
  const hintEl = _gunnerHUD.querySelector('#gunner-lock-hint');
  if (hintEl) {
    hintEl.style.display = document.pointerLockElement ? 'none' : 'block';
  }
}

function _removeGunnerHUD() {
  const existing = document.getElementById('gunner-hud');
  if (existing) existing.remove();
  const dLabel = document.getElementById('driver-label');
  if (dLabel) dLabel.remove();
  _gunnerHUD = null;
}

export function cleanupRace() {
  _removeGunnerHUD();
  if (raceCleanup) raceCleanup();
}

export function setFogEnabled(enabled) {
  _fogEnabled = enabled;
  const near = enabled ? _fogOriginals.near : 99999;
  const far = enabled ? _fogOriginals.far : 100000;
  for (const u of shaderUniforms) {
    if (u.fogNear) u.fogNear.value = near;
    if (u.fogFar) u.fogFar.value = far;
  }
}
