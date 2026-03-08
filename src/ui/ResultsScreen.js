import { setScene } from '../main.js';
import { getCharacter } from '../characters/index.js';

function formatTime(seconds) {
  if (!seconds) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function show(container, data = {}) {
  const { finishOrder = [], circuitId, mode } = data;

  const rows = finishOrder.map((entry, i) => {
    const char = getCharacter(entry.characterId);
    const colorHex = char ? char.kartColor.toString(16).padStart(6, '0') : 'ffffff';
    return `
      <tr style="color:${i === 0 ? '#ff6633' : '#ccc'};">
        <td style="padding:clamp(4px,1vw,8px) clamp(8px,2vw,16px);font-size:clamp(18px,4vw,24px);font-weight:bold;">${i + 1}</td>
        <td style="padding:clamp(4px,1vw,8px) clamp(8px,2vw,16px);">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${colorHex};margin-right:8px;vertical-align:middle;"></span>
          ${char?.name || entry.characterId}
        </td>
        <td style="padding:clamp(4px,1vw,8px) clamp(8px,2vw,16px);font-family:monospace;">${formatTime(entry.time)}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="ui-screen" style="justify-content:center;">
      <h2 class="ui-title" style="font-size:clamp(20px,5vw,36px);margin-bottom:clamp(12px,3vw,24px);">RESULTS</h2>
      <table style="border-collapse:collapse;margin-bottom:clamp(16px,4vw,32px);width:100%;max-width:500px;" class="ui-text">
        <thead>
          <tr class="ui-text--sm" style="text-transform:uppercase;">
            <th style="padding:4px clamp(8px,2vw,16px);text-align:left;">#</th>
            <th style="padding:4px clamp(8px,2vw,16px);text-align:left;">Racer</th>
            <th style="padding:4px clamp(8px,2vw,16px);text-align:left;">Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;gap:clamp(8px,2vw,12px);width:100%;max-width:400px;">
        <button class="ui-btn" data-action="restart" style="flex:1;">RESTART</button>
        <button class="ui-btn ui-btn--secondary" data-action="menu" style="flex:1;">MENU</button>
      </div>
    </div>
  `;

  container.querySelectorAll('.ui-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'menu') {
        setScene('menu');
      } else {
        setScene('character-select', { mode: mode || 'solo' });
      }
    });
  });
}
