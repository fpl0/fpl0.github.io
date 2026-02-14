/**
 * Explorer Animation Engine
 *
 * Procedurally generated walking scene: a stickman traverses an ever-expanding
 * landscape of mountains, clouds, birds, stars, and rare surprises.
 * Pure TypeScript — no DOM dependencies beyond the CanvasRenderingContext2D.
 *
 * v2 — Per-type entity pools, biomechanical walk cycle, wind system,
 * atmospheric perspective, Bezier mountains, ground details.
 */

/* =========================================================================
   Types
   ========================================================================= */

interface Pool<T> {
  items: T[];
  count: number;
}

interface BaseEntity {
  worldX: number;
  y: number;
  parallax: number;
}

interface StarEntity extends BaseEntity {
  size: number;
  twinkleOffset: number;
  twinkleSpeed: number;
}

interface CloudEntity extends BaseEntity {
  circles: Array<{ dx: number; dy: number; r: number }>;
  driftSpeed: number;
  baseOpacity: number;
}

interface MountainEntity extends BaseEntity {
  peakHeight: number;
  leftWidth: number;
  rightWidth: number;
  ctrlLeftDx: number;
  ctrlLeftDy: number;
  ctrlRightDx: number;
  ctrlRightDy: number;
}

interface BirdEntity extends BaseEntity {
  velocity: number;
  flapPhase: number;
  wingspan: number;
  formationOffsetX: number;
  formationOffsetY: number;
}

interface UfoEntity extends BaseEntity {
  size: number;
  hoverPhase: number;
  hasTractorBeam: boolean;
}

interface MeteorEntity extends BaseEntity {
  angle: number;
  speed: number;
  life: number;
  maxLife: number;
  tailLen: number;
}

interface BalloonEntity extends BaseEntity {
  size: number;
  driftSpeed: number;
  swayPhase: number;
}

interface WhaleEntity extends BaseEntity {
  size: number;
  velocity: number;
  bobPhase: number;
}

interface GrassTuftEntity extends BaseEntity {
  bladeCount: number;
  bladeHeight: number;
  bladeAngles: number[];
}

interface JellyfishEntity extends BaseEntity {
  size: number;
  pulsePhase: number;
  driftSpeed: number;
  tentacleCount: number;
  tentaclePhases: number[];
}

interface PebbleEntity extends BaseEntity {
  radius: number;
}

type SpawnType =
  | "star"
  | "cloud"
  | "mountain"
  | "bird"
  | "ufo"
  | "meteor"
  | "balloon"
  | "whale"
  | "jellyfish"
  | "grassTuft"
  | "pebble";

interface SpawnTracker {
  nextSpawnAt: number;
  minInterval: number;
  maxInterval: number;
}

interface CachedColors {
  bg: string;
  text: string;
  textMuted: string;
  primary: string;
  border: string;
  surface: string;
}

export interface ExplorerEngineOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  getColor: (property: string) => string;
  isMobile: boolean;
  reducedMotion: boolean;
}

export interface ExplorerEngine {
  update(dt: number): void;
  draw(): void;
  resize(width: number, height: number): void;
  onThemeChange(): void;
  setReducedMotion(enabled: boolean): void;
}

/* =========================================================================
   Constants
   ========================================================================= */

const STICKMAN_SCREEN_X_RATIO = 0.35;
const WALK_SPEED = 45;
const HEAD_RADIUS = 5.5;
const TORSO_LENGTH = 14;
const NECK_LENGTH = 3;
const UPPER_LEG = 8;
const LOWER_LEG = 7;
const UPPER_ARM = 6;
const LOWER_ARM = 5;
const GROUND_Y_RATIO = 0.8;
const MAX_DT = 0.1;
const FADE_IN_DISTANCE = 60;

const SPAWN_TYPES: SpawnType[] = [
  "star",
  "cloud",
  "mountain",
  "bird",
  "ufo",
  "meteor",
  "balloon",
  "whale",
  "jellyfish",
  "grassTuft",
  "pebble",
];

type EntityCaps = Record<SpawnType, number>;

const ENTITY_CAPS: EntityCaps = {
  star: 30,
  cloud: 6,
  mountain: 12,
  bird: 8,
  ufo: 3,
  meteor: 2,
  balloon: 2,
  whale: 1,
  jellyfish: 2,
  grassTuft: 20,
  pebble: 10,
};

const MOBILE_ENTITY_CAPS: EntityCaps = {
  star: 18,
  cloud: 4,
  mountain: 10,
  bird: 6,
  ufo: 2,
  meteor: 1,
  balloon: 1,
  whale: 1,
  jellyfish: 1,
  grassTuft: 12,
  pebble: 6,
};

/* =========================================================================
   Helpers
   ========================================================================= */

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/** Compute atmospheric + edge-fade alpha for an entity. */
function entityAlpha(
  screenX: number,
  parallax: number,
  canvasWidth: number,
  baseAlpha: number,
): number {
  const depthAlpha = 0.3 + 0.7 * parallax;
  const distFromRight = canvasWidth - screenX;
  const edgeFade =
    distFromRight > 0 && distFromRight < FADE_IN_DISTANCE ? distFromRight / FADE_IN_DISTANCE : 1;
  return baseAlpha * depthAlpha * edgeFade;
}

/** Asymmetric walk: 60% stance sliding back on ground, 40% swing arcing forward via smoothstep. */
function footPathX(t: number, halfStride: number): number {
  if (t < 0.6) return halfStride * (1 - t / 0.3);
  const s = (t - 0.6) * 2.5;
  return halfStride * (6 * s * s - 4 * s * s * s - 1);
}

/** Foot lift: smooth sine arc during swing phase only, zero during stance. */
function footLiftY(t: number, maxLift: number): number {
  if (t < 0.6) return 0;
  return Math.sin((t - 0.6) * 2.5 * Math.PI) * maxLift;
}

/* =========================================================================
   Pool helpers
   ========================================================================= */

function createPool<T>(capacity: number): Pool<T> {
  return { items: new Array<T>(capacity), count: 0 };
}

