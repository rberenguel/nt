#!/usr/bin/env node

const fs = require('fs');

const CONFIG = {
  generations:          2000,
  stepsPerGen:          2000,   // 100 sim-seconds @ 20 Hz (extra time for slower fish)
  dt:                   0.05,
  worldWidth:           1000,
  worldHeight:          600,
  numPrey:              40,
  numPredators:         6,
  numFood:              30,
  eliteCount:           3,
  mutationRate:         0.07,
  mutationScale:        0.22,
  crossoverRate:        0.6,
  starvationThreshold:  350,    // training pressure threshold (sim death is at 300)
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand  = (lo, hi)    => Math.random() * (hi - lo) + lo;
const wrapAngle = a => {
  while (a < -Math.PI) a += 2 * Math.PI;
  while (a >  Math.PI) a -= 2 * Math.PI;
  return a;
};

// ── Brain ──────────────────────────────────────────────────────────────────────
class Brain {
  constructor(layers, weights = null) {
    this.layers = layers;
    this.size = 0;
    for (let i = 0; i < layers.length - 1; i++)
      this.size += (layers[i] + 1) * layers[i + 1];  // +1 bias per output
    this.w = weights ? new Float32Array(weights) : Brain._rand(this.size);
  }

  static _rand(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = (Math.random() * 2 - 1) * 0.5;
    return w;
  }

  forward(inp) {
    let cur = inp, wi = 0;
    for (let l = 0; l < this.layers.length - 1; l++) {
      const id = this.layers[l], od = this.layers[l + 1];
      const nxt = new Float32Array(od);
      for (let j = 0; j < od; j++) {
        let s = this.w[wi++];
        for (let i = 0; i < id; i++) s += cur[i] * this.w[wi++];
        nxt[j] = Math.tanh(s);
      }
      cur = nxt;
    }
    return cur;
  }

  mutate() {
    for (let i = 0; i < this.w.length; i++)
      if (Math.random() < CONFIG.mutationRate)
        this.w[i] += (Math.random() * 2 - 1) * CONFIG.mutationScale;
  }

  clone() { return new Brain(this.layers, this.w); }

  static crossover(a, b) {
    const w = new Float32Array(a.w.length);
    for (let i = 0; i < w.length; i++)
      w[i] = Math.random() < 0.5 ? a.w[i] : b.w[i];
    return new Brain(a.layers, w);
  }
}

// ── Entities ──────────────────────────────────────────────────────────────────
class Entity {
  constructor(x, y, maxSpeed, turnRate = 2.2) {
    this.x = x; this.y = y;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0; this.maxSpeed = maxSpeed; this.turnRate = turnRate;
    this.alive = true; this.fitness = 0;
  }

  step(turn, throttle) {
    this.heading = wrapAngle(this.heading + turn * this.turnRate * CONFIG.dt);
    this.speed   = clamp(this.speed + throttle * this.maxSpeed * CONFIG.dt, 0, this.maxSpeed);
    this.x += Math.cos(this.heading) * this.speed * CONFIG.dt;
    this.y += Math.sin(this.heading) * this.speed * CONFIG.dt;
    if (this.x < 20)                     { this.x = 20;                    this.heading = Math.PI - this.heading; }
    if (this.x > CONFIG.worldWidth - 20) { this.x = CONFIG.worldWidth - 20; this.heading = Math.PI - this.heading; }
    if (this.y < 20)                     { this.y = 20;                     this.heading = -this.heading; }
    if (this.y > CONFIG.worldHeight - 20){ this.y = CONFIG.worldHeight - 20; this.heading = -this.heading; }
    this.heading = wrapAngle(this.heading);
  }
}

// Prey: [food_dist, food_angle, pred_dist, pred_angle, wall_x, wall_y, peer_dist, peer_angle] → [turn, throttle]
class Prey extends Entity {
  constructor(x, y, brain = null) {
    super(x, y, 95, 2.2);
    this.brain = brain || new Brain([8, 14, 2]);
  }

  evaluate(foods, predators, peers) {
    let nf = null, nfd = Infinity;
    for (const f of foods) { const d = Math.hypot(f.x-this.x, f.y-this.y); if (d < nfd) { nfd = d; nf = f; } }

    let np = null, npd = Infinity;
    for (const p of predators) { const d = Math.hypot(p.x-this.x, p.y-this.y); if (d < npd) { npd = d; np = p; } }

    let nb = null, nbd = Infinity;
    for (const b of peers) {
      if (b === this || !b.alive) continue;
      const d = Math.hypot(b.x-this.x, b.y-this.y); if (d < nbd) { nbd = d; nb = b; }
    }

    const fa = nf ? wrapAngle(Math.atan2(nf.y-this.y, nf.x-this.x) - this.heading) / Math.PI : 0;
    const pa = np ? wrapAngle(Math.atan2(np.y-this.y, np.x-this.x) - this.heading) / Math.PI : 0;
    const ba = nb ? wrapAngle(Math.atan2(nb.y-this.y, nb.x-this.x) - this.heading) / Math.PI : 0;

    const [turn, thr] = this.brain.forward([
      nf ? clamp(nfd/400, 0, 1) : 1,  fa,
      np ? clamp(npd/300, 0, 1) : 1,  pa,
      (this.x / CONFIG.worldWidth)  * 2 - 1,
      (this.y / CONFIG.worldHeight) * 2 - 1,
      nb ? clamp(nbd/200, 0, 1) : 1,  ba,
    ]);
    return { turn, throttle: (thr + 1) * 0.5 };
  }
}

// Predator: [prey_dist, prey_angle, prey_speed, wall_x, wall_y, hunger, peer_dist, peer_angle] → [turn, throttle]
class Predator extends Entity {
  constructor(x, y, brain = null) {
    super(x, y, 120, 3.2);
    this.brain = brain || new Brain([8, 12, 2]);
    this.kills = 0;
    this.stepsSinceKill = 0;
    this.satiatedTicks = 0;
  }

  evaluate(preyList, predPool) {
    let np = null, npd = Infinity;
    for (const p of preyList) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x-this.x, p.y-this.y); if (d < npd) { npd = d; np = p; }
    }

    let nb = null, nbd = Infinity;
    for (const p of predPool) {
      if (p === this) continue;
      const d = Math.hypot(p.x-this.x, p.y-this.y); if (d < nbd) { nbd = d; nb = p; }
    }

    const pa     = np ? wrapAngle(Math.atan2(np.y-this.y, np.x-this.x) - this.heading) / Math.PI : 0;
    const spd    = np ? np.speed / np.maxSpeed : 0;
    const hunger = clamp(this.stepsSinceKill / CONFIG.starvationThreshold, 0, 1);
    const nba    = nb ? wrapAngle(Math.atan2(nb.y-this.y, nb.x-this.x) - this.heading) / Math.PI : 0;

    const [turn, thr] = this.brain.forward([
      np ? clamp(npd/500, 0, 1) : 1,  pa,  spd,
      (this.x / CONFIG.worldWidth)  * 2 - 1,
      (this.y / CONFIG.worldHeight) * 2 - 1,
      hunger,
      nb ? clamp(nbd/300, 0, 1) : 1,  nba,
    ]);
    return { turn, throttle: (thr + 1) * 0.5 };
  }
}

