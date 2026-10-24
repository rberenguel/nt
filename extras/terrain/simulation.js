// 3D Terrain Heightfield, Oren-Nayar Rough Diffuse Lighting,
// Orographic Wind Grid, and Volumetric Fog Simulation

// ── Vector Math Helpers ───────────────────────────────────────────────────────
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-9) return [0, 1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// ── Oren-Nayar Microfacet Rough Diffuse Lighting ──────────────────────────────
const RHO_R = 1.0 - 0.5 / 1.33; // ~0.624
const RHO_O = 0.45 / 1.09;       // ~0.413

function roughLight(normal, eye, light) {
  const cosIn = dot(normal, light);
  if (cosIn <= 0.0) return 0.0;

  const cosOut = clamp01(dot(normal, eye));

  // In-plane projections on tangent surface
  const inPlane = normalize3([
    light[0] - cosIn * normal[0],
    light[1] - cosIn * normal[1],
    light[2] - cosIn * normal[2],
  ]);
  const outPlane = normalize3([
    eye[0] - cosOut * normal[0],
    eye[1] - cosOut * normal[1],
    eye[2] - cosOut * normal[2],
  ]);

  const facing = Math.max(0.0, dot(inPlane, outPlane));
  const steeper = Math.acos(Math.min(cosIn, cosOut));
  const shallower = Math.acos(Math.max(cosIn, cosOut));

  const returned = cosIn * (RHO_R + RHO_O * facing * Math.sin(steeper) * Math.tan(shallower));
  return clamp01(1.3 * returned);
}

// ── Procedural Heightfield & Normal Field ──────────────────────────────────────
function createHeightfield(terrainParams, noiseFunc) {
  const [ox, oz] = terrainParams.offset;
  const top = terrainParams.top;
  const floorLevel = 0.5 * top;

  function height(x, z) {
    const nx = x / 32.0 + ox;
    const nz = z / 32.0 + oz;
    const f = clamp01(fbmRotated(noiseFunc, nx, nz, 5));
    const base = top * f * f * f;
    const diff = floorLevel - base;
    if (diff <= 0.0) return base;

    // Secondary erosion ridge
    const s = Math.max(0.0, fbmRotated(noiseFunc, x / 16.0 + ox + 233.0, z / 16.0 + oz + 233.0, 4) - 0.5) / 0.15;
    return base + diff * (1.0 - Math.exp(-s * s));
  }

  function normal(x, z) {
    const eps = 0.002;
    const hL = height(x - eps, z);
    const hR = height(x + eps, z);
    const hD = height(x, z - eps);
    const hU = height(x, z + eps);
    return normalize3([hL - hR, 2.0 * eps, hD - hU]);
  }

  return { height, normal, top, offset: [ox, oz] };
}

// ── Isometric / Dimetric Camera Projection ─────────────────────────────────────
function createCamera(viewPitch, sunElevation, sunAzimuthRatio, heightfield, canvasW, canvasH) {
  const pitch = viewPitch; // ~30 deg (Math.PI / 6)
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const diag = Math.PI / 4; // 45 deg diagonal
  const s = [Math.sin(diag), 0, Math.cos(diag)];
  const u = [Math.cos(diag), 0, -Math.sin(diag)];

  const p = [s[0] * sinPitch, cosPitch, s[2] * sinPitch];
  const g = [s[0] * cosPitch, -sinPitch, s[2] * cosPitch];
  const eye = g.map((v) => -v);

  const azAngle = (sunAzimuthRatio - 0.5) * 2.0 * (Math.PI / 3);
  const cosEl = Math.cos(sunElevation);
  const sinEl = Math.sin(sunElevation);
  const light = [
    cosEl * (s[0] * Math.cos(azAngle) + u[0] * Math.sin(azAngle)),
    sinEl,
    cosEl * (s[2] * Math.cos(azAngle) + u[2] * Math.sin(azAngle)),
  ];

  const scale = 50.0 / canvasH;

  function screenToWorld(sx, sy) {
    const a = (sx - canvasW / 2.0) * scale;
    const b = (canvasH / 2.0 - sy) * scale;
    return [
      u[0] * a + p[0] * b,
      p[1] * b,
      u[2] * a + p[2] * b,
    ];
  }

  // Cast ray from screen pixel to terrain surface
  function hit(sx, sy) {
    const [origX, origY, origZ] = screenToWorld(sx, sy);
    const top = heightfield.top;
    
    // Ensure ray always starts well above the highest possible peak (top + 2)
    // regardless of whether the screen coordinate is on the left, right, top or bottom
    const startDist = (origY - (top + 4.0)) / sinPitch;
    const startX = origX + g[0] * startDist;
    const startY = origY + g[1] * startDist;
    const startZ = origZ + g[2] * startDist;

    const surfaceDist = (t) => (top + 4.0) + g[1] * t - heightfield.height(startX + g[0] * t, startZ + g[2] * t);
    const maxT = (top + 10.0) / sinPitch;

    let prevT = 0.0;
    let currT = 0.0;

    for (let step = 0; step < 400 && currT < maxT; step++) {
      const d = surfaceDist(currT);
      if (d < 0.0) break;
      prevT = currT;
      currT += Math.max(0.4 * d, 0.02);
    }

    let lowT = prevT;
    let highT = Math.min(currT, maxT);

    // 6-step binary bisection
    for (let b = 0; b < 6; b++) {
      const midT = (lowT + highT) * 0.5;
      if (surfaceDist(midT) < 0.0) highT = midT;
      else lowT = midT;
    }

    const finalT = highT;
    const hitX = startX + g[0] * finalT;
    const hitZ = startZ + g[2] * finalT;
    const hitY = (top + 4.0) + g[1] * finalT;
    const norm = heightfield.normal(hitX, hitZ);

    const lit = roughLight(norm, eye, light);

    return {
      x: hitX,
      y: hitY,
      z: hitZ,
      distance: finalT + startDist,
      normal: norm,
      lit,
      dark: clamp01(1.0 - lit),
    };
  }

  return { hit, ray: g, eye, light };
}

// ── Orographic 192x192 Wind Grid Simulation ───────────────────────────────────
function createWindGrid(terrainParams, heightfield, camera) {
  const gridSize = 192;
  const windAngle = terrainParams.angle;
  const windDirX = Math.cos(windAngle);
  const windDirZ = Math.sin(windAngle);
  const windSpeed = terrainParams.wind || 1.0;

  // Compute terrain bounding box in world space
  const cell = 0.8;
  const originX = -gridSize * cell * 0.5;
  const originZ = -gridSize * cell * 0.5;

  const heights = new Float32Array(gridSize * gridSize);
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const wx = originX + (gx + 0.5) * cell;
      const wz = originZ + (gy + 0.5) * cell;
      heights[gy * gridSize + gx] = heightfield.height(wx, wz);
    }
  }

  // Precompute wind deflection and lift vectors
  const flow = new Float32Array(gridSize * gridSize * 4); // [vx, vz, lift, baseH]
  let maxLift = 0.0;

  for (let gy = 1; gy < gridSize - 1; gy++) {
    for (let gx = 1; gx < gridSize - 1; gx++) {
      const idx = gy * gridSize + gx;
      const hL = heights[idx - 1];
      const hR = heights[idx + 1];
      const hD = heights[idx - gridSize];
      const hU = heights[idx + gridSize];

      const slopeX = (hR - hL) / (2.0 * cell);
      const slopeZ = (hU - hD) / (2.0 * cell);
      const slopeMag = Math.hypot(slopeX, slopeZ);

      // Deflection around ridges
      let vx = windDirX;
      let vz = windDirZ;
      let lift = 0.0;

      if (slopeMag > 1e-4) {
        const dotWindSlope = (windDirX * slopeX + windDirZ * slopeZ) / slopeMag;
        lift = Math.max(0.0, dotWindSlope) * 0.5 * windSpeed;
        vx -= (slopeX / slopeMag) * lift * 0.4;
        vz -= (slopeZ / slopeMag) * lift * 0.4;
      }

      const vLen = Math.hypot(vx, vz) || 1.0;
      flow[idx * 4 + 0] = (vx / vLen) * windSpeed;
      flow[idx * 4 + 1] = (vz / vLen) * windSpeed;
      flow[idx * 4 + 2] = lift;
      flow[idx * 4 + 3] = heights[idx];

      if (lift > maxLift) maxLift = lift;
    }
  }

  function sampleFlow(wx, wz) {
    const gx = (wx - originX) / cell - 0.5;
    const gz = (wz - originZ) / cell - 0.5;
    const ix = Math.min(gridSize - 2, Math.max(0, Math.floor(gx)));
    const iz = Math.min(gridSize - 2, Math.max(0, Math.floor(gz)));
    const fx = gx - ix;
    const fz = gz - iz;

    const i00 = (iz * gridSize + ix) * 4;
    const i10 = (iz * gridSize + (ix + 1)) * 4;
    const i01 = ((iz + 1) * gridSize + ix) * 4;
    const i11 = ((iz + 1) * gridSize + (ix + 1)) * 4;

    const vx = (flow[i00] * (1 - fx) + flow[i10] * fx) * (1 - fz) + (flow[i01] * (1 - fx) + flow[i11] * fx) * fz;
    const vz = (flow[i00 + 1] * (1 - fx) + flow[i10 + 1] * fx) * (1 - fz) + (flow[i01 + 1] * (1 - fx) + flow[i11 + 1] * fx) * fz;
    const lift = (flow[i00 + 2] * (1 - fx) + flow[i10 + 2] * fx) * (1 - fz) + (flow[i01 + 2] * (1 - fx) + flow[i11 + 2] * fx) * fz;
    return [vx, vz, lift];
  }

  return { sampleFlow, originX, originZ, cell, gridSize, maxLift };
}

