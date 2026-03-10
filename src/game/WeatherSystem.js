import * as THREE from 'three';

export class WeatherSystem {
  constructor(scene, circuit, renderer) {
    this.scene = scene;
    this.circuit = circuit;
    this.renderer = renderer;

    this.activeWeather = null;
    this.weatherTimer = 0;
    this.nextWeatherIn = 60 + Math.random() * 60; // 60-120s
    this._originalFog = null; // saved scene fog before weather override

    // Particle system for weather effects
    this.particles = null;
    this.particleCount = 500;
  }

  update(delta, participants) {
    // Count down to next weather event
    if (!this.activeWeather) {
      this.nextWeatherIn -= delta;
      if (this.nextWeatherIn <= 0 && this.circuit.weatherPool?.length > 0) {
        this._startWeather();
      }
      return;
    }

    // Active weather
    this.weatherTimer -= delta;

    // Apply gameplay modifiers
    if (participants) {
      for (const p of participants) {
        const kart = p.kartController;
        // Grip modifier
        if (this.activeWeather.gripModifier) {
          const ignoreGrip = kart.character?.passive?.effectModifiers?.ignoreGripPenalty;
          if (!ignoreGrip) {
            kart.surfaceFriction = Math.max(0.1, 1.0 + this.activeWeather.gripModifier);
          }
        }
      }
    }

    // Update particles
    if (this.particles) {
      this._updateParticles(delta);
    }

    // End weather
    if (this.weatherTimer <= 0) {
      this._endWeather();
    }
  }

  _startWeather() {
    const pool = this.circuit.weatherPool;
    this.activeWeather = pool[Math.floor(Math.random() * pool.length)];
    this.weatherTimer = this.activeWeather.duration;

    // Create particle effects
    this._createParticles();

    // Apply visibility — save original fog so we can restore it later
    if (this.activeWeather.visibilityModifier < 1.0) {
      this._originalFog = this.scene.fog;
      const fogDensity = (1.0 - this.activeWeather.visibilityModifier) * 0.006;
      this.scene.fog = new THREE.FogExp2(0x222222, fogDensity);
    }
  }

  _endWeather() {
    this.activeWeather = null;
    this.nextWeatherIn = 60 + Math.random() * 60;

    // Remove particles
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles = null;
    }

    // Restore original fog
    this.scene.fog = this._originalFog;
    this._originalFog = null;
  }

  _createParticles() {
    const type = this.activeWeather.type;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);

    let color = 0xaaaaaa;
    let size = 0.3;

    switch (type) {
      case 'rain':
      case 'acid-rain':
        color = type === 'acid-rain' ? 0x88ff44 : 0x8888cc;
        size = 0.15;
        for (let i = 0; i < this.particleCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 200;
          positions[i * 3 + 1] = Math.random() * 50;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
          velocities[i * 3 + 1] = -30 - Math.random() * 20;
        }
        break;
      case 'blizzard':
        color = 0xffffff;
        size = 0.4;
        for (let i = 0; i < this.particleCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 200;
          positions[i * 3 + 1] = Math.random() * 30;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
          velocities[i * 3] = -5 + Math.random() * 10;
          velocities[i * 3 + 1] = -5 - Math.random() * 5;
          velocities[i * 3 + 2] = Math.random() * 5;
        }
        break;
      case 'ash':
        color = 0x555555;
        size = 0.5;
        for (let i = 0; i < this.particleCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 200;
          positions[i * 3 + 1] = Math.random() * 40;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
          velocities[i * 3 + 1] = -2 - Math.random() * 3;
        }
        break;
      default:
        for (let i = 0; i < this.particleCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 200;
          positions[i * 3 + 1] = Math.random() * 30;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
          velocities[i * 3 + 1] = -10;
        }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.userData = { velocities };

    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.6 });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  _updateParticles(delta) {
    const positions = this.particles.geometry.attributes.position.array;
    const velocities = this.particles.geometry.userData.velocities;

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] += (velocities[i * 3] || 0) * delta;
      positions[i * 3 + 1] += (velocities[i * 3 + 1] || 0) * delta;
      positions[i * 3 + 2] += (velocities[i * 3 + 2] || 0) * delta;

      // Reset particles that fall below ground
      if (positions[i * 3 + 1] < -2) {
        positions[i * 3 + 1] = 30 + Math.random() * 20;
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  getActiveWeather() {
    return this.activeWeather;
  }

  dispose() {
    if (this.particles) {
      this.scene.remove(this.particles);
    }
    if (this._originalFog) {
      this.scene.fog = this._originalFog;
      this._originalFog = null;
    }
  }
}
