#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform vec2 u_virtual_resolution;
uniform float u_screen_offset;
uniform float u_time;
uniform float u_show_border;
uniform int u_screen_index;
uniform int u_total_screens;

uniform vec2 u_camera_angles;      // (orbit azimuth, tilt elevation)
uniform float u_camera_dist;       // Camera distance
uniform float u_dark_mode;         // 0.0: Washi Parchment, 1.0: Obsidian Slate

const int NUM_METABALLS = 32;
uniform vec4 u_metaballs[NUM_METABALLS]; // (x, y, z, radius)

// ── Procedural Paper & Fiber Noise ───────────────────────────────────────────
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float paperNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float paperFibers(vec2 uv) {
  float n = paperNoise(uv * 120.0) * 0.5;
  n += paperNoise(uv * 240.0) * 0.25;
  n += paperNoise(uv * 480.0) * 0.125;
  return n;
}

// ── 3D Metaball Potential and Gradient on a Plane ─────────────────────────────
void evalMetaball(vec3 pos, out float pot, out vec2 grad) {
  pot = 0.0;
  grad = vec2(0.0);
  for (int i = 0; i < NUM_METABALLS; i++) {
    vec3 diff = pos - u_metaballs[i].xyz;
    float r = u_metaballs[i].w;
    float r2 = r * r;
    float d2 = dot(diff, diff) + 0.0003;
    float invD2 = 1.0 / d2;
    float val = r2 * invD2;
    pot += val;
    // Gradient on the horizontal XZ plane: d(val)/d(xz) = -2 * r^2 * diff.xz / d^4
    grad += (-2.0 * val * invD2) * diff.xz;
  }
}

float evalPotential(vec3 pos) {
  float pot = 0.0;
  for (int i = 0; i < NUM_METABALLS; i++) {
    vec3 diff = pos - u_metaballs[i].xyz;
    float r2 = u_metaballs[i].w * u_metaballs[i].w;
    float d2 = dot(diff, diff) + 0.0003;
    pot += r2 / d2;
  }
  return pot;
}

