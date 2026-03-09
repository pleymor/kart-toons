// Procedural road shader with lane markings and surface detail
uniform vec3 baseColor;
uniform vec3 lineColor;
uniform float time;
uniform int roadStyle; // 0=asphalt, 1=lava, 2=underwater, 3=neon, 4=stone
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vFogDepth;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.2;
    a *= 0.45;
  }
  return v;
}

vec3 asphaltRoad(vec2 uv, vec2 wp) {
  // Multi-scale surface grain for sharp asphalt texture
  float grain = fbm(wp * 8.0) * 0.12;
  float fine = noise(wp * 40.0) * 0.06;
  vec3 col = baseColor * (0.88 + grain + fine);

  // Subtle cracks
  float crack = smoothstep(0.78, 0.8, noise(wp * 15.0));
  col *= 1.0 - crack * 0.15;

  // Center dashed line
  float centerLine = smoothstep(0.48, 0.49, uv.x) - smoothstep(0.51, 0.52, uv.x);
  float dash = step(0.5, fract(uv.y * 4.0));
  col = mix(col, lineColor, centerLine * dash * 0.7);

  // Edge lines (solid)
  float edgeL = smoothstep(0.02, 0.04, uv.x) - smoothstep(0.05, 0.06, uv.x);
  float edgeR = smoothstep(0.94, 0.95, uv.x) - smoothstep(0.97, 0.98, uv.x);
  col = mix(col, lineColor, (edgeL + edgeR) * 0.5);

  return col;
}

vec3 lavaRoad(vec2 uv, vec2 wp) {
  // Cracked stone tile pattern
  vec2 tileCoord = wp * 1.2;
  vec2 tile = floor(tileCoord);
  vec2 f = fract(tileCoord);
  float tileNoise = hash(tile);

  // Base stone color with per-tile variation
  float grain = fbm(wp * 8.0) * 0.15;
  float fine = noise(wp * 35.0) * 0.08;
  vec3 col = baseColor * (0.7 + grain + fine + tileNoise * 0.1);

  // Tile gaps (cracks between stones)
  float gap = smoothstep(0.03, 0.07, f.x) * smoothstep(0.03, 0.07, f.y);
  gap *= smoothstep(0.03, 0.07, 1.0 - f.x) * smoothstep(0.03, 0.07, 1.0 - f.y);

  // Lava glows in the gaps between tiles
  float lavaGlow = (1.0 - gap) * (0.6 + 0.4 * sin(time * 0.5 + tileNoise * 6.0));
  col = mix(col, vec3(1.0, 0.35, 0.0), lavaGlow * 0.8);
  col *= 0.6 + gap * 0.4;

  // Interior lava veins (larger cracks through tiles)
  float vein = smoothstep(0.68, 0.75, noise(wp * 6.0 + time * 0.008));
  float veinPulse = 0.7 + 0.3 * sin(time * 1.2 + wp.y * 0.2);
  col += vec3(1.0, 0.3, 0.0) * vein * 0.5 * veinPulse;

  // Glowing edge cracks
  float edgeDist = min(uv.x, 1.0 - uv.x);
  float edgeCrack = smoothstep(0.08, 0.02, edgeDist) * (0.5 + 0.5 * sin(time * 0.6 + wp.y * 0.3));
  col += vec3(1.0, 0.25, 0.0) * edgeCrack * 0.5;

  // Ember spots (rare, static glowing dots)
  float ember = smoothstep(0.92, 0.95, noise(wp * 20.0));
  col += vec3(1.0, 0.5, 0.0) * ember * 0.3;

  return col;
}

vec3 underwaterRoad(vec2 uv, vec2 wp) {
  float grain = fbm(wp * 5.0 + time * 0.008) * 0.15;
  float fine = noise(wp * 25.0) * 0.06;
  vec3 col = baseColor * (0.82 + grain + fine);

  // Ripple highlights
  float ripple = sin(wp.x * 1.5 + wp.y * 0.8 + time * 0.8) * 0.5 + 0.5;
  ripple = smoothstep(0.7, 0.9, ripple);
  col += vec3(0.05, 0.12, 0.18) * ripple;

  // Shell/coral edge accents
  float edgeDist = min(uv.x, 1.0 - uv.x);
  float edgeGlow = smoothstep(0.1, 0.02, edgeDist);
  col = mix(col, col * 1.3, edgeGlow * 0.3);

  return col;
}

vec3 neonRoad(vec2 uv, vec2 wp) {
  float fine = noise(wp * 35.0) * 0.05;
  vec3 col = baseColor * (0.8 + fine);

  // Grid pattern
  float gridV = smoothstep(0.46, 0.5, abs(fract(uv.y * 8.0) - 0.5));
  float gridH = smoothstep(0.46, 0.5, abs(fract(wp.x * 0.5) - 0.5));
  col += lineColor * (gridV + gridH) * 0.1;

  // Center neon line (pulsing)
  float centerLine = smoothstep(0.48, 0.49, uv.x) - smoothstep(0.51, 0.52, uv.x);
  col += lineColor * centerLine * (0.6 + 0.4 * sin(time * 2.0 + wp.y * 0.5));

  // Edge neon strips
  float edgeL = smoothstep(0.02, 0.04, uv.x) - smoothstep(0.05, 0.06, uv.x);
  float edgeR = smoothstep(0.94, 0.95, uv.x) - smoothstep(0.97, 0.98, uv.x);
  col += lineColor * (edgeL + edgeR) * 0.9;

  // Panel seams
  float seam = smoothstep(0.48, 0.5, abs(fract(wp.y * 0.3) - 0.5));
  col *= 0.95 + seam * 0.05;

  return col;
}

vec3 stoneRoad(vec2 uv, vec2 wp) {
  // Cobblestone pattern with sharper cells
  vec2 cellCoord = wp * 1.5;
  vec2 cell = floor(cellCoord);
  vec2 f = fract(cellCoord);
  float cellNoise = hash(cell);
  float grain = fbm(wp * 10.0) * 0.15;
  float fine = noise(wp * 30.0) * 0.08;
  vec3 col = baseColor * (0.72 + grain + fine + cellNoise * 0.12);

  // Gaps between stones (sharper)
  float gap = smoothstep(0.03, 0.08, f.x) * smoothstep(0.03, 0.08, f.y);
  gap *= smoothstep(0.03, 0.08, 1.0 - f.x) * smoothstep(0.03, 0.08, 1.0 - f.y);
  col *= 0.55 + gap * 0.45;

  // Moss in gaps
  float moss = (1.0 - gap) * smoothstep(0.3, 0.6, noise(wp * 5.0));
  col = mix(col, vec3(0.12, 0.2, 0.08), moss * 0.3);

  return col;
}

void main() {
  vec2 wp = vWorldPosition.xz;
  vec2 uv = vUv;
  vec3 col;

  if (roadStyle == 0) col = asphaltRoad(uv, wp);
  else if (roadStyle == 1) col = lavaRoad(uv, wp);
  else if (roadStyle == 2) col = underwaterRoad(uv, wp);
  else if (roadStyle == 3) col = neonRoad(uv, wp);
  else if (roadStyle == 4) col = stoneRoad(uv, wp);
  else col = asphaltRoad(uv, wp);

  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);
  gl_FragColor = vec4(col, 0.85);
}
