#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_trail;
uniform sampler2D u_pigment;
uniform float     u_time;
uniform vec2      u_resolution;
uniform float     u_seed;
uniform int       u_screen_index;
uniform int       u_total_screens;
uniform vec3      u_paper_color;
uniform float     u_grain;
uniform float     u_show_border;
uniform float     u_ink_visibility;

// ── Hash / Noise ────────────────────────────────────────────────────────────
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21) + u_seed * 0.001);
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ── Beer-Lambert translucent colour (KM-inspired subtractive mixing) ───────
vec3 paintColour(vec3 K, float thickness) {
    // K = absorption per channel. thickness = pigment density.
    // Thin wash → paper shows through. Thick stroke → deep, saturated colour.
    vec3 absorption = K * thickness * 4.0;
    vec3 transmitted = exp(-absorption);
    return transmitted;
}

void main() {
    // ── Multi-screen panoramic slicing ──────────────────────────────────────
    float u = (v_uv.x + float(u_screen_index)) / float(u_total_screens);
    float v = v_uv.y;
    vec2 uv = vec2(u, v);

    // ── Paper base ──────────────────────────────────────────────────────────
    vec3 color = u_paper_color;

    // Multi-scale grain
    float fine  = (hash21(gl_FragCoord.xy) - 0.5) * u_grain;
    float med   = (hash21(gl_FragCoord.xy * 0.3 + vec2(17.3, 53.1)) - 0.5) * (u_grain * 0.6);
    float large = (vnoise(gl_FragCoord.xy * 0.015 + u_seed) - 0.5) * (u_grain * 1.3);
    color += fine + med + large;

    // ── Pencil grid ─────────────────────────────────────────────────────────
    float gridSpacing = min(u_resolution.x, u_resolution.y) * 0.012;
    float gridLine = 0.0;
    gridLine += smoothstep(0.97, 0.995, fract(uv.x * gridSpacing));
    gridLine += smoothstep(0.97, 0.995, fract(uv.y * gridSpacing));
    gridLine = clamp(gridLine, 0.0, 1.0) * 0.07;

    float diag = 0.0;
    diag += smoothstep(0.985, 0.997, fract((uv.x + uv.y) * gridSpacing * 0.55));
    diag += smoothstep(0.985, 0.997, fract((uv.x - uv.y + 100.0) * gridSpacing * 0.55));
    diag = clamp(diag, 0.0, 1.0) * 0.035;

    float smudge = vnoise(uv * 7.0 + u_seed * 3.7) * vnoise(uv * 11.0 - u_seed * 1.3);
    smudge = smoothstep(0.55, 0.9, smudge) * 0.04;

    color = color * (1.0 - gridLine - diag - smudge)
          + vec3(0.55, 0.52, 0.48) * (gridLine + diag)
          + vec3(0.62, 0.59, 0.55) * smudge;

    // ── Trail network (very subtle, just the flow scaffolding) ─────────────
    float trail = texture(u_trail, uv).r;
    float veinDetail = vnoise(uv * 160.0 + trail * 8.0) * 0.5 + 0.5;
    float veinMask = smoothstep(0.006, 0.022 + veinDetail * 0.018, trail);
    vec3 networkColor = vec3(0.55, 0.50, 0.43);
    color = mix(color, networkColor, veinMask * 0.07 * u_ink_visibility);

    // ── Pigment (Beer-Lambert subtractive mixing) ───────────────────────────
    vec4 pigment = texture(u_pigment, uv);
    vec3 K = pigment.rgb;
    float X = pigment.a;

    vec3 transmitted = paintColour(K, X);

    // Stronger opacity falloff: thin washes stay translucent, thick strokes opaque-ish
    float opacity = 1.0 - exp(-X * 3.5);
    color = mix(color, color * transmitted, opacity * u_ink_visibility);

    // Saturation boost in dense pigment so it doesn't grey out
    float pigmentDepth = length(K) * X;
    vec3 pigmentHue = normalize(K + 0.008);
    float saturationBoost = smoothstep(0.15, 0.55, pigmentDepth);
    vec3 saturated = pigmentHue * 0.45 + color * 0.55;
    color = mix(color, saturated, saturationBoost * 0.35 * u_ink_visibility);

    // Deepen dense intersections (keeps dark strokes rich, not flat)
    float deep = smoothstep(0.30, 0.75, pigmentDepth);
    color *= 1.0 - deep * 0.12;

    // Water bloom / feather at diffuse vein edges
    float bloom = smoothstep(0.002, 0.014, trail) * (1.0 - veinMask);
    color += pigmentHue * bloom * 0.04 * u_ink_visibility;

    // ── Vignette ────────────────────────────────────────────────────────────
    vec2 vc = uv - 0.5;
    float vignette = 1.0 - dot(vc, vc) * 0.22;
    color *= vignette;

    // ── Bezel guide ─────────────────────────────────────────────────────────
    if (u_show_border > 0.5) {
        float bx = step(0.998, fract(u * float(u_total_screens)));
        color = mix(color, vec3(0.75, 0.2, 0.2), bx * 0.5);
    }

    fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}