/** Explorer Animation Engine — procedural walking scene. */

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

const SCREEN_X = 0.35;
const WALK_SPEED = 45;
const HEAD_R = 5.5;
const TORSO = 14;
const NECK = 3;
const U_LEG = 8;
const L_LEG = 7;
const U_ARM = 6;
const L_ARM = 5;
const GROUND_Y = 0.8;
const MAX_DT = 0.1;
const FADE = 60;

// [type, startMultiplier, minInterval, maxInterval]
// prettier-ignore
const SPAWN_CFG: [SpawnType, number, number, number][] = [
  ["star", 0, 50, 100],
  ["cloud", 0.4, 180, 350],
  ["mountain", 0.8, 400, 700],
  ["bird", 0.5, 200, 400],
  ["meteor", 0.8, 400, 800],
  ["balloon", 2.2, 600, 1000],
  ["ufo", 3, 900, 1800],
  ["whale", 3.8, 1400, 2500],
  ["jellyfish", 2.5, 800, 1400],
  ["grassTuft", 0, 30, 70],
  ["pebble", 0.2, 40, 90],
];
const TYPES = SPAWN_CFG.map((c) => c[0]);

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function randInt(a: number, b: number): number {
  return Math.floor(rand(a, b + 1));
}

function entityAlpha(screenX: number, parallax: number, w: number, base: number): number {
  const depth = 0.3 + 0.7 * parallax;
  const edge = w - screenX;
  return base * depth * (edge > 0 && edge < FADE ? edge / FADE : 1);
}

function footPathX(t: number, hs: number): number {
  if (t < 0.6) return hs * (1 - t / 0.3);
  const s = (t - 0.6) * 2.5;
  return hs * (6 * s * s - 4 * s * s * s - 1);
}

function footLiftY(t: number, max: number): number {
  return t < 0.6 ? 0 : Math.sin((t - 0.6) * 2.5 * Math.PI) * max;
}

function legIK(hx: number, hy: number, fx: number, fy: number): [number, number] {
  const dx = fx - hx;
  const dy = fy - hy;
  const d = Math.sqrt(dx * dx + dy * dy);
  const h = d * 0.5;
  const b = h < U_LEG ? Math.sqrt(U_LEG ** 2 - h ** 2) : 0;
  const inv = d > 0.1 ? b / d : 0;
  return [(hx + fx) * 0.5 + dy * inv, (hy + fy) * 0.5 - dx * inv];
}

function armFK(
  shX: number,
  shY: number,
  sign: number,
  phase: number,
): [number, number, number, number] {
  const ua = sign * Math.cos(phase - 0.3) * 0.45;
  const ex = shX + Math.sin(ua) * U_ARM;
  const ey = shY + Math.cos(ua) * U_ARM;
  const fa = sign * Math.cos(phase - 0.6) * 0.45 * 0.65;
  return [ex, ey, ex + Math.sin(fa) * L_ARM, ey + Math.cos(fa) * L_ARM];
}

// Whale body: start[2] + 12 curves × [cp1x, cp1y, cp1_wag, cp2x, cp2y, cp2_wag, ex, ey, e_wag]
// prettier-ignore
const WHALE_BODY = [
  -0.95, 0.02, -0.92, -0.12, 0, -0.75, -0.32, 0, -0.45, -0.36, 0, -0.15, -0.38, 0, 0.2, -0.34, 0,
  0.45, -0.26, 0, 0.52, -0.24, 0, 0.55, -0.3, 0, 0.58, -0.24, 0, 0.72, -0.16, 0.25, 0.88, -0.06,
  0.5, 0.98, -0.02, 0.7, 1.06, -0.04, 0.85, 1.18, -0.18, 1, 1.28, -0.26, 1, 1.3, -0.22, 1, 1.26,
  -0.14, 0.9, 1.12, -0.04, 0.75, 1.06, 0, 0.7, 1.06, 0.02, 0.7, 1.12, 0.06, 0.75, 1.26, 0.16, 0.9,
  1.3, 0.24, 1, 1.28, 0.28, 1, 1.18, 0.2, 1, 1.06, 0.08, 0.85, 0.98, 0.04, 0.7, 0.85, 0.1, 0.25,
  0.65, 0.2, 0, 0.4, 0.28, 0, 0.1, 0.34, 0, -0.25, 0.36, 0, -0.55, 0.3, 0, -0.78, 0.24, 0, -0.92,
  0.14, 0, -0.95, 0.02, 0,
];

