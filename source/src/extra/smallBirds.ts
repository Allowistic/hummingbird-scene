// Two more birds for Vincent's scene: an American robin (the songbird) and an American goldfinch.
// The flight and behaviour rig is built here from scratch; what you see is drawn by Theo Tillberg's
// feather system (MIT, see songbirdSpecies.ts) on a songbird body. The rig itself has a lofted body, a bill that opens, eyes, and wings made of separate feathers on a three-bone arm
// (upper arm, forearm, hand) that folds against the body when perched and opens to beat in flight.
// The robin flies with steady flaps and short glides; the goldfinch flies the finch's bounding
// flight: a burst of flaps, then wings shut, rising and falling in loops. Both perch, hop, look
// about, flick their tails, sing (the bill moves with the bursts the sound plays), and fly a
// route round the scene before landing on the twig again.
import * as THREE from 'three';
import { createBird, type BirdHandle, type HopLayer, type Pose } from '../bird';
import { ROBIN as ROBIN_SPECIES, GOLDFINCH as GOLDFINCH_SPECIES } from './songbirdSpecies';

/** size of the feathered model inside the old rig's root (which is scaled by spec.scale) */
/** heading that faces the default camera */
const VIEW_YAW = 0.48;

export const FEATHER_SCALE: Record<'robin' | 'goldfinch', number> = { robin: 0.76, goldfinch: 0.62 };

export type SmallKind = 'robin' | 'goldfinch';

export interface PerchFrame { point: THREE.Vector3; up: THREE.Vector3; tangent: THREE.Vector3; radius: number }
export interface SmallEnv {
  perch: (x: number, out: PerchFrame) => PerchFrame | null;
  range: [number, number];
  home: number;
  sway: { at(x: number, out: THREE.Vector3): THREE.Vector3; load(x: number | null): void; push(x: number, s: number, side?: number): void };
  camera: THREE.Camera;
  /** move a waypoint out of the scenery's way */
  guard?: (p: THREE.Vector3) => void;
}

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const damp = (a: number, b: number, k: number, dt: number) => b + (a - b) * Math.exp(-k * dt);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const col = (h: number) => new THREE.Color(h);
const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, clamp(t, 0, 1));
function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++)
    r += hash(xi + i, yi + j, zi + k) * (i ? u : 1 - u) * (j ? v : 1 - v) * (k ? w : 1 - w);
  return r;
}

// --- a 1D table, smoothly interpolated (Catmull-Rom) --------------------------------
type Row = [z: number, w: number, top: number, bot: number, y: number];
function sample(rows: Row[], z: number): [number, number, number, number] {
  if (z <= rows[0][0]) return [rows[0][1], rows[0][2], rows[0][3], rows[0][4]];
  const n = rows.length;
  if (z >= rows[n - 1][0]) return [rows[n - 1][1], rows[n - 1][2], rows[n - 1][3], rows[n - 1][4]];
  let i = 0;
  while (z > rows[i + 1][0]) i++;
  const t = (z - rows[i][0]) / (rows[i + 1][0] - rows[i][0]);
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 1; c <= 4; c++) {
    const p0 = rows[Math.max(0, i - 1)][c], p1 = rows[i][c], p2 = rows[i + 1][c], p3 = rows[Math.min(n - 1, i + 2)][c];
    out[c - 1] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  }
  return out;
}

