#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_src;
uniform vec2      u_gridSize;
uniform float     u_decay;

void main() {
    vec2 texel = 1.0 / u_gridSize;
    vec2 uv = v_uv;

    float sum = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            sum += texture(u_src, uv + vec2(float(x), float(y)) * texel).r;
        }
    }
    float avg = sum * (1.0 / 9.0) * u_decay;

    fragColor = vec4(avg, 0.0, 0.0, 1.0);
}