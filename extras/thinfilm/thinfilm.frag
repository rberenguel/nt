#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;         // Current screen resolution
uniform vec2 u_virtual_resolution; // Total multi-screen resolution (e.g. 3840x1080)
uniform float u_screen_offset;     // Pixel x-offset for current screen
uniform float u_time;
uniform float u_show_border;
uniform int u_screen_index;
uniform int u_total_screens;

uniform int u_num_disturbances;
uniform vec4 u_disturbances[8];    // xy = pos [0,1] in 32:9, z = radius, w = strength
uniform float u_flow_speed;
uniform float u_marbling_style;    // 0: Natural Newton Bands, 1: Vivid Spectral, 2: Opal Pastels

// Refraction index of soap water dielectric membrane
const float N_AIR  = 1.0003;
const float N_FILM = 1.340;

// ── Physical Thin-Film Multi-Order Newton Interference Fringes ────────────────
// Evaluates constructive & destructive interference across visible wavelengths.
// As OPD advances, produces rhythmic cascading Newton color bands:
// Gold -> Violet -> Electric Blue -> Emerald -> Magenta -> Cyan -> repeating cycles!
vec3 evalNewtonBands(float opd, float cosTheta2) {
  // opd in nanometers
  // Primary visible spectrum wavelengths: Red 650nm, Green 530nm, Blue 445nm
  vec3 lambda1 = vec3(650.0, 530.0, 445.0);
  vec3 phase1 = 6.2831853 * (opd / lambda1);
  // Outer boundary phase reversal (pi): R = 0.5 - 0.5 * cos(phase)
  vec3 refl1 = 0.5 - 0.5 * cos(phase1);

  // Secondary sub-harmonics for vibrant chromatic fidelity (Gold 585nm, Cyan 490nm, Violet 415nm)
  vec3 lambda2 = vec3(585.0, 490.0, 415.0);
  vec3 phase2 = 6.2831853 * (opd / lambda2);
  vec3 refl2 = 0.5 - 0.5 * cos(phase2);

  vec3 col = mix(refl1, refl2, 0.35);

  // Black film suppression: below 60nm OPD, destructive interference cancels visible light
  float blackFilm = smoothstep(25.0, 75.0, opd);
  col *= blackFilm;

  // Higher-order gradual fringe damping (fringes above 2800nm soften naturally)
  float order = opd / 550.0;
  float damping = 1.0 / (1.0 + order * 0.12);
  float avg = (col.r + col.g + col.b) * 0.3333;
  col = mix(vec3(avg), col, damping);

  // Contrast curve: creates crisp, dark troughs between each luminous band
  // This produces the characteristic etched, rhythmic banding of soap bubbles!
  if (u_marbling_style > 1.5) {
    // Opal Pastels
    col = mix(col, vec3(col.b * 0.9, col.r * 0.65 + col.g * 0.35, col.g * 0.9), 0.28);
    col = pow(col, vec3(1.3)) * 1.3;
  } else if (u_marbling_style > 0.5) {
    // Vivid Spectral
    col = pow(col, vec3(1.6)) * 1.6;
  } else {
    // Natural Newton Bands (deep contrast, vivid jewel tones)
    col = pow(col, vec3(1.45)) * 1.45;
  }

  // Subtle Fresnel edge enhancement
  float f0 = pow((N_FILM - N_AIR) / (N_FILM + N_AIR), 2.0);
  float fresnel = f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta2, 0.0, 1.0), 3.0);
  col *= (0.85 + 0.55 * fresnel);

  return col;
}

