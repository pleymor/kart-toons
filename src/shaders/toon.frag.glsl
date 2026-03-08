uniform vec3 color;
uniform vec3 lightDirection;
uniform vec3 lightColor;
uniform vec3 ambientColor;
uniform float steps;       // 3.0 or 4.0
uniform float rimPower;
uniform vec3 rimColor;
uniform bool isOutline;
uniform vec3 outlineColor;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  // Outline pass: solid black
  if (isOutline) {
    gl_FragColor = vec4(outlineColor, 1.0);
    return;
  }

  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(lightDirection);

  // Diffuse: stepped quantization for toon look
  float NdotL = dot(normal, lightDir);
  float intensity = NdotL * 0.5 + 0.5; // remap to [0, 1]
  intensity = floor(intensity * steps + 0.5) / steps;

  vec3 diffuse = color * lightColor * intensity;

  // Specular: hard cutoff Blinn-Phong
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
  float specStep = step(0.5, spec);
  vec3 specular = lightColor * specStep * 0.25;

  // Rim lighting
  float rim = 1.0 - max(dot(viewDir, normal), 0.0);
  rim = pow(rim, rimPower);
  float rimStep = step(0.5, rim);
  vec3 rimLight = rimColor * rimStep * 0.3;

  // Ambient: combine ambient color with a base contribution
  vec3 ambient = ambientColor * color * 0.4;

  vec3 finalColor = ambient + diffuse + specular + rimLight;

  // Simple tone mapping to avoid harsh clipping
  finalColor = finalColor / (finalColor + vec3(1.0));

  gl_FragColor = vec4(finalColor, 1.0);
}