/** A closed loft along z: rings of an egg-ish section (separate top and bottom half-heights). */
function loft(rows: Row[], rings: number, segs: number, paint: (s: number, top: number, side: number, p: THREE.Vector3) => THREE.Color, sx = 1) {
  const z0 = rows[0][0], z1 = rows[rows.length - 1][0];
  const pos: number[] = [], colr: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3();
  const put = (c: THREE.Color) => colr.push(c.r, c.g, c.b);
  // pole at the back
  {
    const [, , , y] = sample(rows, z0);
    p.set(0, y, z0 - 0.004);
    pos.push(p.x, p.y, p.z); put(paint(0, 0, 0, p));
  }
  for (let i = 0; i <= rings; i++) {
    const s = i / rings;
    const z = lerp(z0, z1, 0.5 - 0.5 * Math.cos(s * Math.PI));
    const [w, t, b, y] = sample(rows, z);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      p.set(c * w * sx, y + sn * (sn > 0 ? t : b), z);
      pos.push(p.x, p.y, p.z);
      put(paint((z - z0) / (z1 - z0), sn, c, p));
    }
  }
  {
    const [, , , y] = sample(rows, z1);
    p.set(0, y, z1 + 0.004);
    pos.push(p.x, p.y, p.z); put(paint(1, 0, 0, p));
  }
  const ring = (i: number, j: number) => 1 + i * segs + (j % segs);
  for (let j = 0; j < segs; j++) idx.push(0, ring(0, j + 1), ring(0, j));
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = ring(i, j), b = ring(i, j + 1), c = ring(i + 1, j), d = ring(i + 1, j + 1);
      idx.push(a, b, c, b, d, c);
    }
  const last = pos.length / 3 - 1;
  for (let j = 0; j < segs; j++) idx.push(last, ring(rings, j), ring(rings, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** One feather: a tapered, slightly cupped blade from the root (origin) back along -z. */
function featherGeo(len: number, width: number, paint: (t: number, across: number) => THREE.Color, asym = 0.5, cup = 0.08) {
  const N = 7;
  const pos: number[] = [], colr: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const tipR = t > 0.62 ? Math.sqrt(Math.max(0, 1 - ((t - 0.62) / 0.38) ** 2)) : 1;
    const hw = width * (0.45 + 0.55 * Math.min(1, t * 3)) * tipR;
    const z = -t * len;
    const bend = -Math.sin(t * Math.PI * 0.5) * len * 0.05;
    // three across: inner edge, shaft, outer edge
    const xs = [-hw * (1 - asym) * 2, 0, hw * asym * 2];
    for (let k = 0; k < 3; k++) {
      const across = k - 1;
      pos.push(xs[k], bend + (k === 1 ? cup * width : 0), z);
      const c = paint(t, across);
      colr.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = a + 1, c = a + 3, d = a + 4;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// --- the two species ---------------------------------------------------------------
interface Spec {
  kind: SmallKind;
  scale: number;
  body: Row[];
  head: Row[];
  headAt: [number, number, number]; // head center, body frame
  bill: { len: number; w: number; h: number; hook: number; upper: number; lower: number; tip: number; at: [number, number] };
  eye: { at: [number, number, number]; r: number; ring: number | null };
  wing: { shoulder: [number, number, number]; hum: number; fore: number; hand: number; sec: [number, number, number]; prim: [number, number, number]; cov: number; les: number };
  tail: { n: number; len: number; w: number; notch: number; at: [number, number, number] };
  legs: { x: number; hipY: number; len: number; color: number };
  bodyY: number; // body center height above the feet
  perchPitch: number;
  paintBody: (s: number, top: number, side: number, p: THREE.Vector3) => THREE.Color;
  paintHead: (s: number, top: number, side: number, p: THREE.Vector3) => THREE.Color;
  paintPrim: (i: number, n: number, t: number, a: number) => THREE.Color;
  paintSec: (i: number, n: number, t: number, a: number) => THREE.Color;
  paintCov: (i: number, n: number, t: number, a: number) => THREE.Color;
  paintLes: (i: number, n: number, t: number, a: number) => THREE.Color;
  paintTail: (i: number, n: number, t: number, a: number) => THREE.Color;
  flapHz: number;
  speed: number;
}

const nz = (p: THREE.Vector3, f: number, a: number) => 1 + (vnoise(p.x * f, p.y * f, p.z * f) - 0.5) * a;
const shade = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

// American robin: gray-brown back, near-black head with broken white eye-ring and a streaked
// white throat, brick-orange breast, white lower belly and undertail, yellow bill, dark tail
// with white corners.
const R_BACK = col(0x5d554c), R_HEAD = col(0x24201d), R_BREAST = col(0xc0521f), R_BREAST2 = col(0xa84516), R_WHITE = col(0xe9e5dd);
const ROBIN: Spec = {
  kind: 'robin',
  scale: 1.5,
  body: [
    [-0.27, 0.028, 0.022, 0.022, 0.025],
    [-0.21, 0.07, 0.06, 0.065, 0.01],
    [-0.13, 0.108, 0.096, 0.108, 0],
    [-0.04, 0.124, 0.112, 0.126, 0],
    [0.05, 0.12, 0.108, 0.128, 0.004],
    [0.12, 0.1, 0.094, 0.112, 0.014],
    [0.18, 0.074, 0.074, 0.088, 0.028],
    [0.215, 0.055, 0.058, 0.064, 0.036],
  ],
  head: [
    [-0.085, 0.034, 0.034, 0.034, -0.012],
    [-0.06, 0.056, 0.058, 0.056, -0.002],
    [-0.02, 0.066, 0.068, 0.064, 0.003],
    [0.02, 0.064, 0.066, 0.06, 0.004],
    [0.05, 0.054, 0.054, 0.048, 0.0],
    [0.075, 0.034, 0.032, 0.03, -0.006],
    [0.09, 0.014, 0.013, 0.012, -0.01],
  ],
  headAt: [0, 0.075, 0.235],
  bill: { len: 0.085, w: 0.019, h: 0.016, hook: 0.006, upper: 0xd9a21e, lower: 0xe2ad2a, tip: 0x4a3a1c, at: [0.078, -0.01] },
  eye: { at: [0.049, 0.014, 0.03], r: 0.0165, ring: 0xf2efe8 },
  wing: { shoulder: [0.088, 0.07, 0.085], hum: 0.06, fore: 0.085, hand: 0.078, sec: [9, 0.152, 0.042], prim: [9, 0.245, 0.036], cov: 0.085, les: 0.05 },
  tail: { n: 8, len: 0.25, w: 0.044, notch: 0, at: [0, 0.03, -0.25] },
  legs: { x: 0.032, hipY: -0.06, len: 0.18, color: 0x5b4c43 },
  bodyY: 0.175,
  perchPitch: -0.62,
  paintBody(s, top, side, p) {
    const n = nz(p, 60, 0.12);
    // orange from the flanks up the sides of the breast; the back gray-brown
    const under = sstep(0.42 - 0.18 * s, -0.12, top + (vnoise(p.x * 30, p.y * 30, p.z * 30) - 0.5) * 0.18);
    let c = mix(R_BACK, mix(R_BREAST2, R_BREAST, sstep(0.3, 0.8, s)), under);
    // white lower belly and undertail
    const white = sstep(0.5, 0.3, s) * sstep(-0.15, -0.65, top);
    c = mix(c, R_WHITE, white);
    // the dark of the head runs down the nape
    c = mix(c, R_HEAD, sstep(0.82, 0.97, s) * sstep(-0.2, 0.3, top));
    return shade(c, n);
  },
  paintHead(s, top, side, p) {
    const n = nz(p, 80, 0.1);
    let c = R_HEAD.clone();
    // white throat with black streaks
    const throat = sstep(-0.45, -0.75, top) * sstep(0.35, 0.65, s);
    const streak = Math.sin(p.x * 260) > 0.25 ? 0.25 : 1;
    c = mix(c, shade(R_WHITE, streak), throat);
    // the orange breast creeps up under the chin at the back
    c = mix(c, R_BREAST2, sstep(-0.55, -0.9, top) * sstep(0.3, 0.05, s));
    return shade(c, n);
  },
  paintPrim: (i, n, t, a) => mix(col(0x3b342e), col(0x8f8476), a > 0.5 && t > 0.15 ? 0.55 : 0).multiplyScalar(1 - 0.15 * t),
  paintSec: (i, n, t, a) => mix(col(0x4a423a), col(0x7d7366), Math.abs(a) > 0.5 ? 0.35 : 0),
  paintCov: (i, n, t, a) => mix(col(0x5a5249), col(0x6e665b), t),
  paintLes: () => col(0x5d554c),
  paintTail(i, n, t, a) {
    const outer = i === 0 || i === n - 1;
    return outer && t > 0.82 && a * (i === 0 ? -1 : 1) > -0.2 ? R_WHITE.clone() : col(0x2a2622).multiplyScalar(1 - 0.1 * t);
  },
  flapHz: 7.5,
  speed: 2.3,
};

// American goldfinch (male, breeding): lemon-yellow body, black cap on the forehead, black wings
// with white wing bars and edges, yellow shoulder, black notched tail with white spots, white
// undertail, pinkish-orange conical bill.
const G_Y = col(0xf6cd10), G_Y2 = col(0xe8b80a), G_BLACK = col(0x15130f), G_WHITE = col(0xf1efe6);
const GOLDFINCH: Spec = {
  kind: 'goldfinch',
  scale: 1.35,
  body: [
    [-0.22, 0.03, 0.024, 0.024, 0.024],
    [-0.17, 0.08, 0.068, 0.072, 0.01],
    [-0.1, 0.122, 0.108, 0.12, 0],
    [-0.02, 0.138, 0.124, 0.138, 0],
    [0.06, 0.13, 0.118, 0.136, 0.005],
    [0.12, 0.108, 0.1, 0.114, 0.016],
    [0.17, 0.08, 0.08, 0.088, 0.03],
    [0.2, 0.06, 0.062, 0.066, 0.04],
  ],
  head: [
    [-0.09, 0.038, 0.038, 0.038, -0.012],
    [-0.064, 0.064, 0.066, 0.062, -0.002],
    [-0.02, 0.076, 0.078, 0.072, 0.004],
    [0.024, 0.074, 0.076, 0.068, 0.006],
    [0.056, 0.06, 0.058, 0.054, 0.002],
    [0.078, 0.04, 0.036, 0.036, -0.006],
    [0.092, 0.022, 0.02, 0.02, -0.01],
  ],
  headAt: [0, 0.08, 0.225],
  bill: { len: 0.07, w: 0.03, h: 0.028, hook: 0.0, upper: 0xe39a63, lower: 0xeaa874, tip: 0xc9805a, at: [0.082, -0.012] },
  eye: { at: [0.056, 0.016, 0.034], r: 0.017, ring: null },
  wing: { shoulder: [0.098, 0.075, 0.08], hum: 0.058, fore: 0.08, hand: 0.07, sec: [8, 0.14, 0.042], prim: [9, 0.2, 0.035], cov: 0.08, les: 0.055 },
  tail: { n: 8, len: 0.2, w: 0.04, notch: 0.06, at: [0, 0.028, -0.2] },
  legs: { x: 0.034, hipY: -0.07, len: 0.16, color: 0xb88f7c },
  bodyY: 0.18,
  perchPitch: -0.5,
  paintBody(s, top, side, p) {
    const n = nz(p, 50, 0.08);
    let c = mix(G_Y2, G_Y, sstep(-0.6, 0.2, top) * 0.6 + 0.4 * sstep(0.2, 0.7, s));
    // white undertail and vent
    c = mix(c, G_WHITE, sstep(0.3, 0.12, s) * sstep(0.1, -0.5, top));
    return shade(c, n);
  },
  paintHead(s, top, side, p) {
    const n = nz(p, 70, 0.07);
    let c = G_Y.clone();
    // black cap: forehead and fore-crown, a crisp edge
    const cap = sstep(0.38, 0.5, s) * sstep(0.25, 0.45, top + (s - 0.6) * 0.6);
    c = mix(c, G_BLACK, cap);
    return shade(c, n);
  },
  paintPrim: (i, n, t, a) => (a > 0.5 && t > 0.2 && t < 0.9 ? mix(G_BLACK, G_WHITE, 0.6) : G_BLACK.clone()),
  // secondaries: black with broad white tips (the trailing bar)
  paintSec: (i, n, t, a) => (t > 0.8 ? G_WHITE.clone() : Math.abs(a) > 0.5 && t > 0.3 ? mix(G_BLACK, G_WHITE, 0.45) : G_BLACK.clone()),
  // greater coverts: black with white tips (the wing bar)
  paintCov: (i, n, t, a) => (t > 0.66 ? G_WHITE.clone() : G_BLACK.clone()),
  // lesser coverts: the yellow shoulder
  paintLes: (i, n, t) => mix(G_Y, G_Y2, t),
  paintTail(i, n, t, a) {
    const outer = i < 2 || i > n - 3;
    return outer && t > 0.45 && t < 0.8 && a * (i < n / 2 ? 1 : -1) > 0 ? G_WHITE.clone() : G_BLACK.clone();
  },
  flapHz: 12,
  speed: 2.2,
};
export const SPECS: Record<SmallKind, Spec> = { robin: ROBIN, goldfinch: GOLDFINCH };

// --- the wing --------------------------------------------------------------------
interface Wing {
  root: THREE.Group; // at the shoulder (mirrored for the right)
  roll: THREE.Group;
  hum: THREE.Group;
  fore: THREE.Group;
  hand: THREE.Group;
  sec: { g: THREE.Group; spread: number; fold: number; boneYaw: () => number }[];
  prim: { g: THREE.Group; spread: number; fold: number; boneYaw: () => number }[];
}
const FOLD = { hum: 1.65, fore: -2.95, hand: 2.75 };

function buildWing(sp: Spec, mat: THREE.Material, side: 1 | -1): Wing {
  const w = sp.wing;
  const root = new THREE.Group();
  root.position.set(w.shoulder[0] * side, w.shoulder[1], w.shoulder[2]);
  root.scale.x = side;
  const roll = new THREE.Group();
  const hum = new THREE.Group();
  const fore = new THREE.Group();
  const hand = new THREE.Group();
  root.add(roll);
  roll.add(hum);
  fore.position.x = w.hum;
  hum.add(fore);
  hand.position.x = w.fore;
  fore.add(hand);
  const wing: Wing = { root, roll, hum, fore, hand, sec: [], prim: [] };
  const cum = { hum: () => hum.rotation.y, fore: () => hum.rotation.y + fore.rotation.y, hand: () => hum.rotation.y + fore.rotation.y + hand.rotation.y };
  const add = (bone: THREE.Group, x: number, geo: THREE.BufferGeometry, layer: number, spread: number, foldOff: number, list: Wing['sec'], boneYaw: () => number) => {
    const g = new THREE.Group();
    g.position.set(x, layer, 0);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    g.add(m);
    bone.add(g);
    list.push({ g, spread, fold: foldOff, boneYaw });
  };
  // secondaries along the forearm (two tertials on the upper arm), primaries from the hand
  const [ns, ls, ws] = w.sec;
  for (let i = 0; i < ns; i++) {
    const t = i / (ns - 1);
    const len = lerp(ls * 0.85, ls, t) * (i < 2 ? 0.92 : 1);
    const geo = featherGeo(len, ws, (u, a) => sp.paintSec(i, ns, u, a), 0.5, 0.1);
    if (i < 2) add(hum, w.hum * (0.35 + 0.5 * i), geo, 0.0006 * (ns - i), 0.25 - 0.08 * i, 0.04 + 0.01 * i, wing.sec, cum.hum);
    else add(fore, w.fore * ((i - 2) / (ns - 2)) * 0.95, geo, 0.0006 * (ns - i), 0.1 - 0.06 * (i - 2) / (ns - 2), 0.02 * (ns - i) * 0.3, wing.sec, cum.fore);
  }
  const [np, lp, wp] = w.prim;
  for (let i = 0; i < np; i++) {
    const t = i / (np - 1);
    const len = lp * (0.72 + 0.28 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5));
    const geo = featherGeo(len, wp * (1 - 0.25 * t), (u, a) => sp.paintPrim(i, np, u, a), 0.32, 0.06);
    add(hand, w.hand * (0.05 + 0.95 * t), geo, 0.0006 * (np - i) + 0.004, -0.15 - 1.15 * t, -0.012 * i, wing.prim, cum.hand);
  }
  // coverts over the feather roots, upper surface (+y), following the secondaries
  const ncov = ns;
  for (let i = 0; i < ncov; i++) {
    const geo = featherGeo(w.cov, ws * 1.05, (u, a) => sp.paintCov(i, ncov, u, a), 0.5, 0.12);
    const x = i < 2 ? w.hum * (0.3 + 0.5 * i) : w.fore * ((i - 2) / (ncov - 2)) * 0.95;
    add(i < 2 ? hum : fore, x, geo, 0.009 + 0.0004 * i, i < 2 ? 0.2 : 0.05, 0.03, wing.sec, i < 2 ? cum.hum : cum.fore);
  }
  // primary coverts on the hand
  for (let i = 0; i < 5; i++) {
    const geo = featherGeo(w.cov * 0.85, ws * 0.9, (u, a) => sp.paintCov(i, 5, u, a), 0.4, 0.1);
    add(hand, w.hand * (0.1 + 0.2 * i), geo, 0.012 + 0.0004 * i, -0.2 - 0.25 * i, -0.01 * i, wing.prim, cum.hand);
  }
  // lesser coverts along the leading edge
  for (let i = 0; i < 7; i++) {
    const geo = featherGeo(w.les, ws * 1.1, (u, a) => sp.paintLes(i, 7, u, a), 0.5, 0.14);
    const onHum = i < 3;
    add(onHum ? hum : fore, onHum ? w.hum * (0.15 + 0.35 * i) : w.fore * (0.1 + 0.22 * (i - 3)), geo, 0.016 + 0.0004 * i, 0.05, 0.03, wing.sec, onHum ? cum.hum : cum.fore);
  }
  return wing;
}

/** Pose a wing: fold 0 (open) .. 1 (shut against the body), roll (beat), and a little sweep. */
function poseWing(w: Wing, fold: number, roll: number, sweep: number, twist: number) {
  w.roll.rotation.set(twist, 0, roll, 'ZXY');
  w.hum.rotation.y = FOLD.hum * fold + sweep;
  w.fore.rotation.y = FOLD.fore * fold - sweep * 0.6;
  w.hand.rotation.y = FOLD.hand * fold - sweep * 0.2;
  for (const f of w.sec) f.g.rotation.y = lerp(f.spread, -f.boneYaw() + f.fold, fold);
  for (const f of w.prim) f.g.rotation.y = lerp(f.spread, -f.boneYaw() + f.fold, fold);
}

// --- the bird ----------------------------------------------------------------------
type State = 'perch' | 'hop' | 'crouch' | 'fly' | 'land';

export class SmallBird {
  readonly kind: SmallKind;
  readonly spec: Spec;
  readonly root = new THREE.Group(); // feet / flight point, yaw
  readonly rider = new THREE.Group(); // moves with the twig
  private body = new THREE.Group();
  private head = new THREE.Group();
  private lower = new THREE.Group();
  private tail = new THREE.Group();
  private tailF: THREE.Group[] = [];
  private wings: Wing[] = [];
  private legs: { leg: THREE.Mesh; toes: THREE.Group }[] = [];
  private mat: THREE.MeshStandardMaterial;
  private featherMat: THREE.MeshStandardMaterial;
  state: State = 'perch';
  private t = 0;
  private st = 0; // time in state
  private x = 0; // on the perch
  private frame: PerchFrame = { point: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), tangent: new THREE.Vector3(1, 0, 0), radius: 0.03 };
  // perched three-quarter to the default camera (which sits at yaw ~0.48 from the twig), like the hummingbird
  private yaw = VIEW_YAW - 0.95;
  private yawGoal = VIEW_YAW - 0.95;
  private headYaw = 0;
  private headPitch = 0;
  private headGoal = new THREE.Vector2();
  private nextLook = 0;
  private nextHop = 3;
  private nextFlick = 2;
  private nextSing = 4;
  private nextFly = 1e9;
  private flick = 0;
  private hopFrom = 0;
  private hopTo = 0;
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private route: THREE.Vector3[] = [];
  private leg = 0;
  private landFrom = new THREE.Vector3();
  private landYaw = 0;
  private phase = 0; // wingbeat phase
  private bank = 0;
  private glideT = 0;
  private flapNow = true;
  private fold = 1;
  private ride = 1;
  /** the song: what the sound plays from, and the bill opens with */
  readonly mouth = { singFrom: -10, singFor: 0, bursts: [] as { at: number; notes: number; hz: number; amp: number }[] };
  active = false;
  /** the bird you see: the hummingbird's feather system on a songbird's body, posed from this rig */
  readonly feathered: BirdHandle;
  private holder = new THREE.Group();
  private drive = { pitch: 0, crouch: 0, tailPitch: 0, tailFan: 0, flick: 0, open: 0, wing: false, spread: 0, raise: 0, sweep: 0, air: false, grip: 1 };

  constructor(kind: SmallKind, private env: SmallEnv) {
    this.kind = kind;
    const sp = (this.spec = SPECS[kind]);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    this.featherMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
    this.root.name = kind;
    this.root.scale.setScalar(sp.scale);
    this.root.rotation.order = 'YXZ';
    this.rider.add(this.root);
    // body
    const bodyMesh = new THREE.Mesh(loft(sp.body, 30, 28, sp.paintBody), this.mat);
    bodyMesh.castShadow = true;
    this.body.add(bodyMesh);
    this.root.add(this.body);
    // head, with the bill and eyes
    const headMesh = new THREE.Mesh(loft(sp.head, 20, 26, sp.paintHead), this.mat);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    this.root.add(this.head);
    this.buildBill();
    this.buildEyes();
    // wings
    for (const side of [1, -1] as const) {
      const w = buildWing(sp, this.featherMat, side);
      this.body.add(w.root);
      this.wings.push(w);
    }
    // tail
    this.tail.position.set(...sp.tail.at);
    this.body.add(this.tail);
    const tn = sp.tail.n;
    for (let i = 0; i < tn; i++) {
      const c = (i - (tn - 1) / 2) / ((tn - 1) / 2); // -1..1
      const len = sp.tail.len * (1 + sp.tail.notch * Math.abs(c) * 2.2) * (1 - 0.04 * (1 - Math.abs(c)));
      const geo = featherGeo(len, sp.tail.w, (u, a) => sp.paintTail(i, tn, u, a), 0.5, 0.06);
      const g = new THREE.Group();
      g.position.set(c * 0.02, 0.0015 * (tn - Math.abs(i - (tn - 1) / 2)), 0);
      g.userData.c = c;
      const m = new THREE.Mesh(geo, this.featherMat);
      m.castShadow = true;
      g.add(m);
      this.tail.add(g);
      this.tailF.push(g);
    }
    // legs: a tapered shank from the foot up into the belly, and toes round the twig
    const legMat = new THREE.MeshStandardMaterial({ color: sp.legs.color, roughness: 0.6 });
    for (const side of [1, -1]) {
      const geo = new THREE.CylinderGeometry(0.006, 0.009, 1, 6);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2); // along +z, for lookAt
      const leg = new THREE.Mesh(geo, legMat);
      leg.castShadow = true;
      const toes = new THREE.Group();
      for (const [yaw, len] of [[-0.35, 0.045], [0, 0.05], [0.35, 0.045], [Math.PI, 0.038]] as const) {
        const tg = new THREE.CylinderGeometry(0.0035, 0.005, len, 5);
        tg.translate(0, len / 2, 0);
        tg.rotateX(Math.PI / 2 + 0.55);
        const toe = new THREE.Mesh(tg, legMat);
        toe.rotation.y = yaw;
        toes.add(toe);
      }
      toes.position.x = side * sp.legs.x;
      this.root.add(leg, toes);
      this.legs.push({ leg, toes });
    }
    this.root.visible = false;
    // --- the feathered model: the old meshes stay as the rig it follows, hidden
    this.body.visible = false;
    this.head.visible = false;
    for (const L of this.legs) L.leg.visible = L.toes.visible = false;
    const fb = (this.feathered = createBird({ species: kind === 'robin' ? ROBIN_SPECIES : GOLDFINCH_SPECIES }));
    fb.root.name = kind + '.feathered';
    fb.layer<HopLayer>('hop').hold = true; // this rig does the hopping
    const flee = fb.layer('flee') as unknown as { every: [number, number]; nextAt: number };
    flee.every = [1e9, 1e9];
    flee.nextAt = 1e9; // and the flying
    this.holder.scale.setScalar(FEATHER_SCALE[kind] / sp.scale);
    this.holder.add(fb.root);
    this.root.add(this.holder);
    fb.onPose = (p) => this.poseFeathered(p);
  }

  /** the rig's state, written into the feathered bird's pose channels */
  private poseFeathered(p: Pose) {
    const d = this.drive;
    p.bodyPitch += d.pitch;
    p.bodyShift.y -= 0.05 * d.crouch;
    p.tailPitch += d.tailPitch;
    p.tailFan = Math.max(p.tailFan, d.tailFan);
    p.jaw = Math.max(p.jaw, d.open * 0.9);
    if (d.open > 0) p.headPitch += 0.12 * d.open;
    if (d.air) p.grip = Math.min(p.grip, d.grip);
    if (d.wing) {
      for (const s of ['L', 'R'] as const) {
        const w = p.wing[s];
        w.spread = d.spread;
        w.raise = d.raise;
        w.sweep = d.sweep;
      }
    }
  }

  private buildBill() {
    const b = this.spec.bill;
    const mk = (sign: 1 | -1, color: number) => {
      const pos: number[] = [], colr: number[] = [], idx: number[] = [];
      const N = 8, M = 9;
      const c0 = col(color), c1 = col(b.tip);
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const r = 1 - Math.pow(t, 1.15);
        const hook = sign > 0 ? -b.hook * Math.pow(t, 3) : b.hook * 0.3 * Math.pow(t, 3);
        for (let j = 0; j < M; j++) {
          const a = (j / (M - 1)) * Math.PI; // half round, from one side to the other
          const x = Math.cos(a) * b.w * r;
          const y = sign * Math.sin(a) * (sign > 0 ? b.h * 0.62 : b.h * 0.42) * r + hook;
          pos.push(x, y, t * b.len);
          const c = mix(c0, c1, sstep(0.65, 1, t));
          colr.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < N; i++)
        for (let j = 0; j < M - 1; j++) {
          const a = i * M + j, bb = a + 1, c = a + M, d = c + 1;
          if (sign > 0) idx.push(a, c, bb, bb, c, d);
          else idx.push(a, bb, c, bb, d, c);
        }
      // the flat cutting edge, closing the half-cone
      const base = pos.length / 3;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const r = 1 - Math.pow(t, 1.15);
        const hook = sign > 0 ? -b.hook * Math.pow(t, 3) : b.hook * 0.3 * Math.pow(t, 3);
        pos.push(b.w * r, hook, t * b.len, -b.w * r, hook, t * b.len);
        const c = mix(col(color), col(b.tip), sstep(0.65, 1, t)).multiplyScalar(0.55);
        colr.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      for (let i = 0; i < N; i++) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }));
      m.castShadow = true;
      return m;
    };
    const upper = mk(1, b.upper);
    upper.position.set(0, b.at[1], b.at[0] - 0.012);
    this.head.add(upper);
    this.lower.position.set(0, b.at[1] - 0.001, b.at[0] - 0.014);
    this.lower.add(mk(-1, b.lower));
    this.head.add(this.lower);
  }

  private buildEyes() {
    const e = this.spec.eye;
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.12, metalness: 0.1 });
    const geo = new THREE.SphereGeometry(e.r, 14, 10);
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glint = new THREE.SphereGeometry(e.r * 0.22, 6, 4);
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(geo, eyeMat);
      eye.position.set(e.at[0] * side, e.at[1], e.at[2]);
      const g = new THREE.Mesh(glint, glintMat);
      g.position.set(side * e.r * 0.55, e.r * 0.5, e.r * 0.5);
      eye.add(g);
      this.head.add(eye);
      if (e.ring !== null) {
        // the robin's broken white eye-ring: an arc above, an arc below
        const ringMat = new THREE.MeshStandardMaterial({ color: e.ring, roughness: 0.7 });
        for (const [start, arc] of [[0.35, 2.3], [3.55, 2.3]]) {
          const r = new THREE.Mesh(new THREE.TorusGeometry(e.r * 1.18, e.r * 0.26, 4, 12, arc), ringMat);
          r.rotation.set(0, (side * Math.PI) / 2, start);
          r.position.copy(eye.position);
          r.position.x += side * 0.002;
          this.head.add(r);
        }
      }
    }
  }

  // --- control ---------------------------------------------------------------------
  get perched() {
    return this.state === 'perch' || this.state === 'hop' || this.state === 'crouch';
  }
  get flying() {
    return this.state === 'fly' || this.state === 'land';
  }
  /** wings beating (the sound's wing hum) */
  get flapping() {
    return this.state === 'land' || (this.state === 'fly' && this.flapNow);
  }
  get singing() {
    return this.t - this.mouth.singFrom < this.mouth.singFor;
  }
  get time() {
    return this.t;
  }
  /** Come into the scene: fly in from off to one side and land on the twig. */
  enter() {
    this.active = true;
    this.root.visible = true;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.pos.set(side * 3.4, rand(1.4, 2.0), rand(-1.2, -0.4));
    this.vel.set(-side * this.spec.speed, -0.3, 0.2);
    this.route = [new THREE.Vector3(side * 1.1, rand(0.45, 0.75), rand(0.0, 0.4))];
    this.leg = 0;
    this.go('fly');
  }
  leave() {
    this.active = false;
    this.root.visible = false;
    this.env.sway.load(null);
  }
  /** Fly a loop round the scene, then come back to the twig. */
  flee() {
    if (!this.perched || this.state === 'crouch') return false;
    this.go('crouch');
    return true;
  }
  sing(seconds = 2.2) {
    if (this.flying) return false;
    const m = this.mouth;
    m.singFrom = this.t;
    m.singFor = seconds;
    m.bursts = [];
    if (this.kind === 'robin') {
      // cheerily, cheer-up, cheerio: a few slurred phrases with gaps
      let at = 0.05;
      while (at < seconds - 0.25) {
        const notes = 2 + Math.floor(Math.random() * 2);
        const hz = rand(7, 10);
        m.bursts.push({ at, notes, hz, amp: 0.33 });
        at += notes / hz + rand(0.18, 0.35);
      }
    } else {
      // per-chic-o-ree: quick twitters, the last ending in a trill
      let at = 0.05;
      while (at < seconds - 0.3) {
        const notes = 3 + Math.floor(Math.random() * 3);
        const hz = rand(12, 16);
        m.bursts.push({ at, notes, hz, amp: 0.3 });
        at += notes / hz + rand(0.12, 0.25);
      }
    }
    return true;
  }
  headPosition(out: THREE.Vector3) {
    return this.feathered.headPosition(out);
  }
  private go(s: State) {
    this.state = s;
    this.st = 0;
  }
  /** sit on the twig at x (clamped into range) */
  placeAt(x: number) {
    const [a, b] = this.env.range;
    x = clamp(x, a, b);
    const f = this.env.perch(x, this.frame);
    if (f) this.frame = f;
    this.x = x;
    return this.frame.point;
  }

  private planRoute() {
    const n = 3 + Math.floor(Math.random() * 2);
    this.route = [];
    let side = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const w = new THREE.Vector3(side * rand(0.75, 1.35), rand(0.3, 0.8), rand(-0.7, 0.45));
      this.env.guard?.(w);
      this.route.push(w);
      side = -side;
    }
    this.leg = 0;
  }

  update(dt: number) {
    if (!this.active) return;
    this.t += dt;
    this.st += dt;
    const sp = this.spec;
    const env = this.env;
    let bodyPitch = sp.perchPitch;
    let crouch = 0;
    let tailPitch = 0.08;
    let tailFan = 0.15;
    let wingRoll = 0;
    let foldGoal = 1;
    let sweep = 0;
    let twist = 0;
    let legsDown = 1;
    let hopY = 0;
    let rideGoal = 1;

    switch (this.state) {
      case 'perch': {
        if (this.t > this.nextLook) {
          this.headGoal.set(rand(-1.1, 1.1), rand(-0.35, 0.25));
          this.nextLook = this.t + rand(0.35, 1.4);
        }
        if (this.t > this.nextFlick) {
          this.flick = 1;
          this.nextFlick = this.t + rand(1.5, 4.5);
        }
        if (this.t > this.nextSing && !this.singing) {
          this.sing(rand(1.6, 2.6));
          this.nextSing = this.t + rand(7, 13);
        }
        if (this.t > this.nextHop && !this.singing) {
          // hop along the twig, now and then turning round
          this.hopFrom = this.x;
          const [a, b] = env.range;
          let to = this.x + (Math.random() < 0.5 ? -1 : 1) * rand(0.1, 0.22);
          if (to < a + 0.05 || to > b - 0.05) to = this.x - (to - this.x);
          this.hopTo = clamp(to, a, b);
          if (Math.random() < 0.35) this.yawGoal = 2 * VIEW_YAW - this.yawGoal;
          this.nextHop = this.t + rand(2.5, 6);
          this.go('hop');
        }
        if (this.t > this.nextFly && !this.singing) {
          this.nextFly = this.t + 1e9;
          this.flee();
        }
        break;
      }
      case 'hop': {
        const u = clamp(this.st / 0.24, 0, 1);
        this.placeAt(lerp(this.hopFrom, this.hopTo, ease(u)));
        hopY = Math.sin(u * Math.PI) * 0.05;
        crouch = u < 0.15 ? u / 0.15 : 0;
        legsDown = 1 - 0.4 * Math.sin(u * Math.PI);
        tailPitch -= 0.25 * Math.sin(u * Math.PI);
        foldGoal = 1 - 0.12 * Math.sin(u * Math.PI);
        if (u >= 1) {
          env.sway.push(this.x, 0.35, Math.random() * 2 - 1);
          env.sway.load(this.x);
          this.flick = 0.8;
          this.go('perch');
        }
        break;
      }
      case 'crouch': {
        const u = clamp(this.st / 0.22, 0, 1);
        crouch = Math.sin(u * Math.PI * 0.5);
        bodyPitch = lerp(sp.perchPitch, -0.15, u);
        foldGoal = 1 - 0.5 * u;
        tailFan = 0.6;
        if (u >= 1) {
          env.sway.push(this.x, 0.8, 0.4);
          env.sway.load(null);
          this.root.getWorldPosition(this.pos);
          this.vel.set(Math.sin(this.yaw) * 1.4, 1.0, Math.cos(this.yaw) * 1.4);
          this.planRoute();
          this.flapNow = true;
          this.glideT = 0;
          this.go('fly');
        }
        break;
      }
      case 'fly': {
        rideGoal = 0;
        legsDown = 0;
        const target = this.leg < this.route.length ? this.route[this.leg] : this.approachPoint();
        const toT = target.clone().sub(this.pos);
        const dist = toT.length();
        if (this.leg >= this.route.length && dist < 0.35) {
          this.landFrom.copy(this.pos);
          this.landYaw = this.yaw;
          this.go('land');
          break;
        }
        if (dist < 0.4) this.leg++;
        // steer: a turn-rate-limited heading toward the target
        const want = toT.normalize().multiplyScalar(sp.speed);
        const before = Math.atan2(this.vel.x, this.vel.z);
        const k = 1 - Math.exp(-dt * 2.4);
        this.vel.x += (want.x - this.vel.x) * k;
        this.vel.z += (want.z - this.vel.z) * k;
        this.vel.y += (want.y - this.vel.y) * (1 - Math.exp(-dt * 1.6));
        // flight style
        let lift = 0;
        if (this.kind === 'goldfinch') {
          // bounding: about 0.35 s of flaps, 0.3 s wings shut; rising on the flaps, dipping shut
          const cyc = (this.st % 0.68) / 0.68;
          this.flapNow = cyc < 0.52;
          lift = this.flapNow ? 4.2 : -4.6;
        } else {
          // steady flaps with short glides on the turns and the way down
          this.glideT -= dt;
          if (this.glideT <= -rand(0.8, 1.4)) this.glideT = rand(0.35, 0.6);
          this.flapNow = this.glideT <= 0;
          lift = this.flapNow ? 0.25 : -0.35;
        }
        this.vel.y += lift * dt;
        this.pos.addScaledVector(this.vel, dt);
        const after = Math.atan2(this.vel.x, this.vel.z);
        const turn = Math.atan2(Math.sin(after - before), Math.cos(after - before)) / Math.max(dt, 1e-4);
        this.bank = damp(this.bank, clamp(-turn * 0.25, -0.7, 0.7), 6, dt);
        this.yaw = after;
        bodyPitch = -0.08 - clamp(this.vel.y * 0.12, -0.3, 0.3);
        tailPitch = 0;
        tailFan = this.flapNow ? 0.2 : 0.35;
        this.headGoal.set(0, 0.15);
        if (this.flapNow) {
          this.phase += dt * sp.flapHz;
          const c = Math.cos(this.phase * Math.PI * 2);
          wingRoll = 0.15 + 0.95 * c; // up at c = 1
          const up = Math.sin(this.phase * Math.PI * 2) > 0 ? 1 : 0; // upstroke half
          foldGoal = 0.38 * up * (0.5 - 0.5 * c) + 0.02;
          sweep = 0.12 * Math.sin(this.phase * Math.PI * 2);
          twist = -0.25 * Math.sin(this.phase * Math.PI * 2);
        } else if (this.kind === 'goldfinch') {
          foldGoal = 0.97; // wings shut on the bound
        } else {
          foldGoal = 0.05; // the robin's glide: wings held out, a touch down
          wingRoll = -0.05;
        }
        break;
      }
      case 'land': {
        // a braking swoop onto the twig: pitched up, wings beating forward, legs reaching
        const u = clamp(this.st / 0.75, 0, 1);
        const to = this.frame.point;
        const e = ease(u);
        this.pos.copy(this.landFrom).lerp(to, e);
        this.pos.y += Math.sin(u * Math.PI) * 0.12;
        this.yaw = lerpAngle(this.landYaw, this.yawGoal, sstep(0, 0.8, u));
        this.bank = damp(this.bank, 0, 8, dt);
        rideGoal = u;
        bodyPitch = lerp(-0.1, -0.95, sstep(0.2, 0.75, u));
        if (u > 0.85) bodyPitch = lerp(-0.95, sp.perchPitch, sstep(0.85, 1, u));
        legsDown = sstep(0.3, 0.75, u);
        tailFan = 1;
        tailPitch = -0.3;
        this.phase += dt * sp.flapHz * 1.1;
        const c = Math.cos(this.phase * Math.PI * 2);
        const beat = 1 - sstep(0.85, 1, u);
        wingRoll = (0.3 + 0.9 * c) * beat;
        sweep = 0.45 * beat;
        foldGoal = u > 0.9 ? sstep(0.9, 1, u) : 0.05;
        if (u >= 1) {
          env.sway.push(this.x, 0.9, Math.random() * 2 - 1);
          env.sway.load(this.x);
          this.flick = 1.2;
          this.nextHop = this.t + rand(2, 4);
          this.nextSing = this.t + rand(1.2, 3);
          this.nextFly = this.t + rand(9, 16);
          this.go('perch');
        }
        break;
      }
    }

    // --- apply ------------------------------------------------------------------
    this.ride = damp(this.ride, rideGoal, 20, dt);
    if (this.perched) {
      this.yaw = lerpAngle(this.yaw, this.yawGoal, 1 - Math.exp(-dt * 6));
      this.bank = damp(this.bank, 0, 8, dt);
      this.pos.copy(this.frame.point);
      this.pos.y += hopY;
    }
    // with the twig while on it
    const sw = env.sway.at(this.x, new THREE.Vector3());
    this.rider.position.copy(sw).multiplyScalar(this.ride);
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, this.yaw, this.bank, 'YXZ');

    // body: pitched about the hips, low in a crouch
    this.body.rotation.x = bodyPitch;
    this.body.position.set(0, sp.bodyY - 0.035 * crouch, 0);
    // head: on the neck, kept level, looking about
    const hp = new THREE.Vector3(...sp.headAt).applyEuler(this.body.rotation).add(this.body.position);
    this.head.position.copy(hp);
    this.headYaw = damp(this.headYaw, this.headGoal.x, this.state === 'perch' ? 22 : 8, dt);
    this.headPitch = damp(this.headPitch, this.headGoal.y, 18, dt);
    this.head.rotation.set(this.headPitch + (this.state === 'fly' ? 0 : 0.05), this.headYaw, 0, 'YXZ');
    // bill: opens on each sung note
    let open = 0;
    const m = this.mouth;
    const st = this.t - m.singFrom;
    if (st >= 0 && st < m.singFor + 0.1)
      for (const b of m.bursts) {
        const n = st - b.at, T = b.notes / b.hz;
        if (n >= 0 && n <= T) open = Math.max(open, 0.5 + 0.5 * Math.sin(n * b.hz * Math.PI * 2 - Math.PI / 2));
      }
    this.lower.rotation.x = open * 0.42;
    if (open > 0) this.head.rotation.x -= 0.15 * open;
    // tail: a flick now and then, fanned for landing
    this.flick = Math.max(0, this.flick - dt * 3.5);
    const fl = Math.sin(this.flick * Math.PI) * this.flick;
    this.tail.rotation.x = -tailPitch - (this.perched ? 0.25 : 0) - fl * 0.45;
    for (const g of this.tailF) g.rotation.y = -g.userData.c * (0.12 + tailFan * 0.55);
    // wings
    this.fold = damp(this.fold, foldGoal, this.state === 'fly' ? 40 : 14, dt);
    for (const w of this.wings) poseWing(w, this.fold, lerp(wingRoll, -1.38, this.fold), sweep * (1 - this.fold), twist * (1 - this.fold));
    {
      const d = this.drive;
      const air = this.state === 'fly' || this.state === 'land';
      d.air = air;
      d.grip = air ? (this.state === 'land' ? sstep(0.6, 1, clamp(this.st / 0.75, 0, 1)) : 0) : 1;
      d.pitch = (bodyPitch - sp.perchPitch) * 1.35;
      d.crouch = crouch;
      d.tailPitch = fl * 0.7 + (air ? 0.25 : 0) - (tailPitch - 0.08) * 0.6;
      d.tailFan = tailFan * 0.9;
      d.open = open;
      const spread = clamp(1 - this.fold, 0, 1);
      d.wing = spread > 0.03 || air;
      d.spread = spread;
      d.raise = wingRoll * 0.9;
      d.sweep = sweep;
      const fb = this.feathered;
      fb.root.position.set(0, 0, 0);
      fb.root.quaternion.identity();
      fb.update(dt);
      fb.root.position.set(0, 0, 0);
      fb.root.quaternion.identity();
    }
    this.root.updateMatrixWorld(true);
    // legs: from the foot (on the twig) up into the belly; tucked back in flight
    const hipBase = new THREE.Vector3();
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const L = this.legs[i];
      hipBase.set(side * sp.legs.x, sp.legs.hipY, 0.0).applyEuler(this.body.rotation).add(this.body.position);
      const foot = new THREE.Vector3(side * sp.legs.x, 0, 0.005);
      const tuck = hipBase.clone().add(new THREE.Vector3(0, -0.035, -0.09).applyEuler(this.body.rotation));
      foot.lerp(tuck, 1 - legsDown);
      L.leg.position.copy(foot);
      L.leg.lookAt(this.root.localToWorld(hipBase.clone()));
      L.leg.scale.set(1, 1, Math.max(0.01, foot.distanceTo(hipBase)));
      L.toes.position.copy(foot);
      L.toes.rotation.set(legsDown < 0.5 ? -1.2 : 0, 0, 0);
      L.toes.scale.setScalar(lerp(0.6, 1, legsDown));
    }
  }

  /** above the landing spot on the twig, coming from the side it is on */
  private approachPoint() {
    if (this.leg === this.route.length) {
      // choose the landing spot once
      this.placeAt(this.env.home + rand(-0.15, 0.15));
      this.yawGoal = VIEW_YAW + (Math.random() < 0.5 ? -1 : 1) * rand(0.8, 1.1);
      this.leg++;
    }
    const p = this.frame.point;
    return new THREE.Vector3(p.x + (this.pos.x > p.x ? 0.6 : -0.6), p.y + 0.3, p.z + 0.25);
  }
}
