// Procedural ground shader with multiple biome modes
uniform vec3 baseColor;
uniform vec3 accentColor;
uniform float time;
uniform int biome; // 0=grass, 1=lava, 2=water, 3=neon, 4=stone, 5=sand
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vFogDepth;

// --- Noise functions ---

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
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// --- Biome functions ---

vec3 grassBiome(vec2 wp) {
  float n = fbm(wp * 0.3);
  float blades = noise(wp * 5.0);
  vec3 col = baseColor * (0.7 + n * 0.6);
  // Darker patches
  col = mix(col, baseColor * 0.5, smoothstep(0.55, 0.65, fbm(wp * 0.15)));
  // Lighter blade tips
  col += vec3(0.05, 0.1, 0.02) * smoothstep(0.6, 0.8, blades);
  return col;
}

vec3 lavaBiome(vec2 wp) {
  float n = fbm(wp * 0.2 + time * 0.02);
  float cracks = 1.0 - smoothstep(0.0, 0.06, abs(fbm(wp * 0.5 + time * 0.01) - 0.5));
  vec3 darkRock = baseColor * 0.3;
  vec3 lavaGlow = accentColor * (1.5 + sin(time + n * 6.0) * 0.5);
  vec3 col = mix(darkRock, darkRock * (0.6 + n * 0.8), n);
  col = mix(col, lavaGlow, cracks * 0.8);
  // Ember spots
  float embers = smoothstep(0.85, 0.9, noise(wp * 3.0 + time * 0.1));
  col += accentColor * embers * 0.5;
  return col;
}

vec3 waterBiome(vec2 wp) {
  float n = fbm(wp * 0.15 + time * 0.03);
  // Caustics
  float c1 = noise(wp * 0.8 + vec2(time * 0.05, time * 0.03));
  float c2 = noise(wp * 0.8 + vec2(-time * 0.04, time * 0.06));
  float caustics = smoothstep(0.3, 0.7, c1 * c2 * 4.0);
  vec3 col = baseColor * (0.6 + n * 0.5);
  col += accentColor * caustics * 0.3;
  // Wave highlights
  float wave = sin(wp.x * 0.5 + wp.y * 0.3 + time * 0.8) * 0.5 + 0.5;
  wave = smoothstep(0.7, 0.9, wave);
  col += vec3(0.1, 0.15, 0.2) * wave;
  return col;
}

vec3 neonBiome(vec2 wp) {
  // Grid floor
  vec2 grid = fract(wp * 0.2);
  float lines = step(0.95, grid.x) + step(0.95, grid.y);
  vec3 col = baseColor * (0.3 + noise(wp * 0.1) * 0.2);
  // Grid glow
  col += accentColor * lines * 0.4;
  // Random neon strips
  float strip = smoothstep(0.48, 0.5, abs(fract(wp.x * 0.1) - 0.5));
  strip *= step(0.8, noise(floor(wp * 0.1)));
  col += accentColor * strip * 0.2 * (0.5 + 0.5 * sin(time * 2.0 + wp.y * 0.5));
  // Panel variation
  float panel = noise(floor(wp * 0.2));
  col *= 0.8 + panel * 0.4;
  return col;
}

vec3 stoneBiome(vec2 wp) {
  float n = fbm(wp * 0.25);
  float cracks = 1.0 - smoothstep(0.0, 0.04, abs(fbm(wp * 0.6) - 0.5));
  vec3 col = baseColor * (0.6 + n * 0.8);
  // Darker cracks
  col = mix(col, baseColor * 0.2, cracks * 0.6);
  // Moss patches
  float moss = smoothstep(0.6, 0.75, fbm(wp * 0.12));
  col = mix(col, vec3(0.15, 0.25, 0.1), moss * 0.3);
  return col;
}

// --- Main ---

void main() {
  vec2 wp = vWorldPosition.xz;
  vec3 col;

  if (biome == 0) col = grassBiome(wp);
  else if (biome == 1) col = lavaBiome(wp);
  else if (biome == 2) col = waterBiome(wp);
  else if (biome == 3) col = neonBiome(wp);
  else if (biome == 4) col = stoneBiome(wp);
  else col = grassBiome(wp);

  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);
  gl_FragColor = vec4(col, 1.0);
}
