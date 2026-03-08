import { setScene } from '../main.js';
import { getAllCharacters } from '../characters/index.js';
import { getAllCircuits } from '../circuits/index.js';

let networkClient = null;
let currentRoom = null;
let chatMessages = [];

export function show(container, data = {}) {
  networkClient = data.networkClient;

  if (data.action === 'create') {
    showCreateForm(container);
  } else if (data.action === 'join') {
    showJoinForm(container);
  } else if (data.room) {
    currentRoom = data.room;
    showLobby(container);
  }
}

function showCreateForm(container) {
  const circuits = getAllCircuits();
  const circuitOpts = circuits.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  container.innerHTML = `
    <div class="ui-screen" style="justify-content:center;">
      <h2 class="ui-heading" style="margin-bottom:clamp(16px,4vw,24px);">CREATE ROOM</h2>
      <div class="ui-container" style="max-width:400px;">
        <label class="ui-text--sm">Circuit<br>
          <select id="circuit-sel" style="width:100%;padding:clamp(6px,1.5vw,10px);background:#222;color:#ccc;border:1px solid #555;font-size:clamp(14px,2.5vw,16px);margin-top:4px;">
            ${circuitOpts}
          </select>
        </label>
        <label class="ui-text--sm">Laps<br>
          <select id="laps-sel" style="width:100%;padding:clamp(6px,1.5vw,10px);background:#222;color:#ccc;border:1px solid #555;font-size:clamp(14px,2.5vw,16px);margin-top:4px;">
            <option value="2">2</option><option value="3" selected>3</option><option value="5">5</option>
          </select>
        </label>
        <label class="ui-text" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="items-chk" checked style="width:20px;height:20px;"> Items enabled
        </label>
        <button class="ui-btn" id="create-btn">CREATE</button>
        <button class="ui-btn ui-btn--secondary" id="back-btn">BACK</button>
      </div>
    </div>
  `;

  container.querySelector('#create-btn').addEventListener('click', async () => {
    const settings = {
      circuitId: container.querySelector('#circuit-sel').value,
      laps: parseInt(container.querySelector('#laps-sel').value),
      itemsEnabled: container.querySelector('#items-chk').checked
    };
    const res = await networkClient.createRoom(settings);
    if (res.ok) {
      currentRoom = res.room;
      setupRoomListeners(container);
      showLobby(container);
    }
  });

  container.querySelector('#back-btn').addEventListener('click', () => setScene('menu'));
}

function showJoinForm(container) {
  container.innerHTML = `
    <div class="ui-screen" style="justify-content:center;">
      <h2 class="ui-heading" style="margin-bottom:clamp(16px,4vw,24px);">JOIN ROOM</h2>
      <div class="ui-container" style="max-width:400px;">
        <input id="code-input" type="text" maxlength="6" placeholder="Enter 6-digit code"
          style="padding:clamp(10px,2vw,14px);font-size:clamp(20px,5vw,28px);text-align:center;background:#222;color:#fff;border:2px solid #555;letter-spacing:8px;">
        <input id="name-input" type="text" maxlength="20" placeholder="Your name"
          style="padding:clamp(8px,1.5vw,10px);font-size:clamp(14px,2.5vw,16px);background:#222;color:#fff;border:1px solid #555;">
        <button class="ui-btn" id="join-btn">JOIN</button>
        <button class="ui-btn ui-btn--secondary" id="back-btn">BACK</button>
        <p id="error-msg" style="color:#ff4444;font-size:clamp(12px,2vw,14px);display:none;"></p>
      </div>
    </div>
  `;

  container.querySelector('#join-btn').addEventListener('click', async () => {
    const code = container.querySelector('#code-input').value.trim();
    const name = container.querySelector('#name-input').value.trim() || 'Player';
    const res = await networkClient.joinRoom(code, name);
    if (res.ok) {
      currentRoom = res.room;
      setupRoomListeners(container);
      showLobby(container);
    } else {
      const err = container.querySelector('#error-msg');
      err.textContent = res.error || 'Failed to join';
      err.style.display = 'block';
    }
  });

  container.querySelector('#back-btn').addEventListener('click', () => setScene('menu'));
}

function setupRoomListeners(container) {
  networkClient.on('roomUpdate', (room) => {
    currentRoom = room;
    showLobby(container);
  });
  networkClient.on('chat', (msg) => {
    chatMessages.push(msg);
    if (chatMessages.length > 50) chatMessages.shift();
    updateChat(container);
  });
  networkClient.on('raceStart', () => {
    setScene('race');
  });
}

