import { getAllCharacters } from '../characters/index.js';
import { setScene, getAudioEngine } from '../main.js';
import { startRotatingPreview } from './KartPreview.js';
import { startGamepadNav } from './GamepadNav.js';

function createStatBar(value, max = 10) {
  const pct = (value / max) * 100;
  return `<div style="width:100%;height:8px;background:#222;border-radius:4px;overflow:hidden;">
    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ff4400,#ff8800);border-radius:4px;"></div>
  </div>`;
}

function createCharCard(c, isSelected, selIndex) {
  const borderColor = isSelected ? '#ff4400' : '#333';
  const selLabel = isSelected ? `<div style="position:absolute;top:8px;right:8px;background:#ff4400;color:#fff;font-size:12px;padding:3px 8px;border-radius:4px;">P${selIndex + 1}</div>` : '';

  return `
  <div class="char-card" data-id="${c.id}" style="
    position:relative;border:2px solid ${borderColor};border-radius:8px;
    ${isSelected ? 'background:rgba(255,68,0,0.15);' : 'background:rgba(0,0,0,0.3);'}
    padding:clamp(12px,3vw,24px);text-align:center;
  ">
    ${selLabel}
    <div style="width:clamp(100px,28vw,160px);height:clamp(100px,28vw,160px);border-radius:50%;overflow:hidden;
      margin:0 auto clamp(8px,2vw,16px);border:3px solid #${c.kartAccent.toString(16).padStart(6,'0')};background:#111;">
      <canvas class="kart-preview" data-char-id="${c.id}" width="128" height="128"
        style="width:100%;height:100%;display:block;"></canvas>
    </div>
    <h3 style="margin:0 0 4px;font-size:clamp(18px,4vw,24px);color:#fff;font-family:'Press Start 2P',monospace;">${c.name}</h3>
    <p style="font-size:clamp(12px,2.5vw,14px);color:#888;margin:0 0 clamp(8px,2vw,16px);">${c.description}</p>
    <div style="display:grid;grid-template-columns:36px 1fr;gap:6px 8px;font-size:clamp(12px,2.5vw,14px);color:#aaa;
      max-width:280px;margin:0 auto;">
      <span>SPD</span>${createStatBar(c.stats.speed)}
      <span>ACC</span>${createStatBar(c.stats.acceleration)}
      <span>HDL</span>${createStatBar(c.stats.handling)}
      <span>WGT</span>${createStatBar(c.stats.weight)}
      <span>SPC</span>${createStatBar(c.stats.special)}
    </div>
    <p style="font-size:clamp(11px,2.2vw,13px);color:#ff8844;margin:clamp(6px,1.5vw,12px) 0 2px;"><b>${c.signatureWeapon.name}</b></p>
    <p style="font-size:clamp(10px,2vw,12px);color:#666;margin:0;">${c.passive.description}</p>
  </div>`;
}

