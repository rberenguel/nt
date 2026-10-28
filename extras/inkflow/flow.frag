#version 300 es
precision highp float;

in vec2 v_uv;
layout(location = 0) out vec4 trailOut;
layout(location = 1) out vec4 pigmentOut;

uniform sampler2D u_trail;
uniform sampler2D u_pigment;
uniform vec2      u_gridSize;
uniform float     u_flowStrength;
uniform float     u_diffusion;
uniform float     u_trailDecay;
uniform float     u_pigmentDecay;

void main() {
    vec2 texel = 1.0 / u_gridSize;
    vec2 uv = v_uv;

    // ── Trail gradient (flow direction) ─────────────────────────────────────
    float tL = texture(u_trail, uv + vec2(-texel.x, 0.0)).r;
    float tR = texture(u_trail, uv + vec2( texel.x, 0.0)).r;
    float tD = texture(u_trail, uv + vec2(0.0, -texel.y)).r;
    float tU = texture(u_trail, uv + vec2(0.0,  texel.y)).r;

    vec2 grad = vec2(tR - tL, tU - tD);
    float gradLen = length(grad);

    // ── Sample pigment at advected position ─────────────────────────────────
    vec2 flowUV = uv;
    if (gradLen > 0.001) {
        vec2 dir = grad / gradLen;
        flowUV = uv + dir * texel * u_flowStrength;
    }

    vec4 pigment = texture(u_pigment, flowUV);

    // ── Isotropic diffusion of pigment ──────────────────────────────────────
    vec4 pSum = pigment * 0.4;
    pSum += texture(u_pigment, uv + vec2(-texel.x, 0.0)) * 0.15;
    pSum += texture(u_pigment, uv + vec2( texel.x, 0.0)) * 0.15;
    pSum += texture(u_pigment, uv + vec2(0.0, -texel.y)) * 0.15;
    pSum += texture(u_pigment, uv + vec2(0.0,  texel.y)) * 0.15;

    pigmentOut = mix(pigment, pSum, u_diffusion);

    // ── Trail softening (only slight, keep vein structure) ──────────────────
    float trail = texture(u_trail, uv).r;
    float tSum = trail * 0.5;
    tSum += tL * 0.125;
    tSum += tR * 0.125;
    tSum += tD * 0.125;
    tSum += tU * 0.125;
    trailOut = vec4(tSum * u_trailDecay, 0.0, 0.0, 1.0);
    pigmentOut *= u_pigmentDecay;
}