void main() {
  // Global unified 32:9 coordinates across multiple displays
  float globalX = gl_FragCoord.x + u_screen_offset;
  vec2 globalUV = vec2(globalX / u_virtual_resolution.x, gl_FragCoord.y / u_resolution.y);

  float aspect = u_virtual_resolution.x / u_resolution.y;
  vec2 p = vec2((globalUV.x - 0.5) * aspect, (globalUV.y - 0.5) * 2.0);

  // Camera setup
  float azimuth = u_camera_angles.x;
  float elevation = clamp(u_camera_angles.y, 0.25, 1.45); // Pitch from above (~35 to 80 deg)
  float camDist = u_camera_dist;

  vec3 camPos = vec3(
    camDist * cos(elevation) * sin(azimuth),
    camDist * sin(elevation),
    -camDist * cos(elevation) * cos(azimuth)
  );

  vec3 camTarget = vec3(0.0, -0.15, 0.0);
  vec3 fwd = normalize(camTarget - camPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);

  float fov = 0.55;
  vec3 rayDir = normalize(fwd + right * (p.x * fov) + up * (p.y * fov));

  // ── Color Theme Palettes ───────────────────────────────────────────────────
  // Light Mode (Washi Parchment with Sumi-e Walnut Ink)
  vec3 washiPaperBase  = vec3(0.965, 0.945, 0.905);
  vec3 washiCardBase   = vec3(0.985, 0.975, 0.950);
  vec3 washiInkColor   = vec3(0.12, 0.10, 0.09);
  vec3 washiShadow     = vec3(0.20, 0.17, 0.14);

  // Dark Mode (Obsidian Slate with Gold / Brass Ink)
  vec3 slatePaperBase  = vec3(0.05, 0.06, 0.07);
  vec3 slateCardBase   = vec3(0.09, 0.10, 0.12);
  vec3 slateInkColor   = vec3(0.95, 0.82, 0.45); // Luminous gold/brass
  vec3 slateShadow     = vec3(0.01, 0.01, 0.02);

  bool isDark = u_dark_mode > 0.5;
  vec3 bgPaperColor = isDark ? slatePaperBase : washiPaperBase;
  vec3 cardColor    = isDark ? slateCardBase  : washiCardBase;
  vec3 inkColor     = isDark ? slateInkColor  : washiInkColor;
  vec3 shadowColor  = isDark ? slateShadow    : washiShadow;

  // Background Paper texture & vignette
  float fiber = paperFibers(globalUV * 8.0);
  vec3 finalColor = bgPaperColor + (isDark ? vec3(fiber * 0.03) : vec3((fiber - 0.5) * 0.035));
  float vignette = 1.0 - 0.22 * dot(p, p);
  finalColor *= clamp(vignette, 0.7, 1.0);

  // ── Topographic Analytical Planar Slicing ──────────────────────────────────
  const int NUM_SLICES = 40;
  float yTop = 2.2;
  float yBottom = -2.2;
  float deltaY = (yTop - yBottom) / float(NUM_SLICES - 1);

  // Light direction for cast paper shadows
  vec3 lightDir = normalize(vec3(0.4, 0.8, -0.3));

  // Ray hits planes from top to bottom (since rayDir.y < 0 when camera looks down)
  if (abs(rayDir.y) > 0.0001) {
    for (int k = 0; k < NUM_SLICES; k++) {
      float yPlane = yTop - float(k) * deltaY;
      float tPlane = (yPlane - camPos.y) / rayDir.y;

      if (tPlane > 0.0) {
        vec3 hitPos = camPos + rayDir * tPlane;

        float potential;
        vec2 grad;
        evalMetaball(hitPos, potential, grad);

        // If inside the metaball cross section
        if (potential >= 1.0) {
          float gradLen = length(grad);
          float distToEdge = abs(potential - 1.0) / max(gradLen, 0.001);

          // Ink stroke threshold scaled by ray distance for anti-aliasing
          float pixelFootprint = tPlane * 0.0018;
          float inkWidth = pixelFootprint * 1.6;
          float inkAlpha = 1.0 - smoothstep(0.0, inkWidth, distToEdge);

          // Height gradient & subtle card shading
          float sliceFraction = float(k) / float(NUM_SLICES - 1);
          vec3 sliceBase = cardColor * (1.0 - sliceFraction * 0.12);

          // Cast contact shadow from slice above (k - 1)
          float shadowAtten = 1.0;
          if (k > 0) {
            float yAbove = yPlane + deltaY;
            vec3 shadowSamplePos = hitPos + lightDir * (deltaY / lightDir.y);
            float potAbove = evalPotential(shadowSamplePos);
            if (potAbove > 1.0) {
              shadowAtten = isDark ? 0.45 : 0.68;
            } else if (potAbove > 0.85) {
              shadowAtten = isDark ? 0.70 : 0.85;
            }
          }

          vec3 sliceCol = mix(sliceBase * shadowAtten, inkColor, inkAlpha * 0.95);

          // Card fiber noise
          float cardFiber = paperNoise(hitPos.xz * 22.0) * 0.04;
          sliceCol += (isDark ? cardFiber : -cardFiber);

          finalColor = sliceCol;
          break; // Opaque card occludes lower layers
        } else {
          // Check if this empty point is covered by shadow cast from the slice above onto table/lower layers
          if (k == NUM_SLICES - 1) {
            // Drop shadow cast onto background table
            vec3 shadowTest = hitPos + lightDir * 0.25;
            float potShadow = evalPotential(shadowTest);
            if (potShadow > 1.0) {
              finalColor = mix(finalColor, shadowColor, isDark ? 0.35 : 0.18);
            }
          }
        }
      }
    }
  }

  // Dual-screen bezel line guide
  if (u_show_border > 0.5) {
    float screenFrac = fract(globalUV.x * float(u_total_screens));
    float distToSeam = min(screenFrac, 1.0 - screenFrac) * u_virtual_resolution.x;
    if (distToSeam < 2.5) {
      finalColor = mix(finalColor, vec3(1.0, 0.4, 0.2), 0.85);
    }
  }

  fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
