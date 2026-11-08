
        /**
         * BEER-LAMBERT ABSORPTION PALETTES (K = [R_abs, G_abs, B_abs])
         * Low K in a channel means that channel is REFLECTED by the pigment.
         */
        const BOTANICAL_PALETTES = [
            {
                name: "Classic Crimson & Emerald Leaf",
                petalRim: [
                    [0.03, 0.90, 0.86], // Deep Carmine Crimson
                    [0.02, 0.82, 0.78], // Vermilion Red
                    [0.06, 0.94, 0.82]  // Ruby Madder
                ],
                petalVein: [
                    [0.04, 0.86, 0.80], // Crisp Scarlet Vein
                    [0.08, 0.80, 0.84]  // Warm Carmine Hatch
                ],
                throatPool: [
                    [0.14, 0.96, 0.92], // Deep Velvety Maroon
                    [0.22, 0.95, 0.88]  // Dark Burgundy Core
                ],
                leafColors: [
                    [0.88, 0.08, 0.86], // Pure Botanical Emerald Green
                    [0.82, 0.10, 0.90], // Rich Sap & Leaf Green
                    [0.90, 0.14, 0.82]  // Deep Forest Viridian (strictly green, no slate-blue)
                ],
                stamenColors: [
                    [0.86, 0.09, 0.86], // Green Carpel Cluster (matches reference 1)
                    [0.04, 0.18, 0.90]  // Golden Pollen Dot
                ]
            },
            {
                name: "Burnt Sienna & Indigo Leaf",
                petalRim: [
                    [0.10, 0.68, 0.84], // Burnt Sienna
                    [0.06, 0.78, 0.80], // Sanguine Terracotta
                    [0.16, 0.58, 0.82]  // Raw Sienna
                ],
                petalVein: [
                    [0.12, 0.62, 0.80], // Sienna Ink Vein
                    [0.20, 0.52, 0.76]  // Ochre Sienna Hatch
                ],
                throatPool: [
                    [0.28, 0.85, 0.88], // Deep Burnt Umber Pool
                    [0.84, 0.68, 0.18]  // Indigo Core Accent
                ],
                leafColors: [
                    [0.82, 0.56, 0.14], // Prussian Indigo Leaf
                    [0.72, 0.36, 0.45], // Indigo-Teal Foliage
                    [0.52, 0.46, 0.38]  // Payne's Grey Leaf
                ],
                stamenColors: [
                    [0.06, 0.28, 0.86], // Warm Amber Stamen
                    [0.84, 0.62, 0.16]  // Deep Indigo Center
                ]
            },
            {
                name: "Hibiscus Scarlet & Forest",
                petalRim: [
                    [0.03, 0.85, 0.80], // Hibiscus Scarlet
                    [0.05, 0.90, 0.76], // Alizarin Crimson
                    [0.04, 0.74, 0.84]  // Cadmium Red
                ],
                petalVein: [
                    [0.05, 0.86, 0.80], // Intense Scarlet Filaments
                    [0.12, 0.92, 0.84]  // Deep Ruby Ray
                ],
                throatPool: [
                    [0.16, 0.96, 0.90], // Dark Hibiscus Eye
                    [0.25, 0.94, 0.86]  // Velvety Crimson Throat
                ],
                leafColors: [
                    [0.86, 0.18, 0.76], // Forest Botanical Green
                    [0.78, 0.14, 0.82], // Leaf Green
                    [0.90, 0.26, 0.68]  // Deep Pine Green
                ],
                stamenColors: [
                    [0.04, 0.16, 0.88], // Bright Pollen Tips
                    [0.78, 0.16, 0.78]  // Green Stigma
                ]
            },
            {
                name: "Vintage Ochre & Olive",
                petalRim: [
                    [0.06, 0.48, 0.86], // Marigold Ochre (matches reference 4)
                    [0.05, 0.76, 0.80], // Persimmon Red-Orange
                    [0.10, 0.36, 0.84]  // Golden Ochre
                ],
                petalVein: [
                    [0.08, 0.44, 0.84], // Cadmium Orange Vein
                    [0.14, 0.62, 0.80]  // Warm Rust Vein
                ],
                throatPool: [
                    [0.18, 0.84, 0.86], // Deep Rust Throat
                    [0.28, 0.68, 0.84]  // Raw Umber Core
                ],
                leafColors: [
                    [0.76, 0.16, 0.78], // Vintage Olive Emerald
                    [0.66, 0.22, 0.84], // Warm Moss Green
                    [0.82, 0.24, 0.68]  // Hooker's Green
                ],
                stamenColors: [
                    [0.78, 0.14, 0.78], // Emerald Carpel Knot
                    [0.04, 0.14, 0.88]  // Gold Pollen
                ]
            },
            {
                name: "Sumi-e Botanical",
                petalRim: [
                    [0.68, 0.64, 0.60], // Dark Sumi Carbon Ink
                    [0.48, 0.45, 0.42], // Medium Sumi Wash
                    [0.06, 0.86, 0.80]  // Cinnabar Red Accent
                ],
                petalVein: [
                    [0.42, 0.39, 0.36], // Diluted Sumi Line
                    [0.56, 0.50, 0.44]  // Warm Sepia Ink
                ],
                throatPool: [
                    [0.88, 0.84, 0.80], // Concentrated Pine Soot
                    [0.14, 0.88, 0.82]  // Deep Cinnabar Core
                ],
                leafColors: [
                    [0.64, 0.60, 0.54], // Sumi Charcoal Leaf
                    [0.52, 0.44, 0.48], // Indigo-Tinted Sumi
                    [0.72, 0.52, 0.62]  // Muted Sage Sumi
                ],
                stamenColors: [
                    [0.05, 0.85, 0.80], // Cinnabar Stamens
                    [0.88, 0.84, 0.80]  // Black Ink Dots
                ]
            }
        ];

        /**
         * MULTI-SCREEN & SIMULATION CONFIGURATION
         */
        const params = new URLSearchParams(window.location.search);
        const screenIndex = parseInt(params.get("screen") || "0", 10);
        const totalScreens = parseInt(params.get("screens") || "1", 10);
        const isPrimary = screenIndex === 0;

        document.title = `Florilegium ${screenIndex}`;

        const bc = new BroadcastChannel("florilegium");

        const GRID_W = 2048 * totalScreens;
        const GRID_H = 2048;
        const MAX_AGENTS = 140000;
        const AGENT_STRIDE = 32; // 8 floats * 4 bytes

        /**
         * DETERMINISTIC PRNG, POLAR NOISE & POLYGON OCCLUSION HELPERS
         */
        function mulberry32(seed) {
            let a = seed | 0;
            return function() {
                a = (a + 0x6D2B79F5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }

        class PolarNoiseGenerator {
            constructor(prng) {
                this.perm = new Uint8Array(512);
                const p = new Uint8Array(256);
                for (let i = 0; i < 256; i++) p[i] = i;
                for (let i = 255; i > 0; i--) {
                    const j = Math.floor(prng() * (i + 1));
                    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
                }
                for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
            }
            fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
            lerp(a, b, t) { return a + t * (b - a); }
            grad2(hash, x, y) {
                const h = hash & 7;
                const u = h < 4 ? x : y;
                const v = h < 4 ? y : x;
                return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
            }
            noise2D(x, y) {
                const X = Math.floor(x) & 255;
                const Y = Math.floor(y) & 255;
                const xf = x - Math.floor(x);
                const yf = y - Math.floor(y);
                const u = this.fade(xf);
                const v = this.fade(yf);
                const aa = this.perm[this.perm[X] + Y];
                const ab = this.perm[this.perm[X] + Y + 1];
                const ba = this.perm[this.perm[X + 1] + Y];
                const bb = this.perm[this.perm[X + 1] + Y + 1];
                const x1 = this.lerp(this.grad2(aa, xf, yf), this.grad2(ba, xf - 1, yf), u);
                const x2 = this.lerp(this.grad2(ab, xf, yf - 1), this.grad2(bb, xf - 1, yf - 1), u);
                return this.lerp(x1, x2, v) * 0.45;
            }
            polarNoise(theta, radiusScale, seedOffset) {
                const nx = Math.cos(theta) * radiusScale + seedOffset;
                const ny = Math.sin(theta) * radiusScale + seedOffset;
                return this.noise2D(nx, ny);
            }
        }

        function isPointInPolygon(wx, wy, polyPts) {
            let inside = false;
            for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
                const xi = polyPts[i].wx !== undefined ? polyPts[i].wx : polyPts[i].x;
                const yi = polyPts[i].wy !== undefined ? polyPts[i].wy : polyPts[i].y;
                const xj = polyPts[j].wx !== undefined ? polyPts[j].wx : polyPts[j].x;
                const yj = polyPts[j].wy !== undefined ? polyPts[j].wy : polyPts[j].y;
                const intersect = ((yi > wy) !== (yj > wy)) &&
                    (wx < (xj - xi) * (wy - yi) / ((yj - yi) || 1e-7) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        /**
         * CHAIKIN SUBDIVISION SPLINE SMOOTHING
         * Refines polygonal paths into organic, calligraphic curves like in Topography
         */
        function chaikinSmooth(pts, iterations = 2, isClosed = false) {
            if (!pts || pts.length < 3) return pts;
            let cur = pts;
            for (let it = 0; it < iterations; it++) {
                const next = [];
                const n = cur.length;
                if (isClosed) {
                    for (let i = 0; i < n; i++) {
                        const p0 = cur[i];
                        const p1 = cur[(i + 1) % n];
                        next.push({
                            x: 0.75 * p0.x + 0.25 * p1.x,
                            y: 0.75 * p0.y + 0.25 * p1.y,
                            wx: 0.75 * (p0.wx !== undefined ? p0.wx : p0.x) + 0.25 * (p1.wx !== undefined ? p1.wx : p1.x),
                            wy: 0.75 * (p0.wy !== undefined ? p0.wy : p0.y) + 0.25 * (p1.wy !== undefined ? p1.wy : p1.y),
                            mainLobe: p0.mainLobe !== undefined ? (0.75 * p0.mainLobe + 0.25 * p1.mainLobe) : 0.5,
                            theta: p0.theta !== undefined ? p0.theta : 0
                        });
                        next.push({
                            x: 0.25 * p0.x + 0.75 * p1.x,
                            y: 0.25 * p0.y + 0.75 * p1.y,
                            wx: 0.25 * (p0.wx !== undefined ? p0.wx : p0.x) + 0.75 * (p1.wx !== undefined ? p1.wx : p1.x),
                            wy: 0.25 * (p0.wy !== undefined ? p0.wy : p0.y) + 0.75 * (p1.wy !== undefined ? p1.wy : p1.y),
                            mainLobe: p0.mainLobe !== undefined ? (0.25 * p0.mainLobe + 0.75 * p1.mainLobe) : 0.5,
                            theta: p1.theta !== undefined ? p1.theta : 0
                        });
                    }
                } else {
                    next.push(cur[0]);
                    for (let i = 0; i < n - 1; i++) {
                        const p0 = cur[i];
                        const p1 = cur[i + 1];
                        next.push({
                            x: 0.75 * p0.x + 0.25 * p1.x,
                            y: 0.75 * p0.y + 0.25 * p1.y,
                            wx: 0.75 * (p0.wx !== undefined ? p0.wx : p0.x) + 0.25 * (p1.wx !== undefined ? p1.wx : p1.x),
                            wy: 0.75 * (p0.wy !== undefined ? p0.wy : p0.y) + 0.25 * (p1.wy !== undefined ? p1.wy : p1.y),
                            mainLobe: p0.mainLobe !== undefined ? (0.75 * p0.mainLobe + 0.25 * p1.mainLobe) : 0.5
                        });
                        next.push({
                            x: 0.25 * p0.x + 0.75 * p1.x,
                            y: 0.25 * p0.y + 0.75 * p1.y,
                            wx: 0.25 * (p0.wx !== undefined ? p0.wx : p0.x) + 0.75 * (p1.wx !== undefined ? p1.wx : p1.x),
                            wy: 0.25 * (p0.wy !== undefined ? p0.wy : p0.y) + 0.75 * (p1.wy !== undefined ? p1.wy : p1.y),
                            mainLobe: p0.mainLobe !== undefined ? (0.25 * p0.mainLobe + 0.75 * p1.mainLobe) : 0.5
                        });
                    }
                    next.push(cur[n - 1]);
                }
                cur = next;
            }
            return cur;
        }

        const state = {
            seed: isPrimary ? Math.floor(100000 + Math.random() * 900000) : 0,
            paletteIdx: isPrimary ? Math.floor(Math.random() * BOTANICAL_PALETTES.length) : 0,
            archetype: 'mixed',
            flowerCount: totalScreens > 1 ? 5 * totalScreens : 5,
            baseLobes: 8,
            ringCount: 5,
            tiltDepth: 0.55,
            veinDensity: 1.0,
            noiseMult: 1.0,

            // Fine dip-pen stroke & drying controls
            strokeLife: 0.30,     // Short, calm 0.30s stroke lifetime
            diffusion: 0.0025,    // Ultra-subtle wet edge feathering on 2048 grid
            flowStrength: 0.08,   // Gentle wet-edge pigment advection
            wander: 0.008,        // Minimal jitter for crisp dip-pen lines
            gridOpacity: 1.0,
            paperGrain: 0.045,

            // Ink drying state machine
            inkWetness: 1.0,
            wetStartTime: 0,
            wetDuration: 1850,    // 1.85 seconds total drying window
            needsWarmup: false,

            interactionMode: 'bloom', // 'bloom' | 'brush'
            paused: false,
            flowers: [],
            scheduledAgents: [],
            scheduledCursor: 0,
            agentsPerMs: 0
        };

        let rng = mulberry32(state.seed);
        let agentData = new Float32Array(MAX_AGENTS * 8);
        const PENDING_MAX = 16384;
        const pendingBuffer = new Float32Array(PENDING_MAX * 8);
        let pendingCount = 0;
        let writeCursor = 0;
        let activeAgentCount = 0;

        function wakeUpInkDryer(durationMs = 1850, warmup = false) {
            state.inkWetness = 1.0;
            state.wetStartTime = performance.now();
            state.wetDuration = durationMs;
            if (warmup) state.needsWarmup = true;
        }

        /**
         * PACK NIB SIZE & SPEED INTO SINGLE FLOAT ATTRIBUTE (`a_speed`)
         * Integer part = round(nibSize * 100), Fractional part = clamp(speed / 20.0, 0.001, 0.995)
         */
        function packNibAndSpeed(nibSizePx, speedPxPerFrame) {
            const nibInt = Math.round(Math.max(75, Math.min(320, nibSizePx * 100)));
            const speedFrac = Math.max(0.001, Math.min(0.995, speedPxPerFrame / 20.0));
            return nibInt + speedFrac;
        }

        /**
         * QUEUE SINGLE INKFLOW AGENT FOR INCREMENTAL GPU SUB-BUFFER UPLOAD (Zero GC Allocation)
         */
        function spawnAgent(x, y, angle, K, speed, life, nibSize = 1.5) {
            if (x < 6 || x >= GRID_W - 6 || y < 6 || y >= GRID_H - 6) return;
            if (pendingCount >= PENDING_MAX) return;
            const packed = speed > 50.0 ? speed : packNibAndSpeed(nibSize, speed);
            const base = pendingCount * 8;
            pendingBuffer[base + 0] = x;
            pendingBuffer[base + 1] = y;
            pendingBuffer[base + 2] = angle;
            pendingBuffer[base + 3] = K[0];
            pendingBuffer[base + 4] = K[1];
            pendingBuffer[base + 5] = K[2];
            pendingBuffer[base + 6] = packed;
            pendingBuffer[base + 7] = life;
            pendingCount++;
        }

        /**
         * SCHEDULE CHAIKIN SPLINE STROKE
         * Spawns agents sequentially along the spline arc length from startTime to (startTime + durationMs)
         */
        function scheduleSplineStroke(targetArray, pts, K, lifeSec, nibSizePx, startTime, durationMs, fRng, stepPx = 2.0, jitterPx = 0.16) {
            if (!pts || pts.length < 2) return;

            const n = pts.length;
            const dists = new Float32Array(n);
            dists[0] = 0;
            for (let i = 1; i < n; i++) {
                const px0 = pts[i - 1].wx !== undefined ? pts[i - 1].wx : pts[i - 1].x;
                const py0 = pts[i - 1].wy !== undefined ? pts[i - 1].wy : pts[i - 1].y;
                const px1 = pts[i].wx !== undefined ? pts[i].wx : pts[i].x;
                const py1 = pts[i].wy !== undefined ? pts[i].wy : pts[i].y;
                dists[i] = dists[i - 1] + Math.hypot(px1 - px0, py1 - py0);
            }
            const totalLen = dists[n - 1];
            if (totalLen < 0.5) return;

            for (let i = 0; i < n - 1; i++) {
                const px0 = pts[i].wx !== undefined ? pts[i].wx : pts[i].x;
                const py0 = pts[i].wy !== undefined ? pts[i].wy : pts[i].y;
                const px1 = pts[i + 1].wx !== undefined ? pts[i + 1].wx : pts[i + 1].x;
                const py1 = pts[i + 1].wy !== undefined ? pts[i + 1].wy : pts[i + 1].y;

                const segLen = dists[i + 1] - dists[i];
                if (segLen < 0.2) continue;

                const angle = Math.atan2(py1 - py0, px1 - px0);
                const count = Math.max(1, Math.ceil(segLen / stepPx));
                const life = Math.max(0.14, Math.min(0.36, lifeSec));
                const glideSpeed = Math.min(2.8, Math.max(0.35, Math.min(segLen * 0.35, 3.8) / (60.0 * life)));

                for (let j = 0; j < count; j++) {
                    const fracInSeg = count === 1 ? 0.0 : j / count;
                    const curDist = dists[i] + fracInSeg * segLen;
                    const progress = Math.min(1.0, Math.max(0.0, curDist / totalLen));
                    const agentTime = startTime + progress * durationMs;

                    const localNib = nibSizePx * (1.0 - progress * 0.22);
                    const jx = fRng ? (fRng() - 0.5) * jitterPx : 0.0;
                    const jy = fRng ? (fRng() - 0.5) * jitterPx : 0.0;
                    const jAng = fRng ? (fRng() - 0.5) * 0.012 : 0.0;

                    targetArray.push({
                        time: agentTime,
                        agent: {
                            x: px0 + (px1 - px0) * fracInSeg + jx,
                            y: py0 + (py1 - py0) * fracInSeg + jy,
                            angle: angle + jAng,
                            K,
                            speed: packNibAndSpeed(localNib, glideSpeed),
                            life: life * (0.88 + 0.12 * (1.0 - progress))
                        }
                    });
                }
            }
        }

        /**
         * PUSH FINE CONTINUOUS DIP-PEN STROKE CHAIN ALONG SEGMENT (x0, y0) -> (x1, y1)
         * Places finely spaced agents (`stepPx = 1.15`) with minimal jitter (`0.18px`) so lines
         * are continuous, crisp, and never look like fat beaded sausages!
         */
        function pushStrokeChain(targetArray, x0, y0, x1, y1, K, lifeSec, nibSizePx, fRng, stepPx = 1.25, jitterPx = 0.20) {
            const dx = x1 - x0;
            const dy = y1 - y0;
            const distPx = Math.hypot(dx, dy);
            if (distPx < 0.5) return;

            const angle = Math.atan2(dy, dx);
            const count = Math.max(1, Math.ceil(distPx / stepPx));
            const life = Math.max(0.14, Math.min(0.36, lifeSec));
            // Each seeded agent glides forward ~3.5px along the stroke tangent to knit a seamless line
            const glideSpeed = Math.min(2.8, Math.max(0.35, Math.min(distPx * 0.35, 3.8) / (60.0 * life)));

            for (let i = 0; i < count; i++) {
                const t = count === 1 ? 0.0 : i / count;
                // Taper nib size from root to tip along the chain
                const localNib = nibSizePx * (1.0 - t * 0.28);
                const jx = fRng ? (fRng() - 0.5) * jitterPx : 0.0;
                const jy = fRng ? (fRng() - 0.5) * jitterPx : 0.0;
                const jAng = fRng ? (fRng() - 0.5) * 0.015 : 0.0;

                targetArray.push({
                    x: x0 + dx * t + jx,
                    y: y0 + dy * t + jy,
                    angle: angle + jAng,
                    K,
                    speed: packNibAndSpeed(localNib, glideSpeed),
                    life: life * (0.85 + 0.15 * (1.0 - t))
                });
            }
        }

        /**
         * SPAWN EXACT DISTANCE-BOUNDED STROKE (Used for interactive Dip-Pen sketching)
         */
        function spawnBoundedStroke(x0, y0, x1, y1, K, desiredLifeSec, jitterAngle = 0.015, nibSize = 1.45) {
            const dx = x1 - x0;
            const dy = y1 - y0;
            const distPx = Math.hypot(dx, dy);
            if (distPx < 0.75) return null;

            const life = Math.max(0.14, Math.min(0.38, desiredLifeSec));
            const exactSpeed = Math.min(6.0, distPx / (60.0 * life));
            const angle = Math.atan2(dy, dx) + jitterAngle;

            return { x: x0, y: y0, angle, K, speed: packNibAndSpeed(nibSize, exactSpeed), life };
        }

        /**
         * ============================================================================
         * POLAR HARMONIC & 3D CUPPING FLORAL GEOMETRY CHOREOGRAPHER
         * ============================================================================
         */
        function evaluatePolarLayerPoints(layerCfg, flowerCfg, pNoise, numSamples = 240) {
            const pts = [];
            const {
                rBase, lobeCount, lobeAmp, lobeSharpness,
                ruffleFreq, ruffleAmp, phase, rufflePhase, noiseSeed, layerNorm
            } = layerCfg;

            const { tiltStrength, tiltAngle, maxRadius, cx, cy } = flowerCfg;
            const tiltX = Math.cos(tiltAngle);
            const tiltY = Math.sin(tiltAngle);

            // Eccentric 3D throat offset: inner layers shift toward the viewer's tilt angle
            const eccentricShift = (1.0 - Math.pow(layerNorm, 0.85)) * maxRadius * 0.32 * tiltStrength;
            const ringCenterX = tiltX * eccentricShift;
            const ringCenterY = tiltY * eccentricShift;

            for (let i = 0; i <= numSamples; i++) {
                const theta = (i / numSamples) * Math.PI * 2;

                // 1. Primary petal lobes: |sin(k * theta / 2 + phase)|^p
                const rawSine = Math.abs(Math.sin(lobeCount * theta * 0.5 + phase));
                const mainLobe = Math.pow(rawSine, lobeSharpness);

                // 2. Secondary high-frequency notch/ruffle harmonic strongest at petal tips
                const tipWeight = 0.20 + 0.80 * mainLobe;
                const secondaryRuffle = Math.sin(ruffleFreq * theta + rufflePhase) * ruffleAmp * tipWeight;

                // 3. Seamless periodic polar noise
                const organicWobble = pNoise.polarNoise(theta, 2.4, noiseSeed) * 0.11 * state.noiseMult;

                // 4. Unprojected polar radius
                const r = rBase * (1.0 + lobeAmp * mainLobe + secondaryRuffle + organicWobble);

                // 5. Directional 3D foreshortening & parabolic bowl cupping
                const cosView = Math.cos(theta - tiltAngle);
                const foreshorten = 1.0 - tiltStrength * 0.24 * cosView;
                const rProj = r * foreshorten;

                const normR = r / maxRadius;
                const cupLift = Math.pow(normR, 1.65) * maxRadius * 0.20 * tiltStrength;

                const lx = ringCenterX + rProj * Math.cos(theta) - tiltX * cupLift;
                const ly = ringCenterY + rProj * Math.sin(theta) - tiltY * cupLift;

                pts.push({
                    theta,
                    r: rProj,
                    mainLobe,
                    x: lx,
                    y: ly,
                    wx: cx + lx,
                    wy: cy + ly,
                    cx: ringCenterX,
                    cy: ringCenterY,
                    wcx: cx + ringCenterX,
                    wcy: cy + ringCenterY
                });
            }
            return pts;
        }

        /**
         * Creates a mathematical blueprint for a complete flower + leaves at (cx, cy) in 2048x2048 Grid Space
         */
        function createFlowerBlueprint(cx, cy, radiusScale, archetype, localRng) {
            const palette = BOTANICAL_PALETTES[state.paletteIdx];
            const chosenArch = archetype === 'mixed'
                ? ['peony', 'chrysanthemum', 'hibiscus'][Math.floor(localRng() * 3)]
                : archetype;

            // Scaled for 2048x2048 high-DPI grid
            const maxRadius = (188 + localRng() * 88) * radiusScale;
            const tiltStrength = state.tiltDepth * (0.7 + localRng() * 0.45);
            const tiltAngle = localRng() * Math.PI * 2;
            const rotOffset = localRng() * Math.PI * 2;

            let numLayers = state.ringCount;
            let baseLobes, lobeSharpness, lobeAmpRange, ruffleFreqRange, ruffleAmpRange;

            if (chosenArch === 'peony') {
                baseLobes = Math.max(5, Math.round(state.baseLobes * (0.75 + localRng() * 0.25)));
                lobeSharpness = 0.42 + localRng() * 0.22;
                lobeAmpRange = [0.32, 0.48];
                ruffleFreqRange = [18, 28];
                ruffleAmpRange = [0.045, 0.085];
            } else if (chosenArch === 'chrysanthemum') {
                baseLobes = Math.max(8, Math.round(state.baseLobes * (1.35 + localRng() * 0.35)));
                lobeSharpness = 0.85 + localRng() * 0.40;
                lobeAmpRange = [0.48, 0.72];
                ruffleFreqRange = [12, 20];
                ruffleAmpRange = [0.015, 0.032];
            } else {
                // Hibiscus open bloom (fewer rings, broad ruffled petals, prominent central stamen burst)
                numLayers = Math.max(2, Math.min(3, state.ringCount - 2));
                baseLobes = Math.max(5, Math.min(7, Math.round(state.baseLobes * 0.7)));
                lobeSharpness = 0.52 + localRng() * 0.22;
                lobeAmpRange = [0.42, 0.62];
                ruffleFreqRange = [22, 36];
                ruffleAmpRange = [0.05, 0.095];
            }

            const rimK = palette.petalRim[Math.floor(localRng() * palette.petalRim.length)];
            const veinK = palette.petalVein[Math.floor(localRng() * palette.petalVein.length)];
            const throatK = palette.throatPool[Math.floor(localRng() * palette.throatPool.length)];

            // Build protruding botanical delta leaves tucked behind outer petal ring
            const numLeaves = 2 + Math.floor(localRng() * 3);
            const leaves = [];
            const baseLeafAngle = localRng() * Math.PI * 2;
            for (let i = 0; i < numLeaves; i++) {
                const lAngle = baseLeafAngle + (i / numLeaves) * Math.PI * 1.65 + (localRng() - 0.5) * 0.45;
                leaves.push({
                    angle: lAngle,
                    startDist: maxRadius * (0.46 + localRng() * 0.14),
                    length: maxRadius * (0.78 + localRng() * 0.34),
                    width: maxRadius * (0.44 + localRng() * 0.16),
                    bend: (localRng() - 0.5) * 0.22,
                    leafK: palette.leafColors[Math.floor(localRng() * palette.leafColors.length)]
                });
            }

            // Build concentric polar rings from outer (l = numLayers - 1) to inner (l = 0)
            const layers = [];
            for (let l = numLayers - 1; l >= 0; l--) {
                const layerNorm = numLayers === 1 ? 1.0 : l / (numLayers - 1);
                const rFrac = 0.24 + 0.76 * Math.pow(layerNorm, 0.85);
                const layerLobes = Math.max(4, baseLobes + (l % 2 === 0 ? 0 : (localRng() > 0.5 ? 1 : -1)));

                layers.push({
                    layerIndex: l,
                    layerNorm,
                    rBase: maxRadius * rFrac * 0.68,
                    lobeCount: layerLobes,
                    lobeAmp: lobeAmpRange[0] + localRng() * (lobeAmpRange[1] - lobeAmpRange[0]),
                    lobeSharpness: lobeSharpness * (0.9 + localRng() * 0.2),
                    ruffleFreq: Math.round(ruffleFreqRange[0] + localRng() * (ruffleFreqRange[1] - ruffleFreqRange[0])),
                    ruffleAmp: (ruffleAmpRange[0] + localRng() * (ruffleAmpRange[1] - ruffleAmpRange[0])) * state.noiseMult,
                    phase: rotOffset + l * (Math.PI / layerLobes) + (localRng() - 0.5) * 0.20,
                    rufflePhase: localRng() * Math.PI * 2,
                    noiseSeed: localRng() * 500
                });
            }

            return {
                cx, cy, maxRadius, tiltStrength, tiltAngle,
                archetype: chosenArch,
                rimK, veinK, throatK,
                carpelK: palette.stamenColors[0],
                stamenK: palette.stamenColors[1] || palette.petalRim[0],
                leaves,
                layers,
                seed: Math.floor(localRng() * 999999)
            };
        }

        /**
         * CHOREOGRAPHS FINE DIP-PEN, OCCLUSION-MASKED INKFLOW AGENTS ON 2048x2048 GRID
         * - Computes all concentric ring polygons first (`layerPolys`).
         * - Leaves are strictly clipped OUTSIDE `outerFlowerPoly` (`layerPolys[0]`) with crisp parallel green veins.
         * - Each petal ring `idx` has a sharp 1.75px crimson contour and ultra-fine 1.15px radial veins
         *   clipped OUTSIDE `layerPolys[idx + 1]`, leaving raw cream paper on the upper half of each petal lobe!
         */
        function choreographFlowerAgents(flower, otherFlowers = []) {
            const fRng = mulberry32(flower.seed);
            const pNoise = new PolarNoiseGenerator(fRng);
            const baseLife = state.strokeLife;

            const batchWave1 = []; // Crisp outer contours & occluded leaf outlines
            const batchWave2 = []; // Fine radial veins, leaf sawtooth hatching & throat ink pools
            const batchWave3 = []; // Inner petal rings & carpel/stamen core

            // Pre-evaluate all concentric ring polygons from outer (idx = 0) to inner (idx = N-1) with high angular resolution
            const layerPolys = flower.layers.map(layerCfg =>
                evaluatePolarLayerPoints(layerCfg, flower, pNoise, 320)
            );
            const outerFlowerPoly = layerPolys[0];

            // Helper: check if a point is occluded by another flower's outer polygon
            const isOccludedByPriorFlower = (wx, wy) => {
                for (let f = 0; f < otherFlowers.length; f++) {
                    if (otherFlowers[f] !== flower && otherFlowers[f]._outerPoly) {
                        if (isPointInPolygon(wx, wy, otherFlowers[f]._outerPoly)) return true;
                    }
                }
                return false;
            };
            flower._outerPoly = outerFlowerPoly;

            // ------------------------------------------------------------------------
            // A. DELICATE BOTANICAL DELTA LEAVES (Crisp 1.8px Outline & Separated 1.1px Veins)
            // ------------------------------------------------------------------------
            flower.leaves.forEach(lf => {
                const startX = flower.cx + Math.cos(lf.angle) * lf.startDist;
                const startY = flower.cy + Math.sin(lf.angle) * lf.startDist;
                const dirX = Math.cos(lf.angle);
                const dirY = Math.sin(lf.angle);
                const perpX = -dirY;
                const perpY = dirX;

                const steps = 64;
                const upperPts = [];
                const lowerPts = [];
                const midPts = [];

                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const dist = t * lf.length;
                    const curveOffset = Math.sin(t * Math.PI) * lf.bend * lf.length;

                    // Pointed delta-ovate leaf envelope
                    const env = Math.sin(Math.pow(t, 0.62) * Math.PI) * Math.pow(1.0 - t * 0.22, 0.78);
                    const serration = Math.sin(t * 36.0) * 0.025 * lf.width * Math.sin(t * Math.PI);
                    const halfW = (lf.width * 0.5 * env) + serration;

                    const mx = startX + dirX * dist + perpX * curveOffset;
                    const my = startY + dirY * dist + perpY * curveOffset;

                    midPts.push({ x: mx, y: my, t });
                    upperPts.push({ x: mx + perpX * halfW, y: my + perpY * halfW });
                    lowerPts.push({ x: mx - perpX * halfW, y: my - perpY * halfW });
                }

                // 1. Crisp Leaf Perimeter Outline (1.85px nib, single clean pass, strictly outside flower)
                for (let i = 0; i < steps; i++) {
                    const u0 = upperPts[i], u1 = upperPts[i + 1];
                    if (!isPointInPolygon(u0.x, u0.y, outerFlowerPoly) && !isOccludedByPriorFlower(u0.x, u0.y)) {
                        pushStrokeChain(batchWave1, u0.x, u0.y, u1.x, u1.y, lf.leafK, baseLife * 0.75, 1.85, fRng, 1.25, 0.18);
                    }

                    const l0 = lowerPts[i], l1 = lowerPts[i + 1];
                    if (!isPointInPolygon(l0.x, l0.y, outerFlowerPoly) && !isOccludedByPriorFlower(l0.x, l0.y)) {
                        pushStrokeChain(batchWave1, l0.x, l0.y, l1.x, l1.y, lf.leafK, baseLife * 0.75, 1.85, fRng, 1.25, 0.18);
                    }

                    // 2. Sharp Central Midrib Vein (1.5px nib)
                    const m0 = midPts[i], m1 = midPts[i + 1];
                    if (!isPointInPolygon(m0.x, m0.y, outerFlowerPoly) && !isOccludedByPriorFlower(m0.x, m0.y)) {
                        pushStrokeChain(batchWave1, m0.x, m0.y, m1.x, m1.y, lf.leafK, baseLife * 0.7, 1.50, fRng, 1.3, 0.12);
                    }
                }

                // 3. Distinct Parallel Angled Sawtooth Hatching on ONE side of the leaf blade (1.1px nib)
                const numLatVeins = Math.floor(11 * state.veinDensity);
                for (let v = 1; v < numLatVeins; v++) {
                    const idxBase = Math.floor((v / numLatVeins) * (steps - 7));
                    const idxTip = Math.min(steps - 1, idxBase + 5);
                    const mPt = midPts[idxBase];
                    const uPt = upperPts[idxTip];

                    if (isPointInPolygon(mPt.x, mPt.y, outerFlowerPoly) &&
                        isPointInPolygon(uPt.x, uPt.y, outerFlowerPoly)) continue;

                    let tStart = 0.05;
                    while (tStart < 0.90) {
                        const tx = mPt.x + (uPt.x - mPt.x) * tStart;
                        const ty = mPt.y + (uPt.y - mPt.y) * tStart;
                        if (!isPointInPolygon(tx, ty, outerFlowerPoly) && !isOccludedByPriorFlower(tx, ty)) break;
                        tStart += 0.06;
                    }
                    if (tStart >= 0.88) continue;

                    const sx = mPt.x + (uPt.x - mPt.x) * tStart;
                    const sy = mPt.y + (uPt.y - mPt.y) * tStart;
                    const ex = mPt.x + (uPt.x - mPt.x) * 0.94;
                    const ey = mPt.y + (uPt.y - mPt.y) * 0.94;

                    pushStrokeChain(batchWave2, sx, sy, ex, ey, lf.leafK, baseLife * 0.75, 1.15, fRng, 1.35, 0.14);
                }
            });

            // ------------------------------------------------------------------------
            // B. CONCENTRIC POLAR PETAL RINGS (Fine 1.7px Rims & 1.1px Radial Etching Veins)
            // ------------------------------------------------------------------------
            flower.layers.forEach((layerCfg, polyIdx) => {
                const pts = layerPolys[polyIdx];
                const innerPoly = polyIdx + 1 < layerPolys.length ? layerPolys[polyIdx + 1] : null;
                const numPts = pts.length - 1;
                const { layerNorm } = layerCfg;
                const targetContourWave = layerNorm > 0.45 ? batchWave1 : batchWave3;

                // 1. Crisp Tangential Petal Rim Contour (1.75px nib at lobe tips, 1.45px in valleys)
                for (let i = 0; i < numPts; i++) {
                    const p0 = pts[i];
                    const p1 = pts[i + 1];

                    if (innerPoly && isPointInPolygon(p0.wx, p0.wy, innerPoly)) continue;
                    if (isOccludedByPriorFlower(p0.wx, p0.wy)) continue;

                    const rimNib = 1.40 + 0.45 * p0.mainLobe;
                    pushStrokeChain(
                        targetContourWave,
                        p0.wx, p0.wy,
                        p1.wx, p1.wy,
                        flower.rimK,
                        baseLife * 0.75,
                        rimNib,
                        fRng,
                        1.25,
                        0.16
                    );
                }

                // 2. Ultra-Fine Radial Botanical Veins (1.1px nib) & Deep Crimson Throat Collar (2.1px nib)
                const veinStep = Math.max(2, Math.round(3.2 / state.veinDensity));
                for (let i = 0; i < numPts; i += veinStep) {
                    const pt = pts[i];
                    const throatX = pt.wcx;
                    const throatY = pt.wcy;
                    const tipX = pt.wx;
                    const tipY = pt.wy;

                    if (isOccludedByPriorFlower(tipX, tipY)) continue;

                    let startFrac = 0.07;
                    if (innerPoly) {
                        for (let f = 0.10; f <= 0.96; f += 0.03) {
                            const tx = throatX + (tipX - throatX) * f;
                            const ty = throatY + (tipY - throatY) * f;
                            if (!isPointInPolygon(tx, ty, innerPoly)) {
                                startFrac = f;
                                break;
                            }
                            startFrac = 0.98;
                        }
                    }
                    if (startFrac >= 0.90) continue;

                    let bandSpanFrac = 0.58;
                    if (flower.archetype === 'chrysanthemum') {
                        bandSpanFrac = (0.32 + 0.28 * (1.0 - pt.mainLobe)) * (0.65 + fRng() * 0.30);
                    } else if (flower.archetype === 'hibiscus') {
                        bandSpanFrac = innerPoly
                            ? (0.42 + 0.32 * Math.sin(pt.theta * layerCfg.lobeCount))
                            : (0.36 + 0.26 * Math.sin(pt.theta * 7.0 + layerCfg.phase) + fRng() * 0.20);
                    } else {
                        const lobePhase = Math.sin(pt.theta * layerCfg.lobeCount * 0.5 + layerCfg.phase);
                        const fineStriation = 0.5 + 0.5 * Math.cos(pt.theta * layerCfg.lobeCount * 3.0);
                        bandSpanFrac = (0.28 + 0.44 * lobePhase * fineStriation) * (0.70 + fRng() * 0.28);
                    }

                    const endFrac = Math.min(0.88, startFrac + (0.88 - startFrac) * bandSpanFrac);
                    if (endFrac > startFrac + 0.04) {
                        const sx = throatX + (tipX - throatX) * startFrac;
                        const sy = throatY + (tipY - throatY) * startFrac;
                        const ex = throatX + (tipX - throatX) * endFrac;
                        const ey = throatY + (tipY - throatY) * endFrac;

                        pushStrokeChain(
                            batchWave2,
                            sx, sy,
                            ex, ey,
                            flower.veinK,
                            baseLife * 0.85,
                            1.10,
                            fRng,
                            1.40,
                            0.14
                        );
                    }

                    // 3. Concentrated Crimson Throat Collar at the base of the exposed petal ring (1.9px nib)
                    const poolSpan = (0.14 + 0.14 * (1.0 - pt.mainLobe)) * (0.75 + fRng() * 0.25);
                    const poolEndFrac = Math.min(0.75, startFrac + (0.85 - startFrac) * poolSpan);
                    if (poolEndFrac > startFrac + 0.025) {
                        const psx = throatX + (tipX - throatX) * startFrac;
                        const psy = throatY + (tipY - throatY) * startFrac;
                        const pex = throatX + (tipX - throatX) * poolEndFrac;
                        const pey = throatY + (tipY - throatY) * poolEndFrac;

                        pushStrokeChain(
                            batchWave2,
                            psx, psy,
                            pex, pey,
                            flower.throatK,
                            baseLife * 0.65,
                            1.95,
                            fRng,
                            1.50,
                            0.22
                        );
                    }
                }
            });

            // ------------------------------------------------------------------------
            // C. CENTRAL CARPEL KNOT / STAMEN FILAMENTS (Crisp Botanical Center)
            // ------------------------------------------------------------------------
            const innerLayerPts = layerPolys[layerPolys.length - 1];
            const coreX = innerLayerPts[0].wcx;
            const coreY = innerLayerPts[0].wcy;
            const coreRadius = flower.maxRadius * 0.082;

            for (let s = 0; s < 52; s++) {
                const a = (s / 52) * Math.PI * 2 + (fRng() - 0.5) * 0.12;
                const r0 = fRng() * coreRadius * 0.25;
                const r1 = coreRadius * (0.45 + fRng() * 0.60);
                const isCarpel = flower.archetype !== 'hibiscus' || s < 28;

                pushStrokeChain(
                    batchWave3,
                    coreX + Math.cos(a) * r0,
                    coreY + Math.sin(a) * r0,
                    coreX + Math.cos(a + 0.18) * r1,
                    coreY + Math.sin(a + 0.18) * r1,
                    isCarpel ? flower.carpelK : flower.stamenK,
                    baseLife * 0.65,
                    1.65,
                    fRng,
                    1.30,
                    0.18
                );
            }

            return batchWave1.concat(batchWave2, batchWave3);
        }

        /**
         * GENERATE FULL MULTI-FLOWER BOTANICAL COMPOSITION ON 2048x2048 GRID
         */
        function generateBotanicalComposition(clearCanvasFn) {
            if (clearCanvasFn) clearCanvasFn();
            state.scheduledAgents = [];
            state.scheduledCursor = 0;
            state.flowers = [];
            state.compositionStartTime = performance.now();

            rng = mulberry32(state.seed);
            const count = state.flowerCount;
            const minDist = count > 6 ? 410 : 510;

            for (let i = 0; i < count; i++) {
                let bestX = 1024, bestY = 1024;
                let maxMinDist = -1;

                for (let attempt = 0; attempt < 45; attempt++) {
                    const margin = 340;
                    const cx = margin + rng() * (GRID_W - margin * 2);
                    const cy = margin + rng() * (GRID_H - margin * 2);

                    let closest = Infinity;
                    for (const f of state.flowers) {
                        const d = Math.hypot(cx - f.cx, cy - f.cy);
                        if (d < closest) closest = d;
                    }

                    if (closest >= minDist) {
                        bestX = cx; bestY = cy;
                        break;
                    }
                    if (closest > maxMinDist) {
                        maxMinDist = closest;
                        bestX = cx; bestY = cy;
                    }
                }

                const scale = (count <= 2 ? 1.22 : 0.90) + rng() * 0.25;
                const flower = createFlowerBlueprint(bestX, bestY, scale, state.archetype, rng);
                state.flowers.push(flower);
            }

            // Choreograph agents per flower and schedule them sequentially
            const flowerAgents = state.flowers.map(f => choreographFlowerAgents(f, state.flowers));
            const flowerDrawMs = 2200;
            let globalTime = 0;
            for (const fa of flowerAgents) {
                const agentsPerMs = fa.length / flowerDrawMs;
                for (let k = 0; k < fa.length; k++) {
                    state.scheduledAgents.push({
                        time: globalTime + k / agentsPerMs,
                        agent: fa[k]
                    });
                }
                globalTime += flowerDrawMs;
            }

            const drawDurationMs = globalTime;
            state.agentsPerMs = drawDurationMs > 0 ? state.scheduledAgents.length / drawDurationMs : 0;

            updateUIStatus();
        }

        function updateUIStatus() { /* screensaver: no UI */ }

        /**
         * ============================================================================
         * WEBGL2 PIPELINE INITIALIZATION & MAIN LOOP
         * ============================================================================
         */
        function initWebGL2App() {
            const canvas = document.getElementById('glcanvas');
            const gl = canvas.getContext('webgl2', {
                preserveDrawingBuffer: true,
                alpha: false,
                antialias: false
            });

            if (!gl) {
                document.body.innerHTML = `<div class="p-8 text-stone-800">WebGL2 is required for this studio.</div>`;
                return;
            }

            const extFloat = gl.getExtension('EXT_color_buffer_float');
            gl.getExtension('OES_texture_float_linear');

            function resizeCanvas() {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                canvas.width = Math.floor(window.innerWidth * dpr);
                canvas.height = Math.floor(window.innerHeight * dpr);
            }
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();

            function compileShader(type, src) {
                const s = gl.createShader(type);
                gl.shaderSource(s, src.trim());
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                    console.error('Shader error:', gl.getShaderInfoLog(s));
                }
                return s;
            }

            function createProgram(vsId, fsId, tfVaryings = null) {
                const vsSrc = document.getElementById(vsId).textContent;
                const fsSrc = document.getElementById(fsId).textContent;
                const p = gl.createProgram();
                gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vsSrc));
                gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSrc));
                if (tfVaryings) {
                    gl.transformFeedbackVaryings(p, tfVaryings, gl.INTERLEAVED_ATTRIBS);
                }
                gl.linkProgram(p);
                if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
                    console.error('Program link error:', gl.getProgramInfoLog(p));
                }
                return p;
            }

            const agentProg = createProgram('vs-agents', 'fs-deposit', [
                'v_position', 'v_angle', 'v_K', 'v_speed', 'v_life'
            ]);
            const flowProg = createProgram('vs-fullscreen', 'fs-flow');
            const displayProg = createProgram('vs-fullscreen', 'fs-display');

            // Fullscreen Quad VAO
            const quadBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
            const quadVao = gl.createVertexArray();
            gl.bindVertexArray(quadVao);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

            // Ping-Pong Agent Transform-Feedback Buffers
            const agentBufA = gl.createBuffer();
            const agentBufB = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, agentBufA);
            gl.bufferData(gl.ARRAY_BUFFER, agentData.byteLength, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, agentBufB);
            gl.bufferData(gl.ARRAY_BUFFER, agentData.byteLength, gl.DYNAMIC_DRAW);

            function makeAgentVao(buf) {
                const vao = gl.createVertexArray();
                gl.bindVertexArray(vao);
                gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, AGENT_STRIDE, 0);
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(1, 1, gl.FLOAT, false, AGENT_STRIDE, 8);
                gl.enableVertexAttribArray(2);
                gl.vertexAttribPointer(2, 3, gl.FLOAT, false, AGENT_STRIDE, 12);
                gl.enableVertexAttribArray(3);
                gl.vertexAttribPointer(3, 1, gl.FLOAT, false, AGENT_STRIDE, 24);
                gl.enableVertexAttribArray(4);
                gl.vertexAttribPointer(4, 1, gl.FLOAT, false, AGENT_STRIDE, 28);
                return vao;
            }

            let agentVaoRead = makeAgentVao(agentBufA);
            let agentVaoWrite = makeAgentVao(agentBufB);
            let agentBufRead = agentBufA;
            let agentBufWrite = agentBufB;

            function createSimTexture(w, h, isPigment) {
                const tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                if (extFloat) {
                    const internalFmt = isPigment ? gl.RGBA16F : gl.R16F;
                    const fmt = isPigment ? gl.RGBA : gl.RED;
                    gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, fmt, gl.HALF_FLOAT, null);
                } else {
                    const internalFmt = isPigment ? gl.RGBA8 : gl.R8;
                    const fmt = isPigment ? gl.RGBA : gl.RED;
                    gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, null);
                }
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                return tex;
            }

            const trailTexA = createSimTexture(GRID_W, GRID_H, false);
            const trailTexB = createSimTexture(GRID_W, GRID_H, false);
            const pigmentTexA = createSimTexture(GRID_W, GRID_H, true);
            const pigmentTexB = createSimTexture(GRID_W, GRID_H, true);

            let trailAccum = trailTexA;
            let trailNext = trailTexB;
            let pigmentAccum = pigmentTexA;
            let pigmentNext = pigmentTexB;

            const depositFbo = gl.createFramebuffer();
            const flowFbo = gl.createFramebuffer();

            function clearAllTextures() {
                pendingCount = 0;
                writeCursor = 0;
                activeAgentCount = 0;

                const zeroBuf = new Float32Array(MAX_AGENTS * 8);
                gl.bindBuffer(gl.ARRAY_BUFFER, agentBufA);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, zeroBuf);
                gl.bindBuffer(gl.ARRAY_BUFFER, agentBufB);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, zeroBuf);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);

                const clearTex = (tex) => {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, depositFbo);
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
                    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
                    gl.clearColor(0, 0, 0, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                };
                clearTex(trailTexA);
                clearTex(trailTexB);
                clearTex(pigmentTexA);
                clearTex(pigmentTexB);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }

            // Cache Uniform Locations
            const uAgent = {
                trail: gl.getUniformLocation(agentProg, 'u_trail'),
                gridSize: gl.getUniformLocation(agentProg, 'u_gridSize'),
                sensorOffset: gl.getUniformLocation(agentProg, 'u_sensorOffset'),
                sensorAngle: gl.getUniformLocation(agentProg, 'u_sensorAngle'),
                turnSpeed: gl.getUniformLocation(agentProg, 'u_turnSpeed'),
                wander: gl.getUniformLocation(agentProg, 'u_wander'),
                simTime: gl.getUniformLocation(agentProg, 'u_simTime'),
                dt: gl.getUniformLocation(agentProg, 'u_dt'),
                maxLife: gl.getUniformLocation(agentProg, 'u_maxLife'),
                trailDep: gl.getUniformLocation(agentProg, 'u_trailDeposit'),
                pigmentDep: gl.getUniformLocation(agentProg, 'u_pigmentDeposit')
            };

            const uFlow = {
                trail: gl.getUniformLocation(flowProg, 'u_trail'),
                pigment: gl.getUniformLocation(flowProg, 'u_pigment'),
                gridSize: gl.getUniformLocation(flowProg, 'u_gridSize'),
                flowStrength: gl.getUniformLocation(flowProg, 'u_flowStrength'),
                diffusion: gl.getUniformLocation(flowProg, 'u_diffusion'),
                trailDecay: gl.getUniformLocation(flowProg, 'u_trailDecay'),
                pigmentDecay: gl.getUniformLocation(flowProg, 'u_pigmentDecay')
            };

            const uDisp = {
                trail: gl.getUniformLocation(displayProg, 'u_trail'),
                pigment: gl.getUniformLocation(displayProg, 'u_pigment'),
                time: gl.getUniformLocation(displayProg, 'u_time'),
                resolution: gl.getUniformLocation(displayProg, 'u_resolution'),
                seed: gl.getUniformLocation(displayProg, 'u_seed'),
                paperColor: gl.getUniformLocation(displayProg, 'u_paper_color'),
                grain: gl.getUniformLocation(displayProg, 'u_grain'),
                gridOpacity: gl.getUniformLocation(displayProg, 'u_grid_opacity'),
                inkVisibility: gl.getUniformLocation(displayProg, 'u_ink_visibility'),
                screenIndex: gl.getUniformLocation(displayProg, 'u_screen_index'),
                totalScreens: gl.getUniformLocation(displayProg, 'u_total_screens')
            };

            // Pass 1: Agent Update + Fine Tapered Dip-Pen MRT Deposit (Zero Read/Write Texture Feedback Loop)
            function runAgentPass(dt, simTime) {
                // Sub-buffer upload of newly queued agents only (Zero allocation)
                if (pendingCount > 0) {
                    const count = pendingCount;
                    const sub = pendingBuffer.subarray(0, count * 8);
                    pendingCount = 0;

                    gl.bindBuffer(gl.ARRAY_BUFFER, agentBufRead);
                    if (writeCursor + count <= MAX_AGENTS) {
                        gl.bufferSubData(gl.ARRAY_BUFFER, writeCursor * AGENT_STRIDE, sub);
                        writeCursor += count;
                    } else {
                        const fit = MAX_AGENTS - writeCursor;
                        if (fit > 0) {
                            gl.bufferSubData(gl.ARRAY_BUFFER, writeCursor * AGENT_STRIDE, sub.subarray(0, fit * 8));
                        }
                        const rem = count - fit;
                        gl.bufferSubData(gl.ARRAY_BUFFER, 0, sub.subarray(fit * 8));
                        writeCursor = rem;
                    }
                    gl.bindBuffer(gl.ARRAY_BUFFER, null);

                    if (activeAgentCount < MAX_AGENTS) {
                        activeAgentCount = Math.min(MAX_AGENTS, Math.max(activeAgentCount, writeCursor));
                    }
                }

                if (activeAgentCount === 0) return;

                gl.bindFramebuffer(gl.FRAMEBUFFER, depositFbo);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailAccum, 0);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, pigmentAccum, 0);
                gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

                gl.viewport(0, 0, GRID_W, GRID_H);
                gl.useProgram(agentProg);

                // Read from trailNext while additively depositing into trailAccum & pigmentAccum
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, trailNext);
                gl.uniform1i(uAgent.trail, 0);

                gl.uniform2f(uAgent.gridSize, GRID_W, GRID_H);
                gl.uniform1f(uAgent.sensorOffset, 2.2);
                gl.uniform1f(uAgent.sensorAngle, Math.PI / 6.0);
                gl.uniform1f(uAgent.turnSpeed, 0.04);
                gl.uniform1f(uAgent.wander, state.wander);
                gl.uniform1f(uAgent.simTime, simTime);
                gl.uniform1f(uAgent.dt, dt);
                gl.uniform1f(uAgent.maxLife, state.strokeLife);
                gl.uniform1f(uAgent.trailDep, 0.055);
                gl.uniform1f(uAgent.pigmentDep, 0.088);

                gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, agentBufWrite);
                gl.bindVertexArray(agentVaoRead);

                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);

                gl.beginTransformFeedback(gl.POINTS);
                gl.drawArrays(gl.POINTS, 0, activeAgentCount);
                gl.endTransformFeedback();

                gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
                gl.disable(gl.BLEND);

                const tmpBuf = agentBufRead; agentBufRead = agentBufWrite; agentBufWrite = tmpBuf;
                const tmpVao = agentVaoRead; agentVaoRead = agentVaoWrite; agentVaoWrite = tmpVao;
            }

            function syncCpuAgentBufferFromGpu() {
                if (activeAgentCount > 0) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, agentBufRead);
                    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, agentData);
                    gl.bindBuffer(gl.ARRAY_BUFFER, null);
                }
            }

            // Pass 2: Subtle Wet-Edge Micro-Flow & Diffusion (Reads Accum -> Writes Next -> Swaps Accum & Next)
            function runFlowPass(wetness) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, flowFbo);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailNext, 0);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, pigmentNext, 0);
                gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

                gl.viewport(0, 0, GRID_W, GRID_H);
                gl.useProgram(flowProg);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, trailAccum);
                gl.uniform1i(uFlow.trail, 0);

                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, pigmentAccum);
                gl.uniform1i(uFlow.pigment, 1);

                gl.uniform2f(uFlow.gridSize, GRID_W, GRID_H);
                gl.uniform1f(uFlow.flowStrength, state.flowStrength * wetness);
                gl.uniform1f(uFlow.diffusion, state.diffusion * wetness);
                gl.uniform1f(uFlow.trailDecay, 0.94);
                gl.uniform1f(uFlow.pigmentDecay, 1.0); // Zero pigment fade once deposited

                gl.bindVertexArray(quadVao);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                const tmpTrail = trailAccum; trailAccum = trailNext; trailNext = tmpTrail;
                const tmpPigment = pigmentAccum; pigmentAccum = pigmentNext; pigmentNext = tmpPigment;
            }

            // Pass 3: Display Compositing onto Watercolor Paper + Pencil Grid
            function runDisplayPass(nowMs) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.useProgram(displayProg);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, trailAccum);
                gl.uniform1i(uDisp.trail, 0);

                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, pigmentAccum);
                gl.uniform1i(uDisp.pigment, 1);

                gl.uniform1f(uDisp.time, nowMs * 0.001);
                gl.uniform2f(uDisp.resolution, canvas.width, canvas.height);
                gl.uniform1f(uDisp.seed, state.seed);
                gl.uniform3f(uDisp.paperColor, 0.93, 0.90, 0.85);
                gl.uniform1f(uDisp.grain, state.paperGrain);
                gl.uniform1f(uDisp.gridOpacity, state.gridOpacity);
                gl.uniform1f(uDisp.inkVisibility, 1.0);
                gl.uniform1f(uDisp.screenIndex, screenIndex);
                gl.uniform1f(uDisp.totalScreens, totalScreens);

                gl.bindVertexArray(quadVao);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }

            // ── Dual-Screen Coordination & Startup (matching Topography & Map) ─────────
            let hasSynced = isPrimary;

            if (isPrimary) {
                generateBotanicalComposition(clearAllTextures);
                bc.postMessage({
                    cmd: "sync",
                    seed: state.seed,
                    paletteIdx: state.paletteIdx,
                    paused: state.paused,
                    elapsedTime: 0
                });
            } else {
                bc.postMessage({ cmd: "requestSync" });
                // Fallback after 2s if running standalone as secondary display
                setTimeout(() => {
                    if (!hasSynced) {
                        hasSynced = true;
                        state.seed = Math.floor(100000 + Math.random() * 900000);
                        state.paletteIdx = Math.floor(Math.random() * BOTANICAL_PALETTES.length);
                        generateBotanicalComposition(clearAllTextures);
                    }
                }, 2000);
            }

            // HUD DOM references for live drying indicator
            let lastTime = 0;
            let simTime = 0;

            function animate(now) {
                const dt = lastTime ? Math.min((now - lastTime) * 0.001, 0.04) : 0.016;
                lastTime = now;

                if (!hasSynced) {
                    runDisplayPass(now);
                    requestAnimationFrame(animate);
                    return;
                }

                // Release agents by scheduled time: fast O(1) index cursor instead of O(N) shift
                const t0 = state.compositionStartTime || now;
                let released = 0;
                while (state.scheduledCursor < state.scheduledAgents.length && state.scheduledAgents[state.scheduledCursor].time + t0 <= now) {
                    const a = state.scheduledAgents[state.scheduledCursor++].agent;
                    spawnAgent(a.x, a.y, a.angle, a.K, a.speed, a.life);
                    released++;
                }
                if (released > 0) {
                    const remainingMs = state.scheduledCursor < state.scheduledAgents.length
                        ? state.scheduledAgents[state.scheduledAgents.length - 1].time - (now - t0)
                        : 0;
                    wakeUpInkDryer(Math.max(remainingMs, 0) + 1800, false);
                }

                if (!state.paused) {
                    // Update Ink Wetness decay curve (1.0 -> 0.0 over state.wetDuration)
                    const elapsedWet = now - state.wetStartTime;
                    state.inkWetness = Math.max(0.0, 1.0 - (elapsedWet / state.wetDuration));

                    // Only run Agent & Flow passes while ink is still wet; freeze once dry so fine lines stay razor-sharp!
                    if (state.inkWetness > 0.01) {
                        simTime += dt;
                        runAgentPass(dt, simTime);
                        runFlowPass(state.inkWetness);
                    }
                }

                runDisplayPass(now);

                if (isPrimary) {
                    // Primary broadcasts sync every frame so palettes and seeds are 100% locked across monitors
                    bc.postMessage({
                        cmd: "sync",
                        seed: state.seed,
                        paletteIdx: state.paletteIdx,
                        paused: state.paused,
                        elapsedTime: now - t0
                    });

                    // Auto-advance: when all strokes are released and ink is dry, pause then draw a new composition
                    if (state.scheduledCursor >= state.scheduledAgents.length && state.inkWetness <= 0.01 && !state.paused) {
                        if (autoAdvanceTimer === 0) autoAdvanceTimer = now;
                        else if (now - autoAdvanceTimer > AUTO_PAUSE_MS) {
                            autoAdvanceTimer = 0;
                            screensaverNewComposition();
                        }
                    } else {
                        autoAdvanceTimer = 0;
                    }
                }
                
                requestAnimationFrame(animate);
            }

            /* ========== SCREENSAVER MODE ========== */
            let autoAdvanceTimer = 0;
            const AUTO_PAUSE_MS = 3500;

            function screensaverNewComposition(newSeed, newPalette) {
                state.seed = newSeed !== undefined ? newSeed : Math.floor(100000 + Math.random() * 900000);
                state.paletteIdx = newPalette !== undefined ? newPalette : Math.floor(Math.random() * BOTANICAL_PALETTES.length);
                generateBotanicalComposition(clearAllTextures);
                if (isPrimary) {
                    bc.postMessage({
                        cmd: "sync",
                        seed: state.seed,
                        paletteIdx: state.paletteIdx,
                        paused: state.paused,
                        elapsedTime: 0
                    });
                }
            }

            function screensaverSavePNG() {
                canvas.toBlob((blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `florilegium-${state.seed}-${Date.now()}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                }, 'image/png');
            }

            function screensaverTogglePause() {
                state.paused = !state.paused;
                if (isPrimary) {
                    bc.postMessage({
                        cmd: "sync",
                        seed: state.seed,
                        paletteIdx: state.paletteIdx,
                        paused: state.paused,
                        elapsedTime: performance.now() - (state.compositionStartTime || performance.now())
                    });
                }
            }

            function screensaverToggleFullscreen() {
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen();
            }

            // ── Multi-screen BroadcastChannel Communication ───────────────────────────────
            bc.onmessage = (ev) => {
                const data = ev.data;
                if (!data) return;

                if (data.quit) {
                    window.close();
                    return;
                }

                if (isPrimary) {
                    if (data.cmd === "requestSync") {
                        bc.postMessage({
                            cmd: "sync",
                            seed: state.seed,
                            paletteIdx: state.paletteIdx,
                            paused: state.paused,
                            elapsedTime: performance.now() - (state.compositionStartTime || performance.now())
                        });
                    } else if (data.cmd === "next") {
                        screensaverNewComposition();
                    } else if (data.cmd === "palette") {
                        state.paletteIdx = (state.paletteIdx + 1) % BOTANICAL_PALETTES.length;
                        generateBotanicalComposition(clearAllTextures);
                    } else if (data.cmd === "pause") {
                        screensaverTogglePause();
                    }
                    return;
                }

                // Secondary screen handling (strictly adheres to Topography / Map sync architecture)
                if (data.cmd === "sync") {
                    const needsRegen = !hasSynced || data.seed !== state.seed || data.paletteIdx !== state.paletteIdx;
                    state.paused = !!data.paused;

                    if (needsRegen) {
                        hasSynced = true;
                        state.seed = data.seed;
                        state.paletteIdx = data.paletteIdx;
                        generateBotanicalComposition(clearAllTextures);
                        const elapsed = data.elapsedTime || 0;
                        state.compositionStartTime = performance.now() - elapsed;
                    }
                }
            };

            window.addEventListener('keydown', (e) => {
                if (e.code === 'Space' || e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    if (isPrimary) screensaverNewComposition();
                    else bc.postMessage({ cmd: "next" });
                } else if (e.key === 'p' || e.key === 'P') {
                    if (isPrimary) screensaverTogglePause();
                    else bc.postMessage({ cmd: "pause" });
                } else if (e.key === 's' || e.key === 'S') {
                    screensaverSavePNG();
                } else if (e.key === 'f' || e.key === 'F') {
                    screensaverToggleFullscreen();
                } else if (e.key === 'q' || e.key === 'Q') {
                    bc.postMessage({ quit: true });
                    window.close();
                } else if (e.key === 'c' || e.key === 'C') {
                    if (isPrimary) {
                        state.paletteIdx = (state.paletteIdx + 1) % BOTANICAL_PALETTES.length;
                        generateBotanicalComposition(clearAllTextures);
                    } else {
                        bc.postMessage({ cmd: "palette" });
                    }
                }
            });

            canvas.addEventListener('click', () => {
                screensaverToggleFullscreen();
            });

            requestAnimationFrame(animate);
        }

        window.onload = initWebGL2App;

