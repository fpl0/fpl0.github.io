# Explorer Animation — Design Document

A decorative Canvas 2D animation at the bottom of the home page. A stickman walks rightward while a procedurally generated world unveils ahead: mountains, clouds, birds, stars, and rare surprises (shooting stars, hot air balloons, sky whales, UFOs, jellyfish). Thematically tied to the Asimov quote above it: *"True delight is in the finding out rather than in the knowing."*

---

## Architecture

Two files, strict separation of concerns:

```
src/components/ExplorerAnimation/
  explorer-engine.ts      Pure logic — no DOM dependencies beyond CanvasRenderingContext2D
  ExplorerAnimation.astro  DOM wiring — canvas lifecycle, observers, animation loop
```

### `explorer-engine.ts`

Factory function `createExplorerEngine(options) => ExplorerEngine`. Receives a 2D context, dimensions, a `getColor` callback, and boolean flags for mobile/reduced-motion. Returns five methods: `update(dt)`, `draw()`, `resize(w, h)`, `onThemeChange()`, `setReducedMotion(enabled)`.

No awareness of DOM events, requestAnimationFrame, observers, or View Transitions. All state is internal. Colors are cached and refreshed only on explicit `onThemeChange()` calls.

### `ExplorerAnimation.astro`

Thin orchestration layer. Uses `onPageReady()` from the shared lifecycle utility for View Transition compatibility. Manages:

- **DPR-aware canvas sizing**
- **IntersectionObserver** (threshold 0.1) — **stops the RAF loop entirely** when the canvas scrolls out of view (no callbacks scheduled), restarts it with a fresh `lastTime` when visibility resumes
- **MutationObserver** on `document.documentElement[data-theme]` — triggers `onThemeChange()` + redraw on theme toggle
- **Resize listener** — re-sizes canvas buffer and notifies engine
- **Reduced-motion media query listener** — toggles between animated and static modes
- **RAF loop** — delta-time based, fully paused when off-screen (zero CPU cost)
- **Cleanup** — all observers disconnected and RAF cancelled on AbortSignal

All event listeners receive the lifecycle `signal` for automatic cleanup during View Transition navigations.

---

## Coordinate System

**Camera-offset parallax model.** The stickman is drawn at a fixed screen position (35% from left). A `worldOffset` value increases continuously at `WALK_SPEED` (45 px/s). Every entity has a `worldX` (absolute world position) and a `parallax` factor (0.0–1.0).

Screen position: `screenX = entity.worldX - worldOffset * entity.parallax`

- `parallax = 1.0`: moves at camera speed (ground-level objects like grass tufts and pebbles)
- `parallax = 0.1`: barely moves (distant stars)
- `parallax = 0.0`: stationary on screen

### Spawn coordinate correction

Entities spawn just off the right edge of the **screen**, not the world. The helper `toWorldX(screenX, parallax)` converts a desired screen position to the correct `worldX`:

```
worldX = screenX + worldOffset * parallax
```

This is critical — without it, low-parallax entities (stars at 0.1, whales at 0.55) would spawn at screen positions thousands of pixels off-screen and never scroll into view.

---

## Entity System

### Per-Type Entity Arrays with Object Pooling

Instead of a single polymorphic array, each entity type has its own plain `T[]` array plus a parallel **free list** for object recycling:

```ts
const stars: ReturnType<typeof createStar>[] = [];
// ...
const freeLists: Record<SpawnType, any[]> = { star: [], ... };
```

Benefits:
- **O(1) removal**: Swap-and-pop instead of `Array.splice()` which shifts elements
- **Zero type filtering in draw loops**: Each draw function iterates only its own array
- **Object pooling**: Culled entities are pushed to the free list instead of being GC'd. `createX()` functions check the free list first (`freeLists[type].pop()`), reinitialize all fields, and return the recycled object — eliminating all GC pressure from entity lifecycle during steady-state animation

### Entity catalog

