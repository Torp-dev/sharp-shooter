import * as THREE from "three";

export function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface House extends Box {
  color: string;
  roof: "flat" | "pitch";
  floors: number;
  broken: boolean;
  shape: "rect" | "lshape" | "tshape" | "wide";
  hasBalcony: boolean;
  hasAwning: boolean;
  trimColor: string;
  roofColor: string;
}

export interface Prop {
  type:
    | "tree"
    | "rock"
    | "car"
    | "bike"
    | "barrel"
    | "crate"
    | "pole"
    | "bush"
    | "wall"
    | "well"
    | "sandbag"
    | "antenna"
    | "stall"
    | "wreck";
  x: number;
  z: number;
  rot: number;
  scale: number;
  color: string;
}

export const PLAYER_TOWER: Box = { x: 0, z: 48, w: 18, d: 18, h: 14 };
export const ROOF_Y = PLAYER_TOWER.h;

const pick = (arr: string[], r: number) => arr[Math.floor(r * arr.length)] as string;

const HOUSE_COLORS = [
  "#e0b478",
  "#c98a52",
  "#f0d29a",
  "#b86a3a",
  "#d4a070",
  "#9c5a3a",
  "#e8c388",
  "#f5e6c8",
  "#d4b896",
  "#c4956a",
  "#e8d4b0",
  "#b8856a",
  "#dcc8a0",
  "#cfa87a",
];
const TRIM_COLORS = ["#8a6a4a", "#6a5040", "#7a5a3a", "#5a4a38", "#9a7a5a"];
const ROOF_COLORS = ["#8a4a2a", "#6a3a22", "#7a4828", "#5a3a20", "#9a5a30", "#6a4a32", "#4a3020"];
const CAR_COLORS = ["#c25a3a", "#d9a52a", "#3e8a8a", "#a05028", "#8a6a3a", "#cf8048"];

function overlaps(a: Box, b: Box, pad = 2) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad
  );
}

export interface World {
  houses: House[];
  props: Prop[];
  roads: { x: number; z: number; w: number; d: number; rot: number }[];
  cover: { x: number; z: number }[];
  spawns: { x: number; z: number }[];
  rooftopSpawns: { x: number; z: number; y: number }[];
}

