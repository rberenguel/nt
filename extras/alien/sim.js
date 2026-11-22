// High-performance Struct-of-Arrays (SoA) Artificial Life Simulation Engine
// Inspired by chrxh/alien: elastic multicellular organisms, energy/signal networks,
// muscles, sensors, attackers, constructors, open-ended mutation, and spatial hashing.

(function () {
  const {
    CELL_TYPE,
    BRAIN_SIZE,
    cloneGenome,
    createStarterGenomes,
    mutateGenome,
    crossoverGenomes,
  } = window.AlienGenomes;

  const MAX_CELLS = 7168;
  const MAX_BONDS = 14336;
  const MAX_MOTES = 6000;
  const MAX_ORGS = 420;

  const BASE_CELL_RADIUS = 3.2;
  const GRID_CELL_SIZE = 32;

  function mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  class AlienSim {
    constructor(worldW, worldH, seed) {
      this.worldW = worldW;
      this.worldH = worldH;
      this.seed = seed || ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
      this.rng = mulberry32(this.seed);

      this.simTime = 0;
      this.tickCount = 0;
      this.totalBirths = 0;
      this.totalCrossovers = 0;
      this.maxGeneration = 1;
      this.popHistory = [];
      this.lastSampleTime = -10;
      this.avgSpeed = 0;
      this.avgCells = 0;
      this.nextOrgUid = 1;
      this.blooms = [];
      this.popHistory = []; // Array of [timeSec, preyCount, predCount] sampled every 5s
      this.lastSampleTime = -10;
      this.initBlooms();

      // ── Cell SoA Buffers ────────────────────────────────────────────────────
      this.cellAlive = new Uint8Array(MAX_CELLS);
      this.cellType = new Uint8Array(MAX_CELLS);
      this.cellOrg = new Int16Array(MAX_CELLS); // index into this.orgs
      this.cellX = new Float32Array(MAX_CELLS);
      this.cellY = new Float32Array(MAX_CELLS);
      this.cellVx = new Float32Array(MAX_CELLS);
      this.cellVy = new Float32Array(MAX_CELLS);
      this.cellAngle = new Float32Array(MAX_CELLS);
      this.cellRadius = new Float32Array(MAX_CELLS);
      this.cellEnergy = new Float32Array(MAX_CELLS);
      this.cellSignal = new Float32Array(MAX_CELLS); // 0..1 visual & neural excitation
      this.cellSteer = new Float32Array(MAX_CELLS);  // -1..1 steering impulse
      this.cellHue = new Float32Array(MAX_CELLS);
      this.cellMuscleAmp = new Float32Array(MAX_CELLS);
      this.cellMusclePhase = new Float32Array(MAX_CELLS);
      this.cellSenseWeight = new Float32Array(MAX_CELLS);
      this.cellFreeList = new Int32Array(MAX_CELLS);
      this.cellFreeTop = 0;
      this.activeCellCount = 0;

      // ── Bond SoA Buffers ────────────────────────────────────────────────────
      this.bondAlive = new Uint8Array(MAX_BONDS);
      this.bondA = new Int32Array(MAX_BONDS);
      this.bondB = new Int32Array(MAX_BONDS);
      this.bondRestLen = new Float32Array(MAX_BONDS);
      this.bondRestAngle = new Float32Array(MAX_BONDS);
      this.bondIsTree = new Uint8Array(MAX_BONDS);
      this.bondPulse = new Float32Array(MAX_BONDS); // 0..1 travelling signal highlight
      this.bondStress = new Float32Array(MAX_BONDS);
      this.bondFreeList = new Int32Array(MAX_BONDS);
      this.bondFreeTop = 0;
      this.activeBondCount = 0;

      // ── Free Energy Motes SoA Buffers ───────────────────────────────────────
      this.moteAlive = new Uint8Array(MAX_MOTES);
      this.moteX = new Float32Array(MAX_MOTES);
      this.moteY = new Float32Array(MAX_MOTES);
      this.moteVx = new Float32Array(MAX_MOTES);
      this.moteVy = new Float32Array(MAX_MOTES);
      this.moteEnergy = new Float32Array(MAX_MOTES);
      this.moteHue = new Float32Array(MAX_MOTES);
      this.moteFreeList = new Int32Array(MAX_MOTES);
      this.moteFreeTop = 0;
      this.activeMoteCount = 0;

      // ── Organisms Metadata ──────────────────────────────────────────────────
      this.orgs = new Array(MAX_ORGS).fill(null);
      this.activeOrgCount = 0;
      this.hallOfFame = []; // Top evolved genomes

      // ── Spatial Hash Grid ───────────────────────────────────────────────────
      this.gridW = Math.max(8, Math.ceil(worldW / GRID_CELL_SIZE));
      this.gridH = Math.max(8, Math.ceil(worldH / GRID_CELL_SIZE));
      this.gridSize = this.gridW * this.gridH;
      this.cellGridHead = new Int32Array(this.gridSize);
      this.cellGridNext = new Int32Array(MAX_CELLS);
      this.moteGridHead = new Int32Array(this.gridSize);
      this.moteGridNext = new Int32Array(MAX_MOTES);

      // ── Packed GPU Upload Buffers (reused every frame, zero GC) ─────────────
      // Cell instance: [x, y, radius, type, hue, energyNorm, signal, angle] = 8 floats
      this.gpuCells = new Float32Array(MAX_CELLS * 8);
      this.gpuCellCount = 0;
      // Bond instance: [ax, ay, bx, by, hue, energyNorm, pulse, stress] = 8 floats
      this.gpuBonds = new Float32Array(MAX_BONDS * 8);
      this.gpuBondCount = 0;
      // Mote vertex: [x, y, energyNorm, hue] = 4 floats
      this.gpuMotes = new Float32Array(MAX_MOTES * 4);
      this.gpuMoteCount = 0;

      this.resetPools();
    }

    resetPools() {
      this.cellAlive.fill(0);
      this.bondAlive.fill(0);
      this.moteAlive.fill(0);
      this.orgs.fill(null);

      for (let i = 0; i < MAX_CELLS; i++) this.cellFreeList[i] = MAX_CELLS - 1 - i;
      this.cellFreeTop = MAX_CELLS;
      this.activeCellCount = 0;

      for (let i = 0; i < MAX_BONDS; i++) this.bondFreeList[i] = MAX_BONDS - 1 - i;
      this.bondFreeTop = MAX_BONDS;
      this.activeBondCount = 0;

      for (let i = 0; i < MAX_MOTES; i++) this.moteFreeList[i] = MAX_MOTES - 1 - i;
      this.moteFreeTop = MAX_MOTES;
      this.activeMoteCount = 0;

      this.activeOrgCount = 0;
    }

    resizeWorld(worldW, worldH) {
      if (Math.abs(worldW - this.worldW) < 1 && Math.abs(worldH - this.worldH) < 1) return;
      const sx = worldW / this.worldW;
      const sy = worldH / this.worldH;
      this.worldW = worldW;
      this.worldH = worldH;

      for (let i = 0; i < MAX_CELLS; i++) {
        if (this.cellAlive[i]) {
          this.cellX[i] = ((this.cellX[i] * sx) % worldW + worldW) % worldW;
          this.cellY[i] = ((this.cellY[i] * sy) % worldH + worldH) % worldH;
        }
      }
      for (let i = 0; i < MAX_MOTES; i++) {
        if (this.moteAlive[i]) {
          this.moteX[i] = ((this.moteX[i] * sx) % worldW + worldW) % worldW;
          this.moteY[i] = ((this.moteY[i] * sy) % worldH + worldH) % worldH;
        }
      }

      this.gridW = Math.max(8, Math.ceil(worldW / GRID_CELL_SIZE));
      this.gridH = Math.max(8, Math.ceil(worldH / GRID_CELL_SIZE));
      this.gridSize = this.gridW * this.gridH;
      this.cellGridHead = new Int32Array(this.gridSize);
      this.moteGridHead = new Int32Array(this.gridSize);
    }

    wrapX(x) {
      const w = this.worldW;
      return x < 0 ? x + w : x >= w ? x - w : x;
    }

    wrapY(y) {
      const h = this.worldH;
      return y < 0 ? y + h : y >= h ? y - h : y;
    }

    wrapDx(dx) {
      const hw = this.worldW * 0.5;
      if (dx > hw) return dx - this.worldW;
      if (dx < -hw) return dx + this.worldW;
      return dx;
    }

    wrapDy(dy) {
      const hh = this.worldH * 0.5;
      if (dy > hh) return dy - this.worldH;
      if (dy < -hh) return dy + this.worldH;
      return dy;
    }

    allocCell() {
      if (this.cellFreeTop <= 0) return -1;
      const idx = this.cellFreeList[--this.cellFreeTop];
      this.cellAlive[idx] = 1;
      this.activeCellCount++;
      return idx;
    }

    freeCell(idx) {
      if (!this.cellAlive[idx]) return;
      this.cellAlive[idx] = 0;
      const orgIdx = this.cellOrg[idx];
      if (orgIdx >= 0 && this.orgs[orgIdx]) {
        this.orgs[orgIdx].cellCount--;
        const org = this.orgs[orgIdx];
        if (this.cellType[idx] === CELL_TYPE.VENOM && org.venomCount > 0) org.venomCount--;
        if (this.cellType[idx] === CELL_TYPE.DEFENDER && org.defenderCount > 0) org.defenderCount--;
        if (org.cellCount <= 0) {
          this.orgs[orgIdx] = null;
          this.activeOrgCount--;
        } else if (org.rootCell === idx || org.constructorCell === idx || org.sensorCell === idx || org.venomCell === idx) {
          // Promote surviving cells so losing the original root cell never turns an organism into a brainless zombie!
          if (org.rootCell === idx) org.rootCell = -1;
          if (org.constructorCell === idx) org.constructorCell = -1;
          if (org.sensorCell === idx) org.sensorCell = -1;
          if (org.venomCell === idx) org.venomCell = -1;
          for (let k = 0; k < MAX_CELLS; k++) {
            if (!this.cellAlive[k] || this.cellOrg[k] !== orgIdx) continue;
            if (org.rootCell < 0) org.rootCell = k;
            if (org.constructorCell < 0 && this.cellType[k] === CELL_TYPE.CONSTRUCTOR) org.constructorCell = k;
            if (org.sensorCell < 0 && this.cellType[k] === CELL_TYPE.SENSOR) org.sensorCell = k;
            if (org.venomCell < 0 && this.cellType[k] === CELL_TYPE.VENOM) org.venomCell = k;
          }
          org.hasSensor = org.sensorCell >= 0;
        }
      }
      this.cellFreeList[this.cellFreeTop++] = idx;
      this.activeCellCount--;
    }

    allocBond() {
      if (this.bondFreeTop <= 0) return -1;
      const idx = this.bondFreeList[--this.bondFreeTop];
      this.bondAlive[idx] = 1;
      this.activeBondCount++;
      return idx;
    }

    freeBond(idx) {
      if (!this.bondAlive[idx]) return;
      this.bondAlive[idx] = 0;
      this.bondFreeList[this.bondFreeTop++] = idx;
      this.activeBondCount--;
    }

    allocMote() {
      if (this.moteFreeTop <= 0) return -1;
      const idx = this.moteFreeList[--this.moteFreeTop];
      this.moteAlive[idx] = 1;
      this.activeMoteCount++;
      return idx;
    }

    freeMote(idx) {
      if (!this.moteAlive[idx]) return;
      this.moteAlive[idx] = 0;
      this.moteFreeList[this.moteFreeTop++] = idx;
      this.activeMoteCount--;
    }

    allocOrgSlot() {
      for (let i = 0; i < MAX_ORGS; i++) {
        if (!this.orgs[i]) return i;
      }
      return -1;
    }

    spawnMote(x, y, energy = 18, hue = 0.52, vx = 0, vy = 0) {
      const m = this.allocMote();
      if (m < 0) return -1;
      this.moteX[m] = this.wrapX(x);
      this.moteY[m] = this.wrapY(y);
      this.moteVx[m] = vx;
      this.moteVy[m] = vy;
      this.moteEnergy[m] = energy;
      this.moteHue[m] = hue;
      return m;
    }

    spawnOrganism(genome, x, y, baseAngle, startEnergyPerCell = 58, generation = 1) {
      const nodes = genome.nodes;
      if (!nodes || nodes.length === 0) return -1;
      if (this.cellFreeTop < nodes.length + 4 || this.bondFreeTop < nodes.length * 2 + 4) {
        return -1;
      }
      const orgIdx = this.allocOrgSlot();
      if (orgIdx < 0) return -1;

      const cellIndices = new Int32Array(nodes.length);
      const localAngles = new Float32Array(nodes.length);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const ci = this.allocCell();
        cellIndices[i] = ci;

        let cx = x;
        let cy = y;
        let ang = baseAngle;
        if (i > 0 && n.parent >= 0 && n.parent < i) {
          const pIdx = cellIndices[n.parent];
          ang = localAngles[n.parent] + n.angle;
          cx = this.cellX[pIdx] + Math.cos(ang) * n.dist;
          cy = this.cellY[pIdx] + Math.sin(ang) * n.dist;
        }
        localAngles[i] = ang;

        this.cellType[ci] = n.type;
        this.cellOrg[ci] = orgIdx;
        this.cellX[ci] = this.wrapX(cx);
        this.cellY[ci] = this.wrapY(cy);
        this.cellVx[ci] = (this.rng() - 0.5) * 8;
        this.cellVy[ci] = (this.rng() - 0.5) * 8;
        this.cellAngle[ci] = ang;
        this.cellRadius[ci] = BASE_CELL_RADIUS * clamp(n.radius || 1.0, 0.65, 1.4);
        this.cellEnergy[ci] = startEnergyPerCell;
        this.cellSignal[ci] = 0.0;
        this.cellSteer[ci] = 0;
        this.cellHue[ci] = genome.hue;
        this.cellMuscleAmp[ci] = n.muscleAmp || 0;
        this.cellMusclePhase[ci] = n.musclePhase || 0;
        this.cellSenseWeight[ci] = n.senseWeight || 0;

        // Tree bond to parent
        if (i > 0 && n.parent >= 0 && n.parent < i) {
          const bi = this.allocBond();
          if (bi >= 0) {
            this.bondA[bi] = cellIndices[n.parent];
            this.bondB[bi] = ci;
            this.bondRestLen[bi] = clamp(n.dist || 14, 10, 22);
            this.bondRestAngle[bi] = n.angle;
            this.bondIsTree[bi] = 1;
            this.bondPulse[bi] = 0;
            this.bondStress[bi] = 0;
          }
        }
      }

      // Cross-bonds (trusses / rings)
      const extras = genome.extraBonds || [];
      for (let i = 0; i < extras.length; i++) {
        const a = extras[i][0];
        const b = extras[i][1];
        if (a >= 0 && b >= 0 && a < nodes.length && b < nodes.length && a !== b) {
          const ca = cellIndices[a];
          const cb = cellIndices[b];
          const dx = this.wrapDx(this.cellX[cb] - this.cellX[ca]);
          const dy = this.wrapDy(this.cellY[cb] - this.cellY[ca]);
          const dist = Math.hypot(dx, dy);
          if (dist > 6 && dist < 34) {
            const bi = this.allocBond();
            if (bi >= 0) {
              this.bondA[bi] = ca;
              this.bondB[bi] = cb;
              this.bondRestLen[bi] = dist;
              this.bondRestAngle[bi] = 0;
              this.bondIsTree[bi] = 0;
              this.bondPulse[bi] = 0;
              this.bondStress[bi] = 0;
            }
          }
        }
      }

      let sensorCount = 0;
      let muscleCount = 0;
      let hasAttacker = false;
      let venomCount = 0;
      let defenderCount = 0;
      let sensorCell = -1;
      let constructorCell = -1;
      let venomCell = -1;
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].type === CELL_TYPE.SENSOR) {
          sensorCount++;
          if (sensorCell < 0) sensorCell = cellIndices[i];
        } else if (nodes[i].type === CELL_TYPE.ATTACKER) {
          hasAttacker = true;
        } else if (nodes[i].type === CELL_TYPE.VENOM) {
          venomCount++;
          if (venomCell < 0) venomCell = cellIndices[i];
        } else if (nodes[i].type === CELL_TYPE.DEFENDER) {
          defenderCount++;
        } else if (nodes[i].type === CELL_TYPE.MUSCLE) {
          muscleCount++;
        } else if (nodes[i].type === CELL_TYPE.CONSTRUCTOR && constructorCell < 0) {
          constructorCell = cellIndices[i];
        }
      }

      const cloned = cloneGenome(genome);
      this.orgs[orgIdx] = {
        uid: this.nextOrgUid++,
        genome: cloned,
        behavior: cloned.behavior,
        hue: cloned.hue,
        oscFreq: cloned.oscFreq || 2.2,
        generation,
        age: 0,
        offspring: 0,
        cellCount: nodes.length,
        rootCell: cellIndices[0],
        sensorCell,
        constructorCell,
        venomCell,
        sensorCount,
        muscleCount,
        venomCount,
        defenderCount,
        hasSensor: sensorCount > 0,
        hasAttacker,
        hasVenom: venomCount > 0,
        hasDefender: defenderCount > 0,
        hasMuscle: muscleCount > 0,
        steerCmd: 0,
        throttle: 0.4,
        injuredTimer: 0,
        reproCooldown: 3.5 + this.rng() * 2.5,
        brainW: new Float32Array(cloned.brain),
        brainE: new Float32Array(BRAIN_SIZE),
        pendingReward: 0,
        prevTargetDist: Infinity,
        prevThreatDist: Infinity,
      };
      this.activeOrgCount++;
      if (generation > this.maxGeneration) this.maxGeneration = generation;

      return orgIdx;
    }

    initBlooms() {
      const count = Math.max(4, Math.min(8, Math.round(this.worldW / 950)));
      this.blooms = [];
      for (let i = 0; i < count; i++) {
        const ang = this.rng() * Math.PI * 2;
        this.blooms.push({
          x: this.rng() * this.worldW,
          y: this.rng() * this.worldH,
          vx: Math.cos(ang) * (16 + this.rng() * 18),
          vy: Math.sin(ang) * (16 + this.rng() * 18),
          radius: 260 + this.rng() * 180,
          hue: 0.34 + (i / count) * 0.24,
        });
      }
    }

    spawnBloomMote() {
      if (this.blooms.length > 0 && this.rng() < 0.85) {
        const b = this.blooms[Math.floor(this.rng() * this.blooms.length)];
        const a = this.rng() * Math.PI * 2;
        const r = Math.sqrt(this.rng()) * b.radius;
        return this.spawnMote(
          b.x + Math.cos(a) * r,
          b.y + Math.sin(a) * r,
          26 + this.rng() * 18,
          b.hue + (this.rng() - 0.5) * 0.12
        );
      }
      return this.spawnMote(
        this.rng() * this.worldW,
        this.rng() * this.worldH,
        20 + this.rng() * 14,
        0.45 + (this.rng() - 0.5) * 0.2
      );
    }

    seedFreshWorld() {
      this.resetPools();
      this.initBlooms();
      this.simTime = 0;
      this.tickCount = 0;
      this.totalBirths = 0;
      this.totalCrossovers = 0;
      this.maxGeneration = 1;
      this.popHistory = [];
      this.lastSampleTime = -10;

      const starters = createStarterGenomes();
      const areaScale = clamp((this.worldW * this.worldH) / (5330 * 3000), 0.55, 2.2);
      const numOrgs = Math.round(64 * areaScale);

      // Keep ~70% grazers/swimmers/armored/venomous prey and ~30% predators
      const preyStarters = [starters[0], starters[1], starters[3], starters[5], starters[6], starters[7]];
      const predStarters = [starters[2], starters[4]];

      for (let i = 0; i < numOrgs; i++) {
        const isPred = i % 10 < 3;
        const pool = isPred ? predStarters : preyStarters;
        const base = pool[i % pool.length];
        const g = i < starters.length * 2 ? cloneGenome(base) : mutateGenome(base, this.rng);
        const x = this.rng() * this.worldW;
        const y = this.rng() * this.worldH;
        const ang = this.rng() * Math.PI * 2;
        this.spawnOrganism(g, x, y, ang, 58 + this.rng() * 20, 1);
      }

      // Seed patchy nutrient blooms across the large universe
      const numMotes = Math.min(MAX_MOTES - 500, Math.round(1400 * areaScale));
      for (let i = 0; i < numMotes; i++) {
        this.spawnBloomMote();
      }
    }

    // ── Interactive Mouse Actions ─────────────────────────────────────────────
    dropEnergyBurst(worldX, worldY, count = 24) {
      for (let i = 0; i < count; i++) {
        const a = this.rng() * Math.PI * 2;
        const r = Math.sqrt(this.rng()) * 36;
        const spd = 12 + this.rng() * 28;
        this.spawnMote(
          worldX + Math.cos(a) * r,
          worldY + Math.sin(a) * r,
          24 + this.rng() * 14,
          0.16 + this.rng() * 0.36,
          Math.cos(a) * spd,
          Math.sin(a) * spd
        );
      }
    }

    applyRadialImpulse(worldX, worldY, radius = 190, strength = 140) {
      const r2 = radius * radius;
      for (let i = 0; i < MAX_CELLS; i++) {
        if (!this.cellAlive[i]) continue;
        const dx = this.wrapDx(this.cellX[i] - worldX);
        const dy = this.wrapDy(this.cellY[i] - worldY);
        const d2 = dx * dx + dy * dy;
        if (d2 > 1 && d2 < r2) {
          const d = Math.sqrt(d2);
          const f = (1 - d / radius) * strength;
          this.cellVx[i] += (dx / d) * f;
          this.cellVy[i] += (dy / d) * f;
          this.cellSignal[i] = Math.min(1, this.cellSignal[i] + 0.5);
        }
      }
      for (let i = 0; i < MAX_MOTES; i++) {
        if (!this.moteAlive[i]) continue;
        const dx = this.wrapDx(this.moteX[i] - worldX);
        const dy = this.wrapDy(this.moteY[i] - worldY);
        const d2 = dx * dx + dy * dy;
        if (d2 > 1 && d2 < r2) {
          const d = Math.sqrt(d2);
          const f = (1 - d / radius) * strength * 1.3;
          this.moteVx[i] += (dx / d) * f;
          this.moteVy[i] += (dy / d) * f;
        }
      }
    }

    // ── Spatial Hash Grid Rebuild ─────────────────────────────────────────────
    rebuildGrid() {
      this.cellGridHead.fill(-1);
      this.moteGridHead.fill(-1);
      const gw = this.gridW;
      const gh = this.gridH;
      const inv = 1 / GRID_CELL_SIZE;

      for (let i = 0; i < MAX_CELLS; i++) {
        if (!this.cellAlive[i]) continue;
        const gx = Math.min(gw - 1, (this.cellX[i] * inv) | 0);
        const gy = Math.min(gh - 1, (this.cellY[i] * inv) | 0);
        const h = gy * gw + gx;
        this.cellGridNext[i] = this.cellGridHead[h];
        this.cellGridHead[h] = i;
      }

      for (let i = 0; i < MAX_MOTES; i++) {
        if (!this.moteAlive[i]) continue;
        const gx = Math.min(gw - 1, (this.moteX[i] * inv) | 0);
        const gy = Math.min(gh - 1, (this.moteY[i] * inv) | 0);
        const h = gy * gw + gx;
        this.moteGridNext[i] = this.moteGridHead[h];
        this.moteGridHead[h] = i;
      }
    }

    // ── Main Simulation Step ──────────────────────────────────────────────────
    step(dt) {
      dt = Math.min(dt, 0.033);
      this.simTime += dt;
      this.tickCount++;

      // Advance organism timers
      for (let o = 0; o < MAX_ORGS; o++) {
        const org = this.orgs[o];
        if (!org) continue;
        org.age += dt;
        if (org.reproCooldown > 0) org.reproCooldown -= dt;
        if (org.injuredTimer > 0) org.injuredTimer = Math.max(0, org.injuredTimer - dt);
      }

      this.rebuildGrid();

      // 0. Organism-level long-range vision & sensory-motor steering
      this.stepBrains(dt);

      // 1. Bond spring forces, angular restoration, muscles, energy & signal diffusion
      this.stepBonds(dt);

      // 2. Spatial collisions, predator attacks, mote absorption
      this.stepInteractions(dt);

      // 3. Cell integration, anisotropic fluid drag, metabolism, death & reproduction
      this.stepCells(dt);

      // 4. Energy motes drift & ambient solar replenishment
      this.stepMotes(dt);

      // 5. Ecosystem watchdog (keeps evolution running indefinitely)
      if ((this.tickCount & 63) === 0) {
        this.runWatchdog();
      }
    }

    // Sync live learned neural weights back into org.genome.brain for inheritance & persistence
    syncOrgBrainToGenome(org) {
      if (!org || !org.brainW || !org.genome) return;
      const arr = new Array(BRAIN_SIZE);
      for (let k = 0; k < BRAIN_SIZE; k++) {
        arr[k] = Number(org.brainW[k].toFixed(4));
      }
      org.genome.brain = arr;
    }

    // Long-range sensory-motor 6->6->2 MLP brain with online 3-factor eligibility-trace RL
    stepBrains(dt) {
      const traceDecay = Math.exp(-2.2 * dt);
      const lr = 0.045;
      const inp = new Float32Array(6);
      const hid = new Float32Array(6);

      for (let o = 0; o < MAX_ORGS; o++) {
        const org = this.orgs[o];
        if (!org || org.rootCell < 0 || !this.cellAlive[org.rootCell]) continue;
        const rc = org.rootCell;
        const rx = this.cellX[rc];
        const ry = this.cellY[rc];
        const rAng = this.cellAngle[rc];
        const beh = org.behavior;

        if (!org.hasSensor) {
          org.steerCmd *= 0.92;
          org.throttle = 0.45;
          org.pendingReward = 0;
          continue;
        }

        const sensorBonus = 1.0 + Math.max(0, (org.sensorCount || 1) - 1) * 0.14;
        const baseVision = (beh.visionRange || 380) * sensorBonus;
        const scanRange = org.hasAttacker
          ? Math.max(baseVision, 740)
          : Math.max(baseVision, 460);
        const scanRange2 = scanRange * scanRange;

        const muscleRatio = (org.muscleCount || 0) / Math.max(1, org.cellCount);
        const leadTime = org.hasAttacker
          ? Math.min(0.85, (org.sensorCount || 1) * 0.25 + muscleRatio * 0.45)
          : 0;

        let targetX = 0;
        let targetY = 0;
        let targetDist = Infinity;
        let scentX = 0;
        let scentY = 0;
        let scentDist = Infinity;
        const predScentRange2 = 2400 * 2400;
        let threatX = 0;
        let threatY = 0;
        let threatDist = Infinity;

        // 1. Scan other organisms within acute vision (plus long-range scent for predators)
        for (let otherIdx = 0; otherIdx < MAX_ORGS; otherIdx++) {
          if (otherIdx === o) continue;
          const other = this.orgs[otherIdx];
          if (!other || other.rootCell < 0 || !this.cellAlive[other.rootCell]) continue;
          const orc = other.rootCell;
          const dx = this.wrapDx(this.cellX[orc] - rx);
          const dy = this.wrapDy(this.cellY[orc] - ry);
          const d2 = dx * dx + dy * dy;
          if (d2 < 20) continue;

          if (d2 <= scanRange2) {
            const d = Math.sqrt(d2);
            if (other.hasAttacker && !org.hasAttacker) {
              if (d < threatDist) {
                threatDist = d;
                threatX = dx;
                threatY = dy;
              }
            } else if (org.hasAttacker && !other.hasAttacker) {
              // Agile predators still hunt venomous prey, flanking around the actual Venom spine at close range!
              const isVenomousThreat = other.venomCount > org.defenderCount;
              // Slightly prefer non-venomous prey when both are nearby, but still pursue venomous prey
              const effectiveD = isVenomousThreat ? d * 1.35 : d;
              if (effectiveD < targetDist) {
                targetDist = effectiveD;
                // Aim at vulnerable Constructor/body rather than the Venom tip
                const aimCell =
                  other.constructorCell >= 0 && this.cellAlive[other.constructorCell]
                    ? other.constructorCell
                    : orc;
                const adx = this.wrapDx(this.cellX[aimCell] - rx);
                const ady = this.wrapDy(this.cellY[aimCell] - ry);
                targetX = adx + this.cellVx[aimCell] * leadTime;
                targetY = ady + this.cellVy[aimCell] * leadTime;
              }
              if (isVenomousThreat && d < 65) {
                // Tight local danger signal right around the Venom cell (~1 body length) for surgical flanking
                const vc =
                  other.venomCell >= 0 && this.cellAlive[other.venomCell]
                    ? other.venomCell
                    : orc;
                const vdx = this.wrapDx(this.cellX[vc] - rx);
                const vdy = this.wrapDy(this.cellY[vc] - ry);
                const vd = Math.hypot(vdx, vdy);
                if (vd < 55 && vd < threatDist) {
                  threatDist = vd;
                  threatX = vdx;
                  threatY = vdy;
                }
              }
            } else if (
              !org.hasAttacker &&
              org.reproCooldown <= 0 &&
              this.cellEnergy[rc] > 74 &&
              other.age > 6 &&
              other.cellCount >= 4 &&
              this.cellEnergy[orc] > 65 &&
              d < 300 &&
              d < targetDist
            ) {
              targetDist = d;
              targetX = dx;
              targetY = dy;
            }
          } else if (org.hasAttacker && !other.hasAttacker && d2 < predScentRange2) {
            // Long-distance olfactory scent of distant prey herds across the ocean
            const d = Math.sqrt(d2);
            if (d < scentDist) {
              scentDist = d;
              scentX = dx;
              scentY = dy;
            }
          }
        }

        // If predator has no prey in acute vision, follow distant prey scent (calm cruise)
        let isLongRangeScent = false;
        if (org.hasAttacker && targetDist === Infinity && scentDist < Infinity) {
          targetDist = scentDist;
          targetX = scentX;
          targetY = scentY;
          isLongRangeScent = true;
        }

        // 2. For prey, always smell the nearest nutrient bloom across the whole ocean
        if (!org.hasAttacker && targetDist === Infinity && this.blooms.length > 0) {
          for (let b = 0; b < this.blooms.length; b++) {
            const bl = this.blooms[b];
            const dx = this.wrapDx(bl.x - rx);
            const dy = this.wrapDy(bl.y - ry);
            const d = Math.hypot(dx, dy);
            if (d > 55 && d < targetDist) {
              targetDist = d;
              targetX = dx;
              targetY = dy;
              isLongRangeScent = d > scanRange;
            }
          }
        }

        // 3. Build 6 normalized sensory inputs
        if (targetDist < Infinity) {
          const relT = wrapAngle(Math.atan2(targetY, targetX) - rAng);
          inp[0] = Math.sin(relT);
          inp[1] = Math.cos(relT);
          inp[2] = isLongRangeScent
            ? clamp(0.28 * (1.0 - targetDist / 2800), 0.06, 0.28)
            : clamp(1.0 - targetDist / scanRange, 0.15, 1.0);
        } else {
          inp[0] = Math.sin(this.simTime * 0.6 + org.uid) * 0.25;
          inp[1] = 0.4;
          inp[2] = 0.0;
        }

        if (threatDist < Infinity) {
          const relTh = wrapAngle(Math.atan2(threatY, threatX) - rAng);
          inp[3] = Math.sin(relTh);
          inp[4] = Math.cos(relTh);
          const threatSpan = org.hasAttacker ? 55 : scanRange;
          inp[5] = clamp(1.0 - threatDist / threatSpan, 0.05, 1.0);
        } else {
          inp[3] = 0.0;
          inp[4] = 0.0;
          inp[5] = 0.0;
        }

        // 4. Online RL reward (real bite/mote events + distance shaping)
        let reward = org.pendingReward;
        org.pendingReward = 0;
        if (org.hasAttacker && targetDist < Infinity && org.prevTargetDist < Infinity) {
          reward += clamp((org.prevTargetDist - targetDist) * 0.015, -0.35, 0.35);
        }
        if (threatDist < Infinity && org.prevThreatDist < Infinity) {
          // Both prey fleeing predators AND predators steering clear of venomous prey get escape shaping!
          reward += clamp((threatDist - org.prevThreatDist) * 0.018, -0.35, 0.35);
        }
        org.prevTargetDist = targetDist;
        org.prevThreatDist = threatDist;

        // 5. Apply 3-factor reward-modulated update to weights using eligibility traces
        const W = org.brainW;
        const E = org.brainE;
        if (Math.abs(reward) > 0.002) {
          const step = lr * clamp(reward, -2.5, 2.5);
          for (let k = 0; k < BRAIN_SIZE; k++) {
            W[k] = clamp(W[k] + step * E[k], -3.2, 3.2);
          }
        }

        // 6. Forward pass: 6 -> 6 (tanh) -> 2 (tanh) with tiny exploration jitter
        for (let h = 0; h < 6; h++) {
          let s = W[36 + h];
          const row = h * 6;
          for (let i = 0; i < 6; i++) s += W[row + i] * inp[i];
          hid[h] = Math.tanh(s);
        }

        let pre0 = W[54];
        let pre1 = W[55];
        for (let h = 0; h < 6; h++) {
          pre0 += W[42 + h] * hid[h];
          pre1 += W[48 + h] * hid[h];
        }

        // Small zero-mean exploration perturbation for policy-gradient eligibility
        const eps0 = (this.rng() - 0.5) * 0.16;
        const eps1 = (this.rng() - 0.5) * 0.14;
        const outSteer = Math.tanh(pre0 + eps0);
        const outThrot = Math.tanh(pre1 + eps1);

        // 7. Update eligibility traces (local backprop of exploration perturbation)
        for (let h = 0; h < 6; h++) {
          const hv = hid[h];
          const w20 = W[42 + h];
          const w21 = W[48 + h];
          E[42 + h] = E[42 + h] * traceDecay + eps0 * hv;
          E[48 + h] = E[48 + h] * traceDecay + eps1 * hv;

          const dh = (eps0 * w20 + eps1 * w21) * (1.0 - hv * hv);
          E[36 + h] = E[36 + h] * traceDecay + dh;
          const row = h * 6;
          for (let i = 0; i < 6; i++) {
            E[row + i] = E[row + i] * traceDecay + dh * inp[i];
          }
        }
        E[54] = E[54] * traceDecay + eps0;
        E[55] = E[55] * traceDecay + eps1;

        // 8. Drive organism steering & throttle
        org.steerCmd = org.steerCmd * 0.58 + outSteer * 0.42;
        const turnRate = org.hasMuscle
          ? 3.8 + muscleRatio * 4.2 + Math.min(1.4, (org.sensorCount || 1) * 0.35)
          : 1.5;
        this.cellAngle[rc] = wrapAngle(rAng + org.steerCmd * turnRate * dt);

        const baseThrot = 0.55 + (outThrot * 0.5 + 0.5) * (0.85 + (beh.sprintBoost || 0.6) + muscleRatio * 0.4);
        org.throttle = clamp(baseThrot, 0.35, 2.05);
        if (org.injuredTimer > 0) {
          org.throttle *= 0.42;
        }
      }
    }

    stepBonds(dt) {
      const kSpring = 42.0;
      const kDamp = 5.2;
      const kAng = 32.0;
      const energyCond = 3.8 * dt;
      const sigCond = 5.5 * dt;

      for (let b = 0; b < MAX_BONDS; b++) {
        if (!this.bondAlive[b]) continue;
        const a = this.bondA[b];
        const c = this.bondB[b];
        if (!this.cellAlive[a] || !this.cellAlive[c]) {
          this.freeBond(b);
          continue;
        }

        const dx = this.wrapDx(this.cellX[c] - this.cellX[a]);
        const dy = this.wrapDy(this.cellY[c] - this.cellY[a]);
        const dist = Math.hypot(dx, dy) || 0.001;
        const rest = this.bondRestLen[b];

        // Fracture only under extreme external collision stress (not self-propulsion)
        if (dist > rest * 4.5) {
          this.freeBond(b);
          continue;
        }

        const nx = dx / dist;
        const ny = dy / dist;
        const stretch = dist - rest;
        const rvx = this.cellVx[c] - this.cellVx[a];
        const rvy = this.cellVy[c] - this.cellVy[a];
        const relVel = rvx * nx + rvy * ny;

        const fMag = stretch * kSpring + relVel * kDamp;
        const fx = nx * fMag * dt;
        const fy = ny * fMag * dt;

        this.cellVx[a] += fx;
        this.cellVy[a] += fy;
        this.cellVx[c] -= fx;
        this.cellVy[c] -= fy;

        this.bondStress[b] = clamp(Math.abs(stretch) / rest, 0, 1);

        // Angular restoration & muscle undulation on tree bonds
        if (this.bondIsTree[b]) {
          const org = this.orgs[this.cellOrg[a]];
          let targetAng = this.cellAngle[a] + this.bondRestAngle[b];
          let muscleThrust = 0;
          let steerBias = 0;

          let rootAng = this.cellAngle[a];
          let hasRoot = false;
          if (org && org.rootCell >= 0 && this.cellAlive[org.rootCell]) {
            rootAng = this.cellAngle[org.rootCell];
            hasRoot = true;
          }

          if (this.cellType[c] === CELL_TYPE.MUSCLE && org) {
            const amp = this.cellMuscleAmp[c] * 0.95;
            const throttle = org.throttle || 0.6;
            const phase = this.simTime * org.oscFreq * (0.8 + throttle * 0.4) * Math.PI * 2 + this.cellMusclePhase[c];
            const swing = Math.sin(phase) * amp;
            const swingVel = Math.cos(phase) * amp * org.oscFreq;
            const cmd = clamp(org.steerCmd || 0, -1, 1);
            steerBias = cmd * 0.62;
            targetAng += swing + steerBias;

            // Differential left/right limb thrust: boosts outside fins when carving a turn!
            let diffBoost = 1.0;
            if (hasRoot) {
              const rc = org.rootCell;
              const rx = this.wrapDx(this.cellX[c] - this.cellX[rc]);
              const ry = this.wrapDy(this.cellY[c] - this.cellY[rc]);
              const side = Math.cos(rootAng) * ry - Math.sin(rootAng) * rx;
              if (Math.abs(side) > 3.0) {
                diffBoost = clamp(1.0 - Math.sign(side) * cmd * 0.65, 0.25, 1.75);
              }
            }

            // Effortful, stroke-driven propulsion: surges on each muscle beat, glides between beats
            if (this.cellEnergy[c] > 5) {
              const stroke = Math.pow(Math.abs(swingVel), 1.25);
              muscleThrust = (0.08 + stroke * 0.92) * 320.0 * throttle * diffBoost;
              this.cellEnergy[c] -= (0.32 + stroke * 0.18 * throttle) * dt;
              this.bondPulse[b] = Math.max(this.bondPulse[b], Math.min(1.0, Math.abs(swingVel) * 0.65));
            }
          }

          const curAng = Math.atan2(dy, dx);
          const angErr = wrapAngle(targetAng - curAng);

          // Tangential restoring force (swings tail/fins cleanly behind head without shoving head backward)
          const tx = -ny;
          const ty = nx;
          const af = clamp(angErr, -1.2, 1.2) * kAng * dt;
          this.cellVx[c] += tx * af * 0.85;
          this.cellVy[c] += ty * af * 0.85;
          this.cellVx[a] -= tx * af * 0.25;
          this.cellVy[a] -= ty * af * 0.25;

          // Smoothly rotate child orientation; NEVER let child bonds yank rootCell's brain-controlled heading!
          this.cellAngle[c] = wrapAngle(this.cellAngle[c] + wrapAngle(curAng - this.cellAngle[c]) * 0.35);
          if (!org || a !== org.rootCell) {
            this.cellAngle[a] = wrapAngle(this.cellAngle[a] - angErr * 0.04);
          }

          // Physical limb propulsion: 85% along actual bond (-nx,-ny), only 15% heading assist
          if (muscleThrust > 0) {
            const th = muscleThrust * dt;
            const px = hasRoot ? -nx * 0.85 + Math.cos(rootAng) * 0.15 : -nx;
            const py = hasRoot ? -ny * 0.85 + Math.sin(rootAng) * 0.15 : -ny;
            this.cellVx[a] += px * th * 0.72;
            this.cellVy[a] += py * th * 0.72;
            this.cellVx[c] += px * th * 0.42;
            this.cellVy[c] += py * th * 0.42;
          }
        }

        // Energy equalization along bond
        const ea = this.cellEnergy[a];
        const ec = this.cellEnergy[c];
        const eDiff = (ea - ec) * energyCond;
        this.cellEnergy[a] -= eDiff;
        this.cellEnergy[c] += eDiff;

        // Neural signal & steering propagation along bond
        const sa = this.cellSignal[a];
        const sc = this.cellSignal[c];
        const sDiff = (sa - sc) * sigCond;
        this.cellSignal[a] -= sDiff * 0.4;
        this.cellSignal[c] += sDiff * 0.6;

        const stDiff = (this.cellSteer[a] - this.cellSteer[c]) * sigCond;
        this.cellSteer[a] -= stDiff * 0.35;
        this.cellSteer[c] += stDiff * 0.65;

        // Visual pulse decays smoothly and brightens on strong signal/energy transfer
        const activity = Math.min(1, Math.abs(sDiff) * 3.5 + Math.abs(eDiff) * 0.35);
        this.bondPulse[b] = Math.max(this.bondPulse[b] * (1 - 2.6 * dt), activity);
      }
    }

    stepInteractions(dt) {
      const gw = this.gridW;
      const gh = this.gridH;
      const inv = 1 / GRID_CELL_SIZE;
      const kRepel = 120.0;

      for (let i = 0; i < MAX_CELLS; i++) {
        if (!this.cellAlive[i]) continue;
        const xi = this.cellX[i];
        const yi = this.cellY[i];
        const ri = this.cellRadius[i];
        const ti = this.cellType[i];
        const orgI = this.cellOrg[i];

        const gx0 = Math.min(gw - 1, (xi * inv) | 0);
        const gy0 = Math.min(gh - 1, (yi * inv) | 0);

        let bestFoodScore = 0;
        let bestFoodDx = 0;
        let bestFoodDy = 0;

        // Check 3x3 spatial neighborhood (or 5x5 for sensors)
        const span = ti === CELL_TYPE.SENSOR ? 2 : 1;

        for (let oy = -span; oy <= span; oy++) {
          const gy = (gy0 + oy + gh) % gh;
          const rowOff = gy * gw;
          for (let ox = -span; ox <= span; ox++) {
            const gx = (gx0 + ox + gw) % gw;
            const bucket = rowOff + gx;

            // 1. Cell-cell repulsion & attacker feeding
            let j = this.cellGridHead[bucket];
            while (j !== -1) {
              if (j > i || ti === CELL_TYPE.SENSOR) {
                if (j !== i) {
                  const dx = this.wrapDx(this.cellX[j] - xi);
                  const dy = this.wrapDy(this.cellY[j] - yi);
                  const d2 = dx * dx + dy * dy;

                  // Collision / repulsion + predator strike reach margin
                  if (j > i) {
                    const tj = this.cellType[j];
                    const isStrikePair =
                      (ti === CELL_TYPE.ATTACKER && tj !== CELL_TYPE.ATTACKER) ||
                      (tj === CELL_TYPE.ATTACKER && ti !== CELL_TYPE.ATTACKER);
                    const isVenomSting =
                      !isStrikePair &&
                      ((ti === CELL_TYPE.VENOM && tj !== CELL_TYPE.VENOM) ||
                        (tj === CELL_TYPE.VENOM && ti !== CELL_TYPE.VENOM));
                    const minD = ri + this.cellRadius[j];
                    const strikeD = isStrikePair ? minD + 6.0 : isVenomSting ? minD + 4.5 : minD;
                    if (d2 > 0.001 && d2 < strikeD * strikeD) {
                      const d = Math.sqrt(d2);
                      if (d < minD) {
                        const overlap = minD - d;
                        const nx = dx / d;
                        const ny = dy / d;
                        const f = overlap * kRepel * dt;
                        this.cellVx[i] -= nx * f;
                        this.cellVy[i] -= ny * f;
                        this.cellVx[j] += nx * f;
                        this.cellVy[j] += ny * f;
                      }

                      // High-payoff attacker predation & venom stings (only intact organisms >= 3 cells; no floating mines!)
                      const orgJ = this.cellOrg[j];
                      const objI = orgI >= 0 ? this.orgs[orgI] : null;
                      const objJ = orgJ >= 0 ? this.orgs[orgJ] : null;
                      const intactBoth = Boolean(objI && objJ && objI.cellCount >= 3 && objJ.cellCount >= 3);
                      const predI = Boolean(objI && objI.hasAttacker);
                      const predJ = Boolean(objJ && objJ.hasAttacker);
                      if (orgI !== orgJ && intactBoth && predI !== predJ && isVenomSting) {
                        const ven = ti === CELL_TYPE.VENOM ? i : j;
                        const vic = ti === CELL_TYPE.VENOM ? j : i;
                        const venOrg = this.cellOrg[ven] >= 0 ? this.orgs[this.cellOrg[ven]] : null;
                        const vicOrg = this.cellOrg[vic] >= 0 ? this.orgs[this.cellOrg[vic]] : null;
                        // Count-based Venom vs Defender arms race (works symmetrically for both guilds!)
                        const netVenom = venOrg && vicOrg ? venOrg.venomCount - vicOrg.defenderCount : 0;
                        if (venOrg && vicOrg && netVenom > 0) {
                          const potency = 1.0 + (netVenom - 1) * 0.45;
                          if (venOrg.hasAttacker) {
                            // Predator Venom overwhelms prey's Defender count -> stings & paralyzes
                            const sting = Math.min(this.cellEnergy[vic], 110 * potency * dt);
                            this.cellEnergy[vic] -= sting;
                            this.cellEnergy[ven] += sting * 0.5;
                            this.cellVx[vic] *= 0.62;
                            this.cellVy[vic] *= 0.62;
                            this.cellSignal[ven] = 0.9;
                            this.cellSignal[vic] = 0.9;
                            vicOrg.injuredTimer = 2.2;
                            vicOrg.pendingReward -= sting * 0.14;
                            venOrg.pendingReward += sting * 0.12;
                          } else {
                            // Prey Venom overwhelms predator's Defender count -> shocks & harvests energy
                            const shock = Math.min(this.cellEnergy[vic], 170 * potency * dt);
                            this.cellEnergy[vic] -= shock;
                            const harvested = shock * 0.85;
                            if (venOrg.constructorCell >= 0 && this.cellAlive[venOrg.constructorCell]) {
                              this.cellEnergy[ven] += harvested * 0.45;
                              this.cellEnergy[venOrg.constructorCell] += harvested * 0.55;
                            } else {
                              this.cellEnergy[ven] += harvested;
                            }
                            const kdx = this.wrapDx(this.cellX[vic] - this.cellX[ven]);
                            const kdy = this.wrapDy(this.cellY[vic] - this.cellY[ven]);
                            const kd = Math.hypot(kdx, kdy) || 1;
                            this.cellVx[vic] += (kdx / kd) * 140 * dt * 6;
                            this.cellVy[vic] += (kdy / kd) * 140 * dt * 6;
                            this.cellSignal[ven] = 1.0;
                            this.cellSignal[vic] = 1.0;
                            if (vicOrg) {
                              vicOrg.injuredTimer = 0.9;
                              vicOrg.pendingReward -= shock * 0.25;
                            }
                            venOrg.pendingReward += shock * 0.14;
                          }
                        }
                      } else if (orgI !== orgJ && intactBoth && isStrikePair && predI !== predJ) {
                        const att = ti === CELL_TYPE.ATTACKER ? i : j;
                        const vic = ti === CELL_TYPE.ATTACKER ? j : i;
                        const attOrgIdx = this.cellOrg[att];
                        const vicOrgIdx = this.cellOrg[vic];
                        const attOrg = attOrgIdx >= 0 ? this.orgs[attOrgIdx] : null;
                        const vicOrg = vicOrgIdx >= 0 ? this.orgs[vicOrgIdx] : null;
                        const vicType = this.cellType[vic];

                        // Direction from victim to attacker for defensive knockback
                        const kdx = this.wrapDx(this.cellX[att] - this.cellX[vic]);
                        const kdy = this.wrapDy(this.cellY[att] - this.cellY[vic]);
                        const kd = Math.hypot(kdx, kdy) || 1;
                        const knx = kdx / kd;
                        const kny = kdy / kd;

                        const netPreyVenom =
                          vicType === CELL_TYPE.VENOM && vicOrg && attOrg
                            ? vicOrg.venomCount - attOrg.defenderCount
                            : 0;
                        if (netPreyVenom > 0) {
                          // Venom spine shocks predator when prey's venom count exceeds predator's armor count
                          const potency = 1.0 + (netPreyVenom - 1) * 0.45;
                          const shock = Math.min(this.cellEnergy[att], 170 * potency * dt);
                          this.cellEnergy[att] -= shock;
                          const harvested = shock * 0.85;
                          if (vicOrg && vicOrg.constructorCell >= 0 && this.cellAlive[vicOrg.constructorCell]) {
                            this.cellEnergy[vic] += harvested * 0.45;
                            this.cellEnergy[vicOrg.constructorCell] += harvested * 0.55;
                          } else {
                            this.cellEnergy[vic] += harvested;
                          }
                          this.cellVx[att] += knx * 160 * dt * 8;
                          this.cellVy[att] += kny * 160 * dt * 8;
                          this.cellSignal[att] = 1.0;
                          this.cellSignal[vic] = 1.0;
                          if (attOrg) {
                            attOrg.injuredTimer = 0.9;
                            attOrg.pendingReward -= shock * 0.25;
                          }
                          if (vicOrg) vicOrg.pendingReward += shock * 0.14;
                        } else {
                          // Defender armor cuts bite damage by 75% and bounces attacker back
                          const isArmored = vicType === CELL_TYPE.DEFENDER;
                          const rate = isArmored ? 65 : 260;
                          const drain = Math.min(this.cellEnergy[vic], rate * dt);
                          this.cellEnergy[vic] -= drain;
                          const gained = drain * 0.92;
                          if (attOrg && attOrg.constructorCell >= 0 && this.cellAlive[attOrg.constructorCell]) {
                            this.cellEnergy[att] += gained * 0.45;
                            this.cellEnergy[attOrg.constructorCell] += gained * 0.55;
                          } else {
                            this.cellEnergy[att] += gained;
                          }
                          if (isArmored) {
                            this.cellVx[att] += knx * 110 * dt * 6;
                            this.cellVy[att] += kny * 110 * dt * 6;
                          } else {
                            this.cellVx[vic] *= 0.72;
                            this.cellVy[vic] *= 0.72;
                            if (vicOrg) vicOrg.injuredTimer = 1.6;
                          }
                          this.cellSignal[att] = 0.8;
                          this.cellSignal[vic] = 0.8;
                          if (attOrg) attOrg.pendingReward += drain * 0.14;
                          if (vicOrg) vicOrg.pendingReward -= drain * 0.16;
                        }
                      }
                    }
                  }

                  // Sensor detects nearby non-kin organisms
                  if (ti === CELL_TYPE.SENSOR && this.cellOrg[j] !== orgI && d2 < 4600 && d2 > 16) {
                    const score = 1200 / (d2 + 120);
                    // Attract toward prey if organism has attackers, else mildly avoid attackers
                    const isThreat = this.cellType[j] === CELL_TYPE.ATTACKER;
                    const s = isThreat ? -score * 1.4 : score * 0.7;
                    if (Math.abs(s) > Math.abs(bestFoodScore)) {
                      bestFoodScore = s;
                      bestFoodDx = dx;
                      bestFoodDy = dy;
                    }
                  }
                }
              }
              j = this.cellGridNext[j];
            }

            // 2. Energy mote absorption & sensing
            if (ti === CELL_TYPE.PHOTO || ti === CELL_TYPE.CORE || ti === CELL_TYPE.CONSTRUCTOR || ti === CELL_TYPE.SENSOR) {
              let m = this.moteGridHead[bucket];
              const absorbR = ti === CELL_TYPE.PHOTO ? ri + 11.5 : ri + 5.0;
              const absorbR2 = absorbR * absorbR;
              while (m !== -1) {
                const nextM = this.moteGridNext[m];
                if (this.moteAlive[m]) {
                  const dx = this.wrapDx(this.moteX[m] - xi);
                  const dy = this.wrapDy(this.moteY[m] - yi);
                  const d2 = dx * dx + dy * dy;

                  if (d2 < absorbR2 && this.cellEnergy[i] < 135) {
                    const isPredOrg = orgI >= 0 && this.orgs[orgI] && this.orgs[orgI].hasAttacker;
                    const eff = isPredOrg ? 0.18 : ti === CELL_TYPE.PHOTO ? 1.05 : 0.75;
                    const gain = this.moteEnergy[m] * eff;
                    this.cellEnergy[i] += gain;
                    if (orgI >= 0 && this.orgs[orgI] && !isPredOrg) {
                      this.orgs[orgI].pendingReward += gain * 0.035;
                    }
                    this.cellSignal[i] = Math.min(0.5, this.cellSignal[i] + 0.14);
                    this.freeMote(m);
                  } else if (ti === CELL_TYPE.SENSOR && d2 < 4900 && d2 > 25) {
                    const score = 1500 / (d2 + 100);
                    if (score > Math.abs(bestFoodScore)) {
                      bestFoodScore = score;
                      bestFoodDx = dx;
                      bestFoodDy = dy;
                    }
                  }
                }
                m = nextM;
              }
            }
          }
        }

        // Apply sensor steering impulse
        if (ti === CELL_TYPE.SENSOR && bestFoodScore !== 0) {
          const targetAng = Math.atan2(bestFoodDy, bestFoodDx);
          const relAng = wrapAngle(targetAng - this.cellAngle[i]);
          const sign = bestFoodScore > 0 ? 1 : -1;
          const steer = clamp(relAng * sign * (this.cellSenseWeight[i] || 1.0), -1, 1);
          this.cellSteer[i] = this.cellSteer[i] * 0.7 + steer * 0.3;
          this.cellSignal[i] = Math.min(1, this.cellSignal[i] + 0.5 * dt * 10);
        }
      }
    }

    findBestMate(cellIdx, selfOrgIdx, maxDist = 95) {
      const selfOrg = this.orgs[selfOrgIdx];
      if (!selfOrg) return null;
      const selfRc = selfOrg.rootCell >= 0 && this.cellAlive[selfOrg.rootCell] ? selfOrg.rootCell : cellIdx;
      const selfScore = this.cellEnergy[selfRc] + selfOrg.offspring * 18 + selfOrg.generation * 3;
      const minMateScore = selfScore * 0.80;

      const xi = this.cellX[cellIdx];
      const yi = this.cellY[cellIdx];
      const maxD2 = maxDist * maxDist;
      let bestOrg = null;
      let bestScore = -1;
      let bestCell = -1;

      for (let o = 0; o < MAX_ORGS; o++) {
        if (o === selfOrgIdx) continue;
        const cand = this.orgs[o];
        if (!cand || cand.rootCell < 0 || !this.cellAlive[cand.rootCell]) continue;
        // Fitness & trophic-guild gating: only mate with mature, intact, well-fed same-guild peers
        if (cand.hasAttacker !== selfOrg.hasAttacker) continue;
        if (cand.age < 6.0 || cand.cellCount < 4) continue;
        const rc = cand.rootCell;
        if (this.cellEnergy[rc] < 65) continue;

        const dx = this.wrapDx(this.cellX[rc] - xi);
        const dy = this.wrapDy(this.cellY[rc] - yi);
        const d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          const score = this.cellEnergy[rc] + cand.offspring * 18 + cand.generation * 3;
          if (score >= minMateScore && score > bestScore) {
            bestScore = score;
            bestOrg = cand;
            bestCell = rc;
          }
        }
      }
      return bestOrg ? { org: bestOrg, cell: bestCell, score: bestScore, selfScore } : null;
    }

    computeTelemetry() {
      let speedSum = 0;
      let cellSum = 0;
      let orgsSeen = 0;
      for (let o = 0; o < MAX_ORGS; o++) {
        const org = this.orgs[o];
        if (!org || org.rootCell < 0 || !this.cellAlive[org.rootCell]) continue;
        const rc = org.rootCell;
        speedSum += Math.hypot(this.cellVx[rc], this.cellVy[rc]);
        cellSum += org.cellCount;
        orgsSeen++;
      }
      if (orgsSeen > 0) {
        this.avgSpeed = speedSum / orgsSeen;
        this.avgCells = cellSum / orgsSeen;
      }
    }

    stepCells(dt) {
      const fwdDrag = Math.exp(-0.72 * dt);
      const sideDrag = Math.exp(-3.4 * dt);
      const maxSpeed = 340;
      const tFlow = this.simTime * 0.14;
      let curPreyCount = 0;
      let curPredCount = 0;
      for (let o = 0; o < MAX_ORGS; o++) {
        const oo = this.orgs[o];
        if (!oo) continue;
        if (oo.hasAttacker) curPredCount++;
        else curPreyCount++;
      }

      for (let i = 0; i < MAX_CELLS; i++) {
        if (!this.cellAlive[i]) continue;

        // Gentle ambient fluid drift
        const x = this.cellX[i];
        const y = this.cellY[i];
        const flowAng =
          Math.sin(x * 0.0022 + tFlow) * 2.1 + Math.cos(y * 0.0026 - tFlow * 0.8) * 2.1;
        this.cellVx[i] += Math.cos(flowAng) * 5.0 * dt;
        this.cellVy[i] += Math.sin(flowAng) * 5.0 * dt;

        // Anisotropic fluid drag along the organism's swimming axis (prevents side fins dragging sideways!)
        const orgIdx0 = this.cellOrg[i];
        const org0 = orgIdx0 >= 0 ? this.orgs[orgIdx0] : null;
        const dragAng =
          org0 && org0.rootCell >= 0 && this.cellAlive[org0.rootCell]
            ? this.cellAngle[org0.rootCell]
            : this.cellAngle[i];
        const ca = Math.cos(dragAng);
        const sa = Math.sin(dragAng);
        const vx = this.cellVx[i];
        const vy = this.cellVy[i];
        const vFwdRaw = vx * ca + vy * sa;
        // Defender armor is heavier (extra drag trade-off: Armor vs Speed)
        const armorDrag = this.cellType[i] === CELL_TYPE.DEFENDER ? Math.exp(-1.1 * dt) : 1.0;
        const vFwd = vFwdRaw * (vFwdRaw > 0 ? fwdDrag : sideDrag) * armorDrag;
        const vSide = (-vx * sa + vy * ca) * sideDrag;
        this.cellVx[i] = vFwd * ca - vSide * sa;
        this.cellVy[i] = vFwd * sa + vSide * ca;

        const spd2 = this.cellVx[i] * this.cellVx[i] + this.cellVy[i] * this.cellVy[i];
        if (spd2 > maxSpeed * maxSpeed) {
          const inv = maxSpeed / Math.sqrt(spd2);
          this.cellVx[i] *= inv;
          this.cellVy[i] *= inv;
        }

        this.cellX[i] = this.wrapX(x + this.cellVx[i] * dt);
        this.cellY[i] = this.wrapY(y + this.cellVy[i] * dt);

        // Signal & steer decay
        this.cellSignal[i] *= Math.exp(-2.4 * dt);
        this.cellSteer[i] *= Math.exp(-3.0 * dt);

        // Tighter metabolism (no free lunch — creatures must forage blooms or hunt!)
        const orgIdx = this.cellOrg[i];
        const org = orgIdx >= 0 ? this.orgs[orgIdx] : null;
        const type = this.cellType[i];
        let basal = 1.1;
        if (type === CELL_TYPE.ATTACKER) basal = 1.25;
        else if (type === CELL_TYPE.MUSCLE) basal = 1.12;
        else if (type === CELL_TYPE.DEFENDER) basal = 1.12;
        else if (type === CELL_TYPE.VENOM) basal = 1.55;
        else if (type === CELL_TYPE.PHOTO) {
          // Barely below basal so stationary photo blobs must drift/swim into nutrient blooms
          this.cellEnergy[i] += 0.62 * dt;
          basal = 0.88;
        }
        // Graceful senescence: older organisms burn extra metabolism instead of randomly popping while full
        if (org && org.age > 140) {
          basal += (org.age - 140) * 0.04;
        }
        // Detached 1-2 cell fragments (e.g., starved predator or venom remnants) dissolve rapidly into motes
        if (!org || org.cellCount <= 2) {
          basal *= 14.0;
        }
        this.cellEnergy[i] -= basal * dt;

        // Cap energy (higher reserve on Constructor so big meals aren't wasted before budding)
        const eCap = type === CELL_TYPE.CONSTRUCTOR ? 220 : 160;
        if (this.cellEnergy[i] > eCap) this.cellEnergy[i] = eCap;

        if (this.cellEnergy[i] <= 0) {
          // Dissolve into free energy motes (conservation!)
          const burst = 1 + (this.cellEnergy[i] > 12 ? 1 : 0);
          for (let k = 0; k < burst; k++) {
            const a = this.rng() * Math.PI * 2;
            const sp = 10 + this.rng() * 18;
            this.spawnMote(
              this.cellX[i],
              this.cellY[i],
              13 + this.rng() * 7,
              this.cellHue[i],
              Math.cos(a) * sp,
              Math.sin(a) * sp
            );
          }
          this.freeCell(i);
          continue;
        }

        // Constructor reproduction (pure Lotka-Volterra: regulated by food & prey, not artificial guild caps!)
        if (
          type === CELL_TYPE.CONSTRUCTOR &&
          org &&
          org.reproCooldown <= 0 &&
          this.cellEnergy[i] > 78 &&
          this.activeCellCount < MAX_CELLS - 40 &&
          this.activeOrgCount < MAX_ORGS - 6
        ) {
          // Sync live learned brain weights before inheritance (Lamarckian transfer)
          this.syncOrgBrainToGenome(org);
          const mate = this.findBestMate(i, orgIdx, 95);
          let baseGenome = org.genome;
          let childGen = org.generation + 1;
          let didCrossover = false;

          if (mate) {
            this.syncOrgBrainToGenome(mate.org);
            const fitter = mate.score > mate.selfScore ? mate.org.genome : org.genome;
            const donor = mate.score > mate.selfScore ? org.genome : mate.org.genome;
            baseGenome = crossoverGenomes(fitter, donor, this.rng);
            childGen = Math.max(org.generation, mate.org.generation) + 1;
            didCrossover = true;
          }

          const childGenome = mutateGenome(baseGenome, this.rng);
          const spawnAng = this.cellAngle[i] + Math.PI + (this.rng() - 0.5) * 1.4;
          const dist = 18;
          const sx = this.wrapX(this.cellX[i] + Math.cos(spawnAng) * dist);
          const sy = this.wrapY(this.cellY[i] + Math.sin(spawnAng) * dist);

          const childOrg = this.spawnOrganism(
            childGenome,
            sx,
            sy,
            spawnAng,
            46,
            childGen
          );
          if (childOrg >= 0) {
            this.cellEnergy[i] -= 44;
            this.cellSignal[i] = 1.0;
            if (mate && this.cellAlive[mate.cell]) {
              this.cellSignal[mate.cell] = 1.0;
            }
            org.offspring++;
            org.reproCooldown = 3.6 + this.rng() * 2.2;
            this.totalBirths++;
            if (org.hasAttacker) curPredCount++;
            else curPreyCount++;
            if (didCrossover) this.totalCrossovers++;
            this.recordHallOfFame(org);
          }
        }
      }

      if ((this.tickCount & 31) === 0) {
        this.computeTelemetry();
      }

      // Sample Lotka-Volterra population history every 5 seconds of sim time
      if (this.simTime - this.lastSampleTime >= 5.0) {
        this.lastSampleTime = this.simTime;
        this.popHistory.push([Math.round(this.simTime), curPreyCount, curPredCount]);
        if (this.popHistory.length > 360) {
          this.popHistory.shift();
        }
      }
    }

    stepMotes(dt) {
      const drag = Math.exp(-1.5 * dt);
      const tFlow = this.simTime * 0.14;

      // Drift nutrient blooms gently across the ocean
      for (let b = 0; b < this.blooms.length; b++) {
        const bl = this.blooms[b];
        bl.x = this.wrapX(bl.x + bl.vx * dt);
        bl.y = this.wrapY(bl.y + bl.vy * dt);
        if (this.rng() < 0.015 * dt) {
          const a = this.rng() * Math.PI * 2;
          bl.vx = Math.cos(a) * (12 + this.rng() * 16);
          bl.vy = Math.sin(a) * (12 + this.rng() * 16);
        }
      }

      for (let i = 0; i < MAX_MOTES; i++) {
        if (!this.moteAlive[i]) continue;
        const x = this.moteX[i];
        const y = this.moteY[i];
        const flowAng =
          Math.sin(x * 0.0042 + tFlow) * 2.1 + Math.cos(y * 0.0051 - tFlow * 0.8) * 2.1;
        this.moteVx[i] = (this.moteVx[i] + Math.cos(flowAng) * 8.0 * dt) * drag;
        this.moteVy[i] = (this.moteVy[i] + Math.sin(flowAng) * 8.0 * dt) * drag;
        this.moteX[i] = this.wrapX(x + this.moteVx[i] * dt);
        this.moteY[i] = this.wrapY(y + this.moteVy[i] * dt);
      }

      // Replenish motes inside drifting blooms (finite food budget naturally regulates prey!)
      const areaScale = clamp((this.worldW * this.worldH) / (5330 * 3000), 0.55, 2.2);
      const targetMotes = Math.round(1350 * areaScale);
      if (this.activeMoteCount < targetMotes) {
        const toAdd = Math.min(4, targetMotes - this.activeMoteCount);
        for (let k = 0; k < toAdd; k++) {
          this.spawnBloomMote();
        }
      }
    }

    recordHallOfFame(org) {
      const score = org.offspring * 3 + org.generation;
      const existing = this.hallOfFame.find((h) => h.uid === org.uid);
      if (existing) {
        existing.score = score;
        existing.generation = org.generation;
        existing.offspring = org.offspring;
      } else {
        this.hallOfFame.push({
          uid: org.uid,
          score,
          generation: org.generation,
          offspring: org.offspring,
          genome: cloneGenome(org.genome),
        });
      }
      this.hallOfFame.sort((a, b) => b.score - a.score);
      if (this.hallOfFame.length > 18) this.hallOfFame.length = 18;
    }

    spawnAtEdge(genome, generation = 1, energy = 70) {
      const side = Math.floor(this.rng() * 4);
      let x, y, ang;
      if (side === 0) {
        x = 18;
        y = this.rng() * this.worldH;
        ang = (this.rng() - 0.5) * 1.2; // swim right
      } else if (side === 1) {
        x = this.worldW - 18;
        y = this.rng() * this.worldH;
        ang = Math.PI + (this.rng() - 0.5) * 1.2; // swim left
      } else if (side === 2) {
        x = this.rng() * this.worldW;
        y = 18;
        ang = Math.PI * 0.5 + (this.rng() - 0.5) * 1.2; // swim down
      } else {
        x = this.rng() * this.worldW;
        y = this.worldH - 18;
        ang = -Math.PI * 0.5 + (this.rng() - 0.5) * 1.2; // swim up
      }
      return this.spawnOrganism(genome, x, y, ang, energy, generation);
    }

    runWatchdog() {
      const areaScale = clamp((this.worldW * this.worldH) / (5330 * 3000), 0.55, 2.2);
      const minPrey = Math.max(10, Math.round(14 * areaScale));
      const minPreds = Math.max(3, Math.round(4 * areaScale));

      let preyCount = 0;
      let predCount = 0;
      for (let o = 0; o < MAX_ORGS; o++) {
        const org = this.orgs[o];
        if (!org) continue;
        if (org.hasAttacker) predCount++;
        else preyCount++;
      }

      const starters = createStarterGenomes();
      const preyStarters = [starters[0], starters[1], starters[3], starters[5], starters[6], starters[7]];
      const predStarters = [starters[2], starters[4]];

      const hasAttackerGene = (g) =>
        g && Array.isArray(g.nodes) && g.nodes.some((n) => n.type === CELL_TYPE.ATTACKER);

      // 1. Migrate prey in from edges if prey population crashes
      if (preyCount < minPrey) {
        const hofPrey = this.hallOfFame.filter((h) => !hasAttackerGene(h.genome));
        const needed = Math.min(4, minPrey - preyCount);
        for (let i = 0; i < needed; i++) {
          let g;
          let gen = 1;
          if (hofPrey.length > 0 && this.rng() < 0.75) {
            const pick = hofPrey[Math.floor(this.rng() * hofPrey.length)];
            g = mutateGenome(pick.genome, this.rng);
            gen = pick.generation + 1;
          } else {
            g = mutateGenome(preyStarters[Math.floor(this.rng() * preyStarters.length)], this.rng);
          }
          this.spawnAtEdge(g, gen, 68);
        }
      }

      // 2. Migrate predators in from edges if predators die out while prey are plentiful
      if (predCount < minPreds && preyCount >= 12) {
        const hofPreds = this.hallOfFame.filter((h) => hasAttackerGene(h.genome));
        const needed = Math.min(3, minPreds - predCount);
        for (let i = 0; i < needed; i++) {
          let g;
          let gen = 1;
          if (hofPreds.length > 0 && this.rng() < 0.75) {
            const pick = hofPreds[Math.floor(this.rng() * hofPreds.length)];
            g = mutateGenome(pick.genome, this.rng);
            gen = pick.generation + 1;
          } else {
            g = mutateGenome(predStarters[Math.floor(this.rng() * predStarters.length)], this.rng);
          }
          this.spawnAtEdge(g, gen, 76);
        }
      }
    }

    // ── Pack Active Entities for GPU Upload & Multi-Screen Broadcast ──────────
    packRenderBuffers() {
      let ci = 0;
      const gc = this.gpuCells;
      for (let i = 0; i < MAX_CELLS; i++) {
        if (!this.cellAlive[i]) continue;
        const o = ci * 8;
        const orgIdx = this.cellOrg[i];
        const isPred = orgIdx >= 0 && this.orgs[orgIdx] && this.orgs[orgIdx].hasAttacker ? 8 : 0;
        gc[o] = this.cellX[i];
        gc[o + 1] = this.cellY[i];
        gc[o + 2] = this.cellRadius[i];
        gc[o + 3] = this.cellType[i] + isPred;
        gc[o + 4] = this.cellHue[i];
        gc[o + 5] = clamp(this.cellEnergy[i] / 110, 0.05, 1.35);
        gc[o + 6] = this.cellSignal[i];
        gc[o + 7] = this.cellAngle[i];
        ci++;
      }
      this.gpuCellCount = ci;

      let bi = 0;
      const gb = this.gpuBonds;
      const hw = this.worldW * 0.5;
      const hh = this.worldH * 0.5;
      for (let i = 0; i < MAX_BONDS; i++) {
        if (!this.bondAlive[i]) continue;
        const a = this.bondA[i];
        const b = this.bondB[i];
        if (!this.cellAlive[a] || !this.cellAlive[b]) continue;
        const ax = this.cellX[a];
        const ay = this.cellY[a];
        const bx = this.cellX[b];
        const by = this.cellY[b];
        // Skip bonds crossing the toroidal seam
        if (Math.abs(bx - ax) > hw || Math.abs(by - ay) > hh) continue;

        const o = bi * 8;
        gb[o] = ax;
        gb[o + 1] = ay;
        gb[o + 2] = bx;
        gb[o + 3] = by;
        gb[o + 4] = this.cellHue[a];
        gb[o + 5] = clamp((this.cellEnergy[a] + this.cellEnergy[b]) / 220, 0.08, 1.2);
        gb[o + 6] = this.bondPulse[i];
        gb[o + 7] = this.bondStress[i];
        bi++;
      }
      this.gpuBondCount = bi;

      let mi = 0;
      const gm = this.gpuMotes;
      for (let i = 0; i < MAX_MOTES; i++) {
        if (!this.moteAlive[i]) continue;
        const o = mi * 4;
        gm[o] = this.moteX[i];
        gm[o + 1] = this.moteY[i];
        gm[o + 2] = clamp(this.moteEnergy[i] / 28, 0.25, 1.3);
        gm[o + 3] = this.moteHue[i];
        mi++;
      }
      this.gpuMoteCount = mi;
    }

    // ── Serialization for Persistence & Export / Import ───────────────────────
    serializeSnapshot(paletteIdx = 0) {
      const organisms = [];
      for (let o = 0; o < MAX_ORGS; o++) {
        const org = this.orgs[o];
        if (!org || org.cellCount <= 0) continue;
        // Find a live cell belonging to this organism for position/energy summary
        let rx = this.worldW * 0.5;
        let ry = this.worldH * 0.5;
        let rAng = 0;
        let sumE = 0;
        let cnt = 0;
        if (org.rootCell >= 0 && this.cellAlive[org.rootCell]) {
          rx = this.cellX[org.rootCell];
          ry = this.cellY[org.rootCell];
          rAng = this.cellAngle[org.rootCell];
        }
        for (let i = 0; i < MAX_CELLS; i++) {
          if (this.cellAlive[i] && this.cellOrg[i] === o) {
            if (cnt === 0 && (org.rootCell < 0 || !this.cellAlive[org.rootCell])) {
              rx = this.cellX[i];
              ry = this.cellY[i];
              rAng = this.cellAngle[i];
            }
            sumE += this.cellEnergy[i];
            cnt++;
          }
        }
        if (cnt === 0) continue;
        this.syncOrgBrainToGenome(org);
        organisms.push({
          nx: Number((rx / this.worldW).toFixed(4)),
          ny: Number((ry / this.worldH).toFixed(4)),
          angle: Number(rAng.toFixed(3)),
          energy: Number((sumE / cnt).toFixed(1)),
          generation: org.generation,
          offspring: org.offspring,
          genome: cloneGenome(org.genome),
        });
      }

      return {
        version: 1,
        savedAt: Date.now(),
        paletteIdx,
        stats: {
          maxGeneration: this.maxGeneration,
          totalBirths: this.totalBirths,
          totalCrossovers: this.totalCrossovers,
        },
        organisms,
        history: this.popHistory.slice(-360),
        hallOfFame: this.hallOfFame.slice(0, 16).map((h) => ({
          score: h.score,
          generation: h.generation,
          offspring: h.offspring,
          genome: cloneGenome(h.genome),
        })),
      };
    }

    loadSnapshot(validated, { inject = false } = {}) {
      if (!validated || !validated.organisms || validated.organisms.length === 0) {
        return 0;
      }
      if (!inject) {
        this.resetPools();
        this.initBlooms();
        this.simTime = 0;
        this.tickCount = 0;
        this.totalBirths = validated.stats?.totalBirths || 0;
        this.totalCrossovers = validated.stats?.totalCrossovers || 0;
        this.maxGeneration = validated.stats?.maxGeneration || 1;
        this.popHistory = Array.isArray(validated.history)
          ? validated.history.slice(-360)
          : [];
        this.lastSampleTime =
          this.popHistory.length > 0
            ? this.popHistory[this.popHistory.length - 1][0]
            : -10;
        if (this.popHistory.length > 0) {
          this.simTime = this.popHistory[this.popHistory.length - 1][0];
        }
        this.hallOfFame = (validated.hallOfFame || []).map((h, idx) => ({
          uid: -(idx + 1),
          score: h.score || 1,
          generation: h.generation || 1,
          offspring: h.offspring || 0,
          genome: cloneGenome(h.genome),
        }));
      }

      // Restore every saved organism faithfully (no generation-biased culling of predators!)
      const areaScale = clamp((this.worldW * this.worldH) / (5330 * 3000), 0.55, 2.2);
      const maxLoad = inject ? 80 : MAX_ORGS;

      let spawned = 0;
      for (const item of validated.organisms) {
        if (spawned >= maxLoad) break;
        const x =
          typeof item.nx === "number" && !inject
            ? clamp(item.nx, 0, 0.999) * this.worldW
            : this.rng() * this.worldW;
        const y =
          typeof item.ny === "number" && !inject
            ? clamp(item.ny, 0, 0.999) * this.worldH
            : this.rng() * this.worldH;
        const ang = typeof item.angle === "number" ? item.angle : this.rng() * Math.PI * 2;
        const energy = clamp(item.energy || 60, 35, 110);
        const gen = item.generation || 1;
        if (this.spawnOrganism(item.genome, x, y, ang, energy, gen) >= 0) {
          spawned++;
        }
      }

      // Replenish bloom motes on full load
      if (!inject) {
        const numMotes = Math.min(MAX_MOTES - 500, Math.round(800 * areaScale));
        for (let i = 0; i < numMotes; i++) {
          this.spawnBloomMote();
        }
      }

      return spawned;
    }
  }

  window.AlienSim = AlienSim;
  window.AlienSimLimits = { MAX_CELLS, MAX_BONDS, MAX_MOTES, MAX_ORGS };
})();