| Entity | Parallax | Size range | Visual | Motion |
|--------|----------|------------|--------|--------|
| **Star** | 0.1 | 0.5–3.3px (power-law) | Filled circle, `--color-text-muted` | Twinkle: per-star speed [0.8, 2.5] via `sin(time * speed + offset)` |
| **Cloud** | 0.15 | r: 6–18px | Cached `Path2D` of 5 overlapping circles, per-cloud opacity (0.15–0.25), `--color-text-muted` | Drift: per-cloud speed (1–4 px/s) + wind influence |
| **Mountain** | 0.2 | h: 55–165px, w: 25–65px | Cached `Path2D` with quadratic Bezier curves and randomized control points, `--color-border` fill + `--color-text-muted` stroke | Static; spawned in clusters of 3–5, sorted tallest-first for depth |
| **Bird** | 0.5 | wingspan: 5–16px | V-shaped wing stroke (width scales with wingspan) with asymmetric flap, `--color-text-muted` | Own velocity (10–20 px/s) + wind + flapping; 30% chance of V-formation groups |
| **Meteor** | 0.05 | tail: 25–80px, head scales with tail | Dual-stroke alpha-faded tail (full-length at 0.4x alpha + half-length at 0.8x alpha) + glowing head, `--color-primary` | Diagonal trajectory at 200–350 px/s; `life` decreases, culled at 0 |
| **Balloon** | 0.35 | 8–20px | Ellipse envelope in `--color-primary` + basket lines/rect in `--color-text-muted` | Drift (4–12 px/s) + wind + lateral sway |
| **UFO** | 0.6 | scale: 0.6–1.4x | Ellipse body + dome arc in `--color-primary`; optional tractor beam (all dimensions scale with size) | Vertical hover oscillation |
| **Whale** | 0.55 | 40–95px | 12-curve bezier humpback silhouette (solid fill) + pectoral fin + ventral grooves, `--color-text-muted` | Vertical bob + animated tail wag (flukes sway via `sin(bobPhase * 1.6)`, displacement ramps 25%→100% from peduncle to fluke tips) |
| **Jellyfish** | 0.4 | bell: 6–16px | Half-ellipse bell dome + rim stroke in `--color-primary`, 3–5 wavy tentacles in `--color-text-muted` | Drift (2–6 px/s) + wind; bell pulses (contracts/expands), tentacles sway with per-tentacle phase offsets |
| **Grass Tuft** | 1.0 | blade height: 3–11px | 2–3 short angled strokes, `--color-text-muted` | Static position; blades respond to wind |
| **Pebble** | 1.0 | radius: 0.8–3.5px | Tiny filled circles, `--color-text-muted` | Static |

### Entity caps

Prevents unbounded memory growth. Separate limits for desktop and mobile:

| Entity | Desktop cap | Mobile cap |
|--------|-------------|------------|
| Star | 30 | 18 |
| Cloud | 6 | 4 |
| Mountain | 12 | 10 |
| Bird | 8 | 6 |
| UFO | 3 | 2 |
| Meteor | 2 | 1 |
| Balloon | 2 | 1 |
| Whale | 1 | 1 |
| Jellyfish | 2 | 1 |
| Grass Tuft | 20 | 12 |
| Pebble | 10 | 6 |

---

## Spawn System

Distance-based interval spawning driven by a static `SPAWN_CFG` tuple array (`[SpawnType, startMultiplier, minInterval, maxInterval][]`). Each entity type has a spawner record with `next` (world-space threshold), `min`, and `max` intervals built programmatically from this config.

On each frame, `trySpawn()` checks: has the world-space right edge (`worldOffset + width`) passed `next`? If yes and the cap isn't full, spawn the entity at screen position `width + rand(20, 80)` (just off the right edge), then advance `next` by a random interval.

A static `TYPES` array (derived from `SPAWN_CFG`) is iterated each frame instead of calling `Object.keys()`.

### Busy initial scene

The animation starts with a fully populated scene rather than building up from empty. Three seed functions distribute entities evenly using slot-based placement (avoiding clustering):

