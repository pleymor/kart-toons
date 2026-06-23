import { Howl, Howler } from 'howler';

// Map SFX names to actual file paths (ogg/wav/mp3 as available)
const SFX_FILES = {
  'item-pickup':  ['/assets/audio/item-pickup.wav'],
  'explosion':    ['/assets/audio/explosion.wav'],
  'boost':        ['/assets/audio/boost.ogg'],
  'boost-loop':   ['/assets/audio/boost-loop.ogg'],
  'collision':    ['/assets/audio/collision.ogg'],
  'collision2':   ['/assets/audio/collision2.ogg'],
  'drift':        ['/assets/audio/drift.ogg'],
  'horn':         ['/assets/audio/horn.ogg'],
  'projectile':   ['/assets/audio/projectile.ogg'],
  'laser':        ['/assets/audio/laser.ogg'],
  'laser2':       ['/assets/audio/laser2.ogg'],
  'mine-beep':    ['/assets/audio/mine-beep.ogg'],
  'shield':       ['/assets/audio/shield.ogg'],
  'emp':          ['/assets/audio/emp.ogg'],
  'teleport':     ['/assets/audio/teleport.ogg'],
  'splash':       ['/assets/audio/splash.ogg'],
  'slam':         ['/assets/audio/slam.ogg'],
  'countdown-3':  ['/assets/audio/countdown-3.wav'],
  'countdown-2':  ['/assets/audio/countdown-2.wav'],
  'countdown-1':  ['/assets/audio/countdown-1.wav'],
  'countdown-go': ['/assets/audio/countdown-go.wav']
};

// Available race music tracks
const RACE_TRACKS = ['race1', 'race2'];

export class AudioEngine {
  constructor() {
    this.masterVolume = 1.0;
    this.musicVolume = 0.7;
    this.sfxVolume = 0.8;
    this.engineVolume = 0.6;
    this.spatialEnabled = true;
    this.musicMode = 'dynamic'; // 'dynamic' | 'chill' | 'off'

    // We manage the unlock gesture ourselves (see _installAutoUnlock). Howler's
    // own autoUnlock would, on the first gesture, call Howler.unload() to rebuild
    // the context at 44.1kHz — closing the context (and unloading our music) on
    // the common 48kHz desktop case. Disabling it keeps a single stable context.
    Howler.autoUnlock = false;

    // SFX pool
    this.sfxPool = new Map();

    // Music system (single track with last-lap variant)
    this.raceMusic = null;
    this.lastLapMusic = null;
    this.menuMusic = null;
    this._currentTrack = null;
    this._isLastLap = false;

    // Engine synth
    this.engineOsc = null;
    this.engineGain = null;

    // Autoplay policy: browsers forbid creating/starting an AudioContext before
    // a user gesture. We touch nothing in Howler until the first interaction.
    this.unlocked = false;
    /** @type {?() => void} Called once when audio is unlocked by a gesture. */
    this.onUnlock = null;

    this._installAutoUnlock();
  }

  /**
   * The live Web Audio context. Always read from Howler so we never hold a
   * stale reference if Howler ever rebuilds it. Null until the first gesture.
   * @returns {?AudioContext}
   */
  get audioContext() {
    return Howler.ctx || null;
  }

  /**
   * Register one-time listeners that create and resume the AudioContext on the
   * first user gesture, satisfying the browser autoplay policy. Until then no
   * Howler API is called, so the context is never constructed prematurely.
   * Self-removing and idempotent.
   * @private
   */
  _installAutoUnlock() {
    if (typeof window === 'undefined') return;

    const events = ['pointerdown', 'keydown', 'touchstart'];
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;

      // Creating the context here (inside the gesture) is allowed by the browser.
      Howler.volume(this.masterVolume);
      const ctx = this.audioContext;
      if (ctx && ctx.state === 'suspended') ctx.resume();
      this._initEngineSynth();

      events.forEach(e => window.removeEventListener(e, unlock));
      if (typeof this.onUnlock === 'function') this.onUnlock();
    };

