uniform float outlineWidth;
uniform bool isOutline;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;
varying vec4 vShadowCoord;

#ifdef USE_SHADOWMAP
uniform mat4 shadowMatrix;
#endif

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  vec3 pos = position;

  // Inverted hull outline pass: push vertices along normals
  if (isOutline) {
    pos += normal * outlineWidth;
  }

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPos.xyz;

  #ifdef USE_SHADOWMAP
  vShadowCoord = shadowMatrix * worldPos;
  #endif

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