- `seedSky()`: 14–20 stars (evenly distributed across horizontal slots), 3–4 clouds (spaced in horizontal bands), 1 balloon
- `seedBirds()`: 1 solo bird (left side) + 1 small V-formation (right side)
- `seedGround()`: 2 mountain clusters (left third + right third), 8–12 grass tufts, 4–6 pebbles (all slot-distributed with random jitter)

### Staggered rare appearances

After the initial scene, rare entities appear as the stickman walks further:

| Distance | Entity |
|----------|--------|
| ~0.8x viewport | Meteor |
| ~2.2x viewport | Balloon (additional) |
| ~2.5x viewport | Jellyfish |
| ~3x viewport | UFO |
| ~3.8x viewport | Whale |

Mobile uses a 1.5x spawn interval multiplier.

### Mountains

Mountains spawn as **clusters** (3–5 peaks). Peak heights follow a center-weighted distribution: peaks near the cluster center are taller (55–165px) than edge peaks, capped to 85% of ground Y so peaks stay within the visible canvas on smaller screens. Within a cluster, peaks are sorted tallest-first so shorter mountains draw in front, creating depth. Each peak's shape is baked into a `Path2D` at creation time (`buildMountainPath()`), eliminating per-frame path reconstruction. Drawing uses `ctx.translate()` + `ctx.fill(path)` / `ctx.stroke(path)`.

### Birds

Birds have a 30% chance to spawn as a loose V-formation of 2–3 birds instead of singles. Formation followers share the leader's velocity and base Y position but have offset positions.

---

## Wind System

A global `wind` value computed once per frame from two incommensurate sine frequencies:

```
wind = sin(time * 0.2) * 0.3 + sin(time * 0.07) * 0.2
```

This creates non-repeating oscillation. Applied at different intensities:

| Entity | Wind influence |
|--------|---------------|
| Clouds | `wind * 2` added to drift speed |
| Balloons | `wind * 3` added to drift + `wind * 2` sway offset |
| Birds | `wind * 5` added to velocity |
| Jellyfish | `wind * 2` added to drift + `wind * 1.5` tentacle sway |
| Grass tufts | `wind * 0.3` added to blade angles |

Creates a unified atmospheric feel across all entities.

---

## Atmospheric Perspective & Edge Fade-In

All entities use the `entityAlpha()` helper for consistent opacity:

- **Depth opacity**: `depthAlpha = 0.3 + 0.7 * parallax` — far entities (parallax 0.1) are fainter, near entities (parallax 1.0) are solid
- **Edge fade-in**: Entities ramp opacity from 0 to 1 over 60px as they enter from the right edge — no abrupt "popping in"
- **Base alpha**: Each entity type provides its own base alpha (e.g., clouds at 0.15–0.25, birds at 0.7)

Formula: `finalAlpha = baseAlpha * depthAlpha * edgeFade`

---

## Stickman

Drawn at a fixed screen position (35% from left) on the ground line (80% canvas height). Walk cadence: 5.0 rad/s (~1.6 steps/second).

### Body Proportions

```
HEAD_RADIUS = 5.5    UPPER_ARM = 6
TORSO_LENGTH = 14    LOWER_ARM = 5
NECK_LENGTH = 3      UPPER_LEG = 8
                     LOWER_LEG = 7
```

### Walk Cycle (Animated)

**Asymmetric D-shaped foot path** (60% stance / 40% swing):
- During stance (60% of cycle): foot slides linearly from front (+6px) to back (-6px) relative to hip — tracks the ground
- During swing (40% of cycle): foot arcs forward via smoothstep (`6s^2 - 4s^3`) with sinusoidal 6px lift — smooth zero-velocity transitions at lift-off and landing
- Module-level helpers: `footPathX(t, halfStride)` and `footLiftY(t, maxLift)`

**Geometric knee computation**: Given hip and foot positions, knee is placed at midpoint + perpendicular offset pointing forward. Offset magnitude derived from `sqrt(UPPER_LEG^2 - halfDist^2)` — knees bend more when the leg is compressed (during swing), nearly straight during stance.

