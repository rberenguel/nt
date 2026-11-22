// WebGL2 Multi-Pass Bioluminescent Instanced Renderer for Alien
// Renders instanced SDF cells with role-specific organelles, elastic pulsing bonds,
// twinkling energy motes, soft motion trails, and separable Gaussian bloom.

(function () {
  const PALETTES = [
    {
      name: "Abyssal",
      isLight: false,
      bgCenter: [0.016, 0.032, 0.068],
      bgEdge: [0.005, 0.009, 0.022],
      hueShift: 0.0,
      satBoost: 1.15,
      bloomStrength: 0.34,
      trailDecay: 0.84,
    },
    {
      name: "Darkfield",
      isLight: false,
      bgCenter: [0.012, 0.022, 0.026],
      bgEdge: [0.004, 0.007, 0.010],
      hueShift: 0.14,
      satBoost: 1.08,
      bloomStrength: 0.30,
      trailDecay: 0.82,
    },
    {
      name: "Thermal Vent",
      isLight: false,
      bgCenter: [0.042, 0.014, 0.020],
      bgEdge: [0.010, 0.004, 0.007],
      hueShift: 0.86,
      satBoost: 1.18,
      bloomStrength: 0.38,
      trailDecay: 0.85,
    },
    {
      name: "Petri Dish",
      isLight: true,
      bgCenter: [0.945, 0.935, 0.905],
      bgEdge: [0.875, 0.858, 0.815],
      hueShift: 0.02,
      satBoost: 0.95,
      bloomStrength: 0.08,
      trailDecay: 0.72,
    },
  ];

  // ── GLSL Shaders ────────────────────────────────────────────────────────────
  const FULLSCREEN_VERT = `#version 300 es
  precision highp float;
  out vec2 v_uv;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    v_uv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const BG_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform vec3 u_bgCenter;
  uniform vec3 u_bgEdge;
  uniform float u_time;
  uniform float u_screenIndex;
  uniform float u_totalScreens;

  void main() {
    vec2 gUv = vec2((v_uv.x + u_screenIndex) / u_totalScreens, v_uv.y);
    float d = length((gUv - vec2(0.5)) * vec2(1.2, 1.0));
    vec3 col = mix(u_bgCenter, u_bgEdge, smoothstep(0.0, 0.95, d));

    // Very subtle deep-water caustic shimmer
    float w1 = sin(gUv.x * 14.0 + u_time * 0.25) * cos(gUv.y * 10.0 - u_time * 0.2);
    float w2 = sin((gUv.x - gUv.y) * 9.0 - u_time * 0.18);
    col += (w1 + w2) * 0.006;

    outColor = vec4(max(col, 0.0), 1.0);
  }`;

  const MOTE_VERT = `#version 300 es
  precision highp float;
  layout(location = 0) in vec4 a_mote; // x, y, energyNorm, hue

  uniform vec2 u_viewOrigin;
  uniform vec2 u_viewSize;
  uniform float u_dpr;
  uniform float u_time;

  out float v_energy;
  out float v_hue;

  void main() {
    vec2 rel = (a_mote.xy - u_viewOrigin) / u_viewSize;
    vec2 ndc = vec2(rel.x * 2.0 - 1.0, 1.0 - rel.y * 2.0);
    gl_Position = vec4(ndc, 0.0, 1.0);
    float twinkle = 0.85 + 0.2 * sin(u_time * 2.5 + a_mote.x * 0.17 + a_mote.y * 0.13);
    gl_PointSize = (1.0 + a_mote.z * 0.85) * u_dpr * twinkle;
    v_energy = a_mote.z * twinkle;
    v_hue = a_mote.w;
  }`;

  const MOTE_FRAG = `#version 300 es
  precision highp float;
  in float v_energy;
  in float v_hue;
  out vec4 outColor;

  uniform float u_hueShift;
  uniform float u_isLight;

  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float glow = exp(-r2 * 6.0);
    float core = exp(-r2 * 18.0);
    float h = fract(v_hue + u_hueShift);
    vec3 col = hsv2rgb(vec3(h, u_isLight > 0.5 ? 0.65 : 0.72, 1.0));
    if (u_isLight > 0.5) {
      col = mix(col * 0.55, vec3(0.15, 0.35, 0.32), 0.35);
      outColor = vec4(col, glow * 0.38 * v_energy);
    } else {
      vec3 finalCol = col * (glow * 0.45 + core * 0.72) * v_energy;
      outColor = vec4(finalCol, glow * 0.7);
    }
  }`;

  const BOND_VERT = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 a_quad;  // x in [0,1] along bond, y in [-1,1] across
  layout(location = 1) in vec4 a_pos;   // ax, ay, bx, by
  layout(location = 2) in vec4 a_meta;  // hue, energyNorm, pulse, stress

  uniform vec2 u_viewOrigin;
  uniform vec2 u_viewSize;

  out vec2 v_uv;
  out vec4 v_meta;

  void main() {
    vec2 a = a_pos.xy;
    vec2 b = a_pos.zw;
    vec2 d = b - a;
    float len = max(length(d), 0.001);
    vec2 dir = d / len;
    vec2 perp = vec2(-dir.y, dir.x);

    float halfWidth = 1.15 + a_meta.z * 0.7 - a_meta.w * 0.2;
    vec2 worldPos = mix(a, b, a_quad.x) + perp * (a_quad.y * halfWidth);

    vec2 rel = (worldPos - u_viewOrigin) / u_viewSize;
    vec2 ndc = vec2(rel.x * 2.0 - 1.0, 1.0 - rel.y * 2.0);
    gl_Position = vec4(ndc, 0.0, 1.0);
    v_uv = a_quad;
    v_meta = a_meta;
  }`;

  const BOND_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  in vec4 v_meta; // hue, energyNorm, pulse, stress
  out vec4 outColor;

  uniform float u_hueShift;
  uniform float u_satBoost;
  uniform float u_time;
  uniform float u_isLight;
  uniform float u_zoom;

  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  void main() {
    float across = abs(v_uv.y);
    // Taper slightly near midpoint for organic elastic filament look
    float waist = 0.65 + 0.35 * pow(abs(v_uv.x - 0.5) * 2.0, 1.5);
    float core = exp(-pow(across / (0.45 * waist), 2.0) * 2.2);

    // Travelling nerve / energy pulse wave along bond
    float wave = 0.5 + 0.5 * sin(v_uv.x * 6.2831 - u_time * 7.0);
    float pulseBoost = v_meta.z * (0.45 + 0.85 * pow(wave, 2.0));

    float h = fract(v_meta.x + u_hueShift);
    vec3 baseCol = hsv2rgb(vec3(h, clamp(0.68 * u_satBoost, 0.0, 1.0), 0.95));

    if (u_isLight > 0.5) {
      vec3 ink = mix(baseCol * 0.42, vec3(0.12, 0.16, 0.22), 0.45);
      float a = core * (0.45 + pulseBoost * 0.4);
      outColor = vec4(ink, a);
    } else {
      vec3 col = mix(baseCol, vec3(0.92, 0.97, 1.0), pulseBoost * 0.65);
      float intensity = (0.38 + 0.42 * v_meta.y + pulseBoost * 0.9) * core;
      outColor = vec4(col * intensity, core * 0.85);
    }
  }`;

  const CELL_VERT = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 a_quad;  // [-1, 1] x [-1, 1]
  layout(location = 1) in vec4 a_geom;  // x, y, radius, type
  layout(location = 2) in vec4 a_state; // hue, energyNorm, signal, angle

  uniform vec2 u_viewOrigin;
  uniform vec2 u_viewSize;

  out vec2 v_local;
  out float v_type;
  out vec4 v_state;

  void main() {
    // Pad quad by 7.5x radius for clear bioluminescent predator/prey aura at microscopic scale
    float pad = 7.5;
    float r = a_geom.z * pad;
    float c = cos(a_state.w);
    float s = sin(a_state.w);
    vec2 rot = vec2(a_quad.x * c - a_quad.y * s, a_quad.x * s + a_quad.y * c);
    vec2 worldPos = a_geom.xy + rot * r;

    vec2 rel = (worldPos - u_viewOrigin) / u_viewSize;
    vec2 ndc = vec2(rel.x * 2.0 - 1.0, 1.0 - rel.y * 2.0);
    gl_Position = vec4(ndc, 0.0, 1.0);

    v_local = a_quad * pad;
    v_type = a_geom.w;
    v_state = a_state;
  }`;

  const CELL_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_local;
  in float v_type;
  in vec4 v_state; // hue, energyNorm, signal, angle
  out vec4 outColor;

  uniform float u_hueShift;
  uniform float u_satBoost;
  uniform float u_time;
  uniform float u_isLight;
  uniform float u_zoom;

  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  vec3 roleAccent(int t) {
    if (t == 0) return vec3(0.18, 0.42, 1.00); // Core: cobalt blue
    if (t == 1) return vec3(1.00, 0.25, 0.78); // Muscle: hot pink
    if (t == 2) return vec3(0.00, 0.90, 0.36); // Photo: emerald green
    if (t == 3) return vec3(1.00, 0.90, 0.00); // Sensor: lemon yellow
    if (t == 4) return vec3(1.00, 0.10, 0.10); // Attacker: pure crimson red
    if (t == 5) return vec3(0.60, 0.20, 1.00); // Constructor: deep violet
    if (t == 6) return vec3(0.95, 0.98, 1.00); // Defender: crisp white-silver
    return vec3(0.00, 0.97, 1.00);             // Venom: electric cyan
  }

  void main() {
    float r = length(v_local);
    if (r > 7.5) discard;

    int rawType = int(v_type + 0.5);
    bool isPred = rawType >= 8;
    int cellType = isPred ? (rawType - 8) : rawType;
    float energy = clamp(v_state.y, 0.15, 1.15);
    float sig = v_state.z;

    float zoomT = smoothstep(1.2, 3.2, u_zoom);
    float h = fract(v_state.x + u_hueShift);
    vec3 lineageCol = hsv2rgb(vec3(h, clamp(0.88 * u_satBoost, 0.0, 1.0), 1.0));
    vec3 accent = roleAccent(cellType);
    // Pure role color when zoomed in so red predator hue/aura never muddies individual cells
    vec3 col = mix(accent, lineageCol, mix(0.14, 0.0, zoomT));
    vec3 auraCol = isPred ? vec3(1.0, 0.10, 0.14) : vec3(0.06, 0.98, 0.44);

    // Crisp translucent cell body + sharp saturated membrane rim + zoom-adaptive aura
    float body = smoothstep(1.05, 0.72, r);
    float rim = exp(-pow((r - 0.86) / 0.15, 2.0));
    float auraFade = mix(1.0, 0.04, zoomT);
    float aura = exp(-r * r * 0.09) * 0.28 * auraFade;

    // Organelle details per cell type
    float organelle = 0.0;
    if (cellType == 0) {
      // Core: crisp central nucleus
      organelle = smoothstep(0.42, 0.14, r) * 0.75;
    } else if (cellType == 1) {
      // Muscle: banded contractile core
      float band = 0.5 + 0.5 * cos(v_local.x * 11.0);
      organelle = smoothstep(0.66, 0.2, r) * (0.35 + 0.5 * band);
    } else if (cellType == 2) {
      // Photo: vivid chloroplast ring
      organelle = exp(-pow((r - 0.46) / 0.14, 2.0)) * 0.9;
    } else if (cellType == 3) {
      // Sensor: directional forward eye-spot
      float eye = length(v_local - vec2(0.32, 0.0));
      organelle = smoothstep(0.32, 0.08, eye) * 1.0;
    } else if (cellType == 4) {
      // Attacker: sharp forward fang / needle core
      float spike = abs(v_local.y) + max(0.0, -v_local.x * 0.6);
      organelle = smoothstep(0.42, 0.08, spike) * step(r, 0.82) * 1.0;
    } else if (cellType == 5) {
      // Constructor: pulsing violet-gold yolk nucleus
      float pulse = 0.86 + 0.16 * sin(u_time * 4.0 + v_state.x * 20.0);
      organelle = smoothstep(0.52 * pulse, 0.14, r) * 0.95;
    } else if (cellType == 6) {
      // Defender: thick double-ring armor shell
      organelle = exp(-pow((r - 0.58) / 0.14, 2.0)) * 0.95;
    } else {
      // Venom: barbed warning-spine star core
      float star = min(abs(v_local.x), abs(v_local.y));
      organelle = smoothstep(0.24, 0.04, star) * step(r, 0.78) * 1.05;
    }

    if (u_isLight > 0.5) {
      // Brightfield stained microscope aesthetic
      vec3 stain = col * 0.62;
      vec3 nucleusCol = mix(stain * 0.48, vec3(0.06, 0.08, 0.12), 0.3);
      vec3 rgb = mix(stain, nucleusCol, clamp(organelle + rim * 0.5, 0.0, 1.0));
      float alpha = clamp(body * 0.58 + rim * 0.65 + organelle * 0.35, 0.0, 0.95);
      outColor = vec4(rgb, alpha);
    } else {
      // Vivid darkfield bioluminescence — preserve full color saturation without white blowout
      vec3 cytoplasm = col * (0.20 + 0.24 * energy) * body;
      vec3 membrane = col * (0.78 + 0.28 * energy + 0.25 * sig) * rim;
      vec3 nucleus = mix(accent, col, 0.25) * (0.65 + 0.35 * energy) * organelle;
      vec3 glowCol = auraCol * aura;

      vec3 rgb = cytoplasm + membrane + nucleus + glowCol;
      // Only a crisp signal spark adds slight lightness
      rgb += mix(accent, vec3(1.0), 0.45) * sig * (rim * 0.35 + organelle * 0.25);
      float alpha = clamp(body * 0.92 + rim * 0.95 + aura * 0.18, 0.0, 1.0);
      outColor = vec4(rgb, alpha);
    }
  }`;

  const TRAIL_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_prevTrail;
  uniform sampler2D u_scene;
  uniform float u_decay;
  uniform float u_isLight;

  void main() {
    vec3 prev = texture(u_prevTrail, v_uv).rgb * u_decay;
    vec3 cur = texture(u_scene, v_uv).rgb;
    if (u_isLight > 0.5) {
      outColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      // Extract only bright moving bioluminescence into trail
      float luma = dot(cur, vec3(0.299, 0.587, 0.114));
      vec3 bright = cur * smoothstep(0.14, 0.65, luma) * 0.22;
      outColor = vec4(max(prev, bright), 1.0);
    }
  }`;

  const BLUR_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_tex;
  uniform vec2 u_dir; // (1/w, 0) or (0, 1/h)
  uniform float u_threshold;

  void main() {
    const float w0 = 0.227027;
    const float w1 = 0.1945946;
    const float w2 = 0.1216216;
    const float w3 = 0.054054;
    const float w4 = 0.016216;

    vec3 c0 = texture(u_tex, v_uv).rgb;
    if (u_threshold > 0.0) {
      float l = dot(c0, vec3(0.299, 0.587, 0.114));
      c0 *= smoothstep(u_threshold, u_threshold + 0.35, l);
    }
    vec3 sum = c0 * w0;

    vec2 d1 = u_dir * 1.5;
    vec2 d2 = u_dir * 3.0;
    vec2 d3 = u_dir * 4.5;
    vec2 d4 = u_dir * 6.0;

    sum += (texture(u_tex, v_uv + d1).rgb + texture(u_tex, v_uv - d1).rgb) * w1;
    sum += (texture(u_tex, v_uv + d2).rgb + texture(u_tex, v_uv - d2).rgb) * w2;
    sum += (texture(u_tex, v_uv + d3).rgb + texture(u_tex, v_uv - d3).rgb) * w3;
    sum += (texture(u_tex, v_uv + d4).rgb + texture(u_tex, v_uv - d4).rgb) * w4;

    outColor = vec4(sum, 1.0);
  }`;

  const COMPOSITE_FRAG = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_scene;
  uniform sampler2D u_trail;
  uniform sampler2D u_bloom;
  uniform float u_bloomStrength;
  uniform float u_isLight;
  uniform float u_showBezel;
  uniform float u_screenIndex;
  uniform float u_totalScreens;

  vec3 aces(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 scene = texture(u_scene, v_uv).rgb;
    vec3 trail = texture(u_trail, v_uv).rgb;
    vec3 bloom = texture(u_bloom, v_uv).rgb;

    vec3 col;
    if (u_isLight > 0.5) {
      col = scene;
      // Subtle paper vignette
      float vig = 1.0 - 0.08 * dot(v_uv - 0.5, v_uv - 0.5) * 2.0;
      col *= vig;
    } else {
      col = scene + trail * 0.55 + bloom * u_bloomStrength;
      col = aces(col * 1.05);
      // Gentle vignette
      float vig = 1.0 - 0.18 * dot(v_uv - 0.5, v_uv - 0.5) * 2.0;
      col *= vig;
    }

    // Optional bezel alignment guide (red edge bar where monitors meet)
    if (u_showBezel > 0.5 && u_totalScreens > 1.5) {
      bool onRightEdge = (u_screenIndex < u_totalScreens - 0.5) && (v_uv.x > 0.996);
      bool onLeftEdge = (u_screenIndex > 0.5) && (v_uv.x < 0.004);
      if (onRightEdge || onLeftEdge) {
        col = vec3(1.0, 0.18, 0.22);
      }
    }

    outColor = vec4(col, 1.0);
  }`;

  // ── WebGL2 Helpers ──────────────────────────────────────────────────────────
  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error("Shader compile error:\n" + log);
    }
    return sh;
  }

  function createProgram(gl, vertSrc, fragSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error("Program link error:\n" + log);
    }
    return prog;
  }

  function createFBO(gl, w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  function deleteFBO(gl, fbo) {
    if (!fbo) return;
    gl.deleteFramebuffer(fbo.fb);
    gl.deleteTexture(fbo.tex);
  }

  class AlienRenderer {
    constructor(canvas, screenIndex, totalScreens) {
      this.canvas = canvas;
      this.screenIndex = screenIndex;
      this.totalScreens = totalScreens;
      this.paletteIdx = 0;
      this.showBezel = false;

      const gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      if (!gl) {
        throw new Error("WebGL2 is required for Alien screensaver.");
      }
      this.gl = gl;

      // Programs
      this.bgProg = createProgram(gl, FULLSCREEN_VERT, BG_FRAG);
      this.moteProg = createProgram(gl, MOTE_VERT, MOTE_FRAG);
      this.bondProg = createProgram(gl, BOND_VERT, BOND_FRAG);
      this.cellProg = createProgram(gl, CELL_VERT, CELL_FRAG);
      this.trailProg = createProgram(gl, FULLSCREEN_VERT, TRAIL_FRAG);
      this.blurProg = createProgram(gl, FULLSCREEN_VERT, BLUR_FRAG);
      this.compProg = createProgram(gl, FULLSCREEN_VERT, COMPOSITE_FRAG);

      this.emptyVAO = gl.createVertexArray();
      this.initGeometry();

      this.sceneFBO = null;
      this.trailFBOs = [null, null];
      this.trailFlip = 0;
      this.bloomFBOs = [null, null];
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
    }

    initGeometry() {
      const gl = this.gl;
      const { MAX_CELLS, MAX_BONDS, MAX_MOTES } = window.AlienSimLimits;

      // ── Motes VAO ───────────────────────────────────────────────────────────
      this.moteVAO = gl.createVertexArray();
      gl.bindVertexArray(this.moteVAO);
      this.moteBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.moteBuf);
      gl.bufferData(gl.ARRAY_BUFFER, MAX_MOTES * 4 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);

      // ── Bonds Instanced VAO ─────────────────────────────────────────────────
      this.bondVAO = gl.createVertexArray();
      gl.bindVertexArray(this.bondVAO);

      const bondQuad = new Float32Array([
        0, -1, 1, -1, 1, 1,
        0, -1, 1, 1, 0, 1,
      ]);
      const bondQuadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bondQuadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, bondQuad, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

      this.bondInstBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bondInstBuf);
      gl.bufferData(gl.ARRAY_BUFFER, MAX_BONDS * 8 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
      gl.vertexAttribDivisor(2, 1);

      // ── Cells Instanced VAO ─────────────────────────────────────────────────
      this.cellVAO = gl.createVertexArray();
      gl.bindVertexArray(this.cellVAO);

      const cellQuad = new Float32Array([
        -1, -1, 1, -1, 1, 1,
        -1, -1, 1, 1, -1, 1,
      ]);
      const cellQuadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, cellQuadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cellQuad, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

      this.cellInstBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cellInstBuf);
      gl.bufferData(gl.ARRAY_BUFFER, MAX_CELLS * 8 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
      gl.vertexAttribDivisor(2, 1);

      gl.bindVertexArray(null);
    }

    resize() {
      const gl = this.gl;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, Math.round(window.innerWidth * this.dpr));
      const h = Math.max(200, Math.round(window.innerHeight * this.dpr));
      if (w === this.width && h === this.height) return;

      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;

      deleteFBO(gl, this.sceneFBO);
      deleteFBO(gl, this.trailFBOs[0]);
      deleteFBO(gl, this.trailFBOs[1]);
      deleteFBO(gl, this.bloomFBOs[0]);
      deleteFBO(gl, this.bloomFBOs[1]);

      this.sceneFBO = createFBO(gl, w, h);
      const tw = Math.max(160, w >> 1);
      const th = Math.max(100, h >> 1);
      this.trailFBOs[0] = createFBO(gl, tw, th);
      this.trailFBOs[1] = createFBO(gl, tw, th);

      const bw = Math.max(120, w >> 2);
      const bh = Math.max(80, h >> 2);
      this.bloomFBOs[0] = createFBO(gl, bw, bh);
      this.bloomFBOs[1] = createFBO(gl, bw, bh);

      this.clearTrails();
    }

    clearTrails() {
      const gl = this.gl;
      for (const fbo of this.trailFBOs) {
        if (!fbo) continue;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    getPalette() {
      return PALETTES[this.paletteIdx % PALETTES.length];
    }

    render(data, worldW, worldH, simTime, camera = null) {
      const gl = this.gl;
      if (!this.sceneFBO) this.resize();
      const pal = this.getPalette();
      const isLight = pal.isLight ? 1.0 : 0.0;

      const sliceW = worldW / this.totalScreens;
      const zoom = camera ? Math.max(1.0, camera.zoom) : 1.0;
      const viewW = sliceW / zoom;
      const viewH = worldH / zoom;
      const viewOriginX = camera ? camera.x : this.screenIndex * sliceW;
      const viewOriginY = camera ? camera.y : 0;

      // Upload dynamic instance buffers (sub-data only for active count!)
      if (data.moteCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.moteBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.motes.subarray(0, data.moteCount * 4));
      }
      if (data.bondCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bondInstBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.bonds.subarray(0, data.bondCount * 8));
      }
      if (data.cellCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cellInstBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.cells.subarray(0, data.cellCount * 8));
      }

      // ── Pass 1: Render Scene into sceneFBO ──────────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fb);
      gl.viewport(0, 0, this.sceneFBO.w, this.sceneFBO.h);
      gl.disable(gl.BLEND);

      // Background
      gl.useProgram(this.bgProg);
      gl.uniform3fv(gl.getUniformLocation(this.bgProg, "u_bgCenter"), pal.bgCenter);
      gl.uniform3fv(gl.getUniformLocation(this.bgProg, "u_bgEdge"), pal.bgEdge);
      gl.uniform1f(gl.getUniformLocation(this.bgProg, "u_time"), simTime);
      gl.uniform1f(gl.getUniformLocation(this.bgProg, "u_screenIndex"), this.screenIndex);
      gl.uniform1f(gl.getUniformLocation(this.bgProg, "u_totalScreens"), this.totalScreens);
      gl.bindVertexArray(this.emptyVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.BLEND);

      // Energy Motes
      if (data.moteCount > 0) {
        if (pal.isLight) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendFunc(gl.ONE, gl.ONE);

        gl.useProgram(this.moteProg);
        gl.uniform2f(gl.getUniformLocation(this.moteProg, "u_viewOrigin"), viewOriginX, viewOriginY);
        gl.uniform2f(gl.getUniformLocation(this.moteProg, "u_viewSize"), viewW, viewH);
        gl.uniform1f(gl.getUniformLocation(this.moteProg, "u_dpr"), this.dpr * Math.min(2.2, Math.sqrt(zoom)));
        gl.uniform1f(gl.getUniformLocation(this.moteProg, "u_time"), simTime);
        gl.uniform1f(gl.getUniformLocation(this.moteProg, "u_hueShift"), pal.hueShift);
        gl.uniform1f(gl.getUniformLocation(this.moteProg, "u_isLight"), isLight);
        gl.bindVertexArray(this.moteVAO);
        gl.drawArrays(gl.POINTS, 0, data.moteCount);
      }

      // Bonds
      if (data.bondCount > 0) {
        if (pal.isLight) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.bondProg);
        gl.uniform2f(gl.getUniformLocation(this.bondProg, "u_viewOrigin"), viewOriginX, viewOriginY);
        gl.uniform2f(gl.getUniformLocation(this.bondProg, "u_viewSize"), viewW, viewH);
        gl.uniform1f(gl.getUniformLocation(this.bondProg, "u_hueShift"), pal.hueShift);
        gl.uniform1f(gl.getUniformLocation(this.bondProg, "u_satBoost"), pal.satBoost);
        gl.uniform1f(gl.getUniformLocation(this.bondProg, "u_time"), simTime);
        gl.uniform1f(gl.getUniformLocation(this.bondProg, "u_isLight"), isLight);
        gl.bindVertexArray(this.bondVAO);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.bondCount);
      }

      // Cells
      if (data.cellCount > 0) {
        if (pal.isLight) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.cellProg);
        gl.uniform2f(gl.getUniformLocation(this.cellProg, "u_viewOrigin"), viewOriginX, viewOriginY);
        gl.uniform2f(gl.getUniformLocation(this.cellProg, "u_viewSize"), viewW, viewH);
        gl.uniform1f(gl.getUniformLocation(this.cellProg, "u_hueShift"), pal.hueShift);
        gl.uniform1f(gl.getUniformLocation(this.cellProg, "u_satBoost"), pal.satBoost);
        gl.uniform1f(gl.getUniformLocation(this.cellProg, "u_time"), simTime);
        gl.uniform1f(gl.getUniformLocation(this.cellProg, "u_isLight"), isLight);
        gl.uniform1f(gl.getUniformLocation(this.cellProg, "u_zoom"), zoom);
        gl.bindVertexArray(this.cellVAO);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.cellCount);
      }

      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.emptyVAO);

      // ── Pass 2: Trail Persistence Ping-Pong ─────────────────────────────────
      const srcTrail = this.trailFBOs[this.trailFlip];
      const dstTrail = this.trailFBOs[1 - this.trailFlip];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstTrail.fb);
      gl.viewport(0, 0, dstTrail.w, dstTrail.h);
      gl.useProgram(this.trailProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTrail.tex);
      gl.uniform1i(gl.getUniformLocation(this.trailProg, "u_prevTrail"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.tex);
      gl.uniform1i(gl.getUniformLocation(this.trailProg, "u_scene"), 1);
      gl.uniform1f(gl.getUniformLocation(this.trailProg, "u_decay"), pal.trailDecay);
      gl.uniform1f(gl.getUniformLocation(this.trailProg, "u_isLight"), isLight);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.trailFlip = 1 - this.trailFlip;

      // ── Pass 3: Separable Gaussian Bloom ────────────────────────────────────
      if (!pal.isLight) {
        const b0 = this.bloomFBOs[0];
        const b1 = this.bloomFBOs[1];
        gl.useProgram(this.blurProg);
        gl.uniform1i(gl.getUniformLocation(this.blurProg, "u_tex"), 0);

        // Horizontal + threshold
        gl.bindFramebuffer(gl.FRAMEBUFFER, b0.fb);
        gl.viewport(0, 0, b0.w, b0.h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.tex);
        gl.uniform2f(gl.getUniformLocation(this.blurProg, "u_dir"), 1.0 / b0.w, 0.0);
        gl.uniform1f(gl.getUniformLocation(this.blurProg, "u_threshold"), 0.32);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Vertical
        gl.bindFramebuffer(gl.FRAMEBUFFER, b1.fb);
        gl.viewport(0, 0, b1.w, b1.h);
        gl.bindTexture(gl.TEXTURE_2D, b0.tex);
        gl.uniform2f(gl.getUniformLocation(this.blurProg, "u_dir"), 0.0, 1.0 / b1.h);
        gl.uniform1f(gl.getUniformLocation(this.blurProg, "u_threshold"), 0.0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // ── Pass 4: Composite to Screen ─────────────────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.useProgram(this.compProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.tex);
      gl.uniform1i(gl.getUniformLocation(this.compProg, "u_scene"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, dstTrail.tex);
      gl.uniform1i(gl.getUniformLocation(this.compProg, "u_trail"), 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomFBOs[1].tex);
      gl.uniform1i(gl.getUniformLocation(this.compProg, "u_bloom"), 2);

      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_bloomStrength"), pal.bloomStrength);
      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_isLight"), isLight);
      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_showBezel"), this.showBezel ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_screenIndex"), this.screenIndex);
      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_totalScreens"), this.totalScreens);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  window.AlienRenderer = AlienRenderer;
  window.AlienPalettes = PALETTES;
})();
