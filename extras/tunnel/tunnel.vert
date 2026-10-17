#version 300 es
precision highp float;
precision highp int;

// Unit quad: a_corner.xy in [-1, 1] x [-1, 1]
layout(location = 0) in vec2 a_corner;

// Instanced attributes
// Mode 0 (Strut): a_posA (endpoint A), a_posB (endpoint B), a_params (strutWidth, fade)
// Mode 1 (Node):  a_posA (node position), a_params (nodeRadius, fade)
layout(location = 1) in vec3 a_posA;
layout(location = 2) in vec3 a_posB;
layout(location = 3) in vec2 a_params;

uniform mat4 u_view;
uniform mat4 u_proj;
uniform int u_mode; // 0 = strut, 1 = node

out vec2 v_uv;
out float v_depth;
out float v_fade;

void main() {
  if (u_mode == 1) {
    // Mode 1: Node billboard sphere centered at posA
    vec4 viewPos = u_view * vec4(a_posA, 1.0);
    float nodeRadius = a_params.x;
    
    // Scale slightly with distance so far nodes don't vanish below 1 pixel
    float scale = max(nodeRadius, -viewPos.z * 0.005);
    vec3 cornerView = viewPos.xyz + vec3(a_corner * scale, 0.0);

    v_uv = a_corner; // [-1, 1] in both X and Y
    v_depth = -viewPos.z;
    v_fade = a_params.y;
    gl_Position = u_proj * vec4(cornerView, 1.0);
    return;
  }

  // Mode 0: Edge Strut billboard spanning posA -> posB
  vec4 viewA = u_view * vec4(a_posA, 1.0);
  vec4 viewB = u_view * vec4(a_posB, 1.0);

  vec3 dir = viewB.xyz - viewA.xyz;
  float len = length(dir);
  vec3 normDir = len > 0.0001 ? dir / len : vec3(0.0, 1.0, 0.0);

  // Position along edge: a_corner.x in [-1, 1] maps to t in [0, 1]
  float t = a_corner.x * 0.5 + 0.5;
  vec3 pMid = mix(viewA.xyz, viewB.xyz, t);

  // Lateral expansion vector in view space perpendicular to the strut
  vec3 toCam = normalize(-pMid);
  vec3 lateral = cross(normDir, toCam);
  float latLen = length(lateral);
  vec3 perp = latLen > 0.0001 ? (lateral / latLen) : vec3(1.0, 0.0, 0.0);

  float strutWidth = a_params.x;
  // Ensure minimum pixel width at extreme distance
  float width = max(strutWidth, -pMid.z * 0.004);

  // a_corner.y in [-1, 1] expands laterally across strut width
  vec3 finalViewPos = pMid + perp * (a_corner.y * width);

  v_uv = vec2(t, a_corner.y);
  v_depth = -pMid.z;
  v_fade = a_params.y;
  gl_Position = u_proj * vec4(finalViewPos, 1.0);
}