    events.forEach(e => window.addEventListener(e, unlock));
  }

  _initEngineSynth() {
    if (!this.audioContext) return;

    this.engineGain = this.audioContext.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.audioContext.destination);
  }

  startEngine() {
    if (!this.audioContext || this.engineOsc) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.engineOsc = this.audioContext.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.gain.value = this.engineVolume * this.masterVolume * 0.15;
    this.engineOsc.start();
  }

  updateEngineSound(speed, maxSpeed) {
    if (!this.engineOsc) return;
    const ratio = Math.max(0, Math.min(speed / maxSpeed, 1));
    this.engineOsc.frequency.value = 60 + ratio * 160;
    this.engineGain.gain.value = (0.08 + ratio * 0.12) * this.engineVolume * this.masterVolume;
  }

  stopEngine() {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc.disconnect();
      this.engineOsc = null;
    }
  }

  playSFX(name, options = {}) {
    const files = SFX_FILES[name];
    if (!files) return;

    if (!this.sfxPool.has(name)) {
      this.sfxPool.set(name, new Howl({
        src: files,
        volume: this.sfxVolume * this.masterVolume,
        spatial: options.spatial && this.spatialEnabled
      }));
    }
    const sound = this.sfxPool.get(name);
    sound.volume(this.sfxVolume * this.masterVolume);
    return sound.play();
  }

  /**
   * Play a positional SFX at a world position relative to a listener.
   * Volume attenuates with distance.
   */
  playSFX3D(name, sourcePos, listenerPos, maxDist = 60) {
    if (!sourcePos || !listenerPos) return this.playSFX(name);
    const dx = sourcePos.x - listenerPos.x;
    const dy = (sourcePos.y || 0) - (listenerPos.y || 0);
    const dz = sourcePos.z - listenerPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > maxDist) return; // too far, don't play
    const vol = Math.max(0.1, 1.0 - dist / maxDist);
    const files = SFX_FILES[name];
    if (!files) return;
    if (!this.sfxPool.has(name)) {
      this.sfxPool.set(name, new Howl({ src: files, volume: 1.0 }));
    }
    const sound = this.sfxPool.get(name);
    const id = sound.play();
    sound.volume(vol * this.sfxVolume * this.masterVolume, id);
    return id;
  }

  loadRaceMusic(trackIndex = 0) {
    if (this.musicMode === 'off') return;

    const trackName = RACE_TRACKS[trackIndex % RACE_TRACKS.length];
    this._currentTrack = trackName;

    this.raceMusic = new Howl({
      src: [`/assets/audio/music/${trackName}.mp3`],
      loop: true,
      volume: this.musicVolume * this.masterVolume
    });

    this.lastLapMusic = new Howl({
      src: [`/assets/audio/music/${trackName}-lastlap.mp3`],
      loop: true,
      volume: 0
    });
  }

  startMusic() {
    if (this.musicMode === 'off') return;

    // Play start grid jingle first, then race music
    const startGrid = new Howl({
      src: ['/assets/audio/music/start-grid.mp3'],
      volume: this.musicVolume * this.masterVolume,
      onend: () => {
        if (this.raceMusic) this.raceMusic.play();
        if (this.lastLapMusic) this.lastLapMusic.play();
      }
    });
    startGrid.play();
  }

  startMenuMusic() {
    if (this.musicMode === 'off') return;
    // Defer until a user gesture unlocks the audio context; onUnlock retries.
    if (!this.unlocked) return;
    if (this.menuMusic) {
      if (!this.menuMusic.playing()) this.menuMusic.play();
      return;
    }
    this.stopMusic();

    this.menuMusic = new Howl({
      src: ['/assets/audio/music/menu.mp3'],
      loop: true,
      volume: this.musicVolume * this.masterVolume
    });
    this.menuMusic.play();
  }

  stopMenuMusic() {
    if (this.menuMusic) {
      this.menuMusic.fade(this.menuMusic.volume(), 0, 500);
      setTimeout(() => {
        if (this.menuMusic) { this.menuMusic.stop(); this.menuMusic.unload(); this.menuMusic = null; }
      }, 600);
    }
  }

  updateMusicContext(position, totalRacers, isLastLap) {
    if (this.musicMode !== 'dynamic') return;

    // Switch to last-lap music when entering final lap
    if (isLastLap && !this._isLastLap) {
      this._isLastLap = true;
      // Play final lap jingle
      const jingle = new Howl({
        src: ['/assets/audio/music/final-lap.mp3'],
        volume: this.musicVolume * this.masterVolume
      });
      jingle.play();

      // Crossfade: race → lastlap
      if (this.raceMusic) this.raceMusic.fade(this.raceMusic.volume(), 0, 1000);
      if (this.lastLapMusic) this.lastLapMusic.fade(0, this.musicVolume * this.masterVolume, 1000);
    }
  }

  playFinishMusic(position) {
    this.stopMusic();
    let file;
    if (position <= 1) file = 'finish-best.mp3';
    else if (position <= 3) file = 'finish-good.mp3';
    else file = 'finish-bad.mp3';

    const finish = new Howl({
      src: [`/assets/audio/music/${file}`],
      volume: this.musicVolume * this.masterVolume
    });
    finish.play();
  }

  playVictoryMusic() {
    const victory = new Howl({
      src: ['/assets/audio/music/victory.mp3'],
      volume: this.musicVolume * this.masterVolume
    });
    victory.play();
  }

  playCourseIntro() {
    const intro = new Howl({
      src: ['/assets/audio/music/course-intro.mp3'],
      volume: this.musicVolume * this.masterVolume
    });
    intro.play();
  }

  stopMusic() {
    this._isLastLap = false;
    if (this.raceMusic) { this.raceMusic.stop(); this.raceMusic.unload(); this.raceMusic = null; }
    if (this.lastLapMusic) { this.lastLapMusic.stop(); this.lastLapMusic.unload(); this.lastLapMusic = null; }
  }

  setMasterVolume(v) {
    this.masterVolume = v;
    // Avoid creating the AudioContext before the unlock gesture; it is applied
    // in _installAutoUnlock once audio is unlocked.
    if (this.unlocked) Howler.volume(v);
  }

  setMusicVolume(v) { this.musicVolume = v; }
  setSFXVolume(v) { this.sfxVolume = v; }
  setEngineVolume(v) { this.engineVolume = v; }

  // Procedural character voice beeps
  playCharacterVoice(characterId, event = 'select') {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    const patterns = {
      rico:    { freq: [300, 400, 500], dur: 0.08 },
      zyrx:    { freq: [600, 800, 600, 900], dur: 0.06 },
      krogash: { freq: [120, 100, 80], dur: 0.15 },
      d4sh:    { freq: [500, 700, 900, 1200], dur: 0.04 },
      vermox:  { freq: [250, 350, 250], dur: 0.1 },
      sylvara: { freq: [400, 500, 600, 500, 700], dur: 0.07 },
      sharko:  { freq: [200, 300, 200, 150], dur: 0.09 },
      grootx:  { freq: [150, 200, 180], dur: 0.12 },
      chaos:   { freq: [300, 600, 300, 900, 300], dur: 0.05 },
      glitch:  { freq: [100, 1000, 100, 1000], dur: 0.03 }
    };

    const pattern = patterns[characterId] || patterns.rico;
    const ctx = this.audioContext;
    const gain = ctx.createGain();
    gain.gain.value = 0.15 * this.sfxVolume * this.masterVolume;
    gain.connect(ctx.destination);

    let time = ctx.currentTime;
    for (const freq of pattern.freq) {
      const osc = ctx.createOscillator();
      osc.type = event === 'weapon' ? 'square' : 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + pattern.dur);
      time += pattern.dur + 0.02;
    }

    gain.gain.setValueAtTime(gain.gain.value, time);
    gain.gain.linearRampToValueAtTime(0, time + 0.1);
  }

  dispose() {
    this.stopEngine();
    this.stopMusic();
    this.stopMenuMusic();
    this.sfxPool.forEach(s => s.unload());
    this.sfxPool.clear();
  }
}
