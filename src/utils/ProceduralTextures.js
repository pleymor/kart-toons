import * as THREE from 'three';

const _cache = new Map();
const SIZE = 256;

function getOrCreate(key, generator) {
  if (_cache.has(key)) return _cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  generator(ctx, SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  _cache.set(key, tex);
  return tex;
}

// --- Helpers ---

function hexToRgb(hex) {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

function rgb(r, g, b) { return `rgb(${r},${g},${b})`; }

function vary(val, amount, rng) {
  return Math.max(0, Math.min(255, val + (rng() - 0.5) * amount));
}

function mulberry32(seed) {
  let t = seed;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Road Textures ---

export function roadTexture(baseColor) {
  return getOrCreate(`road-${baseColor}`, (ctx, s) => {
    const c = hexToRgb(baseColor);
    const rng = mulberry32(baseColor);

    // Base asphalt
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const noise = (rng() - 0.5) * 20;
        ctx.fillStyle = rgb(
          Math.max(0, Math.min(255, c.r + noise)),
          Math.max(0, Math.min(255, c.g + noise)),
          Math.max(0, Math.min(255, c.b + noise))
        );
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Center dashed line
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(s / 2, 0);
    ctx.lineTo(s / 2, s);
    ctx.stroke();

    // Edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(4, s);
    ctx.moveTo(s - 4, 0); ctx.lineTo(s - 4, s);
    ctx.stroke();
  });
}

// --- Ground Textures ---

export function grassTexture(baseColor) {
  return getOrCreate(`grass-${baseColor}`, (ctx, s) => {
    const c = hexToRgb(baseColor);
    const rng = mulberry32(baseColor + 1);

    // Base fill
    ctx.fillStyle = rgb(c.r, c.g, c.b);
    ctx.fillRect(0, 0, s, s);

    // Grass blades
    for (let i = 0; i < 3000; i++) {
      const x = rng() * s;
      const y = rng() * s;
      const h = 2 + rng() * 5;
      const shade = 0.7 + rng() * 0.6;
      ctx.strokeStyle = rgb(
        Math.min(255, c.r * shade),
        Math.min(255, c.g * shade),
        Math.min(255, c.b * shade)
      );
      ctx.lineWidth = 0.5 + rng();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 3, y - h);
      ctx.stroke();
    }
  });
}

export function sandTexture(baseColor) {
  return getOrCreate(`sand-${baseColor}`, (ctx, s) => {
    const c = hexToRgb(baseColor);
    const rng = mulberry32(baseColor + 2);

    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const noise = (rng() - 0.5) * 30;
        ctx.fillStyle = rgb(
          Math.max(0, Math.min(255, c.r + noise)),
          Math.max(0, Math.min(255, c.g + noise)),
          Math.max(0, Math.min(255, c.b + noise))
        );
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Subtle ripple lines
    ctx.strokeStyle = `rgba(${c.r + 20},${c.g + 20},${c.b + 20},0.2)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const yy = rng() * s;
      ctx.beginPath();
      for (let x = 0; x < s; x += 4) {
        const wy = yy + Math.sin(x * 0.05 + i) * 3;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
  });
}

export function lavaTexture(baseColor) {
  return getOrCreate(`lava-${baseColor}`, (ctx, s) => {
    const rng = mulberry32(baseColor + 3);

    // Dark base
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(0, 0, s, s);

    // Lava cracks
    for (let i = 0; i < 40; i++) {
      let x = rng() * s;
      let y = rng() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 8 + Math.floor(rng() * 12);
      for (let j = 0; j < steps; j++) {
        x += (rng() - 0.5) * 20;
        y += (rng() - 0.5) * 20;
        ctx.lineTo(x, y);
      }
      const glow = rng();
      ctx.strokeStyle = glow > 0.5
        ? `rgba(255,${60 + Math.floor(rng() * 40)},0,${0.4 + rng() * 0.4})`
        : `rgba(255,${120 + Math.floor(rng() * 60)},0,${0.2 + rng() * 0.3})`;
      ctx.lineWidth = 1 + rng() * 2;
      ctx.stroke();
    }

    // Glow spots
    for (let i = 0; i < 20; i++) {
      const gx = rng() * s;
      const gy = rng() * s;
      const gr = 5 + rng() * 15;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, 'rgba(255,100,0,0.3)');
      grad.addColorStop(1, 'rgba(255,50,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
  });
}

export function waterTexture(baseColor) {
  return getOrCreate(`water-${baseColor}`, (ctx, s) => {
    const c = hexToRgb(baseColor);
    const rng = mulberry32(baseColor + 4);

    // Deep base
    ctx.fillStyle = rgb(c.r, c.g, c.b);
    ctx.fillRect(0, 0, s, s);

    // Caustic-like light patterns
    for (let i = 0; i < 30; i++) {
      const cx = rng() * s;
      const cy = rng() * s;
      const r = 10 + rng() * 30;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${c.r + 60},${c.g + 60},${c.b + 80},0.15)`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // Wave lines
    ctx.strokeStyle = `rgba(${c.r + 40},${c.g + 40},${c.b + 60},0.15)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      const yy = rng() * s;
      ctx.beginPath();
      for (let x = 0; x < s; x += 2) {
        const wy = yy + Math.sin(x * 0.04 + i * 2) * 4;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
  });
}

export function stoneTexture(baseColor) {
  return getOrCreate(`stone-${baseColor}`, (ctx, s) => {
    const c = hexToRgb(baseColor);
    const rng = mulberry32(baseColor + 5);

    // Base
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const noise = (rng() - 0.5) * 25;
        ctx.fillStyle = rgb(
          Math.max(0, Math.min(255, c.r + noise)),
          Math.max(0, Math.min(255, c.g + noise)),
          Math.max(0, Math.min(255, c.b + noise))
        );
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Crack lines
    ctx.strokeStyle = `rgba(0,0,0,0.2)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      let x = rng() * s;
      let y = rng() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += (rng() - 0.5) * 30;
        y += (rng() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

export function neonFloorTexture(baseColor) {
  return getOrCreate(`neon-${baseColor}`, (ctx, s) => {
    const c = hexToRgb(baseColor);
    const rng = mulberry32(baseColor + 6);

    // Dark metallic base
    ctx.fillStyle = rgb(c.r, c.g, c.b);
    ctx.fillRect(0, 0, s, s);

    // Grid lines
    ctx.strokeStyle = 'rgba(100,100,120,0.15)';
    ctx.lineWidth = 1;
    const gridSize = 16;
    for (let x = 0; x <= s; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
    for (let y = 0; y <= s; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }

    // Neon glow strips
    for (let i = 0; i < 5; i++) {
      const isHoriz = rng() > 0.5;
      const pos = Math.floor(rng() * (s / gridSize)) * gridSize;
      const glow = rng() > 0.5 ? 'rgba(0,255,200,0.12)' : 'rgba(255,0,255,0.1)';
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (isHoriz) { ctx.moveTo(0, pos); ctx.lineTo(s, pos); }
      else { ctx.moveTo(pos, 0); ctx.lineTo(pos, s); }
      ctx.stroke();
    }
  });
}

// --- Pick texture for circuit theme ---

export function getGroundTexture(circuit) {
  const theme = circuit.theme?.toLowerCase() || '';
  const p = circuit.palette || {};

  if (theme.includes('forest') || theme.includes('crystal')) {
    return grassTexture(p.ground || 0x2a3a2a);
  } else if (theme.includes('volcan') || theme.includes('lava')) {
    return lavaTexture(p.lava || p.ground || 0x3a2a1a);
  } else if (theme.includes('ocean') || theme.includes('reef')) {
    return waterTexture(p.water || p.ground || 0x0a1a2a);
  } else if (theme.includes('neon') || theme.includes('cyber')) {
    return neonFloorTexture(p.ground || 0x222233);
  } else {
    return stoneTexture(p.ground || 0x2a1a2a);
  }
}

export function getRoadTexture(circuit) {
  return roadTexture(circuit.palette?.ground || 0x555555);
}
