const SCENE = {
  MENU: 'menu',
  CHARACTER_SELECT: 'character-select',
  CIRCUIT_SELECT: 'circuit-select',
  RACE: 'race',
  RESULTS: 'results',
  LOBBY: 'lobby'
};

let currentScene = SCENE.MENU;
let lastTime = 0;
let running = true;
let paused = false;

// Systems (initialized lazily)
let renderer = null;
let physics = null;
let inputManager = null;
let audioEngine = null;
let raceManager = null;
let itemSystem = null;
let aiControllers = [];
let playerKart = null;
let uiOverlay = document.getElementById('ui-overlay');

function getDelta(now) {
  const delta = Math.min((now - lastTime) / 1000, 1 / 20); // cap at 50ms
  lastTime = now;
  return delta;
}

function update(delta) {
  if (paused) return;
  // Race scene has its own loop in RaceSetup.js — no updates here
}

function render() {
  // Only render for non-race scenes; race has its own render in RaceSetup
  if (renderer && currentScene !== 'race') renderer.render();
}

function gameLoop(now) {
  if (!running) return;
  const delta = getDelta(now);
  update(delta);
  render();
  requestAnimationFrame(gameLoop);
}

// Scene transitions
export function setScene(scene, data = {}) {
  currentScene = scene;
  uiOverlay.innerHTML = '';

  // Menu music plays across all non-race scenes
  if (audioEngine) {
    if (scene === SCENE.RACE) {
      audioEngine.stopMenuMusic();
    } else {
      audioEngine.startMenuMusic();
    }
  }

  switch (scene) {
    case SCENE.MENU:
      import('./ui/MainMenu.js').then(m => m.show(uiOverlay));
      break;
    case SCENE.CHARACTER_SELECT:
      import('./ui/CharacterSelect.js').then(m => m.show(uiOverlay, data));
      break;
    case SCENE.CIRCUIT_SELECT:
      import('./ui/CircuitSelect.js').then(m => m.show(uiOverlay, data));
      break;
    case SCENE.RACE:
      import('./ui/HUD.js').then(m => m.show(uiOverlay));
      break;
    case SCENE.RESULTS:
      import('./ui/ResultsScreen.js').then(m => m.show(uiOverlay, data));
      break;
    case SCENE.LOBBY:
      import('./ui/LobbyUI.js').then(m => m.show(uiOverlay, data));
      break;
  }
}

export function setPaused(value) {
  paused = value;
}

export function getPaused() {
  return paused;
}

export function getRenderer() { return renderer; }
export function getPhysics() { return physics; }
export function getInputManager() { return inputManager; }
export function getAudioEngine() { return audioEngine; }
export function getRaceManager() { return raceManager; }
export function getItemSystem() { return itemSystem; }
export function getPlayerKart() { return playerKart; }
export function getAIControllers() { return aiControllers; }

export function setRaceState({ raceManagerInstance, itemSystemInstance, playerKartInstance, aiControllerInstances }) {
  raceManager = raceManagerInstance;
  itemSystem = itemSystemInstance;
  playerKart = playerKartInstance;
  aiControllers = aiControllerInstances || [];
}

// Boot
async function init() {
  const { Renderer } = await import('./engine/Renderer.js');
  const { Physics } = await import('./engine/Physics.js');
  const { InputManager } = await import('./engine/InputManager.js');
  const { AudioEngine } = await import('./engine/AudioEngine.js');
  const { QualityDetector } = await import('./utils/QualityDetector.js');
  const { Storage } = await import('./utils/Storage.js');

  const canvas = document.getElementById('game-canvas');

  renderer = new Renderer(canvas);
  physics = new Physics();
  await physics.init();
  inputManager = new InputManager();
  audioEngine = new AudioEngine();

  // Auto quality detection
  const qualityDetector = new QualityDetector();
  const recommendedQuality = qualityDetector.detect();
  const settings = Storage.getSettings();

  if (qualityDetector.isMobile) {
    renderer.applyQuality(settings.quality || 'low');
    inputManager.initTouch();
    const { initOrientationCheck } = await import('./ui/HUD.js');
    initOrientationCheck();
  } else {
    renderer.applyQuality(settings.quality || recommendedQuality);
  }

  // Apply saved settings
  const { applySettings } = await import('./ui/PauseMenu.js');
  applySettings(settings);

  setScene(SCENE.MENU);

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

init().catch(err => console.error('Failed to initialize KHAOS KART:', err));