// Whale pectoral fin: start[2] + 2 curves × 9
// prettier-ignore
const WHALE_FIN = [
  -0.3, 0.2, -0.38, 0.32, 0, -0.52, 0.42, 0, -0.62, 0.38, 0, -0.58, 0.32, 0, -0.44, 0.26, 0, -0.3,
  0.2, 0,
];

function drawBzPath(
  c: CanvasRenderingContext2D,
  x: number,
  cy: number,
  s: number,
  tw: number,
  d: number[],
): void {
  const v = (j: number) => d[j] ?? 0;
  c.beginPath();
  c.moveTo(x + s * v(0), cy + s * v(1));
  for (let i = 2; i < d.length; i += 9) {
    c.bezierCurveTo(
      x + s * v(i),
      cy + s * v(i + 1) + tw * v(i + 2),
      x + s * v(i + 3),
      cy + s * v(i + 4) + tw * v(i + 5),
      x + s * v(i + 6),
      cy + s * v(i + 7) + tw * v(i + 8),
    );
  }
  c.closePath();
}

export function createExplorerEngine(options: ExplorerEngineOptions): ExplorerEngine {
  const { ctx, getColor, isMobile } = options;
  let { width, height, reducedMotion } = options;
  let baseGroundY = height * GROUND_Y;
  let worldOffset = 0;
  let walkPhase = 0;
  let time = 0;
  let wind = 0;
  const sm = isMobile ? 1.5 : 1;

  function readColors() {
    return {
      bg: getColor("--color-bg"),
      text: getColor("--color-text"),
      textMuted: getColor("--color-text-muted"),
      primary: getColor("--color-primary"),
      border: getColor("--color-border"),
      surface: getColor("--color-surface"),
    };
  }
  let colors = readColors();

  // prettier-ignore
  const caps: Record<SpawnType, number> = isMobile
    ? {
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
      }
    : {
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

  /* --- Entity creation --- */

  function createStar(wX: number) {
    return {
      worldX: wX,
      y: rand(height * 0.05, height * 0.45),
      parallax: 0.1,
      size: 0.5 + Math.random() ** 2.5 * 2.8,
      twinkleOffset: rand(0, Math.PI * 2),
      twinkleSpeed: rand(0.8, 2.5),
    };
  }

  function createCloud(wX: number) {
    const r = rand(6, 18);
    return {
      worldX: wX,
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

  function createMountain(wX: number, h: number, wL: number, wR: number) {
    return {
      worldX: wX,
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

  function spawnMountainCluster(cX: number): void {
    const n = randInt(3, 5);
    const tmp: ReturnType<typeof createMountain>[] = [];
    for (let i = 0; i < n; i++) {
      if (mountains.length + tmp.length >= caps.mountain) break;
      const c = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 + 0.5);
      const h = Math.min(rand(55, 115) + c * rand(20, 50), baseGroundY * 0.85);
      tmp.push(
        createMountain(cX + (i - (n - 1) / 2) * rand(30, 55), h, rand(25, 65), rand(25, 65)),
      );
    }
    tmp.sort((a, b) => b.peakHeight - a.peakHeight);
    for (const p of tmp) mountains.push(p);
  }

  function createBird(wX: number) {
    return {
      worldX: wX,
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
    const groupSize = Math.random() < 0.3 ? randInt(2, 3) : 1;
    const leader = createBird(wX);
    leader.worldX = wX;
    birds.push(leader);
    for (let i = 1; i < groupSize; i++) {
      if (birds.length >= caps.bird) break;
      const f = createBird(wX);
      f.worldX = wX;
      f.y = leader.y;
      f.velocity = leader.velocity;
      f.formationOffsetX = -rand(12, 20) * i;
      f.formationOffsetY = (i % 2 === 0 ? -1 : 1) * rand(6, 12) * i;
      birds.push(f);
    }
  }

  function createUfo(wX: number) {
    return {
      worldX: wX,
      y: rand(height * 0.08, height * 0.25),
      parallax: 0.6,
      size: rand(0.6, 1.4),
      hoverPhase: rand(0, Math.PI * 2),
      hasTractorBeam: Math.random() > 0.5,
    };
  }

  function createMeteor(wX: number) {
    return {
      worldX: wX,
      y: rand(height * 0.02, height * 0.2),
      parallax: 0.05,
      angle: rand(0.15, 0.4),
      speed: rand(200, 350),
      life: 2,
      maxLife: 2,
      tailLen: rand(25, 80),
    };
  }

  function createBalloon(wX: number) {
    return {
      worldX: wX,
      y: rand(height * 0.08, height * 0.3),
      parallax: 0.35,
      size: rand(8, 20),
      driftSpeed: rand(4, 12),
      swayPhase: rand(0, Math.PI * 2),
    };
  }

  function createWhale(wX: number) {
    const s = rand(40, 95);
    const minY = s * 0.42 + 4;
    const maxY = height * 0.45 - s * 0.42;
    return {
      worldX: wX,
      y: rand(Math.max(minY, height * 0.12), Math.max(minY, maxY)),
      parallax: 0.55,
      size: s,
      velocity: 0,
      bobPhase: rand(0, Math.PI * 2),
    };
  }

  function createJellyfish(wX: number) {
    const tc = randInt(3, 5);
    return {
      worldX: wX,
      y: rand(height * 0.1, height * 0.4),
      parallax: 0.4,
      size: rand(6, 16),
      pulsePhase: rand(0, Math.PI * 2),
      driftSpeed: rand(2, 6),
      tentacleCount: tc,
      tentaclePhases: Array.from({ length: tc }, () => rand(0, Math.PI * 2)),
    };
  }

  function createGrassTuft(wX: number) {
    const bc = randInt(2, 3);
    return {
      worldX: wX,
      y: baseGroundY,
      parallax: 1.0,
      bladeCount: bc,
      bladeHeight: rand(3, 11),
      bladeAngles: Array.from({ length: bc }, () => rand(-0.4, 0.4)),
    };
  }

  function createPebble(wX: number) {
    return { worldX: wX, y: baseGroundY + rand(1, 3), parallax: 1.0, radius: rand(0.8, 3.5) };
  }

  /* --- Entity arrays & pool registry --- */

  const stars: ReturnType<typeof createStar>[] = [];
  const clouds: ReturnType<typeof createCloud>[] = [];
  const mountains: ReturnType<typeof createMountain>[] = [];
  const birds: ReturnType<typeof createBird>[] = [];
  const ufos: ReturnType<typeof createUfo>[] = [];
  const meteors: ReturnType<typeof createMeteor>[] = [];
  const balloons: ReturnType<typeof createBalloon>[] = [];
  const whales: ReturnType<typeof createWhale>[] = [];
  const jfish: ReturnType<typeof createJellyfish>[] = [];
  const grassTufts: ReturnType<typeof createGrassTuft>[] = [];
  const pebbles: ReturnType<typeof createPebble>[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous pool registry
  const pools: Record<SpawnType, any[]> = {
    star: stars,
    cloud: clouds,
    mountain: mountains,
    bird: birds,
    ufo: ufos,
    meteor: meteors,
    balloon: balloons,
    whale: whales,
    jellyfish: jfish,
    grassTuft: grassTufts,
    pebble: pebbles,
  };

  /* --- Spawn logic --- */

  const spawners: Record<SpawnType, { next: number; min: number; max: number }> = {} as Record<
    SpawnType,
    { next: number; min: number; max: number }
  >;
  for (const [type, start, min, max] of SPAWN_CFG) {
    spawners[type] = { next: width * start, min: min * sm, max: max * sm };
  }

  const creators: Partial<Record<SpawnType, (wX: number) => { worldX: number; parallax: number }>> =
    {
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

  function toWorldX(screenX: number, parallax: number): number {
    return screenX + worldOffset * parallax;
  }

  function spawnEntity(type: SpawnType, screenX: number): void {
    if (type === "mountain") {
      spawnMountainCluster(toWorldX(screenX, 0.2));
      return;
    }
    if (type === "bird") {
      spawnBirdGroup(screenX);
      return;
    }
    const creator = creators[type];
    if (!creator) return;
    const e = creator(0);
    e.worldX = toWorldX(screenX, e.parallax);
    pools[type].push(e);
  }

  function trySpawn(type: SpawnType): void {
    const sp = spawners[type];
    const rightEdge = worldOffset + width;
    if (rightEdge < sp.next) return;
    if (pools[type].length >= caps[type]) {
      sp.next = rightEdge + rand(sp.min, sp.max);
      return;
    }
    spawnEntity(type, width + rand(20, 80));
    sp.next = rightEdge + rand(sp.min, sp.max);
  }

  /* --- Culling (swap-and-pop) --- */

  function sX(wx: number, p: number): number {
    return wx - worldOffset * p;
  }

  function cull<T extends { worldX: number; parallax: number }>(
    arr: T[],
    alive?: (e: T) => boolean,
  ): void {
    let i = 0;
    while (i < arr.length) {
      const e = arr[i];
      if (!e) {
        i++;
        continue;
      }
      if (sX(e.worldX, e.parallax) < -200 || (alive !== undefined && !alive(e))) {
        const last = arr[arr.length - 1];
        if (last !== undefined) arr[i] = last;
        arr.pop();
      } else {
        i++;
      }
    }
  }

  function cullAll(): void {
    for (const t of TYPES) {
      // biome-ignore lint/suspicious/noExplicitAny: pool registry is heterogeneous
      cull(pools[t], t === "meteor" ? (m: any) => m.life > 0 : undefined);
    }
  }

  /* --- Drawing --- */

  function drawStars(): void {
    ctx.fillStyle = colors.textMuted;
    for (let i = 0; i < stars.length; i++) {
      const e = stars[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      if (x < -10 || x > width + 10) continue;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * e.twinkleSpeed + e.twinkleOffset));
      ctx.globalAlpha = entityAlpha(x, e.parallax, width, tw);
      ctx.beginPath();
      ctx.arc(x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(): void {
    ctx.fillStyle = colors.textMuted;
    for (let i = 0; i < clouds.length; i++) {
      const e = clouds[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
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
    for (let i = 0; i < meteors.length; i++) {
      const e = meteors[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      const opacity = e.life / e.maxLife;
      const ms = e.tailLen / 50;
      const tdx = Math.cos(e.angle) * e.tailLen * 1.5;
      const tdy = Math.sin(e.angle) * e.tailLen * 1.5;
      const alpha = entityAlpha(x, e.parallax, width, opacity);

      const grad = ctx.createLinearGradient(x, e.y, x + tdx, e.y - tdy);
      grad.addColorStop(0, colors.primary);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)"); /* token-exempt */
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 + ms;
      ctx.lineCap = "round";
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x, e.y);
      ctx.lineTo(x + tdx, e.y - tdy);
      ctx.stroke();

      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = alpha * 0.4;
      ctx.beginPath();
      ctx.arc(x, e.y, 2 + ms * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, e.y, 1 + ms, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWhales(): void {
    for (let i = 0; i < whales.length; i++) {
      const e = whales[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      if (x < -120 || x > width + 120) continue;
      const bob = Math.sin(e.bobPhase) * 4;
      const cy = e.y + bob;
      const s = e.size;
      const tailWag = Math.sin(e.bobPhase * 1.6) * s * 0.08;
      const alpha = entityAlpha(x, e.parallax, width, 1);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = colors.textMuted;
      ctx.globalAlpha = alpha * 0.7;
      drawBzPath(ctx, x, cy, s, tailWag, WHALE_BODY);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.55;
      drawBzPath(ctx, x, cy, s, 0, WHALE_FIN);
      ctx.fill();

      ctx.strokeStyle = colors.surface;
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let g = 0; g < 3; g++) {
        const gy = cy + s * (0.12 + g * 0.06);
        const gs = x - s * (0.55 - g * 0.1);
        const ge = x + s * (0.1 - g * 0.04);
        ctx.moveTo(gs, gy);
        ctx.quadraticCurveTo((gs + ge) * 0.5, gy + s * 0.03, ge, gy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawJellyfish(): void {
    for (let i = 0; i < jfish.length; i++) {
      const e = jfish[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      if (x < -30 || x > width + 30) continue;
      const s = e.size;
      const pulse = Math.sin(e.pulsePhase) * 0.15;
      const bellW = s * (0.7 + pulse);
      const bellH = s * (0.55 - pulse * 0.3);
      const alpha = entityAlpha(x, e.parallax, width, 0.55);

      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, e.y, bellW, bellH, 0, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.ellipse(x, e.y, bellW * 1.02, bellH * 0.3, 0, 0, Math.PI);
      ctx.stroke();

      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 0.6;
      ctx.lineCap = "round";
      ctx.globalAlpha = alpha * 0.45;
      const tentSpacing = (bellW * 2) / (e.tentacleCount + 1);
      for (let t = 0; t < e.tentacleCount; t++) {
        const tPhase = e.tentaclePhases[t] ?? 0;
        const tx = x - bellW + tentSpacing * (t + 1);
        const tentLen = s * rand(0.8, 1.4);
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
    for (let i = 0; i < balloons.length; i++) {
      const e = balloons[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      if (x < -30 || x > width + 30) continue;
      const sway = Math.sin(e.swayPhase) * 3 + wind * 2;
      const s = e.size;
      const alpha = entityAlpha(x, e.parallax, width, 0.6);
      const bx = x + sway;

      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(bx, e.y, s * 0.6, s * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = alpha * 0.83;
      const basketY = e.y + s;
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.3, e.y + s * 0.6);
      ctx.lineTo(bx - 3, basketY);
      ctx.moveTo(bx + s * 0.3, e.y + s * 0.6);
      ctx.lineTo(bx + 3, basketY);
      ctx.stroke();

      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(bx - 4, basketY, 8, 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMountains(): void {
    for (let i = 0; i < mountains.length; i++) {
      const e = mountains[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      if (x + e.rightWidth < -10 || x - e.leftWidth > width + 10) continue;
      const gY = e.y;
      const peakX = x;
      const peakY = gY - e.peakHeight;
      const lx = x - e.leftWidth;
      const rx = x + e.rightWidth;
      const clx = lx + e.leftWidth * 0.5 + e.ctrlLeftDx;
      const cly = gY - e.ctrlLeftDy;
      const crx = rx - e.rightWidth * 0.5 + e.ctrlRightDx;
      const cry = gY - e.ctrlRightDy;

      ctx.globalAlpha = entityAlpha(x, e.parallax, width, 1);
      ctx.beginPath();
      ctx.moveTo(lx, gY);
      ctx.quadraticCurveTo(clx, cly, peakX, peakY);
      ctx.quadraticCurveTo(crx, cry, rx, gY);
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
    for (let i = 0; i < grassTufts.length; i++) {
      const e = grassTufts[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      if (x < -15 || x > width + 15) continue;
      ctx.globalAlpha = entityAlpha(x, e.parallax, width, 0.45);
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
    for (let i = 0; i < pebbles.length; i++) {
      const e = pebbles[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
      if (x < -5 || x > width + 5) continue;
      ctx.globalAlpha = entityAlpha(x, e.parallax, width, 0.4);
      ctx.beginPath();
      ctx.arc(x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds(): void {
    for (let i = 0; i < birds.length; i++) {
      const e = birds[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax) + e.formationOffsetX;
      const y = e.y + e.formationOffsetY;
      if (x < -20 || x > width + 20) continue;
      const sinPhase = Math.sin(e.flapPhase);
      const flap = Math.sign(sinPhase) * Math.abs(sinPhase) ** 0.7 * 0.6;
      const ws = e.wingspan;
      const bodyRise = Math.max(0, -sinPhase) * 1.5;

      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 0.8 + ws * 0.06;
      ctx.lineCap = "round";
      ctx.globalAlpha = entityAlpha(x, e.parallax, width, 0.7);
      ctx.beginPath();
      ctx.moveTo(x - ws, y - bodyRise - flap * ws * 0.5);
      ctx.lineTo(x, y - bodyRise);
      ctx.lineTo(x + ws, y - bodyRise - flap * ws * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawUfos(): void {
    for (let i = 0; i < ufos.length; i++) {
      const e = ufos[i];
      if (!e) continue;
      const x = sX(e.worldX, e.parallax);
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

  /* --- Stickman --- */

  function drawStickman(): void {
    const stickX = width * SCREEN_X;
    const feetY = baseGroundY - 1;
    const legRoom = U_LEG + L_LEG - 2;
    let hipX: number;
    let hipY: number;
    let shX: number;
    let shY: number;
    let nkX: number;
    let nkY: number;
    let hdX: number;
    let hdY: number;
    let lk: [number, number];
    let rk: [number, number];
    let lf: [number, number];
    let rf: [number, number];
    let la: [number, number, number, number];
    let ra: [number, number, number, number];

    if (reducedMotion) {
      hipX = stickX;
      hipY = feetY - legRoom;
      shY = hipY - TORSO;
      nkY = shY - NECK;
      hdY = nkY - HEAD_R;
      shX = nkX = hdX = stickX;
      const knY = hipY + U_LEG - 1;
      const armY = shY + U_ARM + L_ARM * 0.5;
      lf = [stickX - 2, feetY];
      rf = [stickX + 2, feetY];
      lk = [stickX - 1.5, knY];
      rk = [stickX + 1.5, knY];
      la = [stickX - 1.5, shY + U_ARM, stickX - 2, armY];
      ra = [stickX + 1.5, shY + U_ARM, stickX + 2, armY];
    } else {
      const leftT = (walkPhase % (Math.PI * 2)) / (Math.PI * 2);
      const rightT = (leftT + 0.5) % 1;
      const bob = Math.abs(Math.sin(walkPhase * 2)) * 1.2;
      const twist = Math.sin(walkPhase) * 1.0;
      const lean = Math.sin(0.03);

      hipX = stickX;
      hipY = feetY - legRoom - bob;
      shY = hipY - TORSO;
      nkY = shY - NECK;
      hdY = nkY - HEAD_R - bob * 0.15;
      shX = stickX + lean * TORSO + twist;
      nkX = stickX + lean * (TORSO + NECK) + twist * 0.5;
      hdX = stickX + lean * (TORSO + NECK + HEAD_R) + twist * 0.25;

      const lfx = hipX + footPathX(leftT, 6);
      const lfy = feetY - footLiftY(leftT, 6);
      const rfx = hipX + footPathX(rightT, 6);
      const rfy = feetY - footLiftY(rightT, 6);
      lf = [lfx, lfy];
      rf = [rfx, rfy];
      lk = legIK(hipX, hipY, lfx, lfy);
      rk = legIK(hipX, hipY, rfx, rfy);
      la = armFK(shX, shY, -1, walkPhase);
      ra = armFK(shX, shY, 1, walkPhase);
    }

    ctx.strokeStyle = colors.text;
    ctx.fillStyle = colors.text;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(hdX, hdY, HEAD_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(nkX, nkY);
    ctx.lineTo(hipX, hipY);
    ctx.moveTo(shX, shY);
    ctx.lineTo(la[0], la[1]);
    ctx.lineTo(la[2], la[3]);
    ctx.moveTo(shX, shY);
    ctx.lineTo(ra[0], ra[1]);
    ctx.lineTo(ra[2], ra[3]);
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(lk[0], lk[1]);
    ctx.lineTo(lf[0], lf[1]);
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(rk[0], rk[1]);
    ctx.lineTo(rf[0], rf[1]);
    ctx.stroke();
  }

  /* --- Initial scene --- */

  function seedSky(): void {
    const starCount = isMobile ? 14 : 20;
    for (let i = 0; i < starCount; i++) {
      stars.push(createStar(width * (i / starCount) + rand(0, width / starCount)));
    }
    const cloudCount = isMobile ? 3 : 4;
    for (let i = 0; i < cloudCount; i++) {
      clouds.push(createCloud(width * rand(i / cloudCount, (i + 0.7) / cloudCount)));
    }
    balloons.push(createBalloon(width * rand(0.55, 0.8)));
  }

  function seedBirds(): void {
    const b1 = createBird(width * rand(0.25, 0.4));
    b1.flapPhase = rand(0, Math.PI * 2);
    birds.push(b1);
    const leader = createBird(width * rand(0.65, 0.85));
    leader.flapPhase = rand(0, Math.PI * 2);
    birds.push(leader);
    if (birds.length < caps.bird) {
      const f = createBird(leader.worldX);
      f.flapPhase = rand(0, Math.PI * 2);
      f.y = leader.y;
      f.velocity = leader.velocity;
      f.formationOffsetX = -rand(12, 18);
      f.formationOffsetY = rand(6, 10);
      birds.push(f);
    }
  }

  function seedGround(): void {
    spawnMountainCluster(width * rand(0.2, 0.35));
    spawnMountainCluster(width * rand(0.7, 0.9));
    const grassCount = isMobile ? 8 : 12;
    for (let i = 0; i < grassCount; i++) {
      grassTufts.push(
        createGrassTuft(width * (i / grassCount) + rand(0, (width / grassCount) * 0.8)),
      );
    }
    const pebbleCount = isMobile ? 4 : 6;
    for (let i = 0; i < pebbleCount; i++) {
      pebbles.push(createPebble(width * (i / pebbleCount) + rand(0, (width / pebbleCount) * 0.8)));
    }
  }

  function seed(): void {
    for (const t of TYPES) pools[t].length = 0;
    seedSky();
    seedBirds();
    seedGround();
  }

  /* --- Update --- */

  function tickFlyers(d: number): void {
    for (let i = 0; i < birds.length; i++) {
      const e = birds[i];
      if (!e) continue;
      e.worldX += (e.velocity + wind * 5) * d;
      e.flapPhase += d * 6;
    }
    for (let i = 0; i < ufos.length; i++) {
      const e = ufos[i];
      if (e) e.hoverPhase += d * 2;
    }
    for (let i = 0; i < meteors.length; i++) {
      const e = meteors[i];
      if (!e) continue;
      e.worldX -= Math.cos(e.angle) * e.speed * d;
      e.y += Math.sin(e.angle) * e.speed * d;
      e.life -= d * 1.5;
    }
  }

  function tickBalloonsAndWhales(d: number): void {
    for (let i = 0; i < balloons.length; i++) {
      const e = balloons[i];
      if (!e) continue;
      e.worldX += (e.driftSpeed + wind * 3) * d;
      e.swayPhase += d * 1.5;
    }
    for (let i = 0; i < whales.length; i++) {
      const e = whales[i];
      if (!e) continue;
      e.worldX += e.velocity * d;
      e.bobPhase += d * 1.2;
    }
  }

  function tickSeaAndClouds(d: number): void {
    for (let i = 0; i < jfish.length; i++) {
      const e = jfish[i];
      if (!e) continue;
      e.worldX += (e.driftSpeed + wind * 2) * d;
      e.pulsePhase += d * 2.5;
    }
    for (let i = 0; i < clouds.length; i++) {
      const e = clouds[i];
      if (!e) continue;
      e.worldX += (e.driftSpeed + wind * 2) * d;
    }
  }

  function update(dt: number): void {
    if (reducedMotion) return;
    const d = Math.min(dt, MAX_DT);
    time += d;
    worldOffset += WALK_SPEED * d;
    walkPhase += d * 5.0;
    wind = Math.sin(time * 0.2) * 0.3 + Math.sin(time * 0.07) * 0.2;
    tickFlyers(d);
    tickBalloonsAndWhales(d);
    tickSeaAndClouds(d);
    for (const t of TYPES) trySpawn(t);
    cullAll();
  }

  function draw(): void {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
    drawStars();
    drawMeteors();
    drawClouds();
    drawWhales();
    drawJellyfish();
    drawBalloons();
    drawMountains();
    drawGroundLine();
    drawPebbles();
    drawGrassTufts();
    drawBirds();
    drawUfos();
    drawStickman();
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    baseGroundY = height * GROUND_Y;
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
      seed();
    }
  }

  seed();

  return { update, draw, resize, onThemeChange, setReducedMotion };
}
