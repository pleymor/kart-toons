varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vFogDepth;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vec4 mvPos = viewMatrix * worldPos;
  vFogDepth = -mvPos.z;
  gl_Position = projectionMatrix * mvPos;
}
