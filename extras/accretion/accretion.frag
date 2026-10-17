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

uniform vec2 u_camera_angles;      // (orbit azimuth, tilt elevation)
uniform float u_camera_dist;       // Camera radial distance
uniform float u_doppler_enabled;   // 1.0: ON, 0.0: OFF

// Physical constants (normalized geometric units where c = 1, G = 1, M = 0.5, r_s = 1.0)
const float RS   = 1.0;            // Schwarzschild radius (2GM/c^2)
const float RISCO = 3.0 * RS;      // Innermost Stable Circular Orbit (ISCO = 3 r_s)
const float ROUTER = 22.0 * RS;    // Outer accretion disk boundary

// ── Simplex Noise & Procedural Gas Texture ─────────────────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// 3D Simplex Noise (Stefan Gustavson)
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ── Geodesic Photon Acceleration in Schwarzschild Spacetime ───────────────────
// Planar geodesic acceleration acting on null rays: a = -1.5 * r_s * (r x v)^2 / r^5 * r
vec3 photonAccel(vec3 r, vec3 v) {
  vec3 L = cross(r, v);
  float L2 = dot(L, L);
  float rLen = length(r);
  float r5 = rLen * rLen * rLen * rLen * rLen;
  return r * (-1.5 * RS * L2 / max(r5, 0.0001));
}

// ── Procedural Deep Space Starfield ───────────────────────────────────────────
vec3 sampleStarfield(vec3 dir) {
  vec3 col = vec3(0.001, 0.002, 0.004);
  // High-frequency star noise in seamless 3D spherical direction
  float n = snoise(dir * 160.0);
  float star = pow(clamp(n * 0.5 + 0.5, 0.0, 1.0), 22.0) * 1.8;
  col += vec3(0.9, 0.95, 1.0) * star;

  // Subtle background cosmic nebula haze
  float neb = snoise(dir * 2.5) * 0.5 + snoise(dir * 5.0 + vec3(1.3, 2.7, 4.1)) * 0.25;
  col += vec3(0.015, 0.02, 0.04) * clamp(neb, 0.0, 1.0);
  return col;
}

// ── Accretion Disk Plasma Density & Emission ──────────────────────────────────
// Evaluates Keplerian gas shearing and relativistic Doppler / gravitational redshift
vec4 sampleAccretionDisk(vec3 hitPos, vec3 rayDir, float t) {
  float r = length(hitPos.xz);
  
  // Empty ISCO plunge gap: matter plunges straight into the horizon within r < 3 r_s
  if (r < RISCO || r > ROUTER) {
    return vec4(0.0);
  }

  // Page-Thorne radial intensity profile
  float normR = (r - RISCO) / (ROUTER - RISCO);
  float radialFalloff = pow(RISCO / r, 1.7) * (1.0 - sqrt(RISCO / r)) * smoothstep(1.0, 0.7, normR);
  radialFalloff = max(0.0, radialFalloff * 4.8);

  // Keplerian orbital dynamics: v(r) = sqrt(r_s / 2r), Omega(r) proportional to r^(-1.5)
  float orbitalSpeed = sqrt(RS / (2.0 * r));
  float omega = orbitalSpeed / r;
  float phi = atan(hitPos.z, hitPos.x);

  // Dynamic Keplerian shearing gas noise sampled seamlessly on 3D cylinders:
  // Using harmonic (cos, sin) pairs ensures EXACT 2pi angular periodicity:
  // no branch cut, no atan discontinuity, and no texture seam!
  float theta = phi - omega * t * 3.5;
  vec3 cyl1 = vec3(r * 0.65, 1.8 * cos(theta), 1.8 * sin(theta));
  vec3 cyl2 = vec3(r * 1.5 + 2.3, 3.5 * cos(theta * 2.0), 3.5 * sin(theta * 2.0));
  vec3 cyl3 = vec3(r * 3.2 + 5.7, 6.0 * cos(theta * 3.0), 6.0 * sin(theta * 3.0));

  float n1 = snoise(cyl1);
  float n2 = snoise(cyl2) * 0.5;
  float n3 = snoise(cyl3) * 0.25;
  float gasTurbulence = clamp(0.45 + 0.55 * (n1 + n2 + n3), 0.0, 2.0);

  // Gas density
  float density = radialFalloff * gasTurbulence;

  // Relativistic Doppler Beaming & Gravitational Redshift
  // Gas orbital velocity unit vector in equatorial plane: (-sin(phi), 0, cos(phi))
  vec3 phiHat = vec3(-sin(phi), 0.0, cos(phi));
  vec3 beta = phiHat * orbitalSpeed;
  
  // Emitted photon unit vector toward observer: -rayDir
  vec3 obsDir = -rayDir;
  float betaParallel = dot(beta, obsDir);
  
  // Lorentz gamma factor: 1 / sqrt(1 - beta^2)
  float gamma = 1.0 / sqrt(max(0.01, 1.0 - orbitalSpeed * orbitalSpeed));
  
  // Doppler factor: D = 1 / [gamma * (1 - beta_parallel)]
  float dopplerD = 1.0 / max(0.05, gamma * (1.0 - betaParallel));
  
  // Gravitational time dilation redshift: g_grav = sqrt(1 - r_s / r)
  float gGrav = sqrt(max(0.01, 1.0 - RS / r));
  
  // Combined relativistic invariant factor: g_net = D * g_grav
  float gNet = (u_doppler_enabled > 0.5) ? (dopplerD * gGrav) : 1.0;
  
  // Relativistic radiance transformation: I_obs = I_emit * g_net^3
  float intensity = density * pow(gNet, 3.2);

  // Chromatic Doppler & Gravitational Spectral Shifting:
  // Base emitted gas: hot accretion plasma (white-gold, T ~ 10^7 K)
  vec3 emitColor = vec3(1.0, 0.88, 0.65);

  vec3 obsColor;
  if (gNet >= 1.0) {
    // Blueshifted limb (approaching observer, left screen):
    // Amplified in intensity, shifted toward blazing electric cyan and white
    float blueFactor = clamp((gNet - 1.0) * 1.4, 0.0, 1.0);
    obsColor = mix(emitColor, vec3(0.55, 0.90, 1.25), blueFactor) * (1.0 + blueFactor * 1.8);
  } else {
    // Redshifted limb (receding observer, right screen):
    // Dimmed in intensity, shifted toward deep crimson, amber, and blood red
    float redFactor = clamp((1.0 - gNet) * 1.5, 0.0, 1.0);
    obsColor = mix(emitColor, vec3(1.1, 0.28, 0.04), redFactor) * (1.0 - redFactor * 0.45);
  }

  // Optical thickness and transparency
  float opacity = clamp(density * 1.8, 0.0, 0.95);

  return vec4(obsColor * intensity, opacity);
}

