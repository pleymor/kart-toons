import { getAllCircuits } from '../circuits/index.js';
import { setScene } from '../main.js';
import { startRace } from '../game/RaceSetup.js';
import { startGamepadNav } from './GamepadNav.js';

function highlightCard(cards, index) {
  cards.forEach((c, i) => {
    c.style.outline = i === index ? '2px solid #ff6633' : 'none';
    c.style.outlineOffset = i === index ? '2px' : '0';
  });
}

export function show(container, data = {}) {
  const circuits = getAllCircuits();

  const list = circuits.map(c => `
    <div class="circuit-card ui-card" data-id="${c.id}" style="display:flex;gap:clamp(8px,2vw,16px);align-items:center;">
      <div style="width:clamp(60px,15vw,100px);height:clamp(36px,9vw,60px);background:#${(c.palette?.ground || 0x333333).toString(16).padStart(6,'0')};
        border-radius:4px;border:1px solid #555;flex-shrink:0;"></div>
      <div style="min-width:0;">
        <h3 style="margin:0 0 4px;font-size:clamp(14px,3vw,18px);color:#fff;">${c.name}</h3>
        <p class="ui-text--sm" style="margin:0 0 4px;">${c.theme}</p>
        <p class="ui-text--xs" style="margin:0;">
          Elevation: ${c.elevationProfile} | Laps: ${c.defaultLaps} | Shortcuts: ${c.shortcuts?.length || 0}
        </p>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="ui-screen">
      <h2 class="ui-heading" style="margin-bottom:clamp(12px,3vw,24px);">SELECT CIRCUIT</h2>
      <div class="ui-container">
        ${list}
      </div>
      <button class="ui-btn ui-btn--secondary" id="back-btn" style="margin-top:clamp(12px,3vw,24px);max-width:300px;">BACK</button>
    </div>
  `;

  const cards = [...container.querySelectorAll('.circuit-card')];
  let focusIndex = 0;
  highlightCard(cards, focusIndex);

  function selectCircuit(index) {
    cleanup();
    const circuitId = cards[index].dataset.id;
    startRace({ ...data, circuitId });
  }

  function goBack() {
    cleanup();
    setScene('character-select', data);
  }

  cards.forEach((card, i) => {
    card.addEventListener('click', () => { selectCircuit(i); });
  });

  container.querySelector('#back-btn').addEventListener('click', goBack);

  // Keyboard nav
  const onKey = (e) => {
    if (e.code === 'ArrowUp' || e.code === 'KeyZ') {
      focusIndex = (focusIndex - 1 + cards.length) % cards.length;
      highlightCard(cards, focusIndex);
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      focusIndex = (focusIndex + 1) % cards.length;
      highlightCard(cards, focusIndex);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      selectCircuit(focusIndex);
    } else if (e.code === 'Escape' || e.code === 'Backspace') {
      goBack();
    }
  };
  window.addEventListener('keydown', onKey);

  // Gamepad nav
  const stopGp = startGamepadNav({
    onUp: () => {
      focusIndex = (focusIndex - 1 + cards.length) % cards.length;
      highlightCard(cards, focusIndex);
    },
    onDown: () => {
      focusIndex = (focusIndex + 1) % cards.length;
      highlightCard(cards, focusIndex);
    },
    onConfirm: () => selectCircuit(focusIndex),
    onBack: goBack
  });

  function cleanup() {
    window.removeEventListener('keydown', onKey);
    stopGp();
  }
}