// ── Volumetric Fog & Atmospheric Extinction ────────────────────────────────────
function createAtmosphere(terrainParams, heightfield, camera, windGrid, noiseFunc) {
  const fogBase = 0.42 * terrainParams.top;
  const fogCeiling = fogBase + 8.0 + windGrid.maxLift;
  const windSpeed = terrainParams.wind || 1.0;
  const windDirX = Math.cos(terrainParams.angle);
  const windDirZ = Math.sin(terrainParams.angle);

  function swells(wx, wz, time) {
    const sway = 2.5 * (1.0 - Math.cos(2.0 * Math.PI * (time % 10.0) / 10.0));
    const sx = (wx - windDirX * 0.2 * windSpeed * sway) / 24.0 + terrainParams.offset[0] + 517.0;
    const sz = (wz - windDirZ * 0.2 * windSpeed * sway) / 24.0 + terrainParams.offset[1] + 517.0;
    return fogBase + 10.0 * (fbmRotated(noiseFunc, sx, sz, 3) - 0.5);
  }

  function billows(wx, wz, flowX, flowZ, time) {
    const run = (time * 0.3) % 10.0;
    const freq = 1.0 / 9.0;
    let sum = 0.0;
    let total = 0.0;
    let weight = 1.0;

    for (let o = 0; o < 3; o++) {
      const drift = 0.6 * windSpeed * (1.0 + 0.5 * o) * run;
      const qx = (wx - flowX * drift) * freq + terrainParams.offset[0] - 517.0 + 31.0 * o;
      const qz = (wz - flowZ * drift) * freq + terrainParams.offset[1] - 517.0;
      sum += weight * Math.abs(2.0 * noiseFunc(qx, qz) - 1.0);
      total += weight;
      weight *= 0.5;
    }
    return sum / total;
  }

  function wisps(hitX, hitY, hitZ, flowX, flowZ, time) {
    const run = (time * 0.3) % 10.0;
    const qx = hitX - flowX * 1.2 * windSpeed * run;
    const qz = hitZ - flowZ * 1.2 * windSpeed * run;
    const along = (qx * windDirX + qz * windDirZ) / 8.0 + terrainParams.offset[0] + 517.0;
    const across = (qz * windDirX - qx * windDirZ) / 4.0 + terrainParams.offset[1] + 517.0;
    const up = hitY / 1.5 + 0.05 * run;
    const n = noiseFunc(along + up, across) + noiseFunc(along, across - up) - 1.0;
    return Math.min(1.0, Math.max(-1.0, 2.5 * n));
  }

  // Marches 20 stratified steps through the fog
  function fogThrough(hit, time = 0.0) {
    const rise = fogCeiling - hit.y;
    if (rise <= 0.0) return { clear: 1.0, tone: 0.0 };

    const stride = rise / -camera.ray[1] / 20.0;
    let clear = 1.0;
    let tone = 0.0;

    for (let i = 19; i >= 0; i--) {
      const s = (i + 0.5) * stride;
      const px = hit.x - camera.ray[0] * s;
      const py = hit.y - camera.ray[1] * s;
      const pz = hit.z - camera.ray[2] * s;

      const [flowX, flowZ, lift] = windGrid.sampleFlow(px, pz);
      const baseH = swells(px, pz, time);
      const puffs = billows(px, pz, flowX, flowZ, time) - 0.35;
      const fogTop = baseH + lift + 3.5 * puffs;

      const depth = fogTop - py;
      if (depth <= 0.0) continue;

      const wispVal = wisps(px, py, pz, flowX, flowZ, time);
      const thickness = Math.max(smoothstep(0.0, 0.75, depth), 0.5 * smoothstep(0.0, 2.5, depth + 2.5 * wispVal));
      if (thickness <= 0.0) continue;

      const fogExtinction = 1.0 - Math.exp(-1.0 * thickness * stride);
      const lit = 0.5; // directional in-scattering
      tone += clear * fogExtinction * (0.0 + 0.15 * lit);
      clear *= (1.0 - fogExtinction);
    }

    return { clear, tone };
  }

  return { fogThrough, fogBase, fogCeiling };
}
