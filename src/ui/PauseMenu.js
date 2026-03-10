import { setPaused, getPaused, getRenderer, getAudioEngine, getInputManager } from '../main.js';
import { setFogEnabled } from '../game/RaceSetup.js';
import { Storage } from '../utils/Storage.js';

let pauseElement = null;
let isOpen = false;

export function init() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (isOpen) close();
      else open();
    }
  });

  // Gamepad Start button (button 9) to toggle pause
  let prevStart = false;
  function pollStartButton() {
    const gamepads = navigator.getGamepads?.();
    if (gamepads) {
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && gp.buttons[9]?.pressed) {
          if (!prevStart) {
            if (isOpen) close();
            else open();
          }
          prevStart = true;
          requestAnimationFrame(pollStartButton);
          return;
        }
      }
    }
    prevStart = false;
    requestAnimationFrame(pollStartButton);
  }
  requestAnimationFrame(pollStartButton);
}

export function open() {
  if (isOpen) return;
  isOpen = true;
  setPaused(true);

  const settings = Storage.getSettings();
  const overlay = document.getElementById('ui-overlay');

  const el = document.createElement('div');
  el.id = 'pause-menu';
  el.style.cssText = `
    position:absolute;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Rajdhani',sans-serif;color:white;z-index:1000;
    animation:slideUp 0.3s ease-out;padding:clamp(12px,3vw,24px);
  `;

  el.innerHTML = `
    <style>
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .pause-section { background:rgba(0,0,0,0.3);border:1px solid #333;border-radius:4px;margin:4px 0;overflow:hidden; }
      .pause-section-header { padding:clamp(8px,2vw,12px) clamp(10px,2vw,16px);cursor:pointer;display:flex;justify-content:space-between;align-items:center;
        font-size:clamp(13px,2.5vw,15px);font-weight:bold;color:#ff6633; }
      .pause-section-header:hover { background:rgba(255,68,0,0.1); }
      .pause-section-content { padding:clamp(6px,1.5vw,10px) clamp(10px,2vw,16px);display:none;border-top:1px solid #333; }
      .pause-section-content.open { display:block; }
      .setting-row { display:flex;justify-content:space-between;align-items:center;padding:clamp(4px,1vw,6px) 0;font-size:clamp(13px,2.5vw,15px); }
      .setting-label { color:#ccc; }
      input[type=range] { width:clamp(80px,20vw,120px);accent-color:#ff4400; }
      select { background:#222;color:#ccc;border:1px solid #555;padding:clamp(4px,1vw,6px) 8px;font-size:clamp(12px,2.2vw,14px); }
      .toggle { width:40px;height:22px;background:#333;border-radius:11px;position:relative;cursor:pointer;transition:0.2s;flex-shrink:0; }
      .toggle.on { background:#ff4400; }
      .toggle::after { content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;
        background:white;border-radius:50%;transition:0.2s; }
      .toggle.on::after { left:20px; }
    </style>

    <div style="width:100%;max-width:420px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;">
      <button class="ui-btn ui-btn--pulse" id="resume-btn" style="margin-bottom:clamp(8px,2vw,12px);">
        RESUME
      </button>

      <h3 class="ui-text--sm" style="margin:clamp(8px,2vw,12px) 0 4px;letter-spacing:2px;">SETTINGS</h3>

      <div class="pause-section">
        <div class="pause-section-header" data-section="controls">CONTROLS <span>+</span></div>
        <div class="pause-section-content" id="section-controls">
          ${buildControlsSection(settings)}
        </div>
      </div>

      <div class="pause-section">
        <div class="pause-section-header" data-section="audio">AUDIO <span>+</span></div>
        <div class="pause-section-content" id="section-audio">
          ${buildAudioSection(settings)}
        </div>
      </div>

      <div class="pause-section">
        <div class="pause-section-header" data-section="video">VIDEO <span>+</span></div>
        <div class="pause-section-content" id="section-video">
          ${buildVideoSection(settings)}
        </div>
      </div>

      <div class="pause-section">
        <div class="pause-section-header" data-section="game">GAME <span>+</span></div>
        <div class="pause-section-content" id="section-game">
          ${buildGameSection(settings)}
        </div>
      </div>

      <div class="pause-section">
        <div class="pause-section-header" data-section="accessibility">ACCESSIBILITY <span>+</span></div>
        <div class="pause-section-content" id="section-accessibility">
          ${buildAccessibilitySection(settings)}
        </div>
      </div>

      <button class="ui-btn" id="restart-btn" style="margin-top:clamp(8px,2vw,12px);">RESTART RACE</button>
      <button class="ui-btn ui-btn--secondary" id="menu-btn" style="margin-top:4px;">RETURN TO MENU</button>
    </div>
  `;

  overlay.appendChild(el);
  pauseElement = el;

  el.querySelector('#resume-btn').addEventListener('click', close);

  el.querySelectorAll('.pause-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const span = header.querySelector('span');
      content.classList.toggle('open');
      span.textContent = content.classList.contains('open') ? '-' : '+';
    });
  });

  el.querySelectorAll('input[type=range]').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.key;
      const val = parseFloat(slider.value);
      const numEl = slider.parentElement.querySelector('.slider-val');
      if (numEl) numEl.textContent = Math.round(val * 100);
      updateSetting(key, val);
    });
  });

  el.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      updateSetting(sel.dataset.key, sel.value);
    });
  });

  el.querySelectorAll('.toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isOn = toggle.classList.toggle('on');
      updateSetting(toggle.dataset.key, isOn);
    });
  });

  _bindKeybindListeners(el);

  el.querySelector('#restart-btn').addEventListener('click', () => {
    close();
    import('../main.js').then(m => m.setScene('character-select', { mode: 'solo' }));
  });
  el.querySelector('#menu-btn').addEventListener('click', () => {
    close();
    import('../main.js').then(m => m.setScene('menu'));
  });
}

