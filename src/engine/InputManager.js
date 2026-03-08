const DEFAULT_BINDINGS_P1 = {
  accelerate: ['KeyZ', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyQ', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  drift: ['Space'],
  useItem: ['KeyF', 'Enter'],
  lookBehind: ['KeyR'],
  horn: ['KeyT'],
  cameraToggle: ['KeyC']
};

const DEFAULT_BINDINGS_P2 = {
  accelerate: ['Numpad8'],
  brake: ['Numpad5'],
  left: ['Numpad4'],
  right: ['Numpad6'],
  drift: ['Numpad0'],
  useItem: ['NumpadAdd'],
  lookBehind: ['Numpad9'],
  horn: ['NumpadDecimal']
};

const GAMEPAD_MAPPING = {
  accelerate: { type: 'axis', index: 7 },   // Right trigger
  brake: { type: 'axis', index: 6 },         // Left trigger
  steerAxis: { type: 'axis', index: 0 },     // Left stick X
  drift: { type: 'button', index: 0 },       // A / Cross
  useItem: { type: 'button', index: 2 },     // X / Square
  lookBehind: { type: 'button', index: 1 },  // B / Circle
  horn: { type: 'button', index: 3 }         // Y / Triangle
};

export class InputManager {
  constructor() {
    this.players = [
      this._createPlayerState(DEFAULT_BINDINGS_P1),
      this._createPlayerState(DEFAULT_BINDINGS_P2),
      this._createPlayerState(null), // P3 gamepad only
      this._createPlayerState(null)  // P4 gamepad only
    ];

    this._keysDown = new Set();
    this._keysPressed = new Set();
    this._keysReleased = new Set();
    this._prevKeys = new Set();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this._loadBindings();
  }

  _createPlayerState(bindings) {
    return {
      bindings: bindings ? { ...bindings } : null,
      state: {
        steering: 0,
        throttle: 0,
        brake: false,
        drift: false,
        useItem: false,
        lookBehind: false,
        horn: false,
        cameraToggle: false
      },
      gamepadIndex: -1
    };
  }

  _onKeyDown(e) {
    if (e.repeat) return;
    this._keysDown.add(e.code);
  }

  _onKeyUp(e) {
    this._keysDown.delete(e.code);
  }

  update() {
    // Compute pressed/released
    this._keysPressed.clear();
    this._keysReleased.clear();
    for (const k of this._keysDown) {
      if (!this._prevKeys.has(k)) this._keysPressed.add(k);
    }
    for (const k of this._prevKeys) {
      if (!this._keysDown.has(k)) this._keysReleased.add(k);
    }
    this._prevKeys = new Set(this._keysDown);

    // Update each player
    for (const player of this.players) {
      this._updatePlayerKeyboard(player);
      this._updatePlayerGamepad(player);
    }
  }

  _isKeyHeld(keys) {
    return keys.some(k => this._keysDown.has(k));
  }

  _isKeyPressed(keys) {
    return keys.some(k => this._keysPressed.has(k));
  }

  autoAssignGamepads() {
    const gamepads = navigator.getGamepads?.() || [];
    let slotIndex = 0;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && slotIndex < this.players.length) {
        if (this.players[slotIndex].gamepadIndex < 0) {
          this.players[slotIndex].gamepadIndex = i;
        }
        slotIndex++;
      }
    }
  }

  getActivePlayerCount() {
    let count = 0;
    for (const p of this.players) {
      if (p.bindings || p.gamepadIndex >= 0) count++;
    }
    return count;
  }

  _updatePlayerKeyboard(player) {
    const b = player.bindings;
    if (!b) return;
    const s = player.state;

    s.throttle = this._isKeyHeld(b.accelerate) ? 1.0 : 0.0;
    s.brake = this._isKeyHeld(b.brake);

    const left = this._isKeyHeld(b.left);
    const right = this._isKeyHeld(b.right);
    s.steering = (left ? -1 : 0) + (right ? 1 : 0);

    s.drift = this._isKeyHeld(b.drift);
    s.useItem = this._isKeyPressed(b.useItem);
    s.lookBehind = this._isKeyHeld(b.lookBehind);
    s.horn = this._isKeyPressed(b.horn);
    if (b.cameraToggle) s.cameraToggle = this._isKeyPressed(b.cameraToggle);
  }

  _updatePlayerGamepad(player) {
    if (player.gamepadIndex < 0) return;
    const gp = navigator.getGamepads?.()[player.gamepadIndex];
    if (!gp) return;

    const s = player.state;
    const axes = gp.axes;
    const buttons = gp.buttons;

    // Steering from left stick
    const steer = axes[GAMEPAD_MAPPING.steerAxis.index] || 0;
    if (Math.abs(steer) > 0.15) { // dead zone
      s.steering = steer;
    }

    // Triggers for throttle/brake
    const rt = buttons[GAMEPAD_MAPPING.accelerate.index]?.value || 0;
    const lt = buttons[GAMEPAD_MAPPING.brake.index]?.value || 0;
    if (rt > 0.1) s.throttle = rt;
    if (lt > 0.3) s.brake = true;

    // Buttons
    if (buttons[GAMEPAD_MAPPING.drift.index]?.pressed) s.drift = true;
    if (buttons[GAMEPAD_MAPPING.useItem.index]?.pressed) s.useItem = true;
    if (buttons[GAMEPAD_MAPPING.lookBehind.index]?.pressed) s.lookBehind = true;
    if (buttons[GAMEPAD_MAPPING.horn.index]?.pressed) s.horn = true;
  }

  getPlayerState(playerIndex) {
    return this.players[playerIndex]?.state || null;
  }

  setBinding(playerIndex, action, keyCodes) {
    if (this.players[playerIndex]) {
      this.players[playerIndex].bindings[action] = keyCodes;
      this._saveBindings();
    }
  }

  getBindings(playerIndex) {
    return this.players[playerIndex]?.bindings || null;
  }

  assignGamepad(playerIndex, gamepadIndex) {
    if (this.players[playerIndex]) {
      this.players[playerIndex].gamepadIndex = gamepadIndex;
    }
  }

  _saveBindings() {
    try {
      const data = this.players.map(p => p.bindings);
      localStorage.setItem('khaos-kart-bindings', JSON.stringify(data));
    } catch (_) { /* ignore */ }
  }

  _loadBindings() {
    try {
      const raw = localStorage.getItem('khaos-kart-bindings');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach((bindings, i) => {
            if (this.players[i] && bindings) {
              this.players[i].bindings = { ...this.players[i].bindings, ...bindings };
            }
          });
        }
      }
    } catch (_) { /* ignore */ }
  }

  initTouch() {
    if (this._touchInitialized) return;
    this._touchInitialized = true;
    this._touchState = { steering: 0, throttle: 0, brake: false, drift: false, useItem: false, lookBehind: false, horn: false };

    import('nipplejs').then(nipplejs => {
      const zone = document.createElement('div');
      zone.id = 'joystick-zone';
      zone.style.cssText = 'position:fixed;left:0;top:0;width:40%;height:100%;z-index:500;';
      document.body.appendChild(zone);

      const manager = nipplejs.create({
        zone,
        mode: 'semi',
        color: 'rgba(255,68,0,0.5)',
        size: 120
      });

      manager.on('move', (_, data) => {
        const angle = data.angle?.radian || 0;
        const force = Math.min(data.force || 0, 1);
        this._touchState.steering = -Math.cos(angle) * force;
        this._touchState.throttle = Math.max(0, Math.sin(angle) * force);
      });

      manager.on('end', () => {
        this._touchState.steering = 0;
        this._touchState.throttle = 0;
      });

      // Touch buttons on right side
      this._createTouchButtons();
    }).catch(() => {
      // nipplejs not available — create basic touch buttons
      this._createTouchButtons();
    });
  }

  _createTouchButtons() {
    const btnContainer = document.createElement('div');
    btnContainer.id = 'touch-buttons';
    btnContainer.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:500;display:flex;flex-direction:column;gap:8px;';

    const buttons = [
      { label: 'GAS', action: 'throttle' },
      { label: 'BRAKE', action: 'brake' },
      { label: 'DRIFT', action: 'drift' },
      { label: 'ITEM', action: 'useItem' }
    ];

    for (const btn of buttons) {
      const el = document.createElement('button');
      el.textContent = btn.label;
      el.style.cssText = 'width:70px;height:50px;border:2px solid #ff4400;background:rgba(255,68,0,0.2);color:#ff6633;font-weight:bold;font-size:12px;border-radius:8px;touch-action:none;';

      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (btn.action === 'throttle') this._touchState.throttle = 1;
        else if (btn.action === 'brake') this._touchState.brake = true;
        else if (btn.action === 'drift') this._touchState.drift = true;
        else if (btn.action === 'useItem') this._touchState.useItem = true;
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (btn.action === 'throttle') this._touchState.throttle = 0;
        else if (btn.action === 'brake') this._touchState.brake = false;
        else if (btn.action === 'drift') this._touchState.drift = false;
        else if (btn.action === 'useItem') this._touchState.useItem = false;
      });

      btnContainer.appendChild(el);
    }

    document.body.appendChild(btnContainer);
  }

  initGyroscope() {
    if (this._gyroInitialized) return;
    this._gyroInitialized = true;
    this._gyroSteering = 0;

    const handleOrientation = (e) => {
      const gamma = e.gamma || 0; // left-right tilt
      const deadZone = 8;
      if (Math.abs(gamma) < deadZone) {
        this._gyroSteering = 0;
      } else {
        this._gyroSteering = Math.max(-1, Math.min(1, (gamma - Math.sign(gamma) * deadZone) / 30));
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(perm => {
        if (perm === 'granted') window.addEventListener('deviceorientation', handleOrientation);
      }).catch(() => {});
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  }

  getTouchState() {
    return this._touchState || null;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    const jz = document.getElementById('joystick-zone');
    if (jz) jz.remove();
    const tb = document.getElementById('touch-buttons');
    if (tb) tb.remove();
  }
}