**Arms with phase-lag follow-through** (contralateral to legs):
- Upper arm: `cos(walkPhase - 0.3) * 0.45 rad` — 0.3 rad phase lag behind legs
- Forearm: `cos(walkPhase - 0.6) * 0.45 * 0.65` — double lag, 65% amplitude
- The forearm always swings *less* than the upper arm, creating an elbow bend that naturally trails the direction of motion

**Torso counter-rotation**: `shoulderTwist = sin(walkPhase) * 1px` — shoulder shifts laterally with each stride. Twist diminishes up the spine: shoulder 100%, neck 50%, head 25% (models vestibulo-ocular head stabilization).

**Body dynamics**: Double-bounce bob (`abs(sin(walkPhase * 2)) * 1.2px`), subtle forward lean (0.03 rad), head bob dampened to 15% of body bob.

**Batched draw calls**: Head circle + one composite path for spine and all four limbs (2 draw calls instead of 7).

### Reduced Motion Pose

Natural standing with slight knee bend, arms relaxed at sides. No animation.

Stroke: `--color-text`, `lineWidth: 1.8`, `lineCap: "round"`, `lineJoin: "round"`.

---

## Draw Order

Back to front, organized into layers:

1. Clear canvas with `--color-bg`
2. **Deep sky**: stars, meteors
3. **Mid sky**: clouds, whales, jellyfish, balloons
4. **Terrain**: mountains, ground line, pebbles, grass tufts
5. **Foreground sky**: birds, UFOs
6. **Protagonist**: stickman (always on top)

---

## Color System

Six CSS custom properties cached at init, refreshed on theme change:

| Cache key | CSS variable | Usage |
|-----------|-------------|-------|
| `bg` | `--color-bg` | Canvas clear |
| `text` | `--color-text` | Stickman |
| `textMuted` | `--color-text-muted` | Stars, clouds, birds, whales, mountain strokes, grass tufts, pebbles, balloon baskets, jellyfish tentacles |
| `primary` | `--color-primary` | Meteors (gradient trail + glow), balloon envelopes, UFOs, jellyfish bell |
| `border` | `--color-border` | Ground line, mountain fill |
| `surface` | `--color-surface` | Whale ventral grooves |

**Design rationale**: `--color-text-muted` is used for most environmental entities instead of `--color-border` because `border` has insufficient contrast against `bg` in both themes when multiplied by depth alpha. At parallax 0.2, depth alpha is 0.44 — `border` at that alpha produces only 2-4% contrast from background, making entities invisible. `textMuted` provides 10-20% contrast at the same alpha, keeping elements visible but appropriately subtle.

Theme changes trigger `onThemeChange()` (re-reads all properties) + immediate `draw()`. No flicker because the MutationObserver fires synchronously after the `data-theme` attribute change.

---

## Whale

The whale is a 12-curve bezier humpback silhouette drawn as a continuous closed path:

1. **Snout** — broad, blunt rostrum
2. **Forehead** — steep rise into wide cranium
3. **Crown to mid-back** — long smooth dorsal line
4. **Dorsal fin** — small triangular ridge
5. **Peduncle** — taper toward tail
6. **Upper fluke** — sweeps up and out
7. **Fluke tip** — curves back
8. **Notch** — between flukes
9. **Lower fluke** — sweeps down
10. **Lower tip** — curves back
11. **Belly** — full rounded underside
12. **Lower jaw** — returns to snout

Plus a pectoral fin (2-curve bezier) and 3 ventral grooves (quadratic curves).

Solid fill with `--color-text-muted` at 0.7 alpha. No face (no eye, no mouth). Moves via parallax only (velocity = 0), with a gentle vertical bob and animated tail wag. The tail wag uses `sin(bobPhase * 1.6)` — slightly faster than the body bob — with displacement ramping from 25% at the peduncle to 100% at the fluke tips, fading back to 0% at the belly.