function poolPush<T>(pool: Pool<T>, item: T): void {
  if (pool.count < pool.items.length) {
    pool.items[pool.count] = item;
  } else {
    pool.items.push(item);
  }
  pool.count++;
}

function poolSwapRemove<T>(pool: Pool<T>, index: number): void {
  pool.count--;
  if (index < pool.count) {
    const last = pool.items[pool.count];
    if (last !== undefined) {
      pool.items[index] = last;
    }
  }
}

/* =========================================================================
   Factory
   ========================================================================= */

export function createExplorerEngine(options: ExplorerEngineOptions): ExplorerEngine {
  const { ctx, getColor, isMobile } = options;
  let { width, height, reducedMotion } = options;

  let baseGroundY = height * GROUND_Y_RATIO;
  let worldOffset = 0;
  let walkPhase = 0;
  let time = 0;
  let wind = 0;

  let colors: CachedColors = readColors();
  const caps: EntityCaps = isMobile ? MOBILE_ENTITY_CAPS : ENTITY_CAPS;
  const sm = isMobile ? 1.5 : 1;

  /* ----- Entity pools ----- */

  const stars = createPool<StarEntity>(caps.star);
  const clouds = createPool<CloudEntity>(caps.cloud);
  const mountains = createPool<MountainEntity>(caps.mountain);
  const birds = createPool<BirdEntity>(caps.bird);
  const ufos = createPool<UfoEntity>(caps.ufo);
  const meteors = createPool<MeteorEntity>(caps.meteor);
  const balloons = createPool<BalloonEntity>(caps.balloon);
  const whales = createPool<WhaleEntity>(caps.whale);
  const jellyfish = createPool<JellyfishEntity>(caps.jellyfish);
  const grassTufts = createPool<GrassTuftEntity>(caps.grassTuft);
  const pebbles = createPool<PebbleEntity>(caps.pebble);

  /** Type-erased pool lookup — enables generic iteration over all pools. */
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous pool registry requires any
  const pools: Record<SpawnType, Pool<any>> = {
    star: stars,
    cloud: clouds,
    mountain: mountains,
    bird: birds,
    ufo: ufos,
    meteor: meteors,
    balloon: balloons,
    whale: whales,
    jellyfish,
    grassTuft: grassTufts,
    pebble: pebbles,
  };

  /* ----- Spawners ----- */

  const spawners: Record<SpawnType, SpawnTracker> = {
    star: {
      nextSpawnAt: 0,
      minInterval: 50 * sm,
      maxInterval: 100 * sm,
    },
    cloud: {
      nextSpawnAt: width * 0.4,
      minInterval: 180 * sm,
      maxInterval: 350 * sm,
    },
    mountain: {
      nextSpawnAt: width * 0.8,
      minInterval: 400 * sm,
      maxInterval: 700 * sm,
    },
    bird: {
      nextSpawnAt: width * 0.5,
      minInterval: 200 * sm,
      maxInterval: 400 * sm,
    },
    meteor: {
      nextSpawnAt: width * 0.8,
      minInterval: 400 * sm,
      maxInterval: 800 * sm,
    },
    balloon: {
      nextSpawnAt: width * 2.2,
      minInterval: 600 * sm,
      maxInterval: 1000 * sm,
    },
    ufo: {
      nextSpawnAt: width * 3,
      minInterval: 900 * sm,
      maxInterval: 1800 * sm,
    },
    whale: {
      nextSpawnAt: width * 3.8,
      minInterval: 1400 * sm,
      maxInterval: 2500 * sm,
    },
    jellyfish: {
      nextSpawnAt: width * 2.5,
      minInterval: 800 * sm,
      maxInterval: 1400 * sm,
    },
    grassTuft: {
      nextSpawnAt: 0,
      minInterval: 30 * sm,
      maxInterval: 70 * sm,
    },
    pebble: {
      nextSpawnAt: width * 0.2,
      minInterval: 40 * sm,
      maxInterval: 90 * sm,
    },
  };

  function readColors(): CachedColors {
    return {
      bg: getColor("--color-bg"),
      text: getColor("--color-text"),
      textMuted: getColor("--color-text-muted"),
      primary: getColor("--color-primary"),
      border: getColor("--color-border"),
      surface: getColor("--color-surface"),
    };
  }

  /* ----- Entity creation ----- */

  function createStar(worldX: number): StarEntity {
    return {
      worldX,
      y: rand(height * 0.05, height * 0.45),
      parallax: 0.1,
      size: 0.5 + Math.random() ** 2.5 * 2.8,
      twinkleOffset: rand(0, Math.PI * 2),
      twinkleSpeed: rand(0.8, 2.5),
    };
  }

  function createCloud(worldX: number): CloudEntity {
    const r = rand(6, 18);
    return {
      worldX,
      y: rand(height * 0.1, height * 0.35),
      parallax: 0.15,
      circles: [
        { dx: -r * 1.1, dy: 0, r: r * rand(0.8, 0.95) },
        { dx: 0, dy: 0, r: r * rand(0.9, 1.0) },
        { dx: r * 1.1, dy: 0, r: r * rand(0.8, 0.95) },
        { dx: -r * 0.5, dy: -r * 0.7, r: r * rand(0.7, 0.9) },
        { dx: r * 0.4, dy: -r * 0.65, r: r * rand(0.65, 0.85) },
      ],
      driftSpeed: rand(1, 4),
      baseOpacity: rand(0.15, 0.25),
    };
  }

  function createMountain(worldX: number, h: number, wL: number, wR: number): MountainEntity {
    return {
      worldX,
      y: baseGroundY,
      parallax: 0.2,
      peakHeight: h,
      leftWidth: wL,
      rightWidth: wR,
      ctrlLeftDx: rand(-0.15, 0.15) * wL,
      ctrlLeftDy: rand(0.3, 0.6) * h,
      ctrlRightDx: rand(-0.15, 0.15) * wR,
      ctrlRightDy: rand(0.3, 0.6) * h,
    };
  }

  function spawnMountainCluster(centerWorldX: number): void {
    const count = randInt(3, 5);
    const tempPeaks: MountainEntity[] = [];
    for (let i = 0; i < count; i++) {
      if (mountains.count + tempPeaks.length >= caps.mountain) break;
      const c = 1 - Math.abs(i - (count - 1) / 2) / ((count - 1) / 2 + 0.5);
      const maxH = baseGroundY * 0.85;
      const h = Math.min(rand(55, 115) + c * rand(20, 50), maxH);
      const spread = (i - (count - 1) / 2) * rand(30, 55);
      tempPeaks.push(createMountain(centerWorldX + spread, h, rand(25, 65), rand(25, 65)));
    }
    tempPeaks.sort((a, b) => b.peakHeight - a.peakHeight);
    for (const p of tempPeaks) {
      poolPush(mountains, p);
    }
  }

  function createBird(worldX: number): BirdEntity {
    return {
      worldX,
      y: rand(height * 0.1, height * 0.4),
      parallax: 0.5,
      velocity: rand(10, 20),
      flapPhase: rand(0, Math.PI * 2),
      wingspan: rand(5, 16),
      formationOffsetX: 0,
      formationOffsetY: 0,
    };
  }

  function spawnBirdGroup(screenX: number): void {
    const wX = toWorldX(screenX, 0.5);
    const isFormation = Math.random() < 0.3;
    const groupSize = isFormation ? randInt(2, 3) : 1;
    const leader = createBird(wX);
    leader.worldX = wX;
    poolPush(birds, leader);

    for (let i = 1; i < groupSize; i++) {
      if (birds.count >= caps.bird) break;
      const follower = createBird(wX);
      follower.worldX = wX;
      follower.y = leader.y;
      follower.velocity = leader.velocity;
      follower.formationOffsetX = -rand(12, 20) * i;
      follower.formationOffsetY = (i % 2 === 0 ? -1 : 1) * rand(6, 12) * i;
      poolPush(birds, follower);
    }
  }

  function createUfo(worldX: number): UfoEntity {
    return {
      worldX,
      y: rand(height * 0.08, height * 0.25),
      parallax: 0.6,
      size: rand(0.6, 1.4),
      hoverPhase: rand(0, Math.PI * 2),
      hasTractorBeam: Math.random() > 0.5,
    };
  }

  function createMeteor(worldX: number): MeteorEntity {
    return {
      worldX,
      y: rand(height * 0.02, height * 0.2),
      parallax: 0.05,
      angle: rand(0.15, 0.4),
      speed: rand(200, 350),
      life: 2,
      maxLife: 2,
      tailLen: rand(25, 80),
    };
  }

  function createBalloon(worldX: number): BalloonEntity {
    return {
      worldX,
      y: rand(height * 0.08, height * 0.3),
      parallax: 0.35,
      size: rand(8, 20),
      driftSpeed: rand(4, 12),
      swayPhase: rand(0, Math.PI * 2),
    };
  }

  function createWhale(worldX: number): WhaleEntity {
    const s = rand(40, 95);
    // Keep whale vertically within frame: top of body is cy - s*0.38,
    // bottom of fin is cy + s*0.42. Clamp y so both fit.
    const minY = s * 0.42 + 4;
    const maxY = height * 0.45 - s * 0.42;
    return {
      worldX,
      y: rand(Math.max(minY, height * 0.12), Math.max(minY, maxY)),
      parallax: 0.55,
      size: s,
      velocity: 0,
      bobPhase: rand(0, Math.PI * 2),
    };
  }

  function createJellyfish(worldX: number): JellyfishEntity {
    const tc = randInt(3, 5);
    const phases: number[] = [];
    for (let i = 0; i < tc; i++) {
      phases.push(rand(0, Math.PI * 2));
    }
    return {
      worldX,
      y: rand(height * 0.1, height * 0.4),
      parallax: 0.4,
      size: rand(6, 16),
      pulsePhase: rand(0, Math.PI * 2),
      driftSpeed: rand(2, 6),
      tentacleCount: tc,
      tentaclePhases: phases,
    };
  }

  function createGrassTuft(worldX: number): GrassTuftEntity {
    const bc = randInt(2, 3);
    const angles: number[] = [];
    for (let i = 0; i < bc; i++) {
      angles.push(rand(-0.4, 0.4));
    }
    return {
      worldX,
      y: baseGroundY,
      parallax: 1.0,
      bladeCount: bc,
      bladeHeight: rand(3, 11),
      bladeAngles: angles,
    };
  }

  function createPebble(worldX: number): PebbleEntity {
    return {
      worldX,
      y: baseGroundY + rand(1, 3),
      parallax: 1.0,
      radius: rand(0.8, 3.5),
    };
  }

  /* ----- Spawn logic ----- */

  function toWorldX(screenX: number, parallax: number): number {
    return screenX + worldOffset * parallax;
  }

  /** Simple creators — entity types with identical create/set-worldX/push spawning. */
  const simpleCreators: Partial<Record<SpawnType, (worldX: number) => BaseEntity>> = {
    star: createStar,
    cloud: createCloud,
    ufo: createUfo,
    meteor: createMeteor,
    balloon: createBalloon,
    whale: createWhale,
    jellyfish: createJellyfish,
    grassTuft: createGrassTuft,
    pebble: createPebble,
  };

  function spawnEntity(type: SpawnType, screenX: number): void {
    if (type === "mountain") {
      spawnMountainCluster(toWorldX(screenX, 0.2));
      return;
    }
    if (type === "bird") {
      spawnBirdGroup(screenX);
      return;
    }
    const creator = simpleCreators[type];
    if (!creator) return;
    const e = creator(0);
    e.worldX = toWorldX(screenX, e.parallax);
    poolPush(pools[type], e);
  }

  function trySpawn(type: SpawnType): void {
    const s = spawners[type];
    const rightEdge = worldOffset + width;
    if (rightEdge < s.nextSpawnAt) return;
    if (pools[type].count >= caps[type]) {
      s.nextSpawnAt = rightEdge + rand(s.minInterval, s.maxInterval);
      return;
    }
    spawnEntity(type, width + rand(20, 80));
    s.nextSpawnAt = rightEdge + rand(s.minInterval, s.maxInterval);
  }

  /* ----- Culling (swap-and-pop) ----- */

  function cullPool<T extends BaseEntity>(pool: Pool<T>, isAlive?: (item: T) => boolean): void {
    let i = 0;
    while (i < pool.count) {
      const item = pool.items[i];
      if (item === undefined) {
        poolSwapRemove(pool, i);
        continue;
      }
      const sxPos = sx(item.worldX, item.parallax);
      if (sxPos < -200 || (isAlive !== undefined && !isAlive(item))) {
        poolSwapRemove(pool, i);
      } else {
        i++;
      }
    }
  }

  function cullAllPools(): void {
    for (const type of SPAWN_TYPES) {
      cullPool(pools[type], type === "meteor" ? (m: MeteorEntity) => m.life > 0 : undefined);
    }
  }

  /* ----- Drawing helpers ----- */

  function sx(entityWorldX: number, parallax: number): number {
    return entityWorldX - worldOffset * parallax;
  }

  function drawStars(): void {
    ctx.fillStyle = colors.textMuted;
    for (let i = 0; i < stars.count; i++) {
      const e = stars.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -10 || x > width + 10) continue;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * e.twinkleSpeed + e.twinkleOffset));
      ctx.globalAlpha = entityAlpha(x, e.parallax, width, twinkle);
      ctx.beginPath();
      ctx.arc(x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(): void {
    ctx.fillStyle = colors.textMuted;
    for (let i = 0; i < clouds.count; i++) {
      const e = clouds.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -60 || x > width + 60) continue;
      ctx.globalAlpha = entityAlpha(x, e.parallax, width, e.baseOpacity);
      ctx.beginPath();
      for (const c of e.circles) {
        ctx.moveTo(x + c.dx + c.r, e.y + c.dy);
        ctx.arc(x + c.dx, e.y + c.dy, c.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMeteors(): void {
    for (let i = 0; i < meteors.count; i++) {
      const e = meteors.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      const opacity = e.life / e.maxLife;
      const dx = Math.cos(e.angle) * e.tailLen;
      const dy = Math.sin(e.angle) * e.tailLen;
      const headX = x;
      const headY = e.y;
      // Trail behind the head (upper-right, since meteor moves left+down)
      const tailX = x + dx * 1.5;
      const tailY = e.y - dy * 1.5;

      const alpha = entityAlpha(x, e.parallax, width, opacity);

      // Scale stroke and head with tail length (25-80 range)
      const mScale = e.tailLen / 50;

      // Gradient trail
      const grad = ctx.createLinearGradient(headX, headY, tailX, tailY);
      grad.addColorStop(0, colors.primary);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 + mScale;
      ctx.lineCap = "round";
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(headX, headY);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // Glowing head
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.arc(headX, headY, 2 + mScale * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(headX, headY, 1 + mScale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWhaleBody(x: number, cy: number, s: number, tw: number): void {
    // Full silhouette — continuous closed path
    // tw = tail wag offset (vertical displacement at fluke tips)
    ctx.beginPath();

    // Snout — broad, blunt rostrum
    ctx.moveTo(x - s * 0.95, cy + s * 0.02);

    // Forehead — steep rise into a wide cranium
    ctx.bezierCurveTo(
      x - s * 0.92,
      cy - s * 0.12,
      x - s * 0.75,
      cy - s * 0.32,
      x - s * 0.45,
      cy - s * 0.36,
    );

    // Crown to mid-back — long, smooth dorsal line
    ctx.bezierCurveTo(
      x - s * 0.15,
      cy - s * 0.38,
      x + s * 0.2,
      cy - s * 0.34,
      x + s * 0.45,
      cy - s * 0.26,
    );

    // Dorsal fin — small triangular ridge
    ctx.bezierCurveTo(
      x + s * 0.52,
      cy - s * 0.24,
      x + s * 0.55,
      cy - s * 0.3,
      x + s * 0.58,
      cy - s * 0.24,
    );

    // Rear back tapering into the peduncle — wag starts here (25% influence)
    ctx.bezierCurveTo(
      x + s * 0.72,
      cy - s * 0.16 + tw * 0.25,
      x + s * 0.88,
      cy - s * 0.06 + tw * 0.5,
      x + s * 0.98,
      cy - s * 0.02 + tw * 0.7,
    );

    // Upper tail fluke — full wag influence
    ctx.bezierCurveTo(
      x + s * 1.06,
      cy - s * 0.04 + tw * 0.85,
      x + s * 1.18,
      cy - s * 0.18 + tw,
      x + s * 1.28,
      cy - s * 0.26 + tw,
    );

    // Fluke tip curves back
    ctx.bezierCurveTo(
      x + s * 1.3,
      cy - s * 0.22 + tw,
      x + s * 1.26,
      cy - s * 0.14 + tw * 0.9,
      x + s * 1.12,
      cy - s * 0.04 + tw * 0.75,
    );

    // Notch between flukes
    ctx.bezierCurveTo(
      x + s * 1.06,
      cy + tw * 0.7,
      x + s * 1.06,
      cy + s * 0.02 + tw * 0.7,
      x + s * 1.12,
      cy + s * 0.06 + tw * 0.75,
    );

    // Lower tail fluke — full wag influence
    ctx.bezierCurveTo(
      x + s * 1.26,
      cy + s * 0.16 + tw * 0.9,
      x + s * 1.3,
      cy + s * 0.24 + tw,
      x + s * 1.28,
      cy + s * 0.28 + tw,
    );

    // Lower fluke tip curves back
    ctx.bezierCurveTo(
      x + s * 1.18,
      cy + s * 0.2 + tw,
      x + s * 1.06,
      cy + s * 0.08 + tw * 0.85,
      x + s * 0.98,
      cy + s * 0.04 + tw * 0.7,
    );

    // Peduncle underside back along belly — wag fades out
    ctx.bezierCurveTo(
      x + s * 0.85,
      cy + s * 0.1 + tw * 0.25,
      x + s * 0.65,
      cy + s * 0.2,
      x + s * 0.4,
      cy + s * 0.28,
    );

    // Belly — full, rounded underside
    ctx.bezierCurveTo(
      x + s * 0.1,
      cy + s * 0.34,
      x - s * 0.25,
      cy + s * 0.36,
      x - s * 0.55,
      cy + s * 0.3,
    );

    // Lower jaw curves back to snout
    ctx.bezierCurveTo(
      x - s * 0.78,
      cy + s * 0.24,
      x - s * 0.92,
      cy + s * 0.14,
      x - s * 0.95,
      cy + s * 0.02,
    );

    ctx.closePath();
  }

  function drawWhaleFin(x: number, cy: number, s: number): void {
    // Pectoral fin — long, elegant, sweeps downward from the chest
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, cy + s * 0.2);
    ctx.bezierCurveTo(
      x - s * 0.38,
      cy + s * 0.32,
      x - s * 0.52,
      cy + s * 0.42,
      x - s * 0.62,
      cy + s * 0.38,
    );
    ctx.bezierCurveTo(
      x - s * 0.58,
      cy + s * 0.32,
      x - s * 0.44,
      cy + s * 0.26,
      x - s * 0.3,
      cy + s * 0.2,
    );
    ctx.closePath();
  }

  function drawWhales(): void {
    for (let i = 0; i < whales.count; i++) {
      const e = whales.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -120 || x > width + 120) continue;
      const bob = Math.sin(e.bobPhase) * 4;
      const cy = e.y + bob;
      const s = e.size;
      // Gentle tail wag — sinusoidal, slightly faster than bob
      const tailWag = Math.sin(e.bobPhase * 1.6) * s * 0.08;

      const alpha = entityAlpha(x, e.parallax, width, 1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Solid filled body
      ctx.fillStyle = colors.textMuted;
      ctx.globalAlpha = alpha * 0.7;
      drawWhaleBody(x, cy, s, tailWag);
      ctx.fill();

      // Pectoral fin — solid fill
      ctx.globalAlpha = alpha * 0.55;
      drawWhaleFin(x, cy, s);
      ctx.fill();

      // Ventral grooves — lighter lines over the solid body
      ctx.strokeStyle = colors.surface;
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let g = 0; g < 3; g++) {
        const gy = cy + s * (0.12 + g * 0.06);
        const gxStart = x - s * (0.55 - g * 0.1);
        const gxEnd = x + s * (0.1 - g * 0.04);
        ctx.moveTo(gxStart, gy);
        ctx.quadraticCurveTo((gxStart + gxEnd) * 0.5, gy + s * 0.03, gxEnd, gy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawJellyfish(): void {
    for (let i = 0; i < jellyfish.count; i++) {
      const e = jellyfish.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -30 || x > width + 30) continue;

      const s = e.size;
      const pulse = Math.sin(e.pulsePhase) * 0.15;
      const bellW = s * (0.7 + pulse);
      const bellH = s * (0.55 - pulse * 0.3);
      const alpha = entityAlpha(x, e.parallax, width, 0.55);

      // Bell dome
      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, e.y, bellW, bellH, 0, Math.PI, 0);
      ctx.fill();

      // Bell rim — slightly wider, thin stroke
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.ellipse(x, e.y, bellW * 1.02, bellH * 0.3, 0, 0, Math.PI);
      ctx.stroke();

      // Tentacles — wavy quadratic curves
      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 0.6;
      ctx.lineCap = "round";
      ctx.globalAlpha = alpha * 0.45;
      const tentSpacing = (bellW * 2) / (e.tentacleCount + 1);
      for (let t = 0; t < e.tentacleCount; t++) {
        const tPhase = e.tentaclePhases[t] ?? 0;
        const tx = x - bellW + tentSpacing * (t + 1);
        const tentLen = s * rand(0.8, 1.4); // intentional per-frame jitter for underwater wobble
        const sway = Math.sin(tPhase + time * 1.5) * s * 0.15 + wind * 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, e.y);
        ctx.quadraticCurveTo(tx + sway, e.y + tentLen * 0.5, tx + sway * 0.6, e.y + tentLen);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBalloons(): void {
    for (let i = 0; i < balloons.count; i++) {
      const e = balloons.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -30 || x > width + 30) continue;
      const sway = Math.sin(e.swayPhase) * 3 + wind * 2;
      const s = e.size;
      const alpha = entityAlpha(x, e.parallax, width, 0.6);

      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(x + sway, e.y, s * 0.6, s * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = alpha * 0.83;
      const basketY = e.y + s;
      ctx.beginPath();
      ctx.moveTo(x + sway - s * 0.3, e.y + s * 0.6);
      ctx.lineTo(x + sway - 3, basketY);
      ctx.moveTo(x + sway + s * 0.3, e.y + s * 0.6);
      ctx.lineTo(x + sway + 3, basketY);
      ctx.stroke();

      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(x + sway - 4, basketY, 8, 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMountains(): void {
    for (let i = 0; i < mountains.count; i++) {
      const e = mountains.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x + e.rightWidth < -10 || x - e.leftWidth > width + 10) continue;

      const gY = e.y;
      const peakX = x;
      const peakY = gY - e.peakHeight;
      const leftBaseX = x - e.leftWidth;
      const rightBaseX = x + e.rightWidth;

      const ctrlLeftX = leftBaseX + e.leftWidth * 0.5 + e.ctrlLeftDx;
      const ctrlLeftY = gY - e.ctrlLeftDy;
      const ctrlRightX = rightBaseX - e.rightWidth * 0.5 + e.ctrlRightDx;
      const ctrlRightY = gY - e.ctrlRightDy;

      const alpha = entityAlpha(x, e.parallax, width, 1);
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.moveTo(leftBaseX, gY);
      ctx.quadraticCurveTo(ctrlLeftX, ctrlLeftY, peakX, peakY);
      ctx.quadraticCurveTo(ctrlRightX, ctrlRightY, rightBaseX, gY);
      ctx.closePath();
      ctx.fillStyle = colors.border;
      ctx.fill();
      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawGroundLine(): void {
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseGroundY);
    ctx.lineTo(width, baseGroundY);
    ctx.stroke();
  }

  function drawGrassTufts(): void {
    ctx.strokeStyle = colors.textMuted;
    ctx.lineWidth = 0.8;
    ctx.lineCap = "round";
    for (let i = 0; i < grassTufts.count; i++) {
      const e = grassTufts.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -15 || x > width + 15) continue;
      const alpha = entityAlpha(x, e.parallax, width, 0.45);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let j = 0; j < e.bladeCount; j++) {
        const angle = (e.bladeAngles[j] ?? 0) + wind * 0.3;
        const bx = x + (j - (e.bladeCount - 1) * 0.5) * 3;
        ctx.moveTo(bx, e.y);
        ctx.lineTo(bx + Math.sin(angle) * e.bladeHeight, e.y - Math.cos(angle) * e.bladeHeight);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPebbles(): void {
    ctx.fillStyle = colors.textMuted;
    for (let i = 0; i < pebbles.count; i++) {
      const e = pebbles.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -5 || x > width + 5) continue;
      const alpha = entityAlpha(x, e.parallax, width, 0.4);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds(): void {
    for (let i = 0; i < birds.count; i++) {
      const e = birds.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax) + e.formationOffsetX;
      const y = e.y + e.formationOffsetY;
      if (x < -20 || x > width + 20) continue;

      // Asymmetric flap: fast downstroke, slow upstroke
      const sinPhase = Math.sin(e.flapPhase);
      const flap = Math.sign(sinPhase) * Math.abs(sinPhase) ** 0.7 * 0.6;
      const ws = e.wingspan;

      // Body rise on downstroke
      const bodyRise = Math.max(0, -sinPhase) * 1.5;

      const alpha = entityAlpha(x, e.parallax, width, 0.7);
      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 0.8 + ws * 0.06;
      ctx.lineCap = "round";
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x - ws, y - bodyRise - flap * ws * 0.5);
      ctx.lineTo(x, y - bodyRise);
      ctx.lineTo(x + ws, y - bodyRise - flap * ws * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawUfos(): void {
    for (let i = 0; i < ufos.count; i++) {
      const e = ufos.items[i];
      if (!e) continue;
      const x = sx(e.worldX, e.parallax);
      if (x < -40 || x > width + 40) continue;
      const s = e.size;
      const hoverY = e.y + Math.sin(e.hoverPhase) * 4 * s;

      const alpha = entityAlpha(x, e.parallax, width, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.ellipse(x, hoverY, 16 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, hoverY - 5 * s, 8 * s, Math.PI, 0);
      ctx.fill();

      if (e.hasTractorBeam) {
        ctx.globalAlpha = alpha * 0.15;
        ctx.beginPath();
        ctx.moveTo(x - 10 * s, hoverY + 6 * s);
        ctx.lineTo(x + 10 * s, hoverY + 6 * s);
        ctx.lineTo(x + 22 * s, baseGroundY);
        ctx.lineTo(x - 22 * s, baseGroundY);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ----- Stickman ----- */

  interface StickmanPose {
    headX: number;
    headY: number;
    neckX: number;
    neckY: number;
    shoulderX: number;
    shoulderY: number;
    hipX: number;
    hipY: number;
    leftHandX: number;
    leftHandY: number;
    rightHandX: number;
    rightHandY: number;
    leftElbowX: number;
    leftElbowY: number;
    rightElbowX: number;
    rightElbowY: number;
    leftFootX: number;
    leftFootY: number;
    rightFootX: number;
    rightFootY: number;
    leftKneeX: number;
    leftKneeY: number;
    rightKneeX: number;
    rightKneeY: number;
  }

  function computeStickmanPose(): StickmanPose {
    const stickX = width * STICKMAN_SCREEN_X_RATIO;
    const feetY = baseGroundY - 1;
    const legRoom = UPPER_LEG + LOWER_LEG - 2;

    if (reducedMotion) {
      const hipY = feetY - legRoom;
      const shoulderY = hipY - TORSO_LENGTH;
      const neckY = shoulderY - NECK_LENGTH;
      const headY = neckY - HEAD_RADIUS;
      const kneeY = hipY + UPPER_LEG - 1;
      const armY = shoulderY + UPPER_ARM + LOWER_ARM * 0.5;

      return {
        headX: stickX,
        headY,
        neckX: stickX,
        neckY,
        shoulderX: stickX,
        shoulderY,
        hipX: stickX,
        hipY,
        leftHandX: stickX - 2,
        leftHandY: armY,
        rightHandX: stickX + 2,
        rightHandY: armY,
        leftElbowX: stickX - 1.5,
        leftElbowY: shoulderY + UPPER_ARM,
        rightElbowX: stickX + 1.5,
        rightElbowY: shoulderY + UPPER_ARM,
        leftFootX: stickX - 2,
        leftFootY: feetY,
        rightFootX: stickX + 2,
        rightFootY: feetY,
        leftKneeX: stickX - 1.5,
        leftKneeY: kneeY,
        rightKneeX: stickX + 1.5,
        rightKneeY: kneeY,
      };
    }

    // Walk tuning
    const HALF_STRIDE = 6;
    const FOOT_LIFT = 6;
    const ARM_SWING = 0.45;
    const ARM_LAG = 0.3;
    const FOREARM_LAG = 0.6;
    const FOREARM_RATIO = 0.65;

    // Walk cycle progress [0, 1) for each leg — right leg offset by half cycle
    const leftT = (walkPhase % (Math.PI * 2)) / (Math.PI * 2);
    const rightT = (leftT + 0.5) % 1;

    // Body dynamics
    const bob = Math.abs(Math.sin(walkPhase * 2)) * 1.2;
    const lean = 0.03;
    const shoulderTwist = Math.sin(walkPhase) * 1.0;

    const hipX = stickX;
    const hipY = feetY - legRoom - bob;
    const shoulderY = hipY - TORSO_LENGTH;
    const neckY = shoulderY - NECK_LENGTH;
    const headY = neckY - HEAD_RADIUS - bob * 0.15;

    // Spine with forward lean + counter-rotation (twist diminishes shoulder → head)
    const spineLen = TORSO_LENGTH + NECK_LENGTH;
    const leanX = Math.sin(lean);
    const shoulderX = stickX + leanX * TORSO_LENGTH + shoulderTwist;
    const neckX = stickX + leanX * spineLen + shoulderTwist * 0.5;
    const headX = stickX + leanX * (spineLen + HEAD_RADIUS) + shoulderTwist * 0.25;

    // ---- LEGS: asymmetric D-path (60% stance, 40% swing) with geometric knee ----
    const leftFootX = hipX + footPathX(leftT, HALF_STRIDE);
    const leftFootY = feetY - footLiftY(leftT, FOOT_LIFT);
    const lDx = leftFootX - hipX;
    const lDy = leftFootY - hipY;
    const lDist = Math.sqrt(lDx * lDx + lDy * lDy);
    const lHalf = lDist * 0.5;
    const lBend = lHalf < UPPER_LEG ? Math.sqrt(UPPER_LEG ** 2 - lHalf ** 2) : 0;
    const lInv = lDist > 0.1 ? lBend / lDist : 0;
    const leftKneeX = (hipX + leftFootX) * 0.5 + lDy * lInv;
    const leftKneeY = (hipY + leftFootY) * 0.5 - lDx * lInv;

    const rightFootX = hipX + footPathX(rightT, HALF_STRIDE);
    const rightFootY = feetY - footLiftY(rightT, FOOT_LIFT);
    const rDx = rightFootX - hipX;
    const rDy = rightFootY - hipY;
    const rDist = Math.sqrt(rDx * rDx + rDy * rDy);
    const rHalf = rDist * 0.5;
    const rBend = rHalf < UPPER_LEG ? Math.sqrt(UPPER_LEG ** 2 - rHalf ** 2) : 0;
    const rInv = rDist > 0.1 ? rBend / rDist : 0;
    const rightKneeX = (hipX + rightFootX) * 0.5 + rDy * rInv;
    const rightKneeY = (hipY + rightFootY) * 0.5 - rDx * rInv;

    // ---- ARMS: contralateral with phase lag (forearm trails behind upper arm) ----
    const leftUpperAngle = -Math.cos(walkPhase - ARM_LAG) * ARM_SWING;
    const leftElbowX = shoulderX + Math.sin(leftUpperAngle) * UPPER_ARM;
    const leftElbowY = shoulderY + Math.cos(leftUpperAngle) * UPPER_ARM;
    const leftForeAngle = -Math.cos(walkPhase - FOREARM_LAG) * ARM_SWING * FOREARM_RATIO;
    const leftHandX = leftElbowX + Math.sin(leftForeAngle) * LOWER_ARM;
    const leftHandY = leftElbowY + Math.cos(leftForeAngle) * LOWER_ARM;

    const rightUpperAngle = Math.cos(walkPhase - ARM_LAG) * ARM_SWING;
    const rightElbowX = shoulderX + Math.sin(rightUpperAngle) * UPPER_ARM;
    const rightElbowY = shoulderY + Math.cos(rightUpperAngle) * UPPER_ARM;
    const rightForeAngle = Math.cos(walkPhase - FOREARM_LAG) * ARM_SWING * FOREARM_RATIO;
    const rightHandX = rightElbowX + Math.sin(rightForeAngle) * LOWER_ARM;
    const rightHandY = rightElbowY + Math.cos(rightForeAngle) * LOWER_ARM;

    return {
      headX,
      headY,
      neckX,
      neckY,
      shoulderX,
      shoulderY,
      hipX,
      hipY,
      leftHandX,
      leftHandY,
      rightHandX,
      rightHandY,
      leftElbowX,
      leftElbowY,
      rightElbowX,
      rightElbowY,
      leftFootX,
      leftFootY,
      rightFootX,
      rightFootY,
      leftKneeX,
      leftKneeY,
      rightKneeX,
      rightKneeY,
    };
  }

  function renderStickman(pose: StickmanPose): void {
    ctx.strokeStyle = colors.text;
    ctx.fillStyle = colors.text;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;

    // Head
    ctx.beginPath();
    ctx.arc(pose.headX, pose.headY, HEAD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Body + limbs in batched path
    ctx.beginPath();
    // Spine
    ctx.moveTo(pose.neckX, pose.neckY);
    ctx.lineTo(pose.hipX, pose.hipY);
    // Left arm: shoulder -> elbow -> hand
    ctx.moveTo(pose.shoulderX, pose.shoulderY);
    ctx.lineTo(pose.leftElbowX, pose.leftElbowY);
    ctx.lineTo(pose.leftHandX, pose.leftHandY);
    // Right arm: shoulder -> elbow -> hand
    ctx.moveTo(pose.shoulderX, pose.shoulderY);
    ctx.lineTo(pose.rightElbowX, pose.rightElbowY);
    ctx.lineTo(pose.rightHandX, pose.rightHandY);
    // Left leg: hip -> knee -> foot
    ctx.moveTo(pose.hipX, pose.hipY);
    ctx.lineTo(pose.leftKneeX, pose.leftKneeY);
    ctx.lineTo(pose.leftFootX, pose.leftFootY);
    // Right leg: hip -> knee -> foot
    ctx.moveTo(pose.hipX, pose.hipY);
    ctx.lineTo(pose.rightKneeX, pose.rightKneeY);
    ctx.lineTo(pose.rightFootX, pose.rightFootY);
    ctx.stroke();
  }

  function drawStickman(): void {
    const pose = computeStickmanPose();
    renderStickman(pose);
  }

  /* ----- Initial scene ----- */

  function clearAllPools(): void {
    for (const type of SPAWN_TYPES) pools[type].count = 0;
  }

  function seedSkyEntities(): void {
    // Stars evenly distributed across the sky
    const starCount = isMobile ? 14 : 20;
    for (let i = 0; i < starCount; i++) {
      poolPush(stars, createStar(width * (i / starCount) + rand(0, width / starCount)));
    }

    // Clouds spaced across horizontal thirds to avoid clustering
    const cloudCount = isMobile ? 3 : 4;
    for (let i = 0; i < cloudCount; i++) {
      const slotStart = i / cloudCount;
      const slotEnd = (i + 0.7) / cloudCount;
      poolPush(clouds, createCloud(width * rand(slotStart, slotEnd)));
    }

    // A balloon in the right half of the scene
    poolPush(balloons, createBalloon(width * rand(0.55, 0.8)));
  }

  function seedBirds(): void {
    // Solo bird on the left
    const b1 = createBird(width * rand(0.25, 0.4));
    b1.flapPhase = rand(0, Math.PI * 2);
    poolPush(birds, b1);

    // Small formation on the right, spaced apart from the solo bird
    const leader = createBird(width * rand(0.65, 0.85));
    leader.flapPhase = rand(0, Math.PI * 2);
    poolPush(birds, leader);
    if (birds.count < caps.bird) {
      const follower = createBird(leader.worldX);
      follower.flapPhase = rand(0, Math.PI * 2);
      follower.y = leader.y;
      follower.velocity = leader.velocity;
      follower.formationOffsetX = -rand(12, 18);
      follower.formationOffsetY = rand(6, 10);
      poolPush(birds, follower);
    }
  }

  function seedGroundEntities(): void {
    // Mountains in two distinct clusters: left and right
    spawnMountainCluster(width * rand(0.2, 0.35));
    spawnMountainCluster(width * rand(0.7, 0.9));

    // Grass and pebbles evenly spaced so they don't clump
    const grassCount = isMobile ? 8 : 12;
    for (let i = 0; i < grassCount; i++) {
      const x = width * (i / grassCount) + rand(0, (width / grassCount) * 0.8);
      poolPush(grassTufts, createGrassTuft(x));
    }
    const pebbleCount = isMobile ? 4 : 6;
    for (let i = 0; i < pebbleCount; i++) {
      const x = width * (i / pebbleCount) + rand(0, (width / pebbleCount) * 0.8);
      poolPush(pebbles, createPebble(x));
    }
  }

  function populateInitialScene(): void {
    clearAllPools();
    seedSkyEntities();
    seedBirds();
    seedGroundEntities();
  }

  /* ----- Entity tick ----- */

  function updateBirds(d: number): void {
    for (let i = 0; i < birds.count; i++) {
      const e = birds.items[i];
      if (!e) continue;
      e.worldX += (e.velocity + wind * 5) * d;
      e.flapPhase += d * 6;
    }
  }

  function updateUfos(d: number): void {
    for (let i = 0; i < ufos.count; i++) {
      const e = ufos.items[i];
      if (!e) continue;
      e.hoverPhase += d * 2;
    }
  }

  function updateMeteors(d: number): void {
    for (let i = 0; i < meteors.count; i++) {
      const e = meteors.items[i];
      if (!e) continue;
      // Streak leftward and downward across the sky
      e.worldX -= Math.cos(e.angle) * e.speed * d;
      e.y += Math.sin(e.angle) * e.speed * d;
      e.life -= d * 1.5;
    }
  }

  function updateBalloonsAndWhales(d: number): void {
    for (let i = 0; i < balloons.count; i++) {
      const e = balloons.items[i];
      if (!e) continue;
      e.worldX += (e.driftSpeed + wind * 3) * d;
      e.swayPhase += d * 1.5;
    }
    for (let i = 0; i < whales.count; i++) {
      const e = whales.items[i];
      if (!e) continue;
      e.worldX += e.velocity * d;
      e.bobPhase += d * 1.2;
    }
  }

  function updateJellyfish(d: number): void {
    for (let i = 0; i < jellyfish.count; i++) {
      const e = jellyfish.items[i];
      if (!e) continue;
      e.worldX += (e.driftSpeed + wind * 2) * d;
      e.pulsePhase += d * 2.5;
    }
  }

  function updateClouds(d: number): void {
    for (let i = 0; i < clouds.count; i++) {
      const e = clouds.items[i];
      if (!e) continue;
      e.worldX += (e.driftSpeed + wind * 2) * d;
    }
  }

  /* ----- Public API ----- */

  function update(dt: number): void {
    if (reducedMotion) return;

    const d = Math.min(dt, MAX_DT);
    time += d;
    worldOffset += WALK_SPEED * d;
    walkPhase += d * 5.0;

    // Wind: two incommensurate frequencies for non-repeating oscillation
    wind = Math.sin(time * 0.2) * 0.3 + Math.sin(time * 0.07) * 0.2;

    updateBirds(d);
    updateUfos(d);
    updateMeteors(d);
    updateBalloonsAndWhales(d);
    updateJellyfish(d);
    updateClouds(d);
    for (const t of SPAWN_TYPES) {
      trySpawn(t);
    }
    cullAllPools();
  }

  function draw(): void {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    // Sky (back to front)
    drawStars();
    drawMeteors();
    drawClouds();
    drawWhales();
    drawJellyfish();
    drawBalloons();

    // Terrain
    drawMountains();
    drawGroundLine();
    drawPebbles();
    drawGrassTufts();

    // Foreground sky
    drawBirds();
    drawUfos();

    // Protagonist
    drawStickman();
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    baseGroundY = height * GROUND_Y_RATIO;
  }

  function onThemeChange(): void {
    colors = readColors();
  }

  function setReducedMotion(enabled: boolean): void {
    reducedMotion = enabled;
    if (enabled) {
      worldOffset = 0;
      walkPhase = 0;
      time = 0;
      wind = 0;
      populateInitialScene();
    }
  }

  populateInitialScene();

  return { update, draw, resize, onThemeChange, setReducedMotion };
}
