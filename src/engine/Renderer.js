import * as THREE from 'three';
import toonVert from '../shaders/toon.vert.glsl';
import toonFrag from '../shaders/toon.frag.glsl';

const QUALITY_PRESETS = {
  low: { pixelRatio: 0.5, shadowMapSize: 512, shadows: false, particles: 'reduced' },
  medium: { pixelRatio: 0.75, shadowMapSize: 1024, shadows: true, particles: 'normal' },
  high: { pixelRatio: 1.0, shadowMapSize: 2048, shadows: true, particles: 'normal' },
  ultra: { pixelRatio: window.devicePixelRatio || 1, shadowMapSize: 4096, shadows: true, particles: 'maximum' }
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = 'high';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(0x1a1a2e);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();

    // Main camera (single player default)
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 8, -12);
    this.camera.lookAt(0, 0, 0);

    // Directional light with shadow map
    this.light = new THREE.DirectionalLight(0xffffff, 1.5);
    this.light.position.set(50, 80, 30);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 200;
    this.light.shadow.camera.left = -80;
    this.light.shadow.camera.right = 80;
    this.light.shadow.camera.top = 80;
    this.light.shadow.camera.bottom = -80;
    this.scene.add(this.light);

    this.ambient = new THREE.AmbientLight(0x404060, 0.4);
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
    // configs: [{ camera, x, y, w, h }] in normalized [0,1] coordinates
    this.viewports = configs;
  }

  setupSplitScreen(playerCount, orientation = 'horizontal') {
    // Generate viewport configs and cameras for N players
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
      // 4 quadrants
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

  createToonMaterial(color, options = {}) {
    const uniforms = {
      color: { value: new THREE.Color(color) },
      lightDirection: { value: new THREE.Vector3(50, 80, 30).normalize() },
      lightColor: { value: new THREE.Color(0xffffff) },
      ambientColor: { value: new THREE.Color(0x404060) },
      steps: { value: options.steps || 3.0 },
      rimPower: { value: options.rimPower || 3.0 },
      rimColor: { value: new THREE.Color(options.rimColor || 0xffffff) },
      outlineWidth: { value: 0.0 },
      isOutline: { value: false },
      outlineColor: { value: new THREE.Color(0x000000) }
    };

    return new THREE.ShaderMaterial({
      vertexShader: toonVert,
      fragmentShader: toonFrag,
      uniforms,
      side: THREE.FrontSide
    });
  }

  createOutlineMaterial(width = 0.03, color = 0x000000) {
    return new THREE.ShaderMaterial({
      vertexShader: toonVert,
      fragmentShader: toonFrag,
      uniforms: {
        color: { value: new THREE.Color(0x000000) },
        lightDirection: { value: new THREE.Vector3(50, 80, 30).normalize() },
        lightColor: { value: new THREE.Color(0xffffff) },
        ambientColor: { value: new THREE.Color(0x404060) },
        steps: { value: 3.0 },
        rimPower: { value: 3.0 },
        rimColor: { value: new THREE.Color(0xffffff) },
        outlineWidth: { value: width },
        isOutline: { value: true },
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
    const outlineMesh = new THREE.Mesh(geometry, this.createOutlineMaterial(options.outlineWidth || 0.03));
    group.add(outlineMesh);

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

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Cube camera for reflections on metallic karts
  createReflectionProbe(position) {
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });
    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    cubeCamera.position.copy(position);
    this.scene.add(cubeCamera);
    return { cubeCamera, cubeRenderTarget };
  }

  updateReflectionProbe(probe, position) {
    probe.cubeCamera.position.copy(position);
    probe.cubeCamera.update(this.renderer, this.scene);
  }

  // Cell-shaded lens flare (billboard sprite)
  createLensFlare(position, color = 0xffaa44, size = 4) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const flare = new THREE.Mesh(geo, mat);
    flare.position.copy(position);
    flare.renderOrder = 999;
    this.scene.add(flare);
    return flare;
  }

  updateLensFlares(camera) {
    // Make flares face camera (billboard)
    this.scene.traverse(child => {
      if (child.material?.blending === THREE.AdditiveBlending && child.geometry?.type === 'PlaneGeometry') {
        child.lookAt(camera.position);
      }
    });
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