---

## Culling

Generic `cull()` function iterates forward through each array. Dead entities (off-screen left by >200px, or type-specific conditions like meteor `life <= 0`) are removed via swap-and-pop: the dead entity is swapped with the last element and the array is `.pop()`'d. O(1) per removal instead of O(n) `splice()`.

Removed entities are pushed to the corresponding free list for object recycling (see Entity System above).

Entities are never culled from the right — they enter from the right edge and exit left.

---

## Performance

### Zero-cost off-screen

The RAF loop **stops entirely** when the canvas is not intersecting the viewport (IntersectionObserver). No callbacks are scheduled, no CPU is consumed. When visibility resumes, the loop restarts with a fresh `lastTime` to avoid delta-time spikes.

### Object pooling

Culled entities are recycled via per-type free lists. `createX()` functions check `freeLists[type].pop()` before allocating, reinitialize all mutable fields on the recycled object, and return it. This eliminates all GC pressure from entity lifecycle during steady-state animation.

### Cached Path2D shapes

Mountains and clouds build their `Path2D` at creation time (once per entity lifetime). Drawing uses `ctx.save(); ctx.translate(x, y); ctx.fill(path); ctx.restore()` — no per-frame path reconstruction.

### Batched draw calls

- **Stars**: Visible stars are collected into a pre-allocated `Float64Array` buffer, then grouped into 5 alpha buckets. Each bucket is drawn as a single `beginPath` / `fill` cycle (5 draw calls instead of ~30).
- **Pebbles**: Non-edge pebbles (identical alpha) are batched into a single `fill` call. Only the ~0-2 edge-fading pebbles are drawn individually.
- **Grass tufts**: Same batch/individual split as pebbles, using a single `stroke` for all non-edge tufts.
- **Stickman**: 2 draw calls (head circle + body/limbs composite path) instead of 7.

### Gradient-free meteors

Meteor tails use two overlapping strokes at different alpha/length (full-length at 0.4x alpha + half-length at 0.8x alpha) instead of `createLinearGradient()`. This eliminates per-frame gradient object allocation (~120 objects/sec with 2 meteors at 60fps).

### General

- **Per-type entity arrays**: O(1) swap-and-pop removal, zero type filtering in draw loops
- **Static spawn config**: `SPAWN_CFG` tuple array + derived `TYPES` array, no `Object.keys()` per frame
- **Delta-time movement**: frame-rate independent, dt capped at 100ms to prevent teleportation after tab-switch
- **Entity caps**: bounded memory regardless of session length (~96 entities max on desktop, ~6KB total)
- **Mobile adjustments**: 1.5x spawn intervals, reduced entity caps
- **No allocations in hot path**: entity updates mutate in place, star bucketing uses pre-allocated `Float64Array` buffers
- **Single canvas context**: no offscreen buffers or layered canvases

---

## Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- `update()` is a no-op (no animation, no wind)
- `seed()` re-populates a static scenic composition with the same busy initial scene
- `draw()` still renders for theme changes
- Stickman stands in natural pose with slight knee bend, arms at sides

Toggling reduced motion at runtime resets the scene and re-populates.

---

## Responsive

| Breakpoint | Canvas height | Margins |
|------------|--------------|---------|
| Desktop (>var(--breakpoint-mobile)) | 220px | `margin-top: var(--space-12)` |
| Mobile (<=var(--breakpoint-mobile)) | 150px | `margin-top: var(--space-8)` |

The canvas fills 100% container width. DPR-aware sizing ensures crisp rendering on Retina displays. On resize, the engine receives updated dimensions and recalculates `baseGroundY`.

---

## Integration

The component is placed at the bottom of the home page (`src/pages/index.astro`), after the post/app feed, before `</main>`. It renders regardless of whether the feed has content.

```astro
<ExplorerAnimation />
```

Purely decorative: `aria-hidden="true"` on the canvas element. No semantic content, no keyboard interaction, no screen reader announcements.