// ── Evolution ──────────────────────────────────────────────────────────────────
function tournamentSelect(pool, k = 4) {
  let best = null;
  for (let i = 0; i < k; i++) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (!best || c.fitness > best.fitness) best = c;
  }
  return best;
}

function reproduce(sortedPool, Ctor) {
  const next = [];
  for (let i = 0; i < CONFIG.eliteCount; i++)
    next.push(new Ctor(0, 0, sortedPool[i].brain.clone()));

  while (next.length < sortedPool.length) {
    const p1 = tournamentSelect(sortedPool);
    let childBrain;
    if (Math.random() < CONFIG.crossoverRate) {
      childBrain = Brain.crossover(p1.brain, tournamentSelect(sortedPool).brain);
    } else {
      childBrain = p1.brain.clone();
    }
    childBrain.mutate();
    next.push(new Ctor(0, 0, childBrain));
  }
  return next;
}

// ── Simulation loop ────────────────────────────────────────────────────────────
function runSimulation() {
  console.log(`Neuroevolution: ${CONFIG.generations} gen × ${CONFIG.stepsPerGen} steps (${(CONFIG.generations * CONFIG.stepsPerGen * CONFIG.dt / 60).toFixed(0)} sim-minutes total)`);

  let preyPool = Array.from({ length: CONFIG.numPrey },      () => new Prey    (rand(50, CONFIG.worldWidth-50), rand(50, CONFIG.worldHeight-50)));
  let predPool = Array.from({ length: CONFIG.numPredators }, () => new Predator(rand(50, CONFIG.worldWidth-50), rand(50, CONFIG.worldHeight-50)));

  for (let gen = 1; gen <= CONFIG.generations; gen++) {
    let food = Array.from({ length: CONFIG.numFood }, () => ({
      x: rand(20, CONFIG.worldWidth-20), y: rand(20, CONFIG.worldHeight-20),
    }));

    preyPool.forEach(p => {
      p.x = rand(50, CONFIG.worldWidth-50); p.y = rand(50, CONFIG.worldHeight-50);
      p.heading = Math.random() * Math.PI * 2; p.speed = 0;
      p.alive = true; p.fitness = 0;
    });
    predPool.forEach(p => {
      p.x = rand(50, CONFIG.worldWidth-50); p.y = rand(50, CONFIG.worldHeight-50);
      p.heading = Math.random() * Math.PI * 2; p.speed = 0;
      p.alive = true; p.fitness = 0; p.kills = 0; p.stepsSinceKill = 0; p.satiatedTicks = 0;
    });

    for (let step = 0; step < CONFIG.stepsPerGen; step++) {
      // Prey
      for (const p of preyPool) {
        if (!p.alive) continue;
        p.fitness += 0.05;
        const { turn, throttle } = p.evaluate(food, predPool, preyPool);
        let nearestPredDist = Infinity;
        for (const pred of predPool) { const d = Math.hypot(pred.x-p.x, pred.y-p.y); if (d < nearestPredDist) nearestPredDist = d; }
        const prevMaxSpeed = p.maxSpeed;
        if (nearestPredDist < 60) p.maxSpeed = 155;
        p.step(turn, throttle);
        p.maxSpeed = prevMaxSpeed;
        for (let i = food.length - 1; i >= 0; i--) {
          if (Math.hypot(food[i].x-p.x, food[i].y-p.y) < 12) {
            p.fitness += 15;
            food.splice(i, 1);
            food.push({ x: rand(20, CONFIG.worldWidth-20), y: rand(20, CONFIG.worldHeight-20) });
          }
        }
      }

      // Predators
      for (const pred of predPool) {
        const { turn, throttle } = pred.evaluate(preyPool, predPool);
        pred.step(turn, throttle);
        pred.stepsSinceKill++;
        if (pred.satiatedTicks > 0) pred.satiatedTicks--;

        // Sprint penalty: select for efficient stalks, not aimless dashes
        pred.fitness -= (pred.speed / pred.maxSpeed) * 0.01;

        // Wall-proximity penalty: discourage bouncing along edges
        const wallMargin = 60;
        const wx = Math.max(0, wallMargin - Math.min(pred.x, CONFIG.worldWidth  - pred.x));
        const wy = Math.max(0, wallMargin - Math.min(pred.y, CONFIG.worldHeight - pred.y));
        pred.fitness -= ((wx + wy) / wallMargin) * 0.035;

        // Starvation pressure: ramps up after threshold
        if (pred.stepsSinceKill > CONFIG.starvationThreshold)
          pred.fitness -= 0.15;

        // Clustering penalty: discourage pile-ups on the same prey
        for (const other of predPool) {
          if (other === pred) continue;
          if (Math.hypot(other.x-pred.x, other.y-pred.y) < 80)
            pred.fitness -= 0.05;
        }

        if (pred.satiatedTicks === 0) {
          for (const p of preyPool) {
            if (!p.alive) continue;
            if (Math.hypot(p.x-pred.x, p.y-pred.y) < 14) {
              p.alive = false;
              pred.kills++;
              pred.stepsSinceKill = 0;
              pred.satiatedTicks = 80;
              pred.fitness += 20;
              break;
            }
          }
        }
      }

      // Respawn prey mid-generation when population collapses so predators always have targets
      if (preyPool.filter(p => p.alive).length < CONFIG.numPrey * 0.35) {
        const living = preyPool.filter(p => p.alive);
        preyPool.filter(p => !p.alive).forEach(p => {
          const parent = living[Math.floor(Math.random() * living.length)];
          p.x = clamp(parent.x + (Math.random()-0.5)*60, 20, CONFIG.worldWidth-20);
          p.y = clamp(parent.y + (Math.random()-0.5)*60, 20, CONFIG.worldHeight-20);
          p.alive = true;
        });
      }
    }

    preyPool.sort((a, b) => b.fitness - a.fitness);
    predPool.sort((a, b) => b.fitness - a.fitness);

    if (gen % 50 === 0 || gen === CONFIG.generations) {
      const pf = preyPool[0].fitness.toFixed(0).padStart(7);
      const xf = predPool[0].fitness.toFixed(0).padStart(7);
      console.log(`Gen ${String(gen).padStart(3)} | prey: ${pf} | pred: ${xf} (${predPool[0].kills} kills)`);
    }

    if (gen < CONFIG.generations) {
      preyPool = reproduce(preyPool, Prey);
      predPool = reproduce(predPool, Predator);
    }
  }

  const out = {
    metadata: { generatedAt: new Date().toISOString(), worldScale: [CONFIG.worldWidth, CONFIG.worldHeight] },
    species: {
      prey:     { architecture: preyPool[0].brain.layers, weights: Array.from(preyPool[0].brain.w) },
      predator: { architecture: predPool[0].brain.layers, weights: Array.from(predPool[0].brain.w) },
    },
  };
  fs.writeFileSync('ecosystem_brains.json', JSON.stringify(out, null, 2));
  console.log('Saved ecosystem_brains.json');
}

runSimulation();
