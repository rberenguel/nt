#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
in float v_depth;
in float v_fade;

out vec4 fragColor;

uniform int u_mode; // 0 = strut, 1 = node, 2 = bezel line
uniform vec3 u_coreColor;
uniform vec3 u_glowColor;
uniform vec3 u_nodeCore;
uniform vec3 u_nodeGlow;
uniform float u_fogDensity;
uniform float u_time;

void main() {
  if (u_mode == 2) {
    // Bezel line guide
    fragColor = vec4(1.0, 0.35, 0.15, 0.9);
    return;
  }

  // Atmospheric exponential depth fog
  float fog = exp(-pow(max(0.0, v_depth - 1.0) * u_fogDensity, 1.6));
  fog *= clamp(v_fade, 0.0, 1.0);

  if (u_mode == 1) {
    // Mode 1: Node Sphere
    float r = length(v_uv);
    if (r > 1.0) discard;

    // Blinding white core sphere with soft exponential aura
    float core = 1.0 - smoothstep(0.30, 0.60, r);
    float halo = exp(-r * 3.0);

    vec3 col = mix(u_nodeGlow, u_nodeCore, core);
    float alpha = (core * 1.5 + halo * 0.9) * fog;

    fragColor = vec4(col * alpha, alpha);
    return;
  }

  // Mode 0: Edge Strut
  float dist = abs(v_uv.y); // [-1, 1] across width
  float core = 1.0 - smoothstep(0.0, 0.25, dist);
  float glow = exp(-dist * 3.4);

  // Soft taper at the very ends of the strut to blend cleanly into nodes
  float endTaper = smoothstep(0.0, 0.04, v_uv.x) * (1.0 - smoothstep(0.96, 1.0, v_uv.x));

  vec3 col = mix(u_glowColor, u_coreColor, core);
  float alpha = (core * 1.4 + glow * 0.85) * endTaper * fog;

  fragColor = vec4(col * alpha, alpha);
}
