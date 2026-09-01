import * as THREE from "three";
import { buildWorld, collidesHouse, segmentBlocked, type World } from "./world";
import { getGame, roundConfig, setGame } from "./state";
import { sfx } from "./audio";

export type EnemyState = "patrol" | "alert" | "seek" | "cover" | "shoot" | "dead";

export interface Enemy {
  id: number;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  state: EnemyState;
  target: THREE.Vector2;
  fireCd: number;
  stateT: number;
  deadT: number;
  facing: number;
  walkPhase: number;
  hitFlash: number;
  headshotKill: boolean;
  speed: number;
  crouch: boolean;
  muzzle: number;
  elevated: boolean;
  elevationY: number;
}

export interface Tracer {
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  enemy: boolean;
}

export interface Impact {
  pos: THREE.Vector3;
  life: number;
  blood: boolean;
}

let idc = 1;

export const runtime = {
  world: buildWorld(7) as World,
  enemies: [] as Enemy[],
  tracers: [] as Tracer[],
  impacts: [] as Impact[],
  playerPos: new THREE.Vector3(0, 15.7, 48),
  playerDir: new THREE.Vector3(0, 0, -1),
  alerted: false,
  shake: 0,
};

export function spawnRound(round: number) {
  runtime.world = buildWorld(7 + round * 13); // generate new world each round
  const cfg = roundConfig(round);
  runtime.enemies = [];
  runtime.tracers = [];
  runtime.impacts = [];
  runtime.alerted = false;

  const groundSpawns = [...runtime.world.spawns].sort(() => Math.random() - 0.5);
  const rooftopSpawns = [...runtime.world.rooftopSpawns].sort(() => Math.random() - 0.5);

  // 25-35% of enemies go on rooftops (at least 1 if rooftops exist)
  const rooftopRatio = 0.25 + Math.random() * 0.1;
  const rooftopCount = rooftopSpawns.length > 0
    ? Math.max(1, Math.min(Math.floor(cfg.enemies * rooftopRatio), rooftopSpawns.length))
    : 0;
  const groundCount = cfg.enemies - rooftopCount;

  // Spawn ground enemies
  for (let i = 0; i < groundCount; i++) {
    const s = groundSpawns[i % groundSpawns.length]!;
    runtime.enemies.push({
      id: idc++,
      pos: new THREE.Vector3(
        s.x + (Math.random() - 0.5) * 4,
        0,
        s.z + (Math.random() - 0.5) * 4,
      ),
      hp: cfg.enemyHealth,
      maxHp: cfg.enemyHealth,
      state: "patrol",
      target: new THREE.Vector2(s.x, s.z),
      fireCd: 1 + Math.random() * 2,
      stateT: 0,
      deadT: 0,
      facing: Math.random() * Math.PI * 2,
      walkPhase: Math.random() * 10,
      hitFlash: 0,
      headshotKill: false,
      speed: cfg.enemySpeed,
      crouch: false,
      muzzle: 0,
      elevated: false,
      elevationY: 0,
    });
  }

  // Spawn rooftop enemies
  for (let i = 0; i < rooftopCount; i++) {
    const s = rooftopSpawns[i % rooftopSpawns.length]!;
    runtime.enemies.push({
      id: idc++,
      pos: new THREE.Vector3(
        s.x + (Math.random() - 0.5) * 2,
        s.y,
        s.z + (Math.random() - 0.5) * 2,
      ),
      hp: cfg.enemyHealth,
      maxHp: cfg.enemyHealth,
      state: "patrol", // rooftop enemies start in patrol mode for stealth
      target: new THREE.Vector2(s.x, s.z),
      fireCd: 1.5 + Math.random() * 2,
      stateT: 3 + Math.random() * 4,
      deadT: 0,
      facing: Math.atan2(runtime.playerPos.x - s.x, runtime.playerPos.z - s.z),
      walkPhase: Math.random() * 10,
      hitFlash: 0,
      headshotKill: false,
      speed: cfg.enemySpeed * 0.4, // slower movement on rooftops
      crouch: Math.random() < 0.4,
      muzzle: 0,
      elevated: true,
      elevationY: s.y,
    });
  }

  setGame({
    enemiesLeft: runtime.enemies.length,
    enemiesTotal: runtime.enemies.length,
    timeLeft: cfg.time,
    ammo: getGame().magSize,
    reserve: 40 + round * 6,
  });
}

