#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state_texture;
uniform vec2 u_sim_resolution;
uniform float u_dt;
uniform float u_time;
uniform float u_drain_rate;
uniform float u_marangoni_active;
uniform int u_num_disturbances;
uniform vec4 u_disturbances[8]; // xy = pos [0,1], z = radius, w = angular strength
uniform float u_reset;

// ── Curl Noise & Pseudo-random Utilities ──────────────────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0 - sqrt(3.0)) / 6.0
                      0.366025403784439,  // 0.5 * (sqrt(3.0) - 1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Analytical curl of 2D simplex noise field
vec2 curlNoise(vec2 p, float t) {
  float eps = 0.005;
  vec2 pTime = p * 2.5 + vec2(t * 0.08, t * 0.05);
  float n1 = snoise(pTime + vec2(0.0, eps));
  float n2 = snoise(pTime - vec2(0.0, eps));
  float n3 = snoise(pTime + vec2(eps, 0.0));
  float n4 = snoise(pTime - vec2(eps, 0.0));
  // curl = (dF/dy, -dF/dx)
  return vec2((n1 - n2) / (2.0 * eps), -(n3 - n4) / (2.0 * eps));
}

// ── Initial Film Profile ──────────────────────────────────────────────────────
vec4 initializeProfile(vec2 uv) {
  // y in [0, 1]: 0.0 = bottom (thick pool), 1.0 = top (black film)
  float noise = snoise(uv * vec2(4.0, 2.0)) * 0.15 + snoise(uv * vec2(12.0, 6.0)) * 0.06;
  // Thickness gradient: 120nm at top to 1100nm at bottom with wave modulations
  float d = mix(1150.0, 140.0, smoothstep(0.0, 1.0, uv.y + noise * 0.3));
  d = clamp(d, 40.0, 1600.0);
  
  // Initial gentle lateral velocity
  vec2 vel = curlNoise(uv * 1.5, 0.0) * 0.02;
  float surfactant = mix(0.9, 0.1, uv.y);
  return vec4(vel, d, surfactant);
}

void main() {
  vec2 uv = v_uv;
  vec2 texel = 1.0 / u_sim_resolution;

  // Handle reset condition
  if (u_reset > 0.5) {
    fragColor = initializeProfile(uv);
    return;
  }

  // Sample current state
  vec4 current = texture(u_state_texture, uv);
  vec2 vel = current.xy;
  float d = current.z;
  float surf = current.w;

  // 1. Semi-Lagrangian Advection
  // Trace back along velocity vector in unified 32:9 normalized space
  vec2 backCoord = uv - vel * u_dt;
  // Periodic horizontal boundary across the 32:9 coordinate space
  backCoord.x = fract(backCoord.x);
  backCoord.y = clamp(backCoord.y, 0.001, 0.999);
  vec4 advected = texture(u_state_texture, backCoord);

  // 2. Gravitational Drainage & Lubrication Theory
  // Thinning rate is proportional to gravity g and local thickness squared (Poiseuille flow)
  // Top region (y > 0.7) thins down rapidly towards the "black film" regime (~40-100 nm)
  float drainageAccel = u_drain_rate * 38.0 * u_dt;
  // Higher vertical position experiences faster drainage depletion
  float yDrainFactor = smoothstep(0.05, 0.95, uv.y);
  float dLoss = drainageAccel * (advected.z / 700.0) * yDrainFactor;
  // Accumulation at bottom
  float dGain = drainageAccel * 0.65 * (1.0 - smoothstep(0.0, 0.25, uv.y));
  float newD = clamp(advected.z - dLoss + dGain, 30.0, 1800.0);

  // 3. Marangoni Convection (Surface Tension Gradients)
  // Gradients in surfactant/thickness generate upward buoyant plumes
  vec2 surfGrad = vec2(
    texture(u_state_texture, vec2(fract(uv.x + texel.x), uv.y)).w - texture(u_state_texture, vec2(fract(uv.x - texel.x), uv.y)).w,
    texture(u_state_texture, vec2(uv.x, clamp(uv.y + texel.y, 0.0, 1.0))).w - texture(u_state_texture, vec2(uv.x, clamp(uv.y - texel.y, 0.0, 1.0))).w
  ) * 0.5;

  vec2 marangoniForce = vec2(0.0);
  if (u_marangoni_active > 0.5) {
    // Upward plume fingering along bottom and sidewalls where surfactant gradient is high
    float plumeInstability = snoise(vec2(uv.x * 24.0, u_time * 0.6)) * 0.5 + 0.5;
    float upwardBuoyancy = smoothstep(0.0, 0.35, 1.0 - uv.y) * plumeInstability * 0.06;
    marangoniForce = vec2(-surfGrad.x * 0.4, upwardBuoyancy + abs(surfGrad.y) * 0.2);
  }

  // 4. Background Incompressible Curl Swirls
  // Multi-scale divergence-free turbulence traversing the dual screens
  vec2 ambientCurl = curlNoise(uv * vec2(3.5, 1.5), u_time * 0.5) * 0.018;

  // 5. Injected Stir Disturbances (User interaction or master auto-swirls)
  vec2 disturbanceVel = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= u_num_disturbances) break;
    vec4 dist = u_disturbances[i];
    vec2 dPos = dist.xy;
    float dRad = dist.z;
    float dStr = dist.w;
    
    // Distance in 32:9 aspect corrected coordinates
    vec2 delta = uv - dPos;
    delta.x *= 3.5; // aspect scale for circular vortex
    float distSq = dot(delta, delta);
    float radSq = dRad * dRad;
    if (distSq < radSq) {
      float atten = 1.0 - distSq / radSq;
      atten = atten * atten;
      // Perpendicular vortex vector: (-dy, dx)
      vec2 vortex = vec2(-delta.y, delta.x) / (sqrt(distSq) + 0.001);
      disturbanceVel += vortex * dStr * atten;
      // Also stir the thickness locally
      newD += snoise(uv * 30.0 + float(i)) * atten * 120.0 * u_dt;
    }
  }

  // 6. Velocity Field Evolution
  vec2 newVel = advected.xy * 0.982; // Viscous decay
  newVel += marangoniForce * u_dt;
  newVel += ambientCurl * u_dt;
  newVel += disturbanceVel * u_dt;
  // Gravity drag on fluid velocity
  newVel.y -= 0.004 * u_dt * yDrainFactor;

  // 7. Lubrication Diffusion: small 4-point Laplacian smoothing
  float dLeft  = texture(u_state_texture, vec2(fract(uv.x - texel.x), uv.y)).z;
  float dRight = texture(u_state_texture, vec2(fract(uv.x + texel.x), uv.y)).z;
  float dDown  = texture(u_state_texture, vec2(uv.x, clamp(uv.y - texel.y, 0.0, 1.0))).z;
  float dUp    = texture(u_state_texture, vec2(uv.x, clamp(uv.y + texel.y, 0.0, 1.0))).z;
  float laplacian = (dLeft + dRight + dDown + dUp - 4.0 * newD);
  newD += laplacian * 0.045;

  // 8. Surfactant advection and decay
  float newSurf = clamp(advected.w + laplacian * 0.0001 - 0.01 * u_dt, 0.0, 1.0);
  if (uv.y < 0.05) newSurf = mix(newSurf, 0.95, 0.05); // Surfactant replenished at bottom reservoir

  fragColor = vec4(newVel, newD, newSurf);
}
