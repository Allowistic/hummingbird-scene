import * as THREE from 'three';
import { RISK_TAG } from './riskTagData';

// The perch: Risk Rock's RISK tag (artwork by Kelly Graval, used with his permission through
// Vincent Strader), cut as a free-standing sculpture. The black outline-and-shadow piece is
// the body, thick, with a fully rounded edge (a half-round of the twig's radius), so the
// birds' feet wrap its top edge as they did the twig. The letters sit proud of both faces,
// sprayed in the tag's colours: a yellow-to-purple fade with a little cyan and overspray.
// The birds perch on the top of the S, evened out into one smooth rail (see risk_perch/gen.py).

/** the edge's radius: the twig's (the feet are sized for it) */
export const TAG_RAIL_R = 0.04;
/** the body's flat faces are this far apart (plus the rounded edge each side) */
const FLAT = 0.03;
/** where the stretch of rail the birds may stand on runs, world x */
export const TAG_PERCH_RANGE: [number, number] = [0.11, 0.35];

const toShapes = (list: readonly { o: readonly (readonly number[])[]; h: readonly (readonly (readonly number[])[])[] }[]) =>
  list.map((s) => {
    const sh = new THREE.Shape(s.o.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of s.h) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    return sh;
  });

/** a small tiling spray-paint grain: soft blotches of overspray and fine speckle */
function sprayTexture(light = false) {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const base = light ? 236 : 128;
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, N, N);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * N, y = rnd() * N, r = 10 + rnd() * 34, v = base + (rnd() - (light ? 0.8 : 0.5)) * 46;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    }
  }
  for (let i = 0; i < 2600; i++) {
    const v = light ? 190 + rnd() * 65 : rnd() < 0.5 ? 70 + rnd() * 40 : 170 + rnd() * 50;
    g.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.5})`;
    const r = 0.4 + rnd() * 1.1;
    g.beginPath();
    g.arc(rnd() * N, rnd() * N, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = light ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

// the fade, top to bottom of the letters (sampled from the tag's own colours)
const FADE: [number, THREE.Color][] = [
  [0.0, new THREE.Color('#f2e21a')],
  [0.3, new THREE.Color('#e9b80c')],
  [0.55, new THREE.Color('#c8222c')],
  [0.8, new THREE.Color('#9f0dcc')],
  [1.0, new THREE.Color('#5a14a8')],
];
function fadeAt(u: number, out: THREE.Color) {
  for (let i = 1; i < FADE.length; i++) {
    if (u <= FADE[i][0]) {
      const [a, ca] = FADE[i - 1];
      const [b, cb] = FADE[i];
      return out.copy(ca).lerp(cb, THREE.MathUtils.smoothstep(u, a, b));
    }
  }
  return out.copy(FADE[FADE.length - 1][1]);
}

export function createRiskTag() {
  const group = new THREE.Group();
  group.name = 'risk-tag';
  const grain = sprayTexture();
  const [[x0, y0], [x1, y1]] = RISK_TAG.bounds as unknown as [[number, number], [number, number]];

  // the body: satin black enamel, a touch of clear coat
  const bodyGeo = new THREE.ExtrudeGeometry(toShapes(RISK_TAG.body as never), {
    depth: FLAT,
    bevelEnabled: true,
    bevelThickness: TAG_RAIL_R,
    bevelSize: TAG_RAIL_R,
    bevelSegments: 4,
    curveSegments: 1,
  });
  bodyGeo.translate(0, 0, -FLAT / 2);
  bodyGeo.computeVertexNormals();
  // uv in world units for the grain
  {
    const p = bodyGeo.getAttribute('position');
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[2 * i] = p.getX(i) * 0.9 + p.getZ(i) * 0.9;
      uv[2 * i + 1] = p.getY(i) * 0.9;
    }
    bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0b10,
    roughness: 0.9,
    roughnessMap: grain,
    metalness: 0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'perch';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // the letters, sprayed on raised panels on both faces
  const face = FLAT / 2 + TAG_RAIL_R;
  const letGeo = new THREE.ExtrudeGeometry(toShapes(RISK_TAG.letters as never), {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 1,
  });
  letGeo.computeVertexNormals();
  {
    const p = letGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const uv = new Float32Array(p.count * 2);
    const c = new THREE.Color();
    const cyan = new THREE.Color('#00c1de');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      // the fade runs down the letters, a little diagonal, as a can sweeps
      const u = THREE.MathUtils.clamp(((y1 - y) / (y1 - y0) - 0.12) * 1.35 + (x - x0) / (x1 - x0) * 0.12, 0, 1);
      fadeAt(u, c);
      // a cyan cut-through, like the tag's highlight band
      const ux = (x - x0) / (x1 - x0), uy = (y1 - y) / (y1 - y0);
      const band = Math.exp(-(((uy - 0.5 + 0.18 * ux) / 0.025) ** 2));
      c.lerp(cyan, 0.55 * band);
      col[3 * i] = c.r;
      col[3 * i + 1] = c.g;
      col[3 * i + 2] = c.b;
      uv[2 * i] = x * 0.9;
      uv[2 * i + 1] = y * 0.9;
    }
    letGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    letGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  // spray paint dries matte: no clear coat, a faint mottle of overspray in the colour
  const mottle = sprayTexture(true);
  const letMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: mottle,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 1.0,
  });
  const front = new THREE.Mesh(letGeo, letMat);
  front.position.z = face - 0.002;
  const back = new THREE.Mesh(letGeo, letMat);
  back.scale.z = -1;
  back.position.z = -face + 0.002;
  for (const m of [front, back]) {
    m.castShadow = false;
    m.receiveShadow = true;
    m.name = 'letters';
    group.add(m);
  }
  // (scale.z = -1 flips the winding: draw both sides of the back panel's faces)
  back.material = letMat.clone();
  (back.material as THREE.Material).side = THREE.BackSide;

  return { group, fuzz: null as THREE.Object3D | null };
}

/**
 * Is world (x, y) within the tag's outline, grown by 0.1 (a bird's half-width of room)?
 * For keeping flight paths out of it: the tag is only TAG_HALF thick, so anything farther
 * than that in z is clear.
 */
export const TAG_HALF = FLAT / 2 + TAG_RAIL_R;
export function tagCovers(x: number, y: number) {
  const g = RISK_TAG.grid;
  const i = Math.round((x - g.x0) / g.cell);
  const j = Math.round((y - g.y0) / g.cell);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return false;
  return g.rows[j][i] === '1';
}
