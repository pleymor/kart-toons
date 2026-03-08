import { getAllCharacters } from '../characters/index.js';
import { setScene, getAudioEngine } from '../main.js';
import { startRotatingPreview } from './KartPreview.js';

function createStatBar(value, max = 10) {
  const pct = (value / max) * 100;
  return `<div style="width:100%;height:6px;background:#222;border-radius:3px;overflow:hidden;">
    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ff4400,#ff8800);border-radius:3px;"></div>
  </div>`;
}

function createCharGrid(characters, selectedIds = []) {
  return characters.map(c => {
    const selIndex = selectedIds.indexOf(c.id);
    const isSelected = selIndex >= 0;
    const borderColor = isSelected ? '#ff4400' : '#333';
    const selLabel = isSelected ? `<div style="position:absolute;top:4px;right:4px;background:#ff4400;color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;">P${selIndex + 1}</div>` : '';
    return `
    <div class="char-card ui-card" data-id="${c.id}" style="
      position:relative;border-color:${borderColor};
      ${isSelected ? 'background:rgba(255,68,0,0.15);' : ''}
    ">
      ${selLabel}
      <div style="width:clamp(60px,14vw,96px);height:clamp(60px,14vw,96px);border-radius:50%;overflow:hidden;
        margin:0 auto clamp(4px,1vw,8px);border:3px solid #${c.kartAccent.toString(16).padStart(6,'0')};background:#111;">
        <canvas class="kart-preview" data-char-id="${c.id}" width="128" height="128"
          style="width:100%;height:100%;display:block;"></canvas>
      </div>
      <h3 style="text-align:center;margin:0 0 4px;font-size:clamp(12px,2.5vw,14px);color:#fff;">${c.name}</h3>
      <p style="text-align:center;font-size:clamp(9px,1.8vw,11px);color:#888;margin:0 0 6px;">${c.description}</p>
      <div style="display:grid;grid-template-columns:30px 1fr;gap:3px;font-size:clamp(9px,1.8vw,11px);color:#aaa;">
        <span>SPD</span>${createStatBar(c.stats.speed)}
        <span>ACC</span>${createStatBar(c.stats.acceleration)}
        <span>HDL</span>${createStatBar(c.stats.handling)}
        <span>WGT</span>${createStatBar(c.stats.weight)}
        <span>SPC</span>${createStatBar(c.stats.special)}
      </div>
      <p style="font-size:clamp(8px,1.6vw,10px);color:#ff8844;margin:4px 0 2px;"><b>${c.signatureWeapon.name}</b></p>
      <p style="font-size:clamp(7px,1.4vw,9px);color:#666;margin:0;">${c.passive.description}</p>
    </div>`;
  }).join('');
}

export function show(container, data = {}) {
  const characters = getAllCharacters();
  const playerCount = data.playerCount || 1;
  const selectedIds = [];
  let currentPlayer = 0;
  let previewCleanups = [];

  function stopPreviews() {
    for (const fn of previewCleanups) fn();
    previewCleanups = [];
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

  function render() {
    stopPreviews();
    const title = playerCount > 1
      ? `PLAYER ${currentPlayer + 1} - SELECT`
      : 'SELECT CHARACTER';

    container.innerHTML = `
      <div class="ui-screen">
        <h2 class="ui-heading" style="margin-bottom:clamp(12px,3vw,24px);">${title}</h2>
        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(clamp(120px,28vw,160px), 1fr));
          gap:clamp(8px,1.5vw,12px);
          width:100%;max-width:700px;
        ">
          ${createCharGrid(characters, selectedIds)}
        </div>
        <button class="ui-btn ui-btn--secondary" id="back-btn" style="margin-top:clamp(12px,3vw,24px);max-width:300px;">BACK</button>
      </div>
    `;

    container.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', () => {
        const characterId = card.dataset.id;
        if (selectedIds.includes(characterId)) return;

        const audio = getAudioEngine();
        if (audio) audio.playCharacterVoice(characterId, 'select');

        selectedIds.push(characterId);
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
      });
    });

    container.querySelector('#back-btn').addEventListener('click', () => {
      if (currentPlayer > 0) {
        selectedIds.pop();
        currentPlayer--;
        render();
      } else {
        stopPreviews();
        setScene('menu');
      }
    });

    startPreviews();
  }

  render();
}
