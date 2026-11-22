// Genome definitions, curated starter species, and evolutionary mutation operators
// Inspired by chrxh/alien's multicellular organism blueprints.

(function () {
  const CELL_TYPE = {
    CORE: 0,        // Structural hub, energy buffer, signal relay
    MUSCLE: 1,      // Oscillating / signal-steered actuator for propulsion
    PHOTO: 2,       // Absorbs free energy motes + gentle passive photosynthesis
    SENSOR: 3,      // Detects food & non-kin organisms, injects steering signals
    ATTACKER: 4,    // Drains energy from non-kin cells on contact
    CONSTRUCTOR: 5, // Accumulates surplus energy to bud off mutated offspring
    DEFENDER: 6,    // Armored shell: cuts bite damage by 75% + bounces attackers back
    VENOM: 7,       // Warning spine: shocks & stuns biting predators on contact
  };

  const NUM_CELL_TYPES = 8;
  const MAX_GENOME_NODES = 22;

  // Compact 6 -> 6 -> 2 neural network (36 + 6 + 12 + 2 = 56 weights)
  const BRAIN_IN = 6;
  const BRAIN_HID = 6;
  const BRAIN_OUT = 2;
  const BRAIN_SIZE = BRAIN_IN * BRAIN_HID + BRAIN_HID + BRAIN_HID * BRAIN_OUT + BRAIN_OUT; // 56

  function createInitialBrain(isPredator) {
    const w = new Array(BRAIN_SIZE).fill(0);
    // W1 layout: [h * 6 + i] for h in 0..5, i in 0..5
    // Inputs: 0:sin(target), 1:cos(target), 2:targetProx, 3:sin(threat), 4:cos(threat), 5:threatProx
    // Hidden 0: turn toward target
    w[0 * 6 + 0] = isPredator ? 1.5 : 1.15;
    // Hidden 1: flee from threat (strong for prey)
    w[1 * 6 + 3] = isPredator ? -0.25 : -1.95;
    w[1 * 6 + 5] = isPredator ? 0.0 : 0.45;
    // Hidden 2: surge forward when aligned with target
    w[2 * 6 + 1] = isPredator ? 0.95 : 0.65;
    w[2 * 6 + 2] = isPredator ? 1.25 : 0.65;
    // Hidden 3: panic sprint when threat is close
    w[3 * 6 + 5] = isPredator ? 0.2 : 1.75;
    // Hidden 4 & 5: exploratory plastic neurons for online RL to sculpt carving / evasion
    w[4 * 6 + 0] = 0.35;
    w[4 * 6 + 2] = 0.35;
    w[5 * 6 + 3] = -0.35;
    w[5 * 6 + 4] = -0.35;

    // b1: indices 36..41 (zeros)
    // W2 layout: [42 + o * 6 + h] for o in 0..1 (0:steer, 1:throttle), h in 0..5
    w[42 + 0 * 6 + 0] = 1.35;  // h0 -> steer toward target
    w[42 + 0 * 6 + 1] = 1.55;  // h1 -> steer away from threat
    w[42 + 0 * 6 + 4] = 0.25;  // plastic
    w[42 + 0 * 6 + 5] = 0.25;  // plastic

    w[42 + 1 * 6 + 2] = 1.15;  // h2 -> sprint toward target
    w[42 + 1 * 6 + 3] = 1.35;  // h3 -> sprint away from threat
    w[42 + 1 * 6 + 4] = 0.20;
    // b2: indices 54..55
    w[54] = 0.0;
    w[55] = isPredator ? 0.2 : 0.05;
    return w;
  }

  function cloneBrain(brain, isPredator) {
    if (Array.isArray(brain) && brain.length === BRAIN_SIZE) {
      return brain.slice();
    }
    return createInitialBrain(isPredator);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function wrapHue(h) {
    return ((h % 1) + 1) % 1;
  }

  function defaultBehavior(overrides = {}) {
    return {
      seekFood: overrides.seekFood ?? 0.9,
      seekPrey: overrides.seekPrey ?? 0.0,
      fleePred: overrides.fleePred ?? 1.1,
      sprintBoost: overrides.sprintBoost ?? 0.55,
      visionRange: overrides.visionRange ?? 360,
    };
  }

  function cloneGenome(g) {
    const b = g.behavior || {};
    const isPred = Array.isArray(g.nodes) && g.nodes.some((n) => n.type === CELL_TYPE.ATTACKER);
    return {
      name: g.name || "Evolved",
      hue: g.hue,
      oscFreq: g.oscFreq,
      oscPhaseStep: g.oscPhaseStep,
      mutationRate: g.mutationRate,
      behavior: defaultBehavior(b),
      brain: cloneBrain(g.brain, isPred),
      nodes: g.nodes.map((n) => ({
        type: n.type,
        parent: n.parent,
        angle: n.angle,
        dist: n.dist,
        radius: n.radius,
        muscleAmp: n.muscleAmp,
        musclePhase: n.musclePhase,
        senseWeight: n.senseWeight,
      })),
      extraBonds: (g.extraBonds || []).map((e) => [e[0], e[1]]),
    };
  }

  function makeNode(type, parent, angle, dist, opts = {}) {
    return {
      type,
      parent,
      angle,
      dist,
      radius: opts.radius ?? 1.0,
      muscleAmp: opts.muscleAmp ?? (type === CELL_TYPE.MUSCLE ? 0.52 : 0.0),
      musclePhase: opts.musclePhase ?? 0.0,
      senseWeight: opts.senseWeight ?? (type === CELL_TYPE.SENSOR ? 1.0 : 0.35),
    };
  }

  // ── Curated Starter Species ─────────────────────────────────────────────────
  function createStarterGenomes() {
    // 1. Flagellate Swimmer: nimble bloom-forager that bolts from predators
    const swimmer = {
      name: "Flagellate",
      hue: 0.54, // cyan-teal
      oscFreq: 2.9,
      oscPhaseStep: 0.95,
      mutationRate: 0.16,
      behavior: defaultBehavior({ seekFood: 1.25, seekPrey: 0.0, fleePred: 1.5, sprintBoost: 0.75, visionRange: 380 }),
      nodes: [
        makeNode(CELL_TYPE.CONSTRUCTOR, -1, 0, 0, { radius: 1.12 }),
        makeNode(CELL_TYPE.SENSOR, 0, 0, 14.5, { radius: 0.92, senseWeight: 1.2 }),
        makeNode(CELL_TYPE.PHOTO, 0, 1.15, 14.0, { radius: 1.02 }),
        makeNode(CELL_TYPE.PHOTO, 0, -1.15, 14.0, { radius: 1.02 }),
        makeNode(CELL_TYPE.MUSCLE, 0, Math.PI, 14.5, { radius: 0.98, muscleAmp: 0.58, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.MUSCLE, 4, 0, 13.5, { radius: 0.88, muscleAmp: 0.65, musclePhase: 0.9 }),
        makeNode(CELL_TYPE.MUSCLE, 5, 0, 12.5, { radius: 0.78, muscleAmp: 0.72, musclePhase: 1.8 }),
      ],
      extraBonds: [
        [1, 2],
        [1, 3],
      ],
    };

    // 2. Solar Rosette: glowing radial photosynthesizer with gentle pulsing petals
    const rosette = {
      name: "Solar Rosette",
      hue: 0.36, // emerald-mint
      oscFreq: 1.35,
      oscPhaseStep: 0.6,
      mutationRate: 0.14,
      nodes: [
        makeNode(CELL_TYPE.CONSTRUCTOR, -1, 0, 0, { radius: 1.18 }),
        makeNode(CELL_TYPE.PHOTO, 0, 0.0, 15.0, { radius: 1.06 }),
        makeNode(CELL_TYPE.PHOTO, 0, 1.256, 15.0, { radius: 1.06 }),
        makeNode(CELL_TYPE.PHOTO, 0, 2.513, 15.0, { radius: 1.06 }),
        makeNode(CELL_TYPE.PHOTO, 0, 3.770, 15.0, { radius: 1.06 }),
        makeNode(CELL_TYPE.PHOTO, 0, 5.026, 15.0, { radius: 1.06 }),
        makeNode(CELL_TYPE.MUSCLE, 1, 0.25, 13.0, { radius: 0.8, muscleAmp: 0.42, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.MUSCLE, 3, -0.25, 13.0, { radius: 0.8, muscleAmp: 0.42, musclePhase: 3.14 }),
      ],
      extraBonds: [
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 1],
      ],
    };

    // 3. Bilateral Hunter: fast predator that actively tracks & pursues prey
    const hunter = {
      name: "Viperid",
      hue: 0.96, // crimson-magenta
      oscFreq: 3.5,
      oscPhaseStep: 0.85,
      mutationRate: 0.16,
      behavior: defaultBehavior({ seekFood: 0.2, seekPrey: 1.65, fleePred: 0.15, sprintBoost: 0.9, visionRange: 820 }),
      nodes: [
        makeNode(CELL_TYPE.CORE, -1, 0, 0, { radius: 1.08 }),
        makeNode(CELL_TYPE.SENSOR, 0, 0, 14.5, { radius: 0.9, senseWeight: 1.4 }),
        makeNode(CELL_TYPE.ATTACKER, 1, 0.62, 13.5, { radius: 0.96 }),
        makeNode(CELL_TYPE.ATTACKER, 1, -0.62, 13.5, { radius: 0.96 }),
        makeNode(CELL_TYPE.CONSTRUCTOR, 0, Math.PI, 14.5, { radius: 1.08 }),
        makeNode(CELL_TYPE.MUSCLE, 0, 1.95, 14.0, { radius: 0.92, muscleAmp: 0.62, musclePhase: 0.2 }),
        makeNode(CELL_TYPE.MUSCLE, 0, -1.95, 14.0, { radius: 0.92, muscleAmp: 0.62, musclePhase: 0.2 }),
        makeNode(CELL_TYPE.MUSCLE, 4, 0, 14.0, { radius: 0.9, muscleAmp: 0.68, musclePhase: 1.2 }),
        makeNode(CELL_TYPE.MUSCLE, 7, 0, 13.0, { radius: 0.78, muscleAmp: 0.72, musclePhase: 2.2 }),
      ],
      extraBonds: [
        [0, 2],
        [0, 3],
      ],
    };

    // 4. Ciliate Grazer: wide filter-feeder with symmetric rowing paddles
    const grazer = {
      name: "Ciliate",
      hue: 0.14, // warm gold-amber
      oscFreq: 2.3,
      oscPhaseStep: 0.7,
      mutationRate: 0.15,
      nodes: [
        makeNode(CELL_TYPE.CONSTRUCTOR, -1, 0, 0, { radius: 1.15 }),
        makeNode(CELL_TYPE.SENSOR, 0, 0, 14.5, { radius: 0.9, senseWeight: 1.1 }),
        makeNode(CELL_TYPE.PHOTO, 1, 0.85, 13.5, { radius: 1.02 }),
        makeNode(CELL_TYPE.PHOTO, 1, -0.85, 13.5, { radius: 1.02 }),
        makeNode(CELL_TYPE.MUSCLE, 0, 1.75, 14.5, { radius: 0.95, muscleAmp: 0.56, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.MUSCLE, 0, -1.75, 14.5, { radius: 0.95, muscleAmp: 0.56, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.PHOTO, 0, Math.PI, 14.0, { radius: 1.0 }),
        makeNode(CELL_TYPE.MUSCLE, 4, 0.3, 12.5, { radius: 0.82, muscleAmp: 0.6, musclePhase: 0.9 }),
        makeNode(CELL_TYPE.MUSCLE, 5, -0.3, 12.5, { radius: 0.82, muscleAmp: 0.6, musclePhase: 0.9 }),
      ],
      extraBonds: [
        [0, 2],
        [0, 3],
      ],
    };

    // 5. Serpent / Nematode: fast undulating ambush hunter
    const serpent = {
      name: "Nematode",
      hue: 0.76, // violet-indigo
      oscFreq: 3.2,
      oscPhaseStep: 0.8,
      mutationRate: 0.16,
      behavior: defaultBehavior({ seekFood: 0.45, seekPrey: 1.35, fleePred: 0.25, sprintBoost: 0.85, visionRange: 740 }),
      nodes: [
        makeNode(CELL_TYPE.SENSOR, -1, 0, 0, { radius: 0.96, senseWeight: 1.3 }),
        makeNode(CELL_TYPE.ATTACKER, 0, 0, 13.0, { radius: 0.92 }),
        makeNode(CELL_TYPE.CONSTRUCTOR, 0, Math.PI, 14.0, { radius: 1.08 }),
        makeNode(CELL_TYPE.MUSCLE, 2, 0, 13.5, { radius: 0.96, muscleAmp: 0.55, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.CORE, 3, 0, 13.5, { radius: 0.94 }),
        makeNode(CELL_TYPE.MUSCLE, 4, 0, 13.5, { radius: 0.92, muscleAmp: 0.62, musclePhase: 1.0 }),
        makeNode(CELL_TYPE.MUSCLE, 5, 0, 13.0, { radius: 0.86, muscleAmp: 0.68, musclePhase: 2.0 }),
        makeNode(CELL_TYPE.MUSCLE, 6, 0, 12.5, { radius: 0.78, muscleAmp: 0.72, musclePhase: 3.0 }),
      ],
      extraBonds: [],
    };

    // 6. Colonial Jelly: pulsing bell truss with trailing absorber tendrils
    const jelly = {
      name: "Medusa",
      hue: 0.62, // electric blue
      oscFreq: 1.9,
      oscPhaseStep: 0.55,
      mutationRate: 0.15,
      nodes: [
        makeNode(CELL_TYPE.CONSTRUCTOR, -1, 0, 0, { radius: 1.16 }),
        makeNode(CELL_TYPE.SENSOR, 0, 0, 14.0, { radius: 0.9, senseWeight: 1.0 }),
        makeNode(CELL_TYPE.MUSCLE, 0, 1.25, 14.5, { radius: 0.96, muscleAmp: 0.58, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.MUSCLE, 0, -1.25, 14.5, { radius: 0.96, muscleAmp: 0.58, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.PHOTO, 2, 1.35, 14.0, { radius: 0.92 }),
        makeNode(CELL_TYPE.PHOTO, 3, -1.35, 14.0, { radius: 0.92 }),
        makeNode(CELL_TYPE.PHOTO, 4, 0.15, 13.5, { radius: 0.84 }),
        makeNode(CELL_TYPE.PHOTO, 5, -0.15, 13.5, { radius: 0.84 }),
      ],
      extraBonds: [
        [1, 2],
        [1, 3],
        [0, 4],
        [0, 5],
      ],
    };

    // 7. Shellback: armored grazer with silver Defender carapace plates
    const shellback = {
      name: "Shellback",
      hue: 0.56,
      oscFreq: 2.1,
      oscPhaseStep: 0.75,
      mutationRate: 0.15,
      behavior: defaultBehavior({ seekFood: 1.2, seekPrey: 0.0, fleePred: 0.9, sprintBoost: 0.45, visionRange: 360 }),
      nodes: [
        makeNode(CELL_TYPE.CONSTRUCTOR, -1, 0, 0, { radius: 1.12 }),
        makeNode(CELL_TYPE.SENSOR, 0, 0, 14.0, { radius: 0.9, senseWeight: 1.0 }),
        makeNode(CELL_TYPE.DEFENDER, 0, 0.95, 14.5, { radius: 1.05 }),
        makeNode(CELL_TYPE.DEFENDER, 0, -0.95, 14.5, { radius: 1.05 }),
        makeNode(CELL_TYPE.PHOTO, 0, 2.0, 14.0, { radius: 1.0 }),
        makeNode(CELL_TYPE.PHOTO, 0, -2.0, 14.0, { radius: 1.0 }),
        makeNode(CELL_TYPE.MUSCLE, 0, Math.PI, 14.5, { radius: 0.95, muscleAmp: 0.55, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.MUSCLE, 6, 0, 13.0, { radius: 0.84, muscleAmp: 0.62, musclePhase: 0.9 }),
      ],
      extraBonds: [
        [1, 2],
        [1, 3],
      ],
    };

    // 8. Urchin: warning-orange Venom-spined grazer that shocks careless hunters
    const urchin = {
      name: "Urchin",
      hue: 0.08,
      oscFreq: 1.8,
      oscPhaseStep: 0.65,
      mutationRate: 0.15,
      behavior: defaultBehavior({ seekFood: 1.15, seekPrey: 0.0, fleePred: 0.75, sprintBoost: 0.5, visionRange: 350 }),
      nodes: [
        makeNode(CELL_TYPE.CONSTRUCTOR, -1, 0, 0, { radius: 1.12 }),
        makeNode(CELL_TYPE.SENSOR, 0, 0, 14.0, { radius: 0.88, senseWeight: 1.0 }),
        makeNode(CELL_TYPE.PHOTO, 0, 1.05, 14.0, { radius: 1.0 }),
        makeNode(CELL_TYPE.PHOTO, 0, -1.05, 14.0, { radius: 1.0 }),
        makeNode(CELL_TYPE.VENOM, 2, 0.35, 13.5, { radius: 0.92 }),
        makeNode(CELL_TYPE.VENOM, 3, -0.35, 13.5, { radius: 0.92 }),
        makeNode(CELL_TYPE.MUSCLE, 0, Math.PI, 14.5, { radius: 0.92, muscleAmp: 0.52, musclePhase: 0.0 }),
        makeNode(CELL_TYPE.PHOTO, 6, 0, 13.0, { radius: 0.92 }),
      ],
      extraBonds: [
        [1, 2],
        [1, 3],
      ],
    };

    return [swimmer, rosette, hunter, grazer, serpent, jelly, shellback, urchin];
  }

  // ── Mutation Operator ───────────────────────────────────────────────────────
  function mutateGenome(parentGenome, rng) {
    const g = cloneGenome(parentGenome);
    const rate = clamp(g.mutationRate || 0.15, 0.05, 0.35);

    // Subtle lineage hue drift
    g.hue = wrapHue(g.hue + (rng() - 0.5) * 0.06);

    // Pacemaker & mutation rate drift
    if (rng() < rate * 1.4) {
      g.oscFreq = clamp(g.oscFreq + (rng() - 0.5) * 0.55, 0.8, 5.0);
    }
    if (rng() < rate) {
      g.oscPhaseStep = clamp(g.oscPhaseStep + (rng() - 0.5) * 0.3, 0.2, 2.0);
    }
    if (rng() < 0.12) {
      g.mutationRate = clamp(rate + (rng() - 0.5) * 0.04, 0.06, 0.30);
    }

    // Behavioral weight mutations (evolvable foraging, hunting, fleeing, sprinting)
    const b = g.behavior;
    if (rng() < rate * 1.4) b.seekFood = clamp(b.seekFood + (rng() - 0.5) * 0.45, -0.3, 2.2);
    if (rng() < rate * 1.4) b.seekPrey = clamp(b.seekPrey + (rng() - 0.5) * 0.45, -0.3, 2.4);
    if (rng() < rate * 1.4) b.fleePred = clamp(b.fleePred + (rng() - 0.5) * 0.45, -0.2, 2.4);
    if (rng() < rate * 1.2) b.sprintBoost = clamp(b.sprintBoost + (rng() - 0.5) * 0.3, 0.05, 1.3);
    if (rng() < rate) b.visionRange = clamp(b.visionRange + (rng() - 0.5) * 140, 220, 1200);

    // Neural brain weight mutation (preserves learned structure while allowing exploration)
    if (Array.isArray(g.brain)) {
      for (let k = 0; k < g.brain.length; k++) {
        if (rng() < rate * 0.9) {
          g.brain[k] = Number(clamp(g.brain[k] + (rng() - 0.5) * 0.24, -3.2, 3.2).toFixed(4));
        }
      }
    }

    const parentHasAttacker = countType(parentGenome, CELL_TYPE.ATTACKER) > 0;

    // Per-node parametric drift
    for (let i = 0; i < g.nodes.length; i++) {
      const n = g.nodes[i];
      if (i > 0 && rng() < rate) {
        n.angle += (rng() - 0.5) * 0.38;
      }
      if (i > 0 && rng() < rate) {
        n.dist = clamp(n.dist + (rng() - 0.5) * 2.2, 11.0, 18.5);
      }
      if (rng() < rate) {
        n.radius = clamp(n.radius + (rng() - 0.5) * 0.18, 0.72, 1.32);
      }
      if (n.type === CELL_TYPE.MUSCLE && rng() < rate * 1.3) {
        n.muscleAmp = clamp(n.muscleAmp + (rng() - 0.5) * 0.22, 0.18, 0.85);
        n.musclePhase += (rng() - 0.5) * 0.6;
      }
      if (n.type === CELL_TYPE.SENSOR && rng() < rate) {
        n.senseWeight = clamp(n.senseWeight + (rng() - 0.5) * 0.35, -1.5, 1.8);
      }
      // Occasional cell-type transmutation (keep at least one constructor; rare de-novo attackers in prey)
      if (rng() < rate * 0.18) {
        let newType = Math.floor(rng() * NUM_CELL_TYPES);
        if (newType === CELL_TYPE.ATTACKER && !parentHasAttacker && rng() < 0.92) {
          newType = CELL_TYPE.MUSCLE;
        }
        if (n.type !== CELL_TYPE.CONSTRUCTOR || countType(g, CELL_TYPE.CONSTRUCTOR) > 1) {
          n.type = newType;
          if (newType === CELL_TYPE.MUSCLE && n.muscleAmp < 0.2) {
            n.muscleAmp = 0.45 + rng() * 0.3;
            n.musclePhase = rng() * Math.PI * 2;
          }
        }
      }
    }

    // Structural mutation: add a new cell (often bilaterally symmetric!)
    if (g.nodes.length < MAX_GENOME_NODES && rng() < rate * 0.55) {
      const parentIdx = Math.floor(rng() * g.nodes.length);
      const angle = (rng() - 0.5) * Math.PI * 1.6;
      const dist = 12.5 + rng() * 4.5;
      const typeRoll = rng();
      let type = CELL_TYPE.PHOTO;
      if (typeRoll < 0.28) type = CELL_TYPE.MUSCLE;
      else if (typeRoll < 0.52) type = CELL_TYPE.PHOTO;
      else if (typeRoll < 0.66) type = CELL_TYPE.SENSOR;
      else if (typeRoll < 0.78) type = CELL_TYPE.DEFENDER;
      else if (typeRoll < 0.89) type = CELL_TYPE.VENOM;
      else if (typeRoll < 0.95 && parentHasAttacker) type = CELL_TYPE.ATTACKER;
      else type = CELL_TYPE.CORE;

      const newNode = makeNode(type, parentIdx, angle, dist, {
        radius: 0.8 + rng() * 0.35,
        muscleAmp: type === CELL_TYPE.MUSCLE ? 0.38 + rng() * 0.36 : 0,
        musclePhase: rng() * Math.PI * 2,
      });
      g.nodes.push(newNode);

      // 45% chance to mirror symmetrically on root/spine for organic bilateral forms
      if (
        g.nodes.length < MAX_GENOME_NODES &&
        Math.abs(angle) > 0.35 &&
        rng() < 0.45
      ) {
        g.nodes.push(
          makeNode(type, parentIdx, -angle, dist, {
            radius: newNode.radius,
            muscleAmp: newNode.muscleAmp,
            musclePhase: newNode.musclePhase,
          })
        );
      }
    }

    // Structural mutation: prune a leaf cell (keep minimum 4 cells)
    if (g.nodes.length > 5 && rng() < rate * 0.35) {
      const hasChild = new Uint8Array(g.nodes.length);
      for (let i = 1; i < g.nodes.length; i++) {
        if (g.nodes[i].parent >= 0) hasChild[g.nodes[i].parent] = 1;
      }
      const leaves = [];
      for (let i = 1; i < g.nodes.length; i++) {
        if (!hasChild[i]) {
          if (
            g.nodes[i].type !== CELL_TYPE.CONSTRUCTOR ||
            countType(g, CELL_TYPE.CONSTRUCTOR) > 1
          ) {
            leaves.push(i);
          }
        }
      }
      if (leaves.length > 0) {
        const rm = leaves[Math.floor(rng() * leaves.length)];
        g.nodes.splice(rm, 1);
        // Remap parent indices & extraBonds
        for (let i = 1; i < g.nodes.length; i++) {
          if (g.nodes[i].parent > rm) g.nodes[i].parent--;
        }
        g.extraBonds = g.extraBonds
          .filter(([a, b]) => a !== rm && b !== rm)
          .map(([a, b]) => [a > rm ? a - 1 : a, b > rm ? b - 1 : b]);
      }
    }

    // Guarantee at least one constructor so the lineage can reproduce
    if (countType(g, CELL_TYPE.CONSTRUCTOR) === 0 && g.nodes.length > 0) {
      g.nodes[0].type = CELL_TYPE.CONSTRUCTOR;
    }

    return g;
  }

  function countType(genome, type) {
    let c = 0;
    for (let i = 0; i < genome.nodes.length; i++) {
      if (genome.nodes[i].type === type) c++;
    }
    return c;
  }

  // ── Fitness-Biased Genetic Crossover (Fitter Parent Supplies Base Body Plan) ──
  function crossoverGenomes(fitterGenome, donorGenome, rng) {
    const primary = fitterGenome;
    const donor = donorGenome;
    const child = cloneGenome(primary);

    // Subtle circular blend of lineage hue biased toward fitter parent
    let dh = donor.hue - primary.hue;
    if (dh > 0.5) dh -= 1;
    if (dh < -0.5) dh += 1;
    child.hue = wrapHue(primary.hue + dh * (0.15 + rng() * 0.25));

    // Blend locomotion, behavior & evolutionary parameters (70–85% fitter parent)
    const mixT = 0.15 + rng() * 0.25;
    child.oscFreq = primary.oscFreq * (1 - mixT) + donor.oscFreq * mixT;
    child.oscPhaseStep = primary.oscPhaseStep * (1 - mixT) + donor.oscPhaseStep * mixT;
    child.mutationRate = primary.mutationRate * (1 - mixT) + donor.mutationRate * mixT;

    const pb = defaultBehavior(primary.behavior);
    const db = defaultBehavior(donor.behavior);
    child.behavior = {
      seekFood: pb.seekFood * (1 - mixT) + db.seekFood * mixT,
      seekPrey: pb.seekPrey * (1 - mixT) + db.seekPrey * mixT,
      fleePred: pb.fleePred * (1 - mixT) + db.fleePred * mixT,
      sprintBoost: pb.sprintBoost * (1 - mixT) + db.sprintBoost * mixT,
      visionRange: pb.visionRange * (1 - mixT) + db.visionRange * mixT,
    };

    // Blend learned neural brain weights (70-85% fitter parent)
    const pBrain = cloneBrain(primary.brain, countType(primary, CELL_TYPE.ATTACKER) > 0);
    const dBrain = cloneBrain(donor.brain, countType(donor, CELL_TYPE.ATTACKER) > 0);
    child.brain = new Array(BRAIN_SIZE);
    for (let k = 0; k < BRAIN_SIZE; k++) {
      child.brain[k] = Number((pBrain[k] * (1 - mixT) + dBrain[k] * mixT).toFixed(4));
    }

    // 1. Gentle parametric refinement on overlapping nodes (preserves winning morphology)
    const minLen = Math.min(child.nodes.length, donor.nodes.length);
    for (let i = 1; i < minLen; i++) {
      if (rng() < 0.22) {
        const dn = donor.nodes[i];
        const cn = child.nodes[i];
        cn.muscleAmp = cn.muscleAmp * (1 - mixT) + dn.muscleAmp * mixT;
        cn.musclePhase = cn.musclePhase * (1 - mixT) + dn.musclePhase * mixT;
        cn.senseWeight = cn.senseWeight * (1 - mixT) + dn.senseWeight * mixT;
        cn.radius = cn.radius * (1 - mixT) + dn.radius * mixT;
        if (rng() < 0.25) cn.type = dn.type;
      }
    }

    // 2. Rare limb/subtree graft (18%) so aerodynamic body plans aren't scrambled
    if (donor.nodes.length > 2 && child.nodes.length < MAX_GENOME_NODES - 2 && rng() < 0.18) {
      const donorStart = 1 + Math.floor(rng() * (donor.nodes.length - 1));
      // Collect subtree rooted at donorStart
      const subtree = [donorStart];
      for (let i = donorStart + 1; i < donor.nodes.length; i++) {
        if (subtree.includes(donor.nodes[i].parent)) {
          subtree.push(i);
        }
      }
      if (subtree.length > 0 && child.nodes.length + subtree.length <= MAX_GENOME_NODES) {
        const attachIdx = Math.floor(rng() * child.nodes.length);
        const indexMap = new Map();
        for (let k = 0; k < subtree.length; k++) {
          const oldIdx = subtree[k];
          const src = donor.nodes[oldIdx];
          const newIdx = child.nodes.length;
          indexMap.set(oldIdx, newIdx);
          const newParent = k === 0 ? attachIdx : indexMap.get(src.parent);
          child.nodes.push({
            type: src.type,
            parent: newParent,
            angle: src.angle,
            dist: src.dist,
            radius: src.radius,
            muscleAmp: src.muscleAmp,
            musclePhase: src.musclePhase,
            senseWeight: src.senseWeight,
          });
        }
      }
    }

    // Guarantee at least one constructor
    if (countType(child, CELL_TYPE.CONSTRUCTOR) === 0 && child.nodes.length > 0) {
      child.nodes[0].type = CELL_TYPE.CONSTRUCTOR;
    }

    return child;
  }

  window.AlienGenomes = {
    CELL_TYPE,
    NUM_CELL_TYPES,
    MAX_GENOME_NODES,
    BRAIN_SIZE,
    createInitialBrain,
    cloneGenome,
    createStarterGenomes,
    mutateGenome,
    crossoverGenomes,
  };
})();
