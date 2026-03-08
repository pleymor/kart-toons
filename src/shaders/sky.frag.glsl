uniform vec3 horizonColor;
uniform vec3 zenithColor;
uniform float time;
uniform float cloudDensity;
uniform float weatherDarkness; // 0.0 = clear, 1.0 = full storm

varying vec2 vUv;

// Simple noise for clouds
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

void main() {
  float height = vUv.y;

  // Sky gradient
  vec3 sky = mix(horizonColor, zenithColor, pow(height, 0.8));

  // Animated clouds
  vec2 cloudUV = vUv * 4.0 + vec2(time * 0.02, 0.0);
  float cloud = noise(cloudUV) * noise(cloudUV * 2.0 + 1.3);
  cloud = smoothstep(0.3, 0.6, cloud) * cloudDensity;
  vec3 cloudColor = vec3(1.0, 1.0, 1.0) * (1.0 - weatherDarkness * 0.5);
  sky = mix(sky, cloudColor, cloud * 0.6);

  // Weather darkening
  sky *= (1.0 - weatherDarkness * 0.4);

  gl_FragColor = vec4(sky, 1.0);
}