export function close() {
  if (!isOpen) return;
  isOpen = false;
  setPaused(false);
  if (pauseElement) {
    pauseElement.remove();
    pauseElement = null;
  }
}

function updateSetting(key, value) {
  const settings = Storage.getSettings();
  settings[key] = value;
  Storage.saveSettings(settings);
  applySettings(settings);
}

export function applySettings(settings) {
  const renderer = getRenderer();
  const audio = getAudioEngine();

  if (renderer) {
    if (settings.quality) renderer.applyQuality(settings.quality);
    if (settings.showFPS !== undefined) renderer.showFPS = settings.showFPS;
  }
  if (settings.fog !== undefined) setFogEnabled(settings.fog);

  if (audio) {
    if (settings.masterVolume !== undefined) audio.setMasterVolume(settings.masterVolume);
    if (settings.musicVolume !== undefined) audio.setMusicVolume(settings.musicVolume);
    if (settings.sfxVolume !== undefined) audio.setSFXVolume(settings.sfxVolume);
    if (settings.engineVolume !== undefined) audio.setEngineVolume(settings.engineVolume);
    if (settings.musicMode !== undefined) audio.musicMode = settings.musicMode;
    if (settings.spatialAudio !== undefined) audio.spatialEnabled = settings.spatialAudio;
  }
}

export function buildSettingsSectionsHTML(settings) {
  const s = settings;
  return `
    <style>
      .pause-section { background:rgba(0,0,0,0.3);border:1px solid #333;border-radius:4px;margin:4px 0;overflow:hidden; }
      .pause-section-header { padding:clamp(8px,2vw,12px) clamp(10px,2vw,16px);cursor:pointer;display:flex;justify-content:space-between;align-items:center;
        font-size:clamp(13px,2.5vw,15px);font-weight:bold;color:#ff6633; }
      .pause-section-header:hover { background:rgba(255,68,0,0.1); }
      .pause-section-content { padding:clamp(6px,1.5vw,10px) clamp(10px,2vw,16px);display:none;border-top:1px solid #333; }
      .pause-section-content.open { display:block; }
      .setting-row { display:flex;justify-content:space-between;align-items:center;padding:clamp(4px,1vw,6px) 0;font-size:clamp(13px,2.5vw,15px); }
      .setting-label { color:#ccc; }
      input[type=range] { width:clamp(80px,20vw,120px);accent-color:#ff4400; }
      select { background:#222;color:#ccc;border:1px solid #555;padding:clamp(4px,1vw,6px) 8px;font-size:clamp(12px,2.2vw,14px); }
      .toggle { width:40px;height:22px;background:#333;border-radius:11px;position:relative;cursor:pointer;transition:0.2s;flex-shrink:0; }
      .toggle.on { background:#ff4400; }
      .toggle::after { content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;
        background:white;border-radius:50%;transition:0.2s; }
      .toggle.on::after { left:20px; }
    </style>
    <div class="pause-section">
      <div class="pause-section-header" data-section="controls">CONTROLS <span>+</span></div>
      <div class="pause-section-content" id="section-controls">${buildControlsSection(s)}</div>
    </div>
    <div class="pause-section">
      <div class="pause-section-header" data-section="audio">AUDIO <span>+</span></div>
      <div class="pause-section-content" id="section-audio">${buildAudioSection(s)}</div>
    </div>
    <div class="pause-section">
      <div class="pause-section-header" data-section="video">VIDEO <span>+</span></div>
      <div class="pause-section-content" id="section-video">${buildVideoSection(s)}</div>
    </div>
    <div class="pause-section">
      <div class="pause-section-header" data-section="game">GAME <span>+</span></div>
      <div class="pause-section-content" id="section-game">${buildGameSection(s)}</div>
    </div>
    <div class="pause-section">
      <div class="pause-section-header" data-section="accessibility">ACCESSIBILITY <span>+</span></div>
      <div class="pause-section-content" id="section-accessibility">${buildAccessibilitySection(s)}</div>
    </div>
  `;
}