function pickWander(e: Enemy) {
  if (e.elevated) {
    // Rooftop enemies: small wander within their rooftop area
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 3;
    e.target.set(e.pos.x + Math.sin(a) * r, e.pos.z + Math.cos(a) * r);
    return;
  }
  const a = Math.random() * Math.PI * 2;
  const r = 30 + Math.random() * 40; // much longer distance while patrolling
  e.target.set(
    THREE.MathUtils.clamp(e.pos.x + Math.sin(a) * r, -105, 105),
    THREE.MathUtils.clamp(e.pos.z + Math.cos(a) * r, -105, 105),
  );
}

function pickCover(e: Enemy) {
  if (e.elevated) {
    // Rooftop enemies just crouch/stand — they stay on their roof
    e.crouch = Math.random() < 0.5;
    pickWander(e);
    return;
  }
  const pts = runtime.world.cover;
  let best: { x: number; z: number } | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 26; i++) {
    const p = pts[Math.floor(Math.random() * pts.length)];
    if (!p) continue;
    const d = Math.hypot(p.x - e.pos.x, p.z - e.pos.z);
    if (d > 40) continue;
    const test = new THREE.Vector3(p.x, 1.4, p.z);
    const hidden = segmentBlocked(runtime.world, test, runtime.playerPos) ? 30 : 0;
    const score = hidden - d * 0.5 + Math.random() * 4;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (best) e.target.set(best.x, best.z);
  else pickWander(e);
}

export function alertAll(origin: THREE.Vector3) {
  runtime.alerted = true;
  for (const e of runtime.enemies) {
    if (e.state === "dead") continue;
    const d = e.pos.distanceTo(origin);
    if (d < 80 || Math.random() < 0.7) {
      if (e.state === "patrol") {
        e.state = "alert";
        // Give them a few seconds delay before they start reacting aggressively
        e.stateT = 2.0 + Math.random() * 1.5;
        // Make sure their first shot takes a bit
        e.fireCd = 2.5 + Math.random() * 1.5;
      }
    }
  }
}

function damagePlayer(amount: number) {
  const g = getGame();
  if (g.phase !== "playing") return;
  const hp = Math.max(0, g.health - amount);
  setGame({ health: hp, hitFlash: 1 });
  sfx.hitPlayer();
  runtime.shake = 0.6;
  if (hp <= 0) {
    sfx.gameOver();
    setGame({ phase: "gameover" });
  }
}