void main() {
  // Global unified 32:9 coordinates across multiple displays
  float globalX = gl_FragCoord.x + u_screen_offset;
  vec2 globalUV = vec2(globalX / u_virtual_resolution.x, gl_FragCoord.y / u_resolution.y);

  // Asymmetric Look-At Composition:
  // Black hole singularity is anchored at 35% of total 32:9 width (dominating the left display)
  // The blueshifted limb rules the left screen; the Einstein ring and redshifted gas sweep right!
  float aspect = u_virtual_resolution.x / u_resolution.y; // ~3.555 for dual 16:9
  vec2 p = vec2((globalUV.x - 0.35) * aspect, (globalUV.y - 0.5) * 2.0);

  // Camera setup with slow orbital drift & user tilt
  float azimuth = u_camera_angles.x;
  float elevation = u_camera_angles.y; // Camera elevation above disk plane (~12 deg)
  float camDist = u_camera_dist;

  vec3 camPos = vec3(
    camDist * cos(elevation) * sin(azimuth),
    camDist * sin(elevation),
    -camDist * cos(elevation) * cos(azimuth)
  );

  vec3 camTarget = vec3(0.0, 0.0, 0.0);
  vec3 fwd = normalize(camTarget - camPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);

  // Field of view: 62 degrees
  float fov = 0.58;
  vec3 rayDir = normalize(fwd + right * (p.x * fov) + up * (p.y * fov));

  // ── Relativistic Numerical Geodesic Integration ──────────────────────────────
  vec3 rayPos = camPos;
  vec3 rayVel = rayDir;

  vec3 accumulatedColor = vec3(0.0);
  float transmittance = 1.0;
  bool capturedByHorizon = false;

  const int MAX_STEPS = 96;

  for (int step = 0; step < MAX_STEPS; step++) {
    float r = length(rayPos);

    // Event Horizon Capture: Ray falls below Schwarzschild radius r_s
    if (r < RS) {
      capturedByHorizon = true;
      break;
    }

    // Escape boundary: Ray travels far into deep space
    if (r > 32.0 && step > 5) {
      break;
    }

    // Adaptive step size based on proximity to singularity
    float h = clamp(0.15 * (r - 0.75 * RS), 0.05, 1.05);

    // Velocity Verlet / RK2 relativistic geodesic step
    vec3 a1 = photonAccel(rayPos, rayVel);
    vec3 nextPos = rayPos + rayVel * h + a1 * (0.5 * h * h);
    vec3 a2 = photonAccel(nextPos, rayVel);
    vec3 nextVel = normalize(rayVel + (a1 + a2) * (0.5 * h));

    // Check equatorial plane crossing (y = 0) for accretion disk intersection
    // The ray bends above and below the hole, creating the Einstein dual-arc lens!
    if (rayPos.y * nextPos.y <= 0.0) {
      float tPlane = -rayPos.y / (nextPos.y - rayPos.y + 1e-6);
      vec3 hitPoint = mix(rayPos, nextPos, clamp(tPlane, 0.0, 1.0));

      vec4 diskSample = sampleAccretionDisk(hitPoint, nextVel, u_time);
      if (diskSample.a > 0.001) {
        accumulatedColor += diskSample.rgb * diskSample.a * transmittance;
        transmittance *= (1.0 - diskSample.a);

        // Early ray exit if optical depth saturated
        if (transmittance < 0.02) break;
      }
    }

    // If max steps reached without escaping, treat ray as trapped near horizon
    if (step == MAX_STEPS - 1 && r < 28.0) {
      capturedByHorizon = true;
    }

    rayPos = nextPos;
    rayVel = nextVel;
  }

  // Background celestial starfield for escaping rays
  if (!capturedByHorizon && transmittance > 0.01) {
    vec3 starColor = sampleStarfield(rayVel);
    accumulatedColor += starColor * transmittance;
  }

  // Tone mapping and gamma compression (Reinhard + soft filmic shoulder)
  vec3 color = accumulatedColor;
  color = color / (color + vec3(1.0)); // Filmic Reinhard tone-map
  color = pow(color, vec3(0.85));      // Gamma compression for glowing plasma details
  color = clamp(color, 0.0, 1.0);

  // Display Seam / Bezel alignment guide
  if (u_show_border > 0.5) {
    float screenFrac = fract(globalUV.x * float(u_total_screens));
    float distToSeam = min(screenFrac, 1.0 - screenFrac) * u_virtual_resolution.x;
    if (distToSeam < 2.5) {
      color = mix(color, vec3(1.0, 0.35, 0.2), 0.85);
    }
  }

  fragColor = vec4(color, 1.0);
}