export function show(container, data = {}) {
  const characters = getAllCharacters();
  const playerCount = data.playerCount || 1;
  const selectedIds = [];
  let currentPlayer = 0;
  let charIndex = 0;
  let previewCleanups = [];

  let _inputCleanups = [];

  function stopPreviews() {
    for (const fn of previewCleanups) fn();
    previewCleanups = [];
    for (const fn of _inputCleanups) fn();
    _inputCleanups = [];
  }

  function startPreviews() {
    container.querySelectorAll('.kart-preview').forEach(canvas => {
      const charId = canvas.dataset.charId;
      const char = characters.find(c => c.id === charId);
      if (char) {
        const cleanup = startRotatingPreview(canvas, char);
        previewCleanups.push(cleanup);
      }
    });
  }

  function navigate(delta) {
    charIndex = (charIndex + delta + characters.length) % characters.length;
    render();
  }

  function goBack() {
    if (currentPlayer > 0) {
      selectedIds.pop();
      currentPlayer--;
      render();
    } else {
      stopPreviews();
      setScene('menu');
    }
  }

  function selectCurrent() {
    const c = characters[charIndex];
    if (selectedIds.includes(c.id)) return;

    const audio = getAudioEngine();
    if (audio) audio.playCharacterVoice(c.id, 'select');

    selectedIds.push(c.id);
    currentPlayer++;

    if (currentPlayer >= playerCount) {
      stopPreviews();
      if (playerCount === 1) {
        setScene('circuit-select', { ...data, characterId: selectedIds[0] });
      } else {
        setScene('circuit-select', { ...data, characterIds: selectedIds });
      }
    } else {
      render();
    }
  }

  function render() {
    stopPreviews();
    const title = playerCount > 1
      ? `PLAYER ${currentPlayer + 1} - SELECT`
      : 'SELECT CHARACTER';

    const c = characters[charIndex];
    const selIndex = selectedIds.indexOf(c.id);
    const isSelected = selIndex >= 0;
    const alreadyPicked = isSelected;

    container.innerHTML = `
      <div class="ui-screen" style="justify-content:center;">
        <h2 class="ui-heading" style="margin-bottom:clamp(8px,2vw,16px);">${title}</h2>

        <div style="display:flex;align-items:center;gap:clamp(8px,2vw,20px);width:100%;max-width:500px;justify-content:center;">
          <button id="prev-btn" style="
            width:clamp(44px,10vw,56px);height:clamp(44px,10vw,56px);
            border:2px solid #555;background:rgba(0,0,0,0.4);color:#ff6633;
            font-size:clamp(20px,5vw,28px);border-radius:50%;cursor:pointer;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;
            font-family:'Press Start 2P',monospace;line-height:1;
          ">&lt;</button>

          <div id="char-container" style="flex:1;min-width:0;max-width:360px;">
            ${createCharCard(c, isSelected, selIndex)}
          </div>

          <button id="next-btn" style="
            width:clamp(44px,10vw,56px);height:clamp(44px,10vw,56px);
            border:2px solid #555;background:rgba(0,0,0,0.4);color:#ff6633;
            font-size:clamp(20px,5vw,28px);border-radius:50%;cursor:pointer;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;
            font-family:'Press Start 2P',monospace;line-height:1;
          ">&gt;</button>
        </div>

        <div style="margin-top:clamp(6px,1.5vw,12px);font-size:clamp(11px,2.2vw,13px);color:#555;">
          ${charIndex + 1} / ${characters.length}
        </div>

        <div style="display:flex;gap:clamp(8px,2vw,16px);margin-top:clamp(12px,3vw,24px);max-width:400px;width:100%;">
          <button class="ui-btn ui-btn--secondary" id="back-btn" style="flex:1;">BACK</button>
          <button class="ui-btn ${alreadyPicked ? '' : 'ui-btn--pulse'}" id="select-btn" style="flex:1;"
            ${alreadyPicked ? 'disabled' : ''}>${alreadyPicked ? 'PICKED' : 'SELECT'}</button>
        </div>
      </div>
    `;

    // Navigation buttons
    container.querySelector('#prev-btn').addEventListener('click', () => navigate(-1));
    container.querySelector('#next-btn').addEventListener('click', () => navigate(1));

    // Select button
    container.querySelector('#select-btn').addEventListener('click', selectCurrent);

    // Back button
    container.querySelector('#back-btn').addEventListener('click', goBack);

    // Swipe support
    const charContainer = container.querySelector('#char-container');
    let touchStartX = 0;
    let touchStartY = 0;
    charContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    charContainer.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        navigate(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    // Keyboard arrows
    const onKey = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyQ') navigate(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') navigate(1);
      else if (e.code === 'Enter' || e.code === 'Space') selectCurrent();
      else if (e.code === 'Escape' || e.code === 'Backspace') goBack();
    };
    window.addEventListener('keydown', onKey);
    _inputCleanups.push(() => window.removeEventListener('keydown', onKey));

    // Gamepad nav
    const stopGp = startGamepadNav({
      onLeft: () => navigate(-1),
      onRight: () => navigate(1),
      onConfirm: selectCurrent,
      onBack: goBack
    });
    _inputCleanups.push(stopGp);

    startPreviews();
  }

  render();
}