export function bindSettingsEvents(container) {
  container.querySelectorAll('.pause-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const span = header.querySelector('span');
      content.classList.toggle('open');
      span.textContent = content.classList.contains('open') ? '-' : '+';
    });
  });

  container.querySelectorAll('input[type=range]').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.key;
      const val = parseFloat(slider.value);
      const numEl = slider.parentElement.querySelector('.slider-val');
      if (numEl) numEl.textContent = Math.round(val * 100);
      updateSetting(key, val);
    });
  });

  container.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      updateSetting(sel.dataset.key, sel.value);
    });
  });

  container.querySelectorAll('.toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isOn = toggle.classList.toggle('on');
      updateSetting(toggle.dataset.key, isOn);
    });
  });

  _bindKeybindListeners(container);
}

let _activeRebind = null;

function _bindKeybindListeners(container) {
  container.querySelectorAll('.keybind-row').forEach(row => {
    row.addEventListener('click', () => {
      if (_activeRebind) return;
      const playerIdx = parseInt(row.dataset.player);
      const action = row.dataset.action;
      const valueEl = row.querySelector('.keybind-value');
      const origText = valueEl.textContent;

      valueEl.textContent = '...';
      valueEl.style.color = '#ffcc00';
      valueEl.style.borderColor = '#ffcc00';
      _activeRebind = { playerIdx, action, valueEl, origText };

      const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        if (e.code === 'Escape') {
          // Cancel
          valueEl.textContent = origText;
          valueEl.style.color = '#ff8844';
          valueEl.style.borderColor = '#444';
          return;
        }
        const im = getInputManager();
        if (im) {
          im.setBinding(playerIdx, action, [e.code]);
          valueEl.textContent = keyCodeLabel(e.code);
        }
        valueEl.style.color = '#ff8844';
        valueEl.style.borderColor = '#444';
      };

      function cleanup() {
        _activeRebind = null;
        window.removeEventListener('keydown', onKey, true);
      }

      window.addEventListener('keydown', onKey, true);
    });
  });
}

function slider(label, key, value, min = 0, max = 1, step = 0.01) {
  return `<div class="setting-row">
    <span class="setting-label">${label}</span>
    <div style="display:flex;align-items:center;gap:6px;">
      <span class="slider-val" style="font-size:clamp(11px,2vw,13px);color:#888;width:28px;text-align:right;">${Math.round(value * 100)}</span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}">
    </div>
  </div>`;
}

function select(label, key, value, options) {
  const opts = options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('');
  return `<div class="setting-row">
    <span class="setting-label">${label}</span>
    <select data-key="${key}">${opts}</select>
  </div>`;
}

function toggle(label, key, value) {
  return `<div class="setting-row">
    <span class="setting-label">${label}</span>
    <div class="toggle ${value ? 'on' : ''}" data-key="${key}"></div>
  </div>`;
}

const ACTION_LABELS = {
  accelerate: 'Accelerate',
  brake: 'Brake',
  left: 'Steer Left',
  right: 'Steer Right',
  drift: 'Drift',
  useItem: 'Use Item',
  lookBehind: 'Look Behind',
  horn: 'Horn'
};

function keyCodeLabel(code) {
  return code
    .replace('Key', '')
    .replace('Arrow', '')
    .replace('Numpad', 'Num ')
    .replace('NumpadDecimal', 'Num .')
    .replace('NumpadAdd', 'Num +');
}

