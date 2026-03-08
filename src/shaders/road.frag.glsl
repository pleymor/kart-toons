// Procedural road shader with lane markings and surface detail
uniform vec3 baseColor;
uniform vec3 lineColor;
uniform float time;
uniform int roadStyle; // 0=asphalt, 1=lava, 2=underwater, 3=neon, 4=stone

varying vec3 vWorldPosition;
varying vec2 vUv;

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

vec3 asphaltRoad(vec2 uv, vec2 wp) {
  // Surface grain
  float grain = noise(wp * 2.0) * 0.15;
  vec3 col = baseColor * (0.85 + grain);

  // Center dashed line
  float centerLine = smoothstep(0.48, 0.49, uv.x) - smoothstep(0.51, 0.52, uv.x);
  float dash = step(0.5, fract(uv.y * 4.0)); // dashed pattern
  col = mix(col, lineColor, centerLine * dash * 0.6);

  // Edge lines (solid)
  float edgeL = smoothstep(0.02, 0.04, uv.x) - smoothstep(0.05, 0.06, uv.x);
  float edgeR = smoothstep(0.94, 0.95, uv.x) - smoothstep(0.97, 0.98, uv.x);
  col = mix(col, lineColor, (edgeL + edgeR) * 0.4);

  return col;
}

vec3 lavaRoad(vec2 uv, vec2 wp) {
  float grain = noise(wp * 1.5 + time * 0.01) * 0.2;
  vec3 col = baseColor * (0.7 + grain);
  // Glowing cracks along edges
  float edgeDist = min(uv.x, 1.0 - uv.x);
  float crack = smoothstep(0.08, 0.03, edgeDist) * (0.5 + 0.5 * sin(time + wp.y * 0.3));
  col += vec3(1.0, 0.3, 0.0) * crack * 0.6;
  return col;
}

vec3 underwaterRoad(vec2 uv, vec2 wp) {
  float grain = noise(wp * 1.0 + time * 0.02) * 0.15;
  vec3 col = baseColor * (0.8 + grain);
  // Ripple highlights
  float ripple = sin(wp.x * 0.8 + wp.y * 0.5 + time * 1.2) * 0.5 + 0.5;
  ripple = smoothstep(0.75, 0.9, ripple);
  col += vec3(0.05, 0.1, 0.15) * ripple;
  // Shell/coral edge accents
  float edgeDist = min(uv.x, 1.0 - uv.x);
  float edgeGlow = smoothstep(0.1, 0.02, edgeDist);
  col = mix(col, col * 1.3, edgeGlow * 0.3);
  return col;
}

vec3 neonRoad(vec2 uv, vec2 wp) {
  vec3 col = baseColor * 0.8;
  // Glowing grid lines along road
  float gridV = smoothstep(0.48, 0.5, abs(fract(uv.y * 8.0) - 0.5));
  col += lineColor * gridV * 0.15;
  // Center neon line
  float centerLine = smoothstep(0.48, 0.49, uv.x) - smoothstep(0.51, 0.52, uv.x);
  col += lineColor * centerLine * (0.5 + 0.5 * sin(time * 3.0 + wp.y * 0.5));
  // Edge neon strips
  float edgeL = smoothstep(0.02, 0.04, uv.x) - smoothstep(0.05, 0.06, uv.x);
  float edgeR = smoothstep(0.94, 0.95, uv.x) - smoothstep(0.97, 0.98, uv.x);
  col += lineColor * (edgeL + edgeR) * 0.8;
  return col;
}

vec3 stoneRoad(vec2 uv, vec2 wp) {
  // Cobblestone pattern
  vec2 cell = floor(wp * 0.8);
  float cellNoise = hash(cell);
  float grain = noise(wp * 3.0) * 0.2;
  vec3 col = baseColor * (0.7 + grain + cellNoise * 0.15);
  // Gaps between stones
  vec2 f = fract(wp * 0.8);
  float gap = smoothstep(0.02, 0.06, f.x) * smoothstep(0.02, 0.06, f.y);
  gap *= smoothstep(0.02, 0.06, 1.0 - f.x) * smoothstep(0.02, 0.06, 1.0 - f.y);
  col *= 0.6 + gap * 0.4;
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

  gl_FragColor = vec4(col, 1.0);
}
