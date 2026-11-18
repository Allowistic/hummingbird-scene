import * as THREE from 'three';

// A monarch butterfly (Danaus plexippus), an ambient extra beside whichever bird is on the perch.
// Built for Vincent in the same spirit as the hummingbird: painted wings (orange cells, black
// veins, the black border with its two rows of white spots, the black forewing apex with its
// orange and white spots, and the paler underside), a soft scale sheen on them, a black body
// with white spots under a few shells of fuzz (like the birds' down), clubbed antennae.
// It flies the way monarchs do: a few deep flaps, a glide on raised wings, an unsteady,
// wandering path; now and then it lands on the tag and slowly opens and closes its wings.
// Light on purpose: about 3k triangles, four small canvas textures, no per-frame allocation.

export interface MonarchEnv {
  /** the tag's body mesh, to find the spots on its top edges it can land on */
  perch: THREE.Mesh;
  /** is world (x, y) over the tag's outline (grown a little)? */
  covers: (x: number, y: number) => boolean;
  /** half the tag's thickness */
  half: number;
  /** where the bird on screen is now (it keeps away from it), or null */
  bird: () => THREE.Vector3 | null;
  camera: THREE.Camera;
  /** the whole tag (body and letters), to find spots on its front face: the Monarch pick rests there */
  tag?: THREE.Object3D;
}

/** forewing length, world units: a monarch's is ~5 cm, its span ~10 cm, about a hummingbird's */
export const MONARCH_LEN = 0.2;
const L = MONARCH_LEN;

type P2 = [number, number];
// wing outlines, right wing, in forewing lengths: x out from the body, z forward
const FORE: P2[] = [
  [0.0, 0.055], [0.12, 0.1], [0.3, 0.155], [0.5, 0.2], [0.7, 0.245], [0.86, 0.275], [0.94, 0.278], [0.985, 0.255], [1.0, 0.21],
  [0.985, 0.13], [0.94, 0.03], [0.87, -0.09], [0.79, -0.2], [0.72, -0.27], [0.66, -0.305],
  [0.52, -0.285], [0.34, -0.225], [0.17, -0.14], [0.06, -0.075], [0.0, -0.03],
];
const HIND: P2[] = [
  [0.0, -0.01], [0.15, 0.005], [0.32, -0.015], [0.48, -0.05], [0.6, -0.11],
  [0.67, -0.2], [0.695, -0.31], [0.67, -0.42], [0.6, -0.515], [0.5, -0.575], [0.39, -0.6], [0.28, -0.585],
  [0.18, -0.52], [0.1, -0.4], [0.05, -0.27], [0.015, -0.13],
];
// the stretch of each outline that is the outer margin (indices), where the black border runs
const FORE_MARGIN: [number, number] = [6, 14];
const HIND_MARGIN: [number, number] = [4, 13];

// veins: [from, control, to], in forewing lengths
const FORE_CELL: P2[] = [[0.03, 0.035], [0.25, 0.085], [0.46, 0.12], [0.53, 0.06], [0.51, -0.015], [0.3, -0.04], [0.04, -0.035]];
const FORE_VEINS: [P2, P2, P2][] = [
  [[0.02, 0.05], [0.4, 0.17], [0.8, 0.262]],
  [[0.38, 0.105], [0.62, 0.2], [0.9, 0.275]],
  [[0.46, 0.12], [0.72, 0.21], [0.975, 0.25]],
  [[0.5, 0.1], [0.78, 0.17], [0.998, 0.19]],
  [[0.53, 0.06], [0.8, 0.1], [0.975, 0.1]],
  [[0.525, 0.03], [0.75, 0.03], [0.93, 0.02]],
  [[0.51, -0.015], [0.7, -0.06], [0.865, -0.1]],
  [[0.42, -0.03], [0.62, -0.12], [0.785, -0.205]],
  [[0.26, -0.04], [0.5, -0.16], [0.715, -0.275]],
  [[0.05, -0.045], [0.35, -0.17], [0.62, -0.298]],
];
const HIND_CELL: P2[] = [[0.04, -0.03], [0.2, -0.05], [0.32, -0.08], [0.37, -0.17], [0.31, -0.25], [0.16, -0.19], [0.05, -0.1]];
const HIND_VEINS: [P2, P2, P2][] = [
  [[0.03, -0.012], [0.3, 0.0], [0.56, -0.09]],
  [[0.32, -0.08], [0.5, -0.12], [0.655, -0.18]],
  [[0.36, -0.13], [0.55, -0.2], [0.69, -0.29]],
  [[0.37, -0.18], [0.55, -0.28], [0.675, -0.4]],
  [[0.34, -0.23], [0.5, -0.36], [0.61, -0.5]],
  [[0.31, -0.25], [0.42, -0.4], [0.5, -0.57]],
  [[0.25, -0.23], [0.32, -0.4], [0.37, -0.595]],
  [[0.16, -0.19], [0.22, -0.38], [0.26, -0.578]],
  [[0.04, -0.06], [0.1, -0.3], [0.165, -0.505]],
];

function bounds(pts: P2[]) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0: x0 - 0.01, x1: x1 + 0.01, z0: z0 - 0.01, z1: z1 + 0.01 };
}