// ── Organic Soap Bubble Fluid Dynamics & Banding Potential ────────────────────
// Generates a multi-vortex potential field whose contour lines form the dense,
// rhythmic Newton bands characteristic of real soap bubbles.
float computeBubbleThickness(vec2 uv, float t) {
  // Correct aspect ratio for dual-screen 32:9 coordinate space
  vec2 p = uv;
  p.x *= 3.555; // 32:9 aspect
  
  float speed = t * 0.18 * u_flow_speed;

  // 1. Drifting Vortex Centers (wandering across the dual displays)
  vec2 eye1 = vec2(1.15 + sin(speed * 0.45) * 0.55, 0.52 + cos(speed * 0.65) * 0.22);
  vec2 eye2 = vec2(2.45 + cos(speed * 0.55) * 0.55, 0.48 + sin(speed * 0.75) * 0.22);
  vec2 eye3 = vec2(1.80 + sin(speed * 0.35 + 2.0) * 0.60, 0.38 + cos(speed * 0.45) * 0.18);

  vec2 d1 = p - eye1;
  vec2 d2 = p - eye2;
  vec2 d3 = p - eye3;
  float r1 = length(d1);
  float r2 = length(d2);
  float r3 = length(d3);

  // Rotational circulation around vortex eyes
  float spin1 = 1.6 / (r1 + 0.35);
  float spin2 = -1.5 / (r2 + 0.35);
  float spin3 = 1.3 / (r3 + 0.35);

  mat2 rot1 = mat2(cos(spin1), -sin(spin1), sin(spin1), cos(spin1));
  mat2 rot2 = mat2(cos(spin2), -sin(spin2), sin(spin2), cos(spin2));
  mat2 rot3 = mat2(cos(spin3), -sin(spin3), sin(spin3), cos(spin3));

  vec2 warped = p;
  warped += (rot1 * d1 - d1) * smoothstep(1.4, 0.0, r1) * 0.85;
  warped += (rot2 * d2 - d2) * smoothstep(1.4, 0.0, r2) * 0.85;
  warped += (rot3 * d3 - d3) * smoothstep(1.2, 0.0, r3) * 0.65;

  // 2. Interactive User Vortex Disturbances (Mouse drag / Space bar)
  for (int i = 0; i < 8; i++) {
    if (i >= u_num_disturbances) break;
    vec4 dist = u_disturbances[i];
    vec2 dPos = dist.xy;
    dPos.x *= 3.555;
    vec2 delta = p - dPos;
    float r = length(delta);
    if (r < dist.z) {
      float atten = 1.0 - r / dist.z;
      atten = atten * atten * atten;
      float spin = dist.w * atten * 2.8;
      mat2 vRot = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
      warped += (vRot * delta - delta) * 1.6;
    }
  }

  // 3. Fluid Marbling Field (Domain Warping)
  vec2 q = warped * 1.8;
  q += vec2(sin(q.y * 1.4 + speed * 0.7), cos(q.x * 1.4 + speed * 0.6)) * 0.40;
  q = mat2(0.866, -0.5, 0.5, 0.866) * q;
  q += vec2(sin(q.y * 2.4 - speed * 1.0), cos(q.x * 2.4 + speed * 0.8)) * 0.26;
  q = mat2(0.707, 0.707, -0.707, 0.707) * q;
  q += vec2(sin(q.y * 3.8 + speed * 1.2), cos(q.x * 3.8 - speed * 1.1)) * 0.14;

  // 4. Banding Potential Field
  // Generates 15 to 25 dense, nested, hypnotic Newton rings & flowing ribbons!
  // Distance to nearest vortex eye creates nested concentric rings (like Image 3)
  float eyeDistanceField = min(min(r1 * 1.1, r2 * 1.1), r3 * 1.3);
  
  // Fluid rivers and marbling streams
  float flowStream = sin(q.x * 1.5 + sin(q.y * 1.4)) * 0.5 + 0.5;
  float flowEddy   = cos(q.y * 1.8 - cos(q.x * 1.6)) * 0.5 + 0.5;

  // Combined continuous potential field
  float potential = eyeDistanceField * 4.2 + (flowStream * 2.2 + flowEddy * 1.8);

  // Vertical gravitational drainage bias (thinner at top, pooling at bottom)
  float gravityBias = (1.0 - uv.y) * 1.8;

  // Total Optical Path Difference (spans 380nm to 2400nm across ~16 dense Newton bands!)
  // Each cycle of ~200nm produces one full rainbow band (Yellow->Purple->Blue->Green->Magenta)!
  float opd = 380.0 + (potential + gravityBias) * 210.0;

  // Eye centers thin down to black film
  if (r1 < 0.22) opd = mix(40.0, opd, smoothstep(0.04, 0.22, r1));
  if (r2 < 0.22) opd = mix(40.0, opd, smoothstep(0.04, 0.22, r2));
  if (r3 < 0.18) opd = mix(40.0, opd, smoothstep(0.03, 0.18, r3));

  return opd;
}

void main() {
  // Global unified 32:9 coordinates across multiple displays
  float globalX = gl_FragCoord.x + u_screen_offset;
  vec2 globalUV = vec2(globalX / u_virtual_resolution.x, gl_FragCoord.y / u_resolution.y);

  // Macro surface geometry: gentle convex bubble curvature
  vec2 screenCenter = (globalUV - vec2(0.5)) * vec2(2.6, 1.0);
  vec3 normal = normalize(vec3(screenCenter * 0.08, 1.0));
  vec3 viewDir = normalize(vec3(screenCenter * 0.16, 1.6));

  // Snell's Law & Refraction angle inside soap film
  float cosTheta1 = clamp(dot(normal, viewDir), 0.0, 1.0);
  float sinTheta1 = sqrt(max(0.0, 1.0 - cosTheta1 * cosTheta1));
  float sinTheta2 = sinTheta1 * (N_AIR / N_FILM);
  float cosTheta2 = sqrt(max(0.0, 1.0 - sinTheta2 * sinTheta2));

  // Compute Optical Path Difference directly with organic banding potential
  float baseOPD = computeBubbleThickness(globalUV, u_time);
  float opd = baseOPD * cosTheta2;

  // Evaluate multi-order Newton interference bands
  vec3 bandColor = evalNewtonBands(opd, cosTheta2);

  // Glassy specular highlights: crisp light reflections off the liquid membrane
  vec3 lightDir1 = normalize(vec3(0.25, 0.75, 0.85));
  vec3 halfVec1 = normalize(lightDir1 + viewDir);
  float spec1 = pow(max(0.0, dot(normal, halfVec1)), 64.0) * 0.65;

  vec3 lightDir2 = normalize(vec3(-0.50, 0.35, 0.75));
  vec3 halfVec2 = normalize(lightDir2 + viewDir);
  float spec2 = pow(max(0.0, dot(normal, halfVec2)), 48.0) * 0.35;

  vec3 specular = vec3(1.0, 0.98, 0.95) * (spec1 + spec2);

  // Deep obsidian/liquid velvet backdrop
  // Subtle peripheral vignette toward the screen corners
  float cornerDist = length(screenCenter);
  float vignette = smoothstep(1.7, 0.6, cornerDist);
  
  // Combine: dense hypnotic Newton bands + glassy specular reflection
  vec3 finalColor = bandColor * (0.45 + 0.55 * vignette) + specular;
  finalColor = clamp(finalColor, 0.0, 1.0);

  // Display Seam / Bezel alignment guide
  if (u_show_border > 0.5) {
    float screenFrac = fract(globalUV.x * float(u_total_screens));
    float distToSeam = min(screenFrac, 1.0 - screenFrac) * u_virtual_resolution.x;
    if (distToSeam < 2.5) {
      finalColor = mix(finalColor, vec3(1.0, 0.35, 0.2), 0.9);
    }
  }

  fragColor = vec4(finalColor, 1.0);
}
