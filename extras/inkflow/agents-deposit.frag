#version 300 es
precision highp float;

in vec3  vf_K;
in float vf_life;
in float vf_speed;

layout(location = 0) out vec4 trailDeposit;
layout(location = 1) out vec4 pigmentDeposit;

uniform float u_trailDeposit;
uniform float u_pigmentDeposit;

void main() {
    if (vf_life <= 0.0) discard;

    // Soft circular brush falloff
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float alpha = smoothstep(1.0, 0.15, d);
    if (alpha <= 0.0) discard;

    // Faster agents deposit slightly more (stroke density compensation)
    float density = 0.6 + vf_speed * 0.4;
    alpha *= density;

    trailDeposit   = vec4(u_trailDeposit * alpha, 0.0, 0.0, alpha);
    pigmentDeposit = vec4(vf_K * u_pigmentDeposit * alpha, u_pigmentDeposit * alpha);
}