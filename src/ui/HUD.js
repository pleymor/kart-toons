let hudElement = null;
let minimapCanvas = null;
let minimapCtx = null;

export function show(container) {
  container.innerHTML = `
    <div id="hud" style="
      position:absolute;top:0;left:0;width:100%;height:100%;
      pointer-events:none;font-family:'Rajdhani',sans-serif;color:white;
    ">
      <!-- Countdown overlay -->
      <div id="hud-countdown" style="
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        font-family:'Press Start 2P',monospace;font-size:clamp(48px,15vw,100px);font-weight:bold;color:#ff6633;
        text-shadow:0 0 30px #ff4400;display:none;
      "></div>

      <!-- Position -->
      <div id="hud-position" style="
        position:absolute;top:clamp(8px,2vw,16px);left:clamp(8px,2vw,16px);
        font-family:'Press Start 2P',monospace;font-size:clamp(24px,6vw,36px);
        text-shadow:2px 2px 4px rgba(0,0,0,0.8);
      ">1st</div>

      <!-- Lap -->
      <div id="hud-lap" style="
        position:absolute;top:clamp(36px,9vw,56px);left:clamp(8px,2vw,16px);
        font-size:clamp(16px,3.5vw,20px);text-shadow:2px 2px 4px rgba(0,0,0,0.8);
      ">Lap 1/3</div>

      <!-- Timer -->
      <div id="hud-timer" style="
        position:absolute;top:clamp(58px,14vw,80px);left:clamp(8px,2vw,16px);
        font-size:clamp(13px,2.5vw,16px);color:#aaa;
      ">0:00.000</div>

      <!-- Speed -->
      <div id="hud-speed" style="
        position:absolute;bottom:clamp(8px,2vw,16px);right:clamp(8px,2vw,16px);
        font-size:clamp(24px,6vw,32px);font-weight:bold;
        text-shadow:2px 2px 4px rgba(0,0,0,0.8);
      ">0 <span style="font-size:clamp(12px,2.5vw,14px);color:#888;">km/h</span></div>

      <!-- Item slot -->
      <div id="hud-item" style="
        position:absolute;top:clamp(8px,2vw,16px);right:clamp(8px,2vw,16px);
        width:clamp(52px,12vw,64px);height:clamp(52px,12vw,64px);
        border:2px solid #555;background:rgba(0,0,0,0.5);border-radius:8px;
        display:flex;align-items:center;justify-content:center;
        font-size:clamp(10px,2.2vw,12px);text-align:center;color:#888;
      ">-</div>

      <!-- Rearview mirror (visual frame only, actual render is on the canvas below) -->

      <!-- Minimap -->
      <canvas id="hud-minimap" width="150" height="150" style="
        position:absolute;bottom:clamp(8px,2vw,16px);left:clamp(8px,2vw,16px);
        width:clamp(90px,20vw,150px);height:clamp(90px,20vw,150px);
        border:1px solid #333;background:rgba(0,0,0,0.4);border-radius:4px;
      "></canvas>
    </div>
  `;

  hudElement = container.querySelector('#hud');
  minimapCanvas = container.querySelector('#hud-minimap');
  minimapCtx = minimapCanvas?.getContext('2d');
}

const POSITION_SUFFIXES = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];

export function updateHUD(data) {
  if (!hudElement) return;

  const { position, lap, maxLaps, timer, speed, itemName, countdown, participants, waypoints } = data;

  // Countdown
  const countdownEl = hudElement.querySelector('#hud-countdown');
  if (countdown !== undefined && countdown > 0) {
    countdownEl.style.display = 'block';
    countdownEl.textContent = countdown;
  } else if (countdown === 0) {
    countdownEl.style.display = 'block';
    countdownEl.textContent = 'GO!';
    setTimeout(() => { countdownEl.style.display = 'none'; }, 1000);
  } else {
    countdownEl.style.display = 'none';
  }

  // Position
  const posEl = hudElement.querySelector('#hud-position');
  if (posEl) {
    posEl.textContent = `${position}${POSITION_SUFFIXES[position - 1] || 'th'}`;
  }

  // Lap
  const lapEl = hudElement.querySelector('#hud-lap');
  if (lapEl) lapEl.textContent = `Lap ${Math.min(lap + 1, maxLaps)}/${maxLaps}`;

  // Timer
  const timerEl = hudElement.querySelector('#hud-timer');
  if (timerEl) timerEl.textContent = formatTime(timer);

  // Speed
  const speedEl = hudElement.querySelector('#hud-speed');
  if (speedEl) speedEl.innerHTML = `${Math.round(speed * 3.6)} <span style="font-size:clamp(12px,2.5vw,14px);color:#888;">km/h</span>`;

  // Item
  const itemEl = hudElement.querySelector('#hud-item');
  if (itemEl) {
    itemEl.textContent = itemName || '-';
    itemEl.style.borderColor = itemName ? '#ff4400' : '#555';
  }

  // Minimap
  drawMinimap(participants, waypoints);
}

function drawMinimap(participants, waypoints) {
  if (!minimapCtx || !waypoints) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const wp of waypoints) {
    if (wp.x < minX) minX = wp.x;
    if (wp.x > maxX) maxX = wp.x;
    if (wp.z < minZ) minZ = wp.z;
    if (wp.z > maxZ) maxZ = wp.z;
  }
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const pad = 10;

  const toScreen = (x, z) => [
    pad + ((x - minX) / rangeX) * (w - pad * 2),
    pad + ((z - minZ) / rangeZ) * (h - pad * 2)
  ];

  minimapCtx.strokeStyle = '#444';
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  for (let i = 0; i < waypoints.length; i++) {
    const [sx, sy] = toScreen(waypoints[i].x, waypoints[i].z);
    if (i === 0) minimapCtx.moveTo(sx, sy);
    else minimapCtx.lineTo(sx, sy);
  }
  minimapCtx.closePath();
  minimapCtx.stroke();

  if (participants) {
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const pos = p.kartController?.position;
      if (!pos) continue;
      const [sx, sy] = toScreen(pos.x, pos.z);
      minimapCtx.fillStyle = p.isHuman ? '#ff4400' : '#ffffff';
      minimapCtx.beginPath();
      minimapCtx.arc(sx, sy, p.isHuman ? 4 : 3, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  }
}

function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function hide() {
  if (hudElement) {
    hudElement.remove();
    hudElement = null;
  }
}

let portraitWarning = null;

export function initOrientationCheck() {
  if (!('ontouchstart' in window)) return;

  portraitWarning = document.createElement('div');
  portraitWarning.id = 'portrait-warning';
  portraitWarning.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;
    background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Rajdhani',sans-serif;color:#ff6633;font-size:clamp(18px,5vw,24px);text-align:center;
  `;
  portraitWarning.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">&#x1F504;</div>Rotate to landscape<br><span style="font-size:clamp(12px,3vw,14px);color:#888;">for the best experience</span>';
  document.body.appendChild(portraitWarning);

  function check() {
    if (portraitWarning) {
      portraitWarning.style.display = window.innerHeight > window.innerWidth ? 'flex' : 'none';
    }
  }
  window.addEventListener('resize', check);
  check();
}
