uniform float time;
uniform int biome; // 0=grass, 1=lava, 2=water, 3=neon, 4=stone

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
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);

  vec2 wp = worldPos.xz;
  float h = 0.0;

  if (biome == 0) {
    // Grass: gentle rolling hills
    h = fbm(wp * 0.008) * 6.0 + noise(wp * 0.03) * 1.5;
  } else if (biome == 1) {
    // Lava: small-scale rocky detail (base elevation set by JS deformation)
    h = fbm(wp * 0.03) * 2.0 + noise(wp * 0.08) * 1.0;
    h -= smoothstep(0.4, 0.5, fbm(wp * 0.06)) * 1.0; // small crevasses
  } else if (biome == 2) {
    // Water: animated waves
    float wave1 = sin(wp.x * 0.04 + time * 0.8) * cos(wp.y * 0.03 + time * 0.6);
    float wave2 = sin(wp.x * 0.07 - time * 0.5) * sin(wp.y * 0.06 + time * 0.4);
    h = (wave1 + wave2) * 2.0 + fbm(wp * 0.01 + time * 0.02) * 3.0;
  } else if (biome == 3) {
    // Neon: flat with subtle geometric steps
    float grid = floor(fbm(wp * 0.005) * 4.0) / 4.0;
    h = grid * 2.0;
  } else if (biome == 4) {
    // Stone: rugged, broken terrain
    h = fbm(wp * 0.012) * 7.0 + noise(wp * 0.05) * 2.0;
    h = floor(h * 2.0) / 2.0; // stepped rocky look
  }

  worldPos.y += h;
  vWorldPosition = worldPos.xyz;
  vec4 mvPos = viewMatrix * worldPos;
  vFogDepth = -mvPos.z;
  gl_Position = projectionMatrix * mvPos;
}