function buildKeybindRows(playerIndex) {
  const im = getInputManager();
  const bindings = im?.getBindings(playerIndex);
  if (!bindings) return '';
  return Object.entries(ACTION_LABELS).map(([action, label]) => {
    const keys = bindings[action] || [];
    const keysStr = keys.map(keyCodeLabel).join(' / ') || '-';
    return `<div class="setting-row keybind-row" data-player="${playerIndex}" data-action="${action}" style="cursor:pointer;">
      <span class="setting-label">${label}</span>
      <span class="keybind-value" style="color:#ff8844;font-family:'Press Start 2P',monospace;font-size:clamp(10px,2vw,12px);
        padding:4px 8px;background:rgba(255,68,0,0.1);border:1px solid #444;border-radius:3px;min-width:60px;text-align:center;">
        ${keysStr}
      </span>
    </div>`;
  }).join('');
}

function buildControlsSection(s) {
  return `
    <p class="ui-text--xs" style="margin:0 0 8px;color:#888;">Click a binding to remap it. Press Escape to cancel.</p>
    <p class="ui-text--xs" style="margin:0 0 4px;color:#ff6633;">PLAYER 1</p>
    ${buildKeybindRows(0)}
    <p class="ui-text--xs" style="margin:8px 0 4px;color:#ff6633;">PLAYER 2</p>
    ${buildKeybindRows(1)}
    <div style="margin-top:8px;">
    ${select('Steering Assist', 'steeringAssist', s.steeringAssist || 'off', [
      { value: 'off', label: 'Off' }, { value: 'light', label: 'Light' }, { value: 'strong', label: 'Strong' }
    ])}
    </div>
  `;
}

function buildAudioSection(s) {
  return `
    ${slider('Master Volume', 'masterVolume', s.masterVolume)}
    ${slider('Music', 'musicVolume', s.musicVolume)}
    ${slider('SFX', 'sfxVolume', s.sfxVolume)}
    ${slider('Engine', 'engineVolume', s.engineVolume)}
    ${select('Music Mode', 'musicMode', s.musicMode || 'dynamic', [
      { value: 'dynamic', label: 'Dynamic' }, { value: 'chill', label: 'Chill' }, { value: 'off', label: 'Off' }
    ])}
    ${toggle('3D Spatial Audio', 'spatialAudio', s.spatialAudio)}
  `;
}

function buildVideoSection(s) {
  return `
    ${select('Quality', 'quality', s.quality || 'high', [
      { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }
    ])}
    ${select('Render Resolution', 'renderResolution', String(s.renderResolution || '1'), [
      { value: '0.5', label: '50%' }, { value: '0.75', label: '75%' },
      { value: '1', label: '100%' }, { value: '1.5', label: '150%' }
    ])}
    ${toggle('Shadows', 'shadows', s.shadows !== false)}
    ${toggle('Weather Effects', 'weatherEffects', s.weatherEffects !== false)}
    ${toggle('Reflections', 'reflections', s.reflections !== false)}
    ${select('Post-Processing', 'postProcessing', s.postProcessing || 'full', [
      { value: 'off', label: 'Off' }, { value: 'toon-only', label: 'Cell-Shading Only' }, { value: 'full', label: 'Full' }
    ])}
    ${toggle('Fog', 'fog', s.fog !== false)}
    ${toggle('Show FPS', 'showFPS', s.showFPS)}
  `;
}

function buildGameSection(s) {
  return `
    ${toggle('Track Direction Indicators', 'trackIndicators', s.trackIndicators !== false)}
    ${select('Minimap', 'minimapSize', s.minimapSize || 'small', [
      { value: 'off', label: 'Off' }, { value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }
    ])}
    ${toggle('Show Opponent Stats', 'showOpponentStats', s.showOpponentStats)}
    ${select('Split-Screen', 'splitScreenOrientation', s.splitScreenOrientation || 'horizontal', [
      { value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }
    ])}
    ${select('Language', 'language', s.language || 'en', [
      { value: 'en', label: 'English' }, { value: 'fr', label: 'Francais' },
      { value: 'es', label: 'Espanol' }, { value: 'de', label: 'Deutsch' }, { value: 'jp', label: 'Japanese' }
    ])}
  `;
}

function buildAccessibilitySection(s) {
  return `
    ${select('Text Size', 'textSize', s.textSize || 'normal', [
      { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'very-large', label: 'Very Large' }
    ])}
    ${select('Colorblind Mode', 'colorblindMode', s.colorblindMode || 'off', [
      { value: 'off', label: 'Off' }, { value: 'deuteranopia', label: 'Deuteranopia' }, { value: 'protanopia', label: 'Protanopia' }
    ])}
    ${toggle('Reduce Strobe Effects', 'reduceStrobe', s.reduceStrobe)}
  `;
}
