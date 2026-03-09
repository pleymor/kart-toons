import * as THREE from 'three';

const QUALITY_PRESETS = {
  low: { pixelRatio: 0.5, shadowMapSize: 512, shadows: false, particles: 'reduced' },
  medium: { pixelRatio: 0.75, shadowMapSize: 1024, shadows: true, particles: 'normal' },
  high: { pixelRatio: 1.0, shadowMapSize: 2048, shadows: true, particles: 'normal' },
  ultra: { pixelRatio: window.devicePixelRatio || 1, shadowMapSize: 4096, shadows: true, particles: 'maximum' }
};

// 3-step gradient texture for MeshToonMaterial
function createToonGradient(steps = 4) {
  const size = steps;
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.round((Math.floor((i / size) * steps + 0.5) / steps) * 255);
  }
  const tex = new THREE.DataTexture(data, size, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const _toonGradient3 = createToonGradient(3);
const _toonGradient4 = createToonGradient(4);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = 'high';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(0x1a1a2e);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();

    // Main camera (single player default)
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 8, -12);
    this.camera.lookAt(0, 0, 0);

    // Directional light (sun) with shadow map — follows the player
    this.light = new THREE.DirectionalLight(0xffeedd, 1.8);
    this.light.position.set(40, 60, 20);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.camera.near = 1;
    this.light.shadow.camera.far = 150;
    this.light.shadow.camera.left = -50;
    this.light.shadow.camera.right = 50;
    this.light.shadow.camera.top = 50;
    this.light.shadow.camera.bottom = -50;
    this.light.shadow.bias = -0.002;
    this.light.shadow.normalBias = 0.02;
    this.scene.add(this.light);
    this.scene.add(this.light.target);

    // Light offset from player (sun direction)
    this._lightOffset = new THREE.Vector3(40, 60, 20);

    // Hemisphere light for natural sky/ground ambient
    this.hemiLight = new THREE.HemisphereLight(0x88aacc, 0x444422, 0.6);
    this.scene.add(this.hemiLight);

    // Low ambient fill
    this.ambient = new THREE.AmbientLight(0x303040, 0.3);
    this.scene.add(this.ambient);

    // Split-screen viewports
    this.viewports = [{ camera: this.camera, x: 0, y: 0, w: 1, h: 1 }];

    // FPS counter
    this.showFPS = false;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.currentFPS = 60;

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();

    this.applyQuality(this.quality);
  }

  applyQuality(preset) {
    const q = QUALITY_PRESETS[preset] || QUALITY_PRESETS.high;
    this.quality = preset;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadows;
    this.light.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    this._onResize();
  }

  setViewports(configs) {
    this.viewports = configs;
  }

  setupSplitScreen(playerCount, orientation = 'horizontal') {
    const cameras = [];
    const configs = [];

    for (let i = 0; i < playerCount; i++) {
      const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      cam.position.set(0, 8, -12);
      cameras.push(cam);
    }

    if (playerCount === 1) {
      configs.push({ camera: cameras[0], x: 0, y: 0, w: 1, h: 1 });
    } else if (playerCount === 2) {
      if (orientation === 'horizontal') {
        configs.push({ camera: cameras[0], x: 0, y: 0.5, w: 1, h: 0.5 });
        configs.push({ camera: cameras[1], x: 0, y: 0, w: 1, h: 0.5 });
      } else {
        configs.push({ camera: cameras[0], x: 0, y: 0, w: 0.5, h: 1 });
        configs.push({ camera: cameras[1], x: 0.5, y: 0, w: 0.5, h: 1 });
      }
    } else if (playerCount === 3) {
      configs.push({ camera: cameras[0], x: 0, y: 0.5, w: 0.5, h: 0.5 });
      configs.push({ camera: cameras[1], x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
      configs.push({ camera: cameras[2], x: 0.25, y: 0, w: 0.5, h: 0.5 });
    } else {
      configs.push({ camera: cameras[0], x: 0, y: 0.5, w: 0.5, h: 0.5 });
      configs.push({ camera: cameras[1], x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
      configs.push({ camera: cameras[2], x: 0, y: 0, w: 0.5, h: 0.5 });
      configs.push({ camera: cameras[3], x: 0.5, y: 0, w: 0.5, h: 0.5 });
    }

    this.setViewports(configs);
    return cameras;
  }

  resetSinglePlayer() {
    this.viewports = [{ camera: this.camera, x: 0, y: 0, w: 1, h: 1 }];
  }

  // Set lighting theme based on circuit
  setLightingTheme(theme) {
    const t = (theme || '').toLowerCase();
    if (t.includes('volcan') || t.includes('lava')) {
      this.light.color.setHex(0xffaa66);
      this.light.intensity = 1.4;
      this.hemiLight.color.setHex(0x664422);
      this.hemiLight.groundColor.setHex(0x331100);
      this.hemiLight.intensity = 0.5;
      this.ambient.color.setHex(0x442211);
      this.ambient.intensity = 0.4;
    } else if (t.includes('ocean') || t.includes('reef')) {
      this.light.color.setHex(0xaaccff);
      this.light.intensity = 1.2;
      this.hemiLight.color.setHex(0x6688bb);
      this.hemiLight.groundColor.setHex(0x223344);
      this.hemiLight.intensity = 0.7;
      this.ambient.color.setHex(0x223344);
      this.ambient.intensity = 0.4;
    } else if (t.includes('neon') || t.includes('cyber')) {
      this.light.color.setHex(0x8888cc);
      this.light.intensity = 1.0;
      this.hemiLight.color.setHex(0x222244);
      this.hemiLight.groundColor.setHex(0x111122);
      this.hemiLight.intensity = 0.4;
      this.ambient.color.setHex(0x222233);
      this.ambient.intensity = 0.5;
    } else if (t.includes('forest') || t.includes('crystal')) {
      this.light.color.setHex(0xffeebb);
      this.light.intensity = 1.6;
      this.hemiLight.color.setHex(0x88aa66);
      this.hemiLight.groundColor.setHex(0x334422);
      this.hemiLight.intensity = 0.7;
      this.ambient.color.setHex(0x334433);
      this.ambient.intensity = 0.3;
    } else {
      this.light.color.setHex(0xffeedd);
      this.light.intensity = 1.8;
      this.hemiLight.color.setHex(0x88aacc);
      this.hemiLight.groundColor.setHex(0x444422);
      this.hemiLight.intensity = 0.6;
      this.ambient.color.setHex(0x303040);
      this.ambient.intensity = 0.3;
    }
  }

  // Make the shadow-casting light follow a world position (player kart)
  updateLightTarget(targetPosition) {
    this.light.position.copy(targetPosition).add(this._lightOffset);
    this.light.target.position.copy(targetPosition);
  }

  createToonMaterial(color, options = {}) {
    const gradientMap = (options.steps === 4) ? _toonGradient4 : _toonGradient3;
    const mat = new THREE.MeshToonMaterial({
      color,
      gradientMap
    });
    return mat;
  }

  createOutlineMaterial(width = 0.03, color = 0x000000) {
    // Simple outline material - vertex displacement along normals
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float outlineWidth;
        void main() {
          vec3 pos = position + normal * outlineWidth;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 outlineColor;
        void main() {
          gl_FragColor = vec4(outlineColor, 1.0);
        }
      `,
      uniforms: {
        outlineWidth: { value: width },
        outlineColor: { value: new THREE.Color(color) }
      },
      side: THREE.BackSide
    });
  }

  createToonMesh(geometry, color, options = {}) {
    const group = new THREE.Group();

    const mainMesh = new THREE.Mesh(geometry, this.createToonMaterial(color, options));
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // Outline via inverted hull
    if (options.outlineWidth > 0) {
      const outlineMesh = new THREE.Mesh(geometry, this.createOutlineMaterial(options.outlineWidth));
      group.add(outlineMesh);
    }

    return group;
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.renderer.clear();

    for (const vp of this.viewports) {
      const x = Math.floor(vp.x * w);
      const y = Math.floor(vp.y * h);
      const vpW = Math.floor(vp.w * w);
      const vpH = Math.floor(vp.h * h);

      this.renderer.setViewport(x, y, vpW, vpH);
      this.renderer.setScissor(x, y, vpW, vpH);
      this.renderer.setScissorTest(true);

      vp.camera.aspect = vpW / vpH;
      vp.camera.updateProjectionMatrix();

      this.renderer.render(this.scene, vp.camera);
    }

    // FPS tracking
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsTime >= 1000) {
      this.currentFPS = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsTime = now;
    }
  }

  /**
   * Render a rearview mirror into a sub-region of the canvas.
   * Call after render() so it draws on top.
   * rect: { x, y, w, h } in pixels (bottom-left origin for WebGL).
   */
  renderRearview(camera, rect) {
    this.renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
    this.renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
    this.renderer.setScissorTest(true);
    camera.aspect = rect.w / rect.h;
    camera.updateProjectionMatrix();
    // Add temporary fill light so rearview isn't dark
    if (!this._rearviewLight) {
      this._rearviewLight = new THREE.AmbientLight(0xffffff, 1.5);
    }
    this.scene.add(this._rearviewLight);
    this.renderer.render(this.scene, camera);
    this.scene.remove(this._rearviewLight);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
