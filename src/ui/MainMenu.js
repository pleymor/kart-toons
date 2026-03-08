import { setScene } from '../main.js';

const MENU_HTML = `
<div class="ui-screen" style="justify-content:center;">
  <h1 class="ui-title" style="margin-bottom:8px;">KHAOS KART</h1>
  <p class="ui-subtitle" style="margin-bottom:clamp(24px,5vw,48px);">CELL SHADED RACING</p>

  <div class="ui-container">
    <button class="ui-btn" data-action="solo">SOLO RACE</button>
    <button class="ui-btn" data-action="time-trial">TIME TRIAL</button>
    <button class="ui-btn" data-action="grand-prix">GRAND PRIX</button>
    <button class="ui-btn" data-action="local-2">LOCAL 2 PLAYERS</button>
    <button class="ui-btn" data-action="local-4">LOCAL 4 PLAYERS</button>
    <button class="ui-btn" data-action="crew">CREW MODE (2P)</button>
    <button class="ui-btn" data-action="online-create">ONLINE: CREATE ROOM</button>
    <button class="ui-btn" data-action="online-join">ONLINE: JOIN ROOM</button>
    <button class="ui-btn ui-btn--secondary" data-action="stats">STATS</button>
  </div>
</div>
`;

export function show(container) {
  container.innerHTML = MENU_HTML;

  container.querySelectorAll('.ui-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (btn.disabled) return;

      switch (action) {
        case 'solo':
          setScene('character-select', { mode: 'solo' });
          break;
        case 'time-trial':
          setScene('character-select', { mode: 'time-trial' });
          break;
        case 'grand-prix':
          setScene('character-select', { mode: 'grand-prix' });
          break;
        case 'local-2':
          setScene('character-select', { mode: 'local', playerCount: 2 });
          break;
        case 'local-4':
          setScene('character-select', { mode: 'local', playerCount: 4 });
          break;
        case 'crew':
          setScene('character-select', { mode: 'crew', playerCount: 1 });
          break;
        case 'stats':
          import('../utils/Storage.js').then(({ Storage }) => {
            const p = Storage.getProfile();
            const winRate = p.totalRaces > 0 ? Math.round((p.totalWins / p.totalRaces) * 100) : 0;
            const bestTimesHtml = Object.entries(p.bestTimes || {}).map(([circuit, time]) => {
              const mins = Math.floor(time / 60);
              const secs = (time % 60).toFixed(3);
              return `<tr><td style="padding:4px 12px;">${circuit}</td><td style="padding:4px 12px;font-family:monospace;">${mins}:${secs.padStart(6, '0')}</td></tr>`;
            }).join('') || '<tr><td colspan="2" style="padding:4px 12px;color:#666;">No records yet</td></tr>';

            container.innerHTML = `
              <div class="ui-screen" style="justify-content:center;">
                <h2 class="ui-heading" style="margin-bottom:24px;">STATISTICS</h2>
                <div class="ui-container ui-text" style="max-width:400px;">
                  <p>Races: <b>${p.totalRaces || 0}</b></p>
                  <p>Wins: <b>${p.totalWins || 0}</b> (${winRate}%)</p>
                  <p>Items Used: <b>${p.totalItemsUsed || 0}</b></p>
                  <p>Distance: <b>${Math.round(p.totalDistance || 0)}</b> km</p>
                  <h3 class="ui-text--sm" style="margin-top:12px;letter-spacing:2px;">BEST TIMES</h3>
                  <table style="width:100%;border-collapse:collapse;color:#ccc;" class="ui-text--sm">${bestTimesHtml}</table>
                  <button class="ui-btn ui-btn--secondary" style="margin-top:16px;" onclick="location.reload()">BACK</button>
                </div>
              </div>
            `;
          });
          return;
        case 'online-create':
        case 'online-join':
          import('../network/NetworkClient.js').then(({ NetworkClient }) => {
            const nc = new NetworkClient();
            nc.connect();
            setScene('lobby', {
              networkClient: nc,
              action: action === 'online-create' ? 'create' : 'join'
            });
          });
          break;
      }
    });
  });
}
