import * as THREE from 'three';
import { createKartMesh } from '../game/RaceSetup.js';

const PREVIEW_SIZE = 128;
let _renderer = null;
let _scene = null;
let _camera = null;
let _cache = new Map();

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

/** Mini renderer adapter that mimics the game Renderer's createToonMesh API */
const _previewRenderer = {
  createToonMesh(geometry, color, options = {}) {
    const group = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ color, gradientMap: _toonGrad });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    group.add(mesh);
    if (options.outlineWidth > 0) {
      const outlineMat = new THREE.ShaderMaterial({
        vertexShader: `
          uniform float outlineWidth;
          void main() {
            vec3 pos = position + normal * outlineWidth;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }
        `,
        uniforms: { outlineWidth: { value: options.outlineWidth } },
        side: THREE.BackSide
      });
      group.add(new THREE.Mesh(geometry, outlineMat));
    }
    return group;
  }
};

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

  const light = new THREE.DirectionalLight(0xffffff, 2.0);
  light.position.set(3, 5, 3);
  _scene.add(light);

  const hemi = new THREE.HemisphereLight(0x88aacc, 0x444422, 0.8);
  _scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x404060, 0.5);
  _scene.add(ambient);
}

/**
 * Render a kart preview for a character and return a data URL.
 * Results are cached by character id.
 */
export function renderKartPreview(character) {
  if (_cache.has(character.id)) return _cache.get(character.id);

  ensureSetup();

  const mesh = createKartMesh(_previewRenderer, character);
  _scene.add(mesh);

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

  const mesh = createKartMesh(_previewRenderer, character);
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
