export class QualityDetector {
  constructor() {
    this.isMobile = false;
    this.cores = navigator.hardwareConcurrency || 2;
    this.hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.screenWidth = window.screen.width;
    this.screenHeight = window.screen.height;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.profile = this.detect();

    // Runtime FPS monitoring
    this._fpsHistory = [];
    this._lastFrame = 0;
    this._downgraded = false;
  }

  detect() {
    const smallScreen = Math.min(this.screenWidth, this.screenHeight) < 768;
    this.isMobile = this.hasTouch && smallScreen;

    if (this.isMobile) {
      return 'low';
    }

    if (this.cores <= 2 || (this.hasTouch && this.cores <= 4)) {
      return 'low';
    }

    if (this.cores <= 4) {
      return 'medium';
    }

    if (this.cores >= 8 && this.devicePixelRatio >= 1.5) {
      return 'ultra';
    }

    return 'high';
  }

  trackFrame(now) {
    if (this._lastFrame > 0) {
      const fps = 1000 / (now - this._lastFrame);
      this._fpsHistory.push(fps);
      if (this._fpsHistory.length > 120) { // 2 seconds of frames
        this._fpsHistory.shift();
      }
    }
    this._lastFrame = now;
  }

  shouldDowngrade() {
    if (this._downgraded || this._fpsHistory.length < 60) return false;

    const avgFPS = this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length;
    if (avgFPS < 30) {
      this._downgraded = true;
      return true;
    }
    return false;
  }

  getAverageFPS() {
    if (this._fpsHistory.length === 0) return 60;
    return this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length;
  }
}