function showLobby(container) {
  const room = currentRoom;
  if (!room) return;

  const characters = getAllCharacters();
  const isHost = room.hostId === networkClient.socket?.id;

  const playerList = room.players.map(p => {
    const char = characters.find(c => c.id === p.characterId);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:clamp(6px,1.5vw,8px);
      border-bottom:1px solid #333;font-size:clamp(13px,2.5vw,15px);">
      <span>${p.name} ${p.id === room.hostId ? '(Host)' : ''}</span>
      <span style="color:${char ? '#ff6633' : '#555'};">${char?.name || '...'}</span>
      <span style="color:${p.ready ? '#44ff44' : '#ff4444'};">${p.ready ? 'READY' : 'NOT READY'}</span>
    </div>`;
  }).join('');

  const charGrid = characters.map(c => `
    <div class="char-pick ui-card" data-id="${c.id}" style="padding:clamp(4px,1vw,6px);text-align:center;">
      <div style="width:clamp(30px,8vw,40px);height:clamp(30px,8vw,40px);border-radius:50%;background:#${c.kartColor.toString(16).padStart(6,'0')};
        margin:0 auto clamp(2px,0.5vw,4px);"></div>
      <span class="ui-text--xs">${c.name}</span>
    </div>
  `).join('');

  const chatHtml = chatMessages.map(m =>
    `<div class="ui-text--xs" style="padding:2px 0;"><b style="color:#ff6633;">${m.from}:</b> ${m.message}</div>`
  ).join('');

  container.innerHTML = `
    <div class="ui-screen">
      <h2 class="ui-heading">ROOM: ${room.code}</h2>
      <p class="ui-text--sm">Circuit: ${room.settings.circuitId} | Laps: ${room.settings.laps}</p>

      <div style="display:flex;flex-direction:column;gap:clamp(8px,2vw,16px);width:100%;max-width:600px;margin-top:clamp(8px,2vw,16px);">
        <div>
          <h3 class="ui-text--sm" style="margin-bottom:8px;letter-spacing:1px;">PLAYERS</h3>
          <div style="background:rgba(0,0,0,0.3);border:1px solid #333;border-radius:4px;">
            ${playerList}
          </div>
        </div>

        <div>
          <h3 class="ui-text--sm" style="margin-bottom:8px;letter-spacing:1px;">SELECT CHARACTER</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(60px,15vw,80px),1fr));gap:6px;">
            ${charGrid}
          </div>
        </div>

        <div style="display:flex;gap:8px;">
          <button class="ui-btn" id="ready-btn" style="flex:1;">READY</button>
          ${isHost ? '<button class="ui-btn" id="start-btn" style="flex:1;">START</button>' : ''}
        </div>
        <button class="ui-btn ui-btn--secondary" id="leave-btn">LEAVE</button>

        <div>
          <h3 class="ui-text--sm" style="margin-bottom:8px;letter-spacing:1px;">CHAT</h3>
          <div id="chat-log" style="height:clamp(100px,20vh,200px);overflow-y:auto;background:rgba(0,0,0,0.3);
            border:1px solid #333;padding:6px;border-radius:4px;">${chatHtml}</div>
          <div style="display:flex;gap:4px;margin-top:4px;">
            <input id="chat-input" type="text" maxlength="200" placeholder="Message..."
              style="flex:1;padding:clamp(6px,1.5vw,8px);background:#222;color:#fff;border:1px solid #555;font-size:clamp(13px,2.5vw,14px);">
            <button class="ui-btn" id="chat-send" style="width:auto;padding:clamp(6px,1.5vw,8px) clamp(10px,2vw,16px);">SEND</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.char-pick').forEach(el => {
    el.addEventListener('click', () => {
      networkClient.selectCharacter(el.dataset.id);
    });
  });

  container.querySelector('#ready-btn')?.addEventListener('click', () => {
    networkClient.setReady(true);
  });

  container.querySelector('#start-btn')?.addEventListener('click', () => {
    networkClient.startRace();
  });

  container.querySelector('#leave-btn')?.addEventListener('click', () => {
    networkClient.disconnect();
    setScene('menu');
  });

  container.querySelector('#chat-send')?.addEventListener('click', () => {
    const input = container.querySelector('#chat-input');
    if (input.value.trim()) {
      networkClient.sendChat(input.value.trim());
      input.value = '';
    }
  });
  container.querySelector('#chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') container.querySelector('#chat-send')?.click();
  });
}

function updateChat(container) {
  const log = container.querySelector('#chat-log');
  if (!log) return;
  const chatHtml = chatMessages.map(m =>
    `<div class="ui-text--xs" style="padding:2px 0;"><b style="color:#ff6633;">${m.from}:</b> ${m.message}</div>`
  ).join('');
  log.innerHTML = chatHtml;
  log.scrollTop = log.scrollHeight;
}