export function updateSim(dt: number, round: number) {
  const cfg = roundConfig(round);
  const g = getGame();
  const playing = g.phase === "playing";

  for (const e of runtime.enemies) {
    if (e.state === "dead") {
      e.deadT += dt;
      continue;
    }
    e.hitFlash = Math.max(0, e.hitFlash - dt * 3);
    e.muzzle = Math.max(0, e.muzzle - dt * 8);
    e.stateT -= dt;

    const eyeY = e.elevated
      ? e.elevationY + (e.crouch ? 1.1 : 1.6)
      : e.crouch
        ? 1.1
        : 1.6;
    const toPlayer = new THREE.Vector3().subVectors(runtime.playerPos, e.pos);
    const dist = toPlayer.length();
    const eye = new THREE.Vector3(e.pos.x, eyeY, e.pos.z);
    const canSee = !segmentBlocked(runtime.world, eye, runtime.playerPos);

    if (!playing) continue;

    switch (e.state) {
      case "patrol": {
        e.crouch = false;
        if (e.elevated) {
          // Rooftop patrol — just small wanders
          moveToElevated(e, dt, e.speed * 0.3);
        } else {
          moveTo(e, dt, e.speed * 0.42);
        }
        if (reached(e)) pickWander(e);
        if (runtime.alerted && Math.random() < dt * 0.8) {
          e.state = "alert";
          e.stateT = 0.3;
        }
        break;
      }
      case "alert": {
        e.facing = lerpAngle(e.facing, Math.atan2(toPlayer.x, toPlayer.z), dt * 5);
        if (e.stateT <= 0) {
          if (e.elevated) {
            // Rooftop enemies go straight to shoot
            e.state = "shoot";
            e.crouch = Math.random() < 0.4;
            e.stateT = 3 + Math.random() * 4;
            e.fireCd = Math.max(e.fireCd, 0.5 + Math.random());
          } else {
            e.state = canSee ? "cover" : "seek";
            pickCover(e);
            e.stateT = 4 + Math.random() * 3;
          }
        }
        break;
      }
      case "seek": {
        e.crouch = false;
        if (e.elevated) {
          moveToElevated(e, dt, e.speed * 0.8);
        } else {
          moveTo(e, dt, e.speed * 1.8); // Run with more movement during fire
        }
        if (reached(e) || e.stateT <= 0) {
          pickCover(e);
          e.state = "cover";
          e.stateT = 3 + Math.random() * 3;
        }
        break;
      }
      case "cover": {
        if (e.elevated) {
          moveToElevated(e, dt, e.speed * 0.7);
        } else {
          moveTo(e, dt, e.speed * 1.8); // Run with more movement during fire
        }
        if (reached(e)) {
          e.state = "shoot";
          e.crouch = Math.random() < 0.5;
          e.stateT = 2.5 + Math.random() * 3;
          e.fireCd = 0.3 + Math.random() * 0.8;
        } else if (e.stateT <= 0) {
          pickCover(e);
          e.stateT = 4;
        }
        break;
      }
      case "shoot": {
        e.facing = lerpAngle(e.facing, Math.atan2(toPlayer.x, toPlayer.z), dt * 6);
        e.fireCd -= dt;
        if (canSee && e.fireCd <= 0 && dist < 150) {
          e.fireCd = cfg.enemyFireRate * (0.7 + Math.random() * 0.6);
          e.muzzle = 1;
          sfx.enemyShot(dist);
          const fromY = e.elevated
            ? e.elevationY + (e.crouch ? 1.1 : 1.5)
            : e.crouch
              ? 1.1
              : 1.5;
          const from = new THREE.Vector3(e.pos.x, fromY, e.pos.z);
          const hit = Math.random() < cfg.enemyAccuracy * (dist < 60 ? 1.2 : 0.75);
          const to = runtime.playerPos
            .clone()
            .add(
              hit
                ? new THREE.Vector3(0, 0, 0)
                : new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 4,
                    (Math.random() - 0.5) * 5,
                  ),
            );
          runtime.tracers.push({ from, to, life: 0.12, enemy: true });
          if (hit) damagePlayer(cfg.enemyDamage);
          else if (Math.random() < 0.5) sfx.ricochet();
        }
        if (e.stateT <= 0 || !canSee) {
          if (e.elevated) {
            // Rooftop: alternate between crouching (ducking) and shooting
            e.crouch = !e.crouch;
            e.stateT = e.crouch ? 1.5 + Math.random() * 2 : 3 + Math.random() * 3;
            if (!canSee) {
              e.state = "patrol";
              e.stateT = 2 + Math.random() * 2;
              pickWander(e);
            }
          } else {
            e.state = "cover";
            e.crouch = false;
            pickCover(e);
            e.stateT = 4 + Math.random() * 2;
          }
        }
        break;
      }
    }
  }

  for (let i = runtime.tracers.length - 1; i >= 0; i--) {
    const t = runtime.tracers[i]!;
    t.life -= dt;
    if (t.life <= 0) runtime.tracers.splice(i, 1);
  }
  for (let i = runtime.impacts.length - 1; i >= 0; i--) {
    const im = runtime.impacts[i]!;
    im.life -= dt;
    if (im.life <= 0) runtime.impacts.splice(i, 1);
  }
  runtime.shake = Math.max(0, runtime.shake - dt * 2);
}

function reached(e: Enemy) {
  return Math.hypot(e.target.x - e.pos.x, e.target.y - e.pos.z) < 1.2;
}

function moveTo(e: Enemy, dt: number, speed: number) {
  const dx = e.target.x - e.pos.x;
  const dz = e.target.y - e.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  const nx = e.pos.x + (dx / d) * speed * dt;
  const nz = e.pos.z + (dz / d) * speed * dt;
  if (!collidesHouse(runtime.world, nx, e.pos.z)) e.pos.x = nx;
  else e.target.x = e.pos.x + (Math.random() - 0.5) * 10;
  if (!collidesHouse(runtime.world, e.pos.x, nz)) e.pos.z = nz;
  else e.target.y = e.pos.z + (Math.random() - 0.5) * 10;
  e.facing = lerpAngle(e.facing, Math.atan2(dx, dz), dt * 6);
  e.walkPhase += dt * speed * 2.2;
}

