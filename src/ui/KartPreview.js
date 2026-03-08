import * as THREE from 'three';

const PREVIEW_SIZE = 128;
let _renderer = null;
let _scene = null;
let _camera = null;
let _light = null;
let _cache = new Map();

function ensureSetup() {
  if (_renderer) return;
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  _renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  _renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
  _renderer.setClearColor(0x000000, 0);

  _scene = new THREE.Scene();

  _camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  _camera.position.set(3, 2.5, 4);
  _camera.lookAt(0, 0.5, 0);

  _light = new THREE.DirectionalLight(0xffffff, 2.0);
  _light.position.set(3, 5, 3);
  _scene.add(_light);

  const hemi = new THREE.HemisphereLight(0x88aacc, 0x444422, 0.8);
  _scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x404060, 0.5);
  _scene.add(ambient);
}

// 3-step toon gradient
function createToonGradient() {
  const data = new Uint8Array([0, 85, 170, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const _toonGrad = createToonGradient();

function createPreviewMesh(character) {
  const col = character.kartColor;
  const acc = character.kartAccent;
  const type = character.kartPhysicsType || 'wheeled';
  const w = character.stats?.weight || 4;
  const group = new THREE.Group();

  const toonMat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: _toonGrad });
  const darkMat = toonMat(0x222222);

  // Body
  const heavy = w >= 6;
  const light = w <= 3;
  let bodyGeo, bodyY;
  if (type === 'levitating') {
    bodyGeo = new THREE.BoxGeometry(1.6, 0.4, 3.4);
    bodyY = 0.7;
  } else if (type === 'tracked') {
    bodyGeo = new THREE.BoxGeometry(2.4, 0.8, 3.2);
    bodyY = 0.6;
  } else if (heavy) {
    bodyGeo = new THREE.BoxGeometry(2.4, 0.8, 3.2);
    bodyY = 0.55;
  } else if (light) {
    bodyGeo = new THREE.BoxGeometry(1.6, 0.4, 3.4);
    bodyY = 0.5;
  } else {
    bodyGeo = new THREE.BoxGeometry(2, 0.6, 3);
    bodyY = 0.5;
  }
  const body = new THREE.Mesh(bodyGeo, toonMat(col));
  body.position.y = bodyY;
  body.castShadow = true;
  group.add(body);

  // Cockpit
  if (type === 'levitating') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      toonMat(acc)
    );
    dome.position.set(0, 1.1, -0.1);
    group.add(dome);
  } else {
    const cockGeo = light
      ? new THREE.BoxGeometry(1.0, 0.4, 0.8)
      : new THREE.BoxGeometry(1.2, 0.5, 1.0);
    const cock = new THREE.Mesh(cockGeo, toonMat(acc));
    cock.position.set(0, bodyY + 0.5, -0.2);
    group.add(cock);
  }

  // Wheels / treads / hover pads
  if (type === 'levitating') {
    const padGeo = new THREE.CylinderGeometry(0.6, 0.5, 0.12, 8);
    for (const [x, z] of [[-0.7, 1], [0.7, 1], [-0.7, -1], [0.7, -1]]) {
      const pad = new THREE.Mesh(padGeo, toonMat(acc));
      pad.position.set(x, 0.35, z);
      group.add(pad);
    }
  } else if (type === 'tracked') {
    const trackGeo = new THREE.BoxGeometry(0.4, 0.3, 2.4);
    for (const side of [-1.2, 1.2]) {
      const track = new THREE.Mesh(trackGeo, darkMat);
      track.position.set(side, 0.3, 0);
      group.add(track);
    }
  } else {
    const wGeo = heavy
      ? new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12)
      : new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
    const positions = heavy
      ? [[-1.1, 0.45, 1.1], [1.1, 0.45, 1.1], [-1.1, 0.45, -1.1], [1.1, 0.45, -1.1]]
      : [[-0.9, 0.35, 1.0], [0.9, 0.35, 1.0], [-0.9, 0.35, -1.0], [0.9, 0.35, -1.0]];
    for (const [x, y, z] of positions) {
      const wheel = new THREE.Mesh(wGeo, darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      group.add(wheel);
    }
    // Hybrid: rear hover pads
    if (type === 'hybrid') {
      const padGeo = new THREE.CylinderGeometry(0.6, 0.5, 0.12, 8);
      for (const [x, z] of [[-0.8, -1], [0.8, -1]]) {
        const pad = new THREE.Mesh(padGeo, toonMat(acc));
        pad.position.set(x, 0.3, z);
        group.add(pad);
      }
    }
  }

  // Spoiler for light/hybrid
  if (light || type === 'hybrid') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), toonMat(acc));
    spoiler.position.set(0, 1.1, -1.4);
    group.add(spoiler);
  }

  return group;
}

/**
 * Render a kart preview for a character and return a data URL.
 * Results are cached by character id.
 */
export function renderKartPreview(character) {
  if (_cache.has(character.id)) return _cache.get(character.id);

  ensureSetup();

  // Clear previous meshes from scene (keep lights)
  const toRemove = [];
  _scene.traverse(c => { if (c.isMesh) toRemove.push(c); });
  toRemove.forEach(m => m.parent.remove(m));

  const mesh = createPreviewMesh(character);
  _scene.add(mesh);

  // Render multiple frames for a 3/4 angle
  mesh.rotation.y = -0.6;
  _renderer.render(_scene, _camera);
  const dataUrl = _renderer.domElement.toDataURL('image/png');

  _scene.remove(mesh);

  _cache.set(character.id, dataUrl);
  return dataUrl;
}

/**
 * Start rotating a kart preview in a canvas element.
 * Returns a cleanup function to stop the animation.
 */
export function startRotatingPreview(canvasEl, character) {
  ensureSetup();

  const ctx = canvasEl.getContext('2d');
  const size = canvasEl.width;

  const mesh = createPreviewMesh(character);
  _scene.add(mesh);

  let angle = -0.6;
  let frameId;

  function animate() {
    angle += 0.015;
    mesh.rotation.y = angle;

    // Hide all other groups, render only this one
    const hidden = [];
    for (const child of _scene.children) {
      if (child.isGroup && child !== mesh && child.visible) {
        child.visible = false;
        hidden.push(child);
      }
    }
    _renderer.render(_scene, _camera);
    for (const child of hidden) child.visible = true;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(_renderer.domElement, 0, 0, size, size);

    frameId = requestAnimationFrame(animate);
  }

  frameId = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(frameId);
    _scene.remove(mesh);
  };
}