interface WingArt {
  outline: P2[];
  margin: [number, number];
  cell: P2[];
  veins: [P2, P2, P2][];
  fore: boolean;
}

/** paint one side of one wing; alpha is the wing's outline */
function paintWing(w: WingArt, under: boolean) {
  const b = bounds(w.outline);
  const W = b.x1 - b.x0, H = b.z1 - b.z0;
  const NX = 1024, NY = Math.round((1024 * H) / W);
  const c = document.createElement('canvas');
  c.width = NX;
  c.height = NY;
  const g = c.getContext('2d')!;
  const sx = NX / W;
  const X = (x: number) => (x - b.x0) * sx;
  const Y = (z: number) => (b.z1 - z) * sx;
  const path = (pts: P2[], close = true) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z))));
    if (close) g.closePath();
  };
  let seed = w.fore ? (under ? 11 : 3) : under ? 17 : 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  path(w.outline);
  g.save();
  g.clip();
  // ground: the orange, deeper toward the body; the underside hindwing a pale buff orange
  const ground = g.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), sx * 0.95);
  if (under && !w.fore) {
    ground.addColorStop(0, '#c9772c');
    ground.addColorStop(1, '#e8b066');
  } else if (under) {
    ground.addColorStop(0, '#c55a10');
    ground.addColorStop(1, '#e98a2a');
  } else {
    ground.addColorStop(0, '#b84a08');
    ground.addColorStop(0.45, '#e46a0c');
    ground.addColorStop(1, '#f0891c');
  }
  g.fillStyle = ground;
  g.fillRect(0, 0, NX, NY);
  // the scales: a fine grain of lighter and darker flecks
  for (let i = 0; i < 8800; i++) {
    const v = rnd();
    g.fillStyle = v < 0.5 ? `rgba(120,40,0,${0.05 + rnd() * 0.08})` : `rgba(255,190,90,${0.04 + rnd() * 0.08})`;
    g.fillRect(rnd() * NX, rnd() * NY, 1.6, 1.6);
  }
  // and the rows of scales themselves, close up: short strokes laid outward from the wing's base
  g.lineCap = 'round';
  g.lineWidth = 1.3;
  for (let i = 0; i < 7000; i++) {
    const px = rnd() * NX, py = rnd() * NY;
    const wx = b.x0 + px / sx, wz = b.z1 - py / sx;
    const a = Math.atan2(-wz, wx) + (rnd() - 0.5) * 0.25;
    const len = 2.2 + rnd() * 2.4;
    g.strokeStyle = rnd() < 0.5 ? `rgba(90,30,0,${0.06 + rnd() * 0.06})` : `rgba(255,205,120,${0.05 + rnd() * 0.06})`;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    g.stroke();
  }
  const black = '#100b08';
  // veins: black, thickening out toward the border, the underside's edged with pale scales
  const vein = (p: [P2, P2, P2], width: number) => {
    g.beginPath();
    g.moveTo(X(p[0][0]), Y(p[0][1]));
    g.quadraticCurveTo(X(p[1][0]), Y(p[1][1]), X(p[2][0]), Y(p[2][1]));
    g.lineWidth = width;
    g.stroke();
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const vw = (w.fore ? 0.011 : 0.016) * sx;
  if (under && !w.fore) {
    g.strokeStyle = 'rgba(255,240,215,0.75)';
    for (const v of w.veins) vein(v, vw * 2.1);
    g.strokeStyle = black;
    path(w.cell);
    g.lineWidth = vw * 2.1;
    g.strokeStyle = 'rgba(255,240,215,0.75)';
    g.stroke();
  }
  g.strokeStyle = black;
  for (const v of w.veins) {
    vein(v, vw);
    // a second pass on the outer half, wider
    const mid: [P2, P2, P2] = [
      [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2],
      [(v[1][0] + v[2][0]) / 2, (v[1][1] + v[2][1]) / 2],
      v[2],
    ];
    vein(mid, vw * 1.6);
  }
  path(w.cell);
  g.lineWidth = vw;
  g.stroke();
  if (!w.fore && !under) {
    // the male's scent patch, a black spot on a vein of the hindwing
    g.fillStyle = black;
    g.beginPath();
    g.ellipse(X(0.42), Y(-0.29), 0.022 * sx, 0.016 * sx, -0.7, 0, Math.PI * 2);
    g.fill();
  }
  // the leading edge (and the hindwing's inner edge) is black
  g.strokeStyle = black;
  g.lineWidth = (w.fore ? 0.05 : 0.07) * sx;
  path(w.fore ? w.outline.slice(0, 8) : w.outline.slice(12).concat([w.outline[0]]), false);
  g.stroke();
  // the black border along the outer margin
  const m = w.outline.slice(w.margin[0], w.margin[1] + 1);
  g.lineWidth = (w.fore ? 0.15 : 0.16) * sx;
  path(m, false);
  g.stroke();
  if (w.fore) {
    // the apex: black, with a row of orange spots and white spots in it
    g.fillStyle = black;
    path([[0.6, 0.3], [0.7, 0.21], [0.78, 0.15], [0.86, 0.06], [0.96, 0.06], [1.05, 0.3]]);
    g.fill();
    const or = under ? '#f2b45a' : '#f39a2a';
    for (const [x, z, r, col] of [
      [0.73, 0.235, 0.022, or], [0.78, 0.2, 0.024, or], [0.83, 0.16, 0.022, or], [0.875, 0.115, 0.017, or],
      [0.81, 0.245, 0.012, '#f6f1e6'], [0.86, 0.215, 0.012, '#f6f1e6'], [0.9, 0.175, 0.011, '#f6f1e6'],
      [0.66, 0.255, 0.012, '#f6f1e6'],
    ] as [number, number, number, string][]) {
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(X(x), Y(z), r * sx * 1.25, r * sx, -0.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  // two rows of white spots in the border, between the veins
  const cx = w.fore ? 0.5 : 0.3, cz = w.fore ? 0.0 : -0.25;
  const rows: [number, number, number][] = [
    [0.028, 0.0105, 1],
    [0.062, 0.0135, 0],
  ];
  g.fillStyle = '#f7f3ea';
  for (const [inset, r, outer] of rows) {
    for (let i = 0; i < m.length - 1; i++) {
      const [ax, az] = m[i], [bx, bz] = m[i + 1];
      const seg = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(seg / 0.042));
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const px = ax + (bx - ax) * u, pz = az + (bz - az) * u;
        let nx = -(bz - az) / seg, nz = (bx - ax) / seg;
        if (nx * (cx - px) + nz * (cz - pz) < 0) { nx = -nx; nz = -nz; }
        // the outer row is paired spots, the inner row single and a little bigger
        const off = outer ? [-0.012, 0.012] : [0];
        for (const o of off) {
          const qx = px + nx * inset + (bx - ax) / seg * o, qz = pz + nz * inset + (bz - az) / seg * o;
          g.beginPath();
          g.ellipse(X(qx), Y(qz), r * sx, r * sx * 0.8, Math.atan2(-(bz - az), bx - ax), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, b };
}

/** a wing's mesh: a grid over its bounds, cupped a little; the outline comes from the texture's alpha */
function wingGeo(b: { x0: number; x1: number; z0: number; z1: number }, cup: number) {
  const NX = 14, NZ = 10;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NZ;
      const x = b.x0 + (b.x1 - b.x0) * u, z = b.z0 + (b.z1 - b.z0) * v;
      // cupped from leading to trailing edge, and the outer part bowed down a touch
      const y = cup * Math.sin(Math.PI * v) * (0.4 + x) - 0.03 * x * x;
      pos.push(x * L, y * L, z * L);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b2 = a + 1, c = a + NX + 1, d = c + 1;
      idx.push(a, c, b2, b2, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function spotTexture(kind: 'thorax' | 'head' | 'abdomen') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.scale(2, 2); // drawn on the 256 x 128 grid, at twice the resolution
  g.fillStyle = '#0d0b0b';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#f2efe8';
  let s = kind === 'head' ? 23 : kind === 'thorax' ? 29 : 31;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // spheres are mapped u round the long axis (z), v from one end to the other
  if (kind === 'abdomen') {
    // fine pale dots in rows down the sides and underneath
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 9; i++) {
        const v = 18 + i * 11;
        for (const u of [64 + (k ? 18 : -18), 192 + (k ? 18 : -18)]) {
          g.beginPath();
          g.arc(u, v, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  } else {
    for (let i = 0; i < (kind === 'head' ? 14 : 18); i++) {
      g.beginPath();
      g.arc(rnd() * 256, 20 + rnd() * 88, 2 + rnd() * 3.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function fuzzTexture() {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  let s = 9;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) {
    const v = rnd() ** 1.6 * 255;
    img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = v;
    img.data[4 * i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 3);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (t: number) => t * t * (3 - 2 * t);
const angleLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

type State = 'fly' | 'approach' | 'descend' | 'perched' | 'takeoff';

export function createMonarch(env: MonarchEnv) {
  const root = new THREE.Group();
  root.name = 'monarch';
  root.rotation.order = 'YXZ';
  const body = new THREE.Group();
  root.add(body);

  // --- wings ---------------------------------------------------------------------
  const foreArt: WingArt = { outline: FORE, margin: FORE_MARGIN, cell: FORE_CELL, veins: FORE_VEINS, fore: true };
  const hindArt: WingArt = { outline: HIND, margin: HIND_MARGIN, cell: HIND_CELL, veins: HIND_VEINS, fore: false };
  const sheen = new THREE.Color(1.0, 0.72, 0.4);
  const wingMat = (tex: THREE.Texture, side: THREE.Side) =>
    new THREE.MeshPhysicalMaterial({
      map: tex,
      alphaTest: 0.5,
      // with the MSAA target, the cut-out edge is smoothed instead of stair-stepped up close
      alphaToCoverage: true,
      side,
      roughness: 0.62,
      metalness: 0,
      sheen: 0.7,
      sheenColor: sheen,
      sheenRoughness: 0.35,
      envMapIntensity: 0.7,
    });
  const wings: { pivot: THREE.Group; fore: boolean }[] = [];
  const sides: THREE.Group[] = [];
  const wingMats: THREE.Material[] = [];
  for (const art of [foreArt, hindArt]) {
    const top = paintWing(art, false);
    const under = paintWing(art, true);
    const geo = wingGeo(top.b, art.fore ? 0.035 : 0.03);
    const mTop = wingMat(top.tex, THREE.FrontSide);
    const mUnder = wingMat(under.tex, THREE.BackSide);
    wingMats.push(mTop, mUnder);
    for (const s of [1, -1]) {
      const side = new THREE.Group();
      side.scale.x = s;
      side.position.set(0, art.fore ? 0.012 * L : 0.004 * L, art.fore ? 0.012 * L : -0.02 * L);
      const pivot = new THREE.Group();
      pivot.position.x = 0.03 * L;
      pivot.rotation.order = 'ZYX';
      for (const m of [mTop, mUnder]) {
        const mesh = new THREE.Mesh(geo, m);
        mesh.castShadow = true;
        pivot.add(mesh);
      }
      side.add(pivot);
      body.add(side);
      sides.push(side);
      wings.push({ pivot, fore: art.fore });
    }
  }

  // --- body: thorax, abdomen, head, eyes, antennae, legs ----------------------------
  const sph = new THREE.SphereGeometry(1, 28, 18);
  sph.rotateX(Math.PI / 2); // poles along z, so the texture's v runs head to tail
  // the fuzz shells and the antenna clubs don't need as many
  const sphLo = new THREE.SphereGeometry(1, 18, 12);
  sphLo.rotateX(Math.PI / 2);
  const bodyMat = (kind: 'thorax' | 'head' | 'abdomen') =>
    new THREE.MeshPhysicalMaterial({ map: spotTexture(kind), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0.5, 0.5, 0.55), sheenRoughness: 0.5 });
  const thorax = new THREE.Mesh(sph, bodyMat('thorax'));
  thorax.scale.set(0.05 * L, 0.048 * L, 0.075 * L);
  const abdomen = new THREE.Mesh(sph, bodyMat('abdomen'));
  abdomen.scale.set(0.038 * L, 0.04 * L, 0.17 * L);
  abdomen.position.set(0, -0.012 * L, -0.215 * L);
  abdomen.rotation.x = 0.12;
  const head = new THREE.Mesh(sph, bodyMat('head'));
  head.scale.set(0.038 * L, 0.036 * L, 0.034 * L);
  head.position.set(0, 0.004 * L, 0.095 * L);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x1b1612, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(sph, eyeMat);
    eye.scale.setScalar(0.024 * L);
    eye.position.set(s * 0.026 * L, 0.008 * L, 0.105 * L);
    body.add(eye);
  }
  body.add(thorax, abdomen, head);
  for (const m of [thorax, abdomen, head]) m.castShadow = true;
  // the fuzz: a few shells, longer on the thorax (the birds' down, scaled to a butterfly)
  const fuzzTex = fuzzTexture();
  const fuzz = new THREE.Group();
  for (const [k, cut] of [[1.08, 0.4], [1.17, 0.54], [1.27, 0.68], [1.38, 0.82]] as [number, number][]) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1817, alphaMap: fuzzTex, alphaTest: cut, roughness: 0.9 });
    // the alpha map's green channel decides; it is grey, so any works
    const t = new THREE.Mesh(sphLo, mat);
    t.scale.copy(thorax.scale).multiplyScalar(k);
    const a = new THREE.Mesh(sphLo, mat);
    a.scale.set(abdomen.scale.x * (1 + (k - 1) * 0.6), abdomen.scale.y * (1 + (k - 1) * 0.6), abdomen.scale.z * (1 + (k - 1) * 0.15));
    a.position.copy(abdomen.position);
    a.rotation.copy(abdomen.rotation);
    fuzz.add(t, a);
  }
  body.add(fuzz);
  // antennae, with clubbed tips
  const black = new THREE.MeshStandardMaterial({ color: 0x0e0c0b, roughness: 0.5 });
  const antennae: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.012 * L, 0.03 * L, 0.11 * L);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.05 * L, 0.09 * L, 0.18 * L), new THREE.Vector3(s * 0.11 * L, 0.11 * L, 0.36 * L));
    const stalk = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0042 * L, 8), black);
    const club = new THREE.Mesh(sphLo, black);
    club.scale.set(0.011 * L, 0.011 * L, 0.03 * L);
    const tip = curve.getPoint(1), tan = curve.getTangent(1);
    club.position.copy(tip).addScaledVector(tan, -0.015 * L);
    club.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    pivot.add(stalk, club);
    body.add(pivot);
    antennae.push(pivot);
  }
  // legs: the two back pairs it stands on (a monarch carries its front pair folded)
  const legs: THREE.Group[] = [];
  const legGeo = new THREE.CylinderGeometry(0.0035 * L, 0.0028 * L, 1, 6);
  legGeo.translate(0, -0.5, 0);
  for (const s of [1, -1]) {
    for (const [z, out] of [[0.02, 0.9], [-0.025, 0.75], [0.05, 0.4]] as [number, number][]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.025 * L, -0.03 * L, z * L);
      const upper = new THREE.Mesh(legGeo, black);
      upper.scale.y = out > 0.5 ? 0.09 * L : 0.05 * L;
      upper.rotation.z = s * (out > 0.5 ? 0.9 : 0.4);
      upper.rotation.x = z > 0.03 ? -0.9 : z > 0 ? -0.3 : 0.45;
      leg.add(upper);
      body.add(leg);
      legs.push(leg);
    }
  }

  // --- where it may land: the tops of the tag's letters ------------------------------
  const spots: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  {
    const ray = new THREE.Raycaster();
    ray.ray.direction.set(0, -1, 0);
    env.perch.updateMatrixWorld(true);
    const hits: THREE.Intersection[] = [];
    for (let x = -1.9; x <= 1.9; x += 0.04) {
      ray.ray.origin.set(x, 1.6, 0);
      hits.length = 0;
      ray.intersectObject(env.perch, false, hits);
      // the first hit from above, and any ledge under an overhang farther down
      for (const h of hits) {
        if (!h.face) continue;
        const n = h.face.normal.clone().transformDirection(env.perch.matrixWorld);
        if (n.y < 0.8 || h.point.y < -0.35 || h.point.y > 1.2) continue;
        // there must be room above it (nothing of the tag right over it)
        if (env.covers(x, h.point.y + 0.22)) continue;
        spots.push({ p: h.point.clone(), n });
      }
    }
  }
  // on the front of the tag (the Monarch pick): it rests on the face, head up, back to the camera,
  // so its open wings show their whole pattern
  const faceSpots: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  if (env.tag) {
    const ray = new THREE.Raycaster();
    ray.ray.direction.set(0, 0, -1);
    env.tag.updateMatrixWorld(true);
    const hits: THREE.Intersection[] = [];
    for (let x = -1.1; x <= 1.25; x += 0.05) {
      for (let y = -0.75; y <= 0.45; y += 0.05) {
        ray.ray.origin.set(x, y, 2);
        hits.length = 0;
        ray.intersectObject(env.tag, true, hits);
        const h = hits[0];
        if (!h || !h.face) continue;
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        if (n.z < 0.9) continue;
        faceSpots.push({ p: h.point.clone(), n });
      }
    }
  }
  // the spots must be on screen when chosen
  const ndc = new THREE.Vector3();
  function onScreen(p: THREE.Vector3, m = 0.8) {
    ndc.copy(p).project(env.camera);
    return Math.abs(ndc.x) < m && Math.abs(ndc.y) < m && ndc.z < 1;
  }

  // --- motion ------------------------------------------------------------------------
  const pos = new THREE.Vector3(1.2, 0.7, 0.6);
  const vel = new THREE.Vector3(-0.3, 0, 0);
  const goal = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const from = new THREE.Vector3();
  const spot = new THREE.Vector3();
  const spotN = new THREE.Vector3(0, 1, 0);
  let state: State = 'fly';
  let st = 0; // time in state
  let t = 0;
  let phase = 0; // wingbeat phase
  let flapping = true;
  let beatsLeft = 4;
  let glideLeft = 0;
  let wingAngle = 0.3;
  let yaw = -1.2, pitch = 0, bank = 0;
  let perchYaw = 0;
  let flightLeft = rand(6, 12);
  // the slow open-and-close when it sits
  let bask = 1; // 1 = closed above the back, 0 = open flat
  let baskGoal = 1;
  let baskNext = 1.5;
  let restLeft = 0;
  // the Monarch pick: shown large, the subject itself, framed near the middle
  let hero = false;
  let size = 1;
  let onFace = false; // resting on the front of the tag (or landing there, or leaving it)
  let faceSpin = 0; // its heading on the face, round the face's normal
  let wallW = 0; // 0: posed from yaw/pitch/bank, 1: posed flat on the face
  // how far the body sits off what it stands on: on the face the legs reach straight in, so a little more
  const standOff = () => (0.034 * L + (onFace ? 0.009 : 0)) * size;
  const qE = new THREE.Quaternion();
  const qWall = new THREE.Quaternion();
  const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
  const mBasis = new THREE.Matrix4();
  const wob = Array.from({ length: 6 }, () => ({ f: rand(0.4, 1.6), a: rand(0, Math.PI * 2) }));
  const FLY_BOX = { x: [-1.5, 1.6], y: [0.1, 1.15], z: [0.25, 1.1] };
  // large, it keeps near the middle of the picture, in front of the tag
  const HERO_BOX = { x: [-0.75, 1.05], y: [-0.35, 0.75], z: [0.6, 1.4] };
  const pickGoal = () => {
    const B = hero ? HERO_BOX : FLY_BOX;
    for (let k = 0; k < 12; k++) {
      goal.set(rand(B.x[0], B.x[1]), rand(B.y[0], B.y[1]), rand(B.z[0], B.z[1]));
      if (goal.distanceTo(pos) > (hero ? 0.45 : 0.6) && onScreen(goal, hero ? 0.6 : 0.85)) return;
    }
  };
  pickGoal();

  function chooseSpot() {
    onFace = false;
    if (hero && faceSpots.length && Math.random() < 0.8) {
      const ok = faceSpots.filter((s) => onScreen(s.p, 0.5));
      if (ok.length) {
        const s = ok[Math.floor(Math.random() * ok.length)];
        spot.copy(s.p);
        spotN.copy(s.n);
        onFace = true;
        faceSpin = rand(-0.4, 0.4);
        return true;
      }
    }
    const b = env.bird();
    const ok = spots.filter((s) => onScreen(s.p, hero ? 0.55 : 0.75) && (!b || s.p.distanceTo(b) > 0.45) && (!hero || !env.covers(s.p.x, s.p.y + 0.22 * size)));
    if (!ok.length) return false;
    const s = ok[Math.floor(Math.random() * ok.length)];
    spot.copy(s.p);
    spotN.copy(s.n);
    // side-on to the camera, so its wings show as they open and close
    perchYaw = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 + rand(-0.45, 0.45);
    return true;
  }
  function go(s: State) {
    state = s;
    st = 0;
  }

  /** the wings' angle, radians up from flat, and the beat */
  function beat(dt: number, freq: number, amp: number, mid: number) {
    phase += dt * freq * Math.PI * 2;
    if (phase > Math.PI * 2) {
      phase -= Math.PI * 2;
      beatsLeft--;
    }
    return mid + amp * Math.sin(phase);
  }

  function update(dtIn: number) {
    if (!root.visible) return;
    const dt = Math.min(dtIn, 1 / 20);
    if (dt <= 0) return;
    t += dt;
    st += dt;
    const birdAt = env.bird();
    let target = wingAngle;
    let bob = 0;
    if (state === 'fly' || state === 'approach' || state === 'takeoff') {
      // flap-and-glide: 2-6 deep beats, then a glide on raised wings
      if (flapping) {
        target = beat(dt, state === 'takeoff' ? 7 : 5.2, 0.95, 0.35);
        bob = -0.018 * Math.cos(phase);
        if (beatsLeft <= 0 && phase < 0.4 && state === 'fly') {
          flapping = false;
          glideLeft = rand(0.25, 1.0);
        }
      } else {
        glideLeft -= dt;
        target = 0.22 + 0.04 * Math.sin(t * 9);
        if (glideLeft <= 0) {
          flapping = true;
          beatsLeft = 2 + Math.floor(Math.random() * 5);
          phase = 0;
        }
      }
      wingAngle = flapping ? target : lerp(wingAngle, target, 1 - Math.exp(-dt * 10));
    }

    if (state === 'fly' || state === 'approach') {
      // big, it covers more ground for the same wingbeats
      const k = hero ? 0.8 * Math.sqrt(size) : 1;
      let speed = 0.42 * k;
      if (state === 'approach') {
        if (onFace) goal.copy(spot).addScaledVector(spotN, 0.3 * size);
        else goal.copy(spot).addScaledVector(spotN, 0.2 * size).add(tmp.set(0, 0, 0.14 * size));
        speed = 0.38 * k;
      } else if (pos.distanceTo(goal) < 0.2 || st > 9) {
        pickGoal();
        st = 0;
      }
      flightLeft -= dt;
      if (state === 'fly' && flightLeft <= 0) {
        if (chooseSpot()) go('approach');
        flightLeft = hero ? rand(4, 8) : rand(6, 12);
      }
      desired.copy(goal).sub(pos);
      const d = desired.length();
      desired.multiplyScalar(speed / Math.max(d, 0.001));
      if (state === 'approach') desired.multiplyScalar(clamp(d / (0.25 * size), 0.35, 1));
      // the wander: monarchs never fly a straight line
      const w = (state === 'approach' ? 0.12 : 0.32) * k;
      desired.x += w * (Math.sin(t * wob[0].f + wob[0].a) + 0.6 * Math.sin(t * wob[1].f * 2.3 + wob[1].a));
      desired.y += w * (Math.sin(t * wob[2].f * 1.7 + wob[2].a) + 0.5 * Math.sin(t * wob[3].f * 3.1 + wob[3].a));
      desired.z += w * 0.7 * Math.sin(t * wob[4].f + wob[4].a);
      // lift on the downstroke, a gentle sink in the glide
      desired.y += flapping ? 0.08 : -0.16;
      // keep away from the bird
      if (birdAt) {
        tmp.copy(pos).sub(birdAt);
        const bd = tmp.length();
        if (bd < 0.4) desired.addScaledVector(tmp, (0.4 - bd) * 4 / Math.max(bd, 0.05));
      }
      vel.lerp(desired, 1 - Math.exp(-dt * 2.2));
      pos.addScaledVector(vel, dt);
      // stay clear of the tag (but for the last of an approach) and inside the scene
      if (state !== 'approach' || d > 0.3 * size) {
        const clear = env.half + 0.09 * size;
        if (Math.abs(pos.z) < clear && (env.covers(pos.x, pos.y) || env.covers(pos.x, pos.y - 0.06))) {
          pos.z = pos.z < 0 && pos.z > -clear ? -clear : clear;
          vel.z = Math.abs(vel.z) * Math.sign(pos.z || 1);
        }
      }
      pos.x = clamp(pos.x, -2.2, 2.2);
      pos.y = clamp(pos.y, -0.25, 1.5);
      pos.z = clamp(pos.z, -0.6, 1.6);
      if (state === 'approach' && d < (onFace ? 0.07 : 0.05) * size) {
        from.copy(pos);
        go('descend');
      }
      // face where it goes, nose up a little, banked into the turn
      const yawGoal = Math.atan2(vel.x, vel.z);
      const dyaw = angleLerp(yaw, yawGoal, 1 - Math.exp(-dt * 4)) - yaw;
      yaw += dyaw;
      bank = lerp(bank, clamp(-dyaw / Math.max(dt, 1e-3) * 0.25, -0.6, 0.6), 1 - Math.exp(-dt * 5));
      pitch = lerp(pitch, 0.35 + clamp(vel.y * 0.8, -0.3, 0.4) + (flapping ? 0.18 * Math.sin(phase + 1.2) : 0), 1 - Math.exp(-dt * 8));
    } else if (state === 'takeoff') {
      const u = Math.min(st / 0.7, 1);
      const k = hero ? 0.6 * size : 1;
      if (onFace) pos.copy(from).addScaledVector(spotN, 0.3 * k * ease(u)).add(tmp.set(0, 0.1 * k * ease(u), 0));
      else pos.copy(from).add(tmp.set(0, 0.22 * k * ease(u), 0.18 * k * ease(u)));
      pitch = lerp(pitch, 0.6, 1 - Math.exp(-dt * 6));
      wallW = onFace ? 1 - ease(u) : 0;
      if (u >= 1) {
        vel.set(0, 0.15, 0.2);
        flapping = true;
        beatsLeft = 4;
        flightLeft = hero ? rand(4, 8) : rand(8, 16);
        onFace = false;
        wallW = 0;
        pickGoal();
        go('fly');
      }
    } else if (state === 'descend') {
      // the last little drop, wings beating slow and shallow, flaring as the feet touch
      const T = 1.3;
      const u = Math.min(st / T, 1);
      const at = tmp.copy(spot).addScaledVector(spotN, standOff());
      pos.lerpVectors(from, at, ease(u));
      if (!onFace) pos.y += 0.03 * size * Math.sin(Math.PI * u);
      wallW = onFace ? ease(Math.min(u * 1.25, 1)) : 0;
      target = beat(dt, lerp(5, 2.6, u), lerp(0.8, 0.4, u), lerp(0.4, 0.9, u));
      wingAngle = target;
      yaw = angleLerp(yaw, perchYaw, 1 - Math.exp(-dt * 3));
      pitch = lerp(pitch, 0.05, 1 - Math.exp(-dt * 5));
      bank = lerp(bank, 0, 1 - Math.exp(-dt * 5));
      if (u >= 1) {
        bask = clamp((wingAngle - 0.1) / 1.35, 0, 1);
        baskGoal = onFace ? 0 : 1;
        baskNext = onFace ? rand(2.2, 3.6) : rand(0.8, 1.6);
        restLeft = hero ? rand(10, 18) : rand(5, 11);
        go('perched');
      }
    } else if (state === 'perched') {
      // the slow basking open and close; now and then a little shiver of the wings
      baskNext -= dt;
      if (baskNext <= 0) {
        if (onFace) {
          // on the face it basks open, closing part way now and then, so the pattern stays in view
          baskGoal = baskGoal > 0.4 ? rand(0, 0.08) : rand(0.55, 0.85);
          baskNext = baskGoal > 0.4 ? rand(1.0, 2.0) : rand(2.6, 4.6);
        } else {
          baskGoal = baskGoal > 0.5 ? rand(0, 0.12) : 1;
          baskNext = baskGoal > 0.5 ? rand(1.2, 2.6) : rand(1.8, 3.4);
        }
      }
      bask = lerp(bask, baskGoal, 1 - Math.exp(-dt * 1.3));
      // on the face the wings never quite touch it
      wingAngle = lerp(onFace ? 0.16 : 0.08, 1.46, ease(bask));
      wallW = onFace ? 1 : 0;
      restLeft -= dt;
      const near = birdAt && birdAt.distanceTo(spot) < 0.35;
      if (restLeft <= 0 || near) {
        from.copy(pos);
        flapping = true;
        beatsLeft = 6;
        go('takeoff');
      }
      pitch = lerp(pitch, 0.05, 1 - Math.exp(-dt * 5));
      bank = lerp(bank, 0, 1 - Math.exp(-dt * 5));
    }

    // pose
    root.position.copy(pos);
    root.position.y += bob * size;
    root.rotation.set(-pitch, yaw, bank);
    if (wallW > 0) {
      // flat on the face: back along its normal, head up (turned a little round the normal)
      by.copy(spotN);
      bz.set(-Math.sin(faceSpin), Math.cos(faceSpin), 0);
      bz.addScaledVector(by, -bz.dot(by)).normalize();
      bx.crossVectors(by, bz);
      mBasis.makeBasis(bx, by, bz);
      qWall.setFromRotationMatrix(mBasis);
      qE.copy(root.quaternion);
      root.quaternion.copy(qE.slerp(qWall, wallW));
    }
    const hindLag = state === 'perched' ? 0 : 0.06;
    for (const w of wings) {
      // the hindwing follows the forewing a moment late and a little less far
      const a = w.fore ? wingAngle : wingAngle * 0.96 - hindLag * Math.cos(phase);
      w.pivot.rotation.z = a;
      // the forewing sweeps forward on the upstroke, back on the downstroke (a figure eight)
      w.pivot.rotation.y = w.fore && state !== 'perched' ? 0.12 * Math.cos(phase) : 0;
    }
    // antennae: a slow twitch
    antennae.forEach((a, i) => {
      a.rotation.x = 0.06 * Math.sin(t * 1.3 + i * 1.7) + (state === 'perched' ? 0.0 : -0.15);
      a.rotation.y = 0.05 * Math.sin(t * 0.9 + i);
    });
    // legs reach down to stand, tuck up in flight
    const air = state === 'perched' ? 0 : state === 'descend' ? 1 - ease(Math.min(st / 1.3, 1)) : 1;
    for (const leg of legs) leg.rotation.x = air * 0.9;
  }

  return {
    group: root,
    update,
    get state() { return state; },
    spotCount: spots.length,
    setVisible(on: boolean) {
      root.visible = on;
    },
    setPerf(on: boolean) {
      fuzz.visible = !on;
    },
    /** for the screenshots: sit on a spot now (wings opening and closing), or fly */
    landNow(x?: number, open?: number) {
      if (x !== undefined) {
        let best = spots[0];
        for (const s of spots) if (Math.abs(s.p.x - x) < Math.abs(best.p.x - x)) best = s;
        spot.copy(best.p);
        spotN.copy(best.n);
        onFace = false;
      } else if (!chooseSpot()) return false;
      pos.copy(spot).addScaledVector(spotN, 0.034 * L * size);
      perchYaw = yaw = Math.PI / 2 + rand(-0.5, 0.5);
      pitch = 0.05;
      bank = 0;
      bask = baskGoal = open ?? 1;
      baskNext = open !== undefined ? 1e9 : 1;
      restLeft = open !== undefined ? 1e9 : rand(7, 14);
      go('perched');
      update(1e-4);
      return true;
    },
    /** for the screenshots: rest on the tag's front face nearest (x, y), wings held at `open` (0 open, 1 shut) */
    landOnFace(x: number, y: number, open?: number) {
      if (!faceSpots.length) return false;
      let best = faceSpots[0];
      const d2 = (s: { p: THREE.Vector3 }) => (s.p.x - x) ** 2 + (s.p.y - y) ** 2;
      for (const s of faceSpots) if (d2(s) < d2(best)) best = s;
      spot.copy(best.p);
      spotN.copy(best.n);
      onFace = true;
      faceSpin = 0.15;
      pos.copy(spot).addScaledVector(spotN, standOff());
      bask = baskGoal = open ?? 0;
      baskNext = open !== undefined ? 1e9 : 1;
      restLeft = open !== undefined ? 1e9 : rand(10, 18);
      go('perched');
      update(1e-4);
      return true;
    },
    faceSpotCount: faceSpots.length,
    /** F: off the tag, or a fresh burst of flight */
    takeOff() {
      if (!root.visible) return;
      if (state === 'perched') {
        from.copy(pos);
        flapping = true;
        beatsLeft = 6;
        go('takeoff');
      } else if (state === 'fly') {
        flapping = true;
        beatsLeft = 6;
        phase = 0;
        flightLeft = hero ? rand(4, 8) : rand(6, 12);
        pickGoal();
      } else if (state === 'approach') {
        onFace = false;
        flightLeft = hero ? rand(4, 8) : rand(6, 12);
        pickGoal();
        go('fly');
      }
    },
    /** the Monarch pick: large, the subject itself (true), or the small ambient extra (false) */
    setHero(on: boolean, s = 2.5) {
      if (on === hero) {
        if (on) this.setSize(s);
        return;
      }
      hero = on;
      this.setSize(on ? s : 1);
      // fly in from the right, into the middle of the picture, and land soon after
      onFace = false;
      wallW = 0;
      if (on) pos.set(1.25, 0.55, 1.2);
      else pos.set(1.3, 0.8, 0.9);
      vel.set(-0.35, 0.02, 0.05);
      flapping = true;
      beatsLeft = 4;
      flightLeft = on ? rand(2, 3.5) : rand(4, 8);
      pickGoal();
      go('fly');
    },
    setSize(s: number) {
      size = s;
      root.scale.setScalar(s);
    },
    get size() { return size; },
    get hero() { return hero; },
    get onFace() { return onFace; },
    get perched() { return state === 'perched'; },
    get flying() { return state !== 'perched' && root.visible; },
    headPosition(out: THREE.Vector3) {
      return head.getWorldPosition(out);
    },
    flyAt(p: THREE.Vector3, wings?: number) {
      onFace = false;
      wallW = 0;
      pos.copy(p);
      vel.set(-0.35, 0.02, 0.05);
      yaw = Math.atan2(vel.x, vel.z);
      go('fly');
      flightLeft = 1e9;
      if (wings !== undefined) {
        phase = Math.asin(clamp((wings - 0.35) / 0.95, -1, 1));
        flapping = true;
        beatsLeft = 99;
        wingAngle = wings;
      }
      update(1e-4);
    },
    resume() {
      flightLeft = rand(3, 8);
      restLeft = Math.min(restLeft, rand(4, 9));
      baskNext = Math.min(baskNext, 1);
    },
    /** perched: the yaw it turns to as it lands (set when an approach starts) */
    set perchYaw(v: number) { perchYaw = v; },
    get position() { return pos; },
  };
}
export type Monarch = ReturnType<typeof createMonarch>;