/** Elevated (rooftop) enemy movement — no house collision, limited range */
function moveToElevated(e: Enemy, dt: number, speed: number) {
  const dx = e.target.x - e.pos.x;
  const dz = e.target.y - e.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  e.pos.x += (dx / d) * speed * dt;
  e.pos.z += (dz / d) * speed * dt;
  e.facing = lerpAngle(e.facing, Math.atan2(dx, dz), dt * 6);
  e.walkPhase += dt * speed * 2.2;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * Math.min(1, t);
}

/** Player fires a sniper shot along `dir` from `from`. */
export function playerShoot(from: THREE.Vector3, dir: THREE.Vector3, round: number) {
  const cfg = roundConfig(round);
  const ray = new THREE.Ray(from.clone(), dir.clone().normalize());
  let best: { e: Enemy; dist: number; head: boolean; hitPt: THREE.Vector3 } | null = null;
  const sphere = new THREE.Sphere();
  const box = new THREE.Box3();
  const hitPoint = new THREE.Vector3();

  for (const e of runtime.enemies) {
    if (e.state === "dead") continue;
    const baseY = e.elevated ? e.elevationY : 0;
    const top = baseY + (e.crouch ? 1.25 : 1.8);
    // head
    sphere.set(new THREE.Vector3(e.pos.x, top - 0.16, e.pos.z), 0.28);
    if (ray.intersectSphere(sphere, hitPoint)) {
      const d = hitPoint.distanceTo(from);
      if (!best || d < best.dist) best = { e, dist: d, head: true, hitPt: hitPoint.clone() };
      continue;
    }
    // body
    box.min.set(e.pos.x - 0.38, baseY, e.pos.z - 0.30);
    box.max.set(e.pos.x + 0.38, top - 0.34, e.pos.z + 0.30);
    if (ray.intersectBox(box, hitPoint)) {
      const d = hitPoint.distanceTo(from);
      if (!best || d < best.dist) best = { e, dist: d, head: false, hitPt: hitPoint.clone() };
    }
  }

  // FIX: Check occlusion from player to the ENEMY HIT POINT, not the tracer endpoint
  // This was the root cause of "can't kill enemies" — buildings behind the enemy
  // were falsely blocking the shot
  if (best) {
    const occlusionTarget = best.hitPt.clone();
    // Pull the test point slightly toward the player to avoid self-intersection at the hit surface
    const pullback = dir.clone().normalize().multiplyScalar(-0.6);
    occlusionTarget.add(pullback);
    if (segmentBlocked(runtime.world, from, occlusionTarget)) {
      best = null;
    }
  }

  const end = from.clone().add(dir.clone().normalize().multiplyScalar(best ? best.dist : 400));
  runtime.tracers.push({ from: from.clone(), to: end, life: 0.09, enemy: false });

  if (!best) {
    // ground / building impact
    const ground = groundHit(ray);
    if (ground) runtime.impacts.push({ pos: ground, life: 0.5, blood: false });
    alertAll(ground ?? end);
    return;
  }

  const e = best.e;
  const dmg = best.head ? 500 : 60;
  e.hp -= dmg;
  e.hitFlash = 1;
  const baseY = e.elevated ? e.elevationY : 0;
  runtime.impacts.push({
    pos: new THREE.Vector3(e.pos.x, baseY + (best.head ? 1.65 : 1.1), e.pos.z),
    life: 0.45,
    blood: true,
  });
  if (best.head) sfx.headshot();
  else sfx.hitFlesh();

  if (e.hp <= 0) {
    e.state = "dead";
    e.deadT = 0;
    e.headshotKill = best.head;
    const g = getGame();
    const coins = Math.round(cfg.coinPerKill * (best.head ? 2 : 1));
    sfx.kill();
    sfx.coin();
    setGame({
      coins: g.coins + coins,
      kills: g.kills + 1,
      headshots: g.headshots + (best.head ? 1 : 0),
      enemiesLeft: Math.max(0, g.enemiesLeft - 1),
      lastKillMsg: `${best.head ? "HEADSHOT" : "KILL"}  +${coins}`,
      lastKillAt: performance.now(),
    });
  } else {
    e.state = "alert";
    e.stateT = 0.25;
  }
  alertAll(e.pos);
}

function groundHit(ray: THREE.Ray) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const p = new THREE.Vector3();
  return ray.intersectPlane(plane, p) ? p : null;
}