export function buildWorld(seed = 7): World {
  const rnd = mulberry32(seed);
  const houses: House[] = [];
  const props: Prop[] = [];
  const roads: World["roads"] = [];
  const blocked: Box[] = [{ ...PLAYER_TOWER, w: PLAYER_TOWER.w + 6, d: PLAYER_TOWER.d + 6 }];

  // Roads: main streets + cross lanes + plaza
  roads.push({ x: 0, z: -5, w: 10, d: 220, rot: 0 }); // main N-S
  roads.push({ x: 0, z: -20, w: 200, d: 9, rot: 0 }); // main E-W
  roads.push({ x: -34, z: 20, w: 120, d: 7, rot: 0.25 }); // diagonal
  roads.push({ x: 50, z: 10, w: 7, d: 100, rot: 0 }); // east side street
  roads.push({ x: -50, z: -5, w: 7, d: 90, rot: 0 }); // west side street
  roads.push({ x: 0, z: -55, w: 26, d: 26, rot: 0 }); // central plaza

  const roadBoxes: Box[] = roads.map((r) => ({ x: r.x, z: r.z, w: r.w + 3, d: r.d + 3, h: 0 }));

  // Houses in loose grid — expanded area
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 3; gz++) {
      if (rnd() < 0.15) continue;
      // Determine floor count: 30% 1-story, 45% 2-story, 25% 3-story
      const roll = rnd();
      const floors = roll < 0.30 ? 1 : roll < 0.75 ? 2 : 3;
      const floorH = 3.6 + rnd() * 0.8;
      const h = floors * floorH;

      // Determine shape
      const shapeRoll = rnd();
      const shape: House["shape"] =
        floors === 1
          ? shapeRoll < 0.6
            ? "rect"
            : shapeRoll < 0.8
              ? "wide"
              : "lshape"
          : shapeRoll < 0.5
            ? "rect"
            : shapeRoll < 0.7
              ? "lshape"
              : shapeRoll < 0.85
                ? "tshape"
                : "wide";

      // Size varies by shape
      let w: number, d: number;
      switch (shape) {
        case "wide":
          w = 12 + rnd() * 6;
          d = 6 + rnd() * 4;
          break;
        case "lshape":
        case "tshape":
          w = 10 + rnd() * 5;
          d = 10 + rnd() * 5;
          break;
        default:
          w = 7 + rnd() * 7;
          d = 7 + rnd() * 7;
      }

      const cand: House = {
        x: gx * 24 + (rnd() - 0.5) * 8,
        z: gz * 24 + (rnd() - 0.5) * 8,
        w,
        d,
        h,
        floors,
        color: pick(HOUSE_COLORS, rnd()),
        trimColor: pick(TRIM_COLORS, rnd()),
        roofColor: pick(ROOF_COLORS, rnd()),
        roof: floors >= 2 ? (rnd() < 0.7 ? "flat" : "pitch") : rnd() < 0.55 ? "pitch" : "flat",
        broken: rnd() < 0.2,
        shape,
        hasBalcony: floors >= 2 && rnd() < 0.5,
        hasAwning: rnd() < 0.35,
      };
      if (blocked.some((b) => overlaps(cand, b, 3.5))) continue;
      if (roadBoxes.some((b) => overlaps(cand, b, 1))) continue;
      houses.push(cand);
      blocked.push(cand);
    }
  }

  const place = (type: Prop["type"], count: number, size: number, colorFn: () => string) => {
    let tries = 0;
    let made = 0;
    while (made < count && tries < count * 40) {
      tries++;
      const x = (rnd() - 0.5) * 220;
      const z = (rnd() - 0.5) * 220 - 8;
      const cand: Box = { x, z, w: size, d: size, h: 2 };
      if (blocked.some((b) => overlaps(cand, b, 1))) continue;
      const onRoad = roadBoxes.some((b) => overlaps(cand, b, 0));
      if (
        onRoad &&
        !(type === "car" || type === "bike" || type === "barrel" || type === "wreck")
      )
        continue;
      if (!onRoad && (type === "car" || type === "bike") && rnd() < 0.6) continue;
      props.push({
        type,
        x,
        z,
        rot: rnd() * Math.PI * 2,
        scale: 0.75 + rnd() * 0.6,
        color: colorFn(),
      });
      blocked.push(cand);
      made++;
    }
  };

  place("tree", 85, 3.2, () => pick(["#5a8a3a", "#6b9a44", "#3a6a28", "#7aa84a"], rnd()));
  place("bush", 65, 1.8, () => pick(["#6b8a3a", "#7a9a48", "#8a9c4a"], rnd()));
  place("rock", 55, 1.6, () => pick(["#b89a72", "#a08260", "#c8a878"], rnd()));
  place("car", 18, 4.6, () => pick(CAR_COLORS, rnd()));
  place("bike", 14, 2.0, () => pick(["#8a4a2a", "#3e6a6a", "#a06028"], rnd()));
  place("barrel", 30, 1.4, () => pick(["#a05028", "#6a8a3a", "#8a4a2a"], rnd()));
  place("crate", 28, 1.6, () => pick(["#c89858", "#a07042", "#d8a868"], rnd()));
  place("wall", 26, 4.0, () => pick(["#c8a880", "#b09068", "#d0b890"], rnd()));
  place("pole", 18, 1.0, () => "#6a5240");
  place("well", 3, 3.0, () => "#b8a07a");
  place("sandbag", 18, 2.4, () => pick(["#b8a070", "#a09060", "#c8b080"], rnd()));
  place("antenna", 6, 1.2, () => "#6a6a6a");
  place("stall", 8, 3.6, () => pick(["#d4a060", "#c89050", "#b88040"], rnd()));
  place("wreck", 6, 5.0, () => pick(["#5a4a3a", "#6a5a4a", "#4a3a2a"], rnd()));

  // Cover points: near houses, cars, walls
  const cover: { x: number; z: number }[] = [];
  for (const h of houses) {
    cover.push({ x: h.x + h.w / 2 + 1.5, z: h.z });
    cover.push({ x: h.x - h.w / 2 - 1.5, z: h.z });
    cover.push({ x: h.x, z: h.z - h.d / 2 - 1.5 });
    cover.push({ x: h.x, z: h.z + h.d / 2 + 1.5 });
  }
  for (const p of props) {
    if (
      p.type === "car" ||
      p.type === "wall" ||
      p.type === "rock" ||
      p.type === "crate" ||
      p.type === "sandbag" ||
      p.type === "wreck"
    )
      cover.push({ x: p.x + 1.6, z: p.z + 1.6 });
  }

  // Ground spawns
  const spawns: { x: number; z: number }[] = [];
  for (let i = 0; i < 80; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 40 + rnd() * 65;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r - 10;
    if (Math.abs(x) > 105 || Math.abs(z) > 105) continue;
    const distToPlayer = Math.hypot(x - PLAYER_TOWER.x, z - PLAYER_TOWER.z);
    if (distToPlayer < 45) continue;
    if (houses.some((h) => overlaps({ x, z, w: 2, d: 2, h: 0 }, h, 1))) continue;
    spawns.push({ x, z });
  }

  // Rooftop spawns: on top of 2+ story houses
  const rooftopSpawns: { x: number; z: number; y: number }[] = [];
  for (const h of houses) {
    if (h.floors >= 2) {
      const distToPlayer = Math.hypot(h.x - PLAYER_TOWER.x, h.z - PLAYER_TOWER.z);
      if (distToPlayer < 45) continue;
      rooftopSpawns.push({ x: h.x, z: h.z, y: h.h + 0.2 });
      // Add offset spawn points for larger houses
      if (h.w > 10) {
        rooftopSpawns.push({ x: h.x + h.w * 0.25, z: h.z, y: h.h + 0.2 });
      }
    }
  }

  return { houses, props, roads, cover, spawns, rooftopSpawns };
}

/** Occlusion: does segment from a to b hit any building? */
export function segmentBlocked(world: World, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.001) return false;
  dir.divideScalar(len);
  const ray = new THREE.Ray(a, dir);
  const box = new THREE.Box3();
  const hit = new THREE.Vector3();
  for (const h of world.houses) {
    box.min.set(h.x - h.w / 2, 0, h.z - h.d / 2);
    box.max.set(h.x + h.w / 2, h.h, h.z + h.d / 2);
    if (ray.intersectBox(box, hit) && hit.distanceTo(a) < len - 0.5) return true;
  }
  return false;
}

export function collidesHouse(world: World, x: number, z: number, r = 0.6) {
  for (const h of world.houses) {
    if (Math.abs(x - h.x) < h.w / 2 + r && Math.abs(z - h.z) < h.d / 2 + r) return true;
  }
  if (
    Math.abs(x - PLAYER_TOWER.x) < PLAYER_TOWER.w / 2 + r &&
    Math.abs(z - PLAYER_TOWER.z) < PLAYER_TOWER.d / 2 + r
  )
    return true;
  return false;
}
