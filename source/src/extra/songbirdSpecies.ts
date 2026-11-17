// The robin and the goldfinch, written as species for the hummingbird's own feather system
// (Theo Tillberg's model, MIT): the same body loft, contour feathers, fuzz shells, flight
// feathers and plumage shader, dialled to a songbird's shape and colours. Added for Vincent.
import { MOUNTAIN_GEM, type FeatherLook, type Section, type Species } from '../bird/species';

/** a plain, matte songbird feather: little structural colour, no sparkle */
function plain(base: number, tip: number, o: Partial<FeatherLook> = {}): FeatherLook {
  return {
    width: 0.032, aspect: 2.2, rowStep: 0.3, tilt: 12, lift: 1, cup: 0.3, round: 0.72, loose: 0.5, fuzz: 0.3,
    base, tip, iri: 0xfff0dc, iriGraze: 0xd8c8b0, iriStrength: 0.06, iriPower: 5,
    iriAlign: 0, jitter: 0.5, sparkle: 0.25,
    ...o,
  };
}

/** the hummingbird's body, reshaped: per section [width, dorsal, ventral] factors */
function reshape(f: [number, number, number][], dy = 0, dz: number[] = []): Section[] {
  return MOUNTAIN_GEM.sections.map((s, i) => ({
    ...s,
    y: s.y + (i >= 6 ? dy : 0),
    z: s.z + (dz[i] ?? 0),
    w: s.w * f[i][0],
    rd: s.rd * f[i][1],
    rv: s.rv * f[i][2],
  }));
}

const G = MOUNTAIN_GEM;

/** American robin, Turdus migratorius (male). */
export const ROBIN: Species = {
  ...G,
  name: 'Turdus migratorius',
  seed: 3407,
  // a deep, round breast, a bigger head on a short neck, a blunt face for the short bill
  sections: reshape(
    [
      [1.1, 1.0, 1.0],
      [1.08, 1.02, 1.08],
      [1.08, 1.04, 1.12],
      [1.1, 1.04, 1.18],
      [1.12, 1.04, 1.2],
      [1.1, 1.02, 1.14],
      [1.08, 1.02, 1.06],
      [1.14, 1.1, 1.1],
      [1.22, 1.16, 1.18],
      [1.4, 1.3, 1.35],
      [1.65, 1.5, 1.6],
    ],
    -0.01,
    [0, 0, 0, 0, 0.012, 0.012, 0.01, 0, -0.01, -0.03, -0.045],
  ),
  eye: { s: 7.75, phi: 0.56, radius: 0.044, inset: 0.84 },
  bill: { length: 0.2, radius: 0.034, droop: 0.012, color: 0xd9a01e },
  skin: 0x2a2220,
  shading: { flank: 0.75, under: 0.8, patch: 0.22, gold: 0x6a5030, goldAmount: 0 },
  looks: {
    body: plain(0x4a4038, 0x6e6254, { loose: 0.5 }),
    back: plain(0x2e2824, 0x6e6254, { width: 0.034, rowStep: 0.31, tilt: 10, loose: 0.42, round: 0.78 }),
    scapular: plain(0x2c2622, 0x6c5f52, { width: 0.044, aspect: 3.2, rowStep: 0.25, tilt: 18, loose: 0.5, lift: 0.8 }),
    // the red breast: soft, full, a little fluffed, darker at the base of each feather
    belly: plain(0x5c200a, 0xc85c24, { width: 0.036, aspect: 2.4, rowStep: 0.24, tilt: 11, lift: 1.2, loose: 0.7, fuzz: 0.45, cup: 0.25 }),
    flank: plain(0x521c0a, 0xba541f, { width: 0.038, aspect: 2.8, rowStep: 0.24, tilt: 12, lift: 1.3, loose: 0.85, fuzz: 0.5 }),
    vent: plain(0xa8a29a, 0xf0ece4, { width: 0.036, aspect: 2.6, rowStep: 0.24, loose: 0.85, fuzz: 0.7 }),
    down: plain(0x2a2220, 0x4a3e36, { width: 0.04, aspect: 2.6, tilt: 26, lift: 1.4, loose: 1, iriStrength: 0 }),
    collar: plain(0x7e3212, 0xc25a24, { width: 0.03, aspect: 1.9, rowStep: 0.3, loose: 0.55, fuzz: 0.4 }),
    // the throat: white, streaked black
    throat: plain(0xb8b2aa, 0xf2eee8, { width: 0.016, aspect: 2.0, rowStep: 0.3, loose: 0.6, fuzz: 0.5 }),
    streak: plain(0x141212, 0x24201e, { width: 0.014, aspect: 2.2, rowStep: 0.3, loose: 0.5, fuzz: 0.3 }),
    head: plain(0x121212, 0x262524, { width: 0.019, aspect: 1.8, rowStep: 0.34, lift: 0.45, loose: 0.4, fuzz: 0.25, round: 0.85, iriStrength: 0.05 }),
    mask: plain(0x0c0b0b, 0x1a1817, { width: 0.014, aspect: 1.7, rowStep: 0.34, lift: 0.2, loose: 0.35, fuzz: 0.25 }),
    velvet: plain(0x121010, 0x221e1c, { width: 0.016, aspect: 1.6, rowStep: 0.28, tilt: 6, lift: 0.15, loose: 0.7, fuzz: 0.5 }),
    // the broken white eye ring: tiny, soft, flush
    eyering: plain(0xd8d4cc, 0xfbfaf6, { width: 0.009, aspect: 1.8, rowStep: 0.3, tilt: 4, lift: 0.1, loose: 0.6, fuzz: 0.8, iriStrength: 0 }),
    covert: plain(0x3a322c, 0x5e5246, { width: 0.046, aspect: 2.6, rowStep: 0.33, tilt: 9, lift: 0.7, loose: 0.4 }),
    undertail: plain(0x9a948c, 0xf0ece6, { width: 0.04, aspect: 2.9, rowStep: 0.26, tilt: 10, lift: 0.8, loose: 0.8, iriStrength: 0 }),
    wingCovert: plain(0x3c342e, 0x6a5d50, { width: 0.03, aspect: 2.3, rowStep: 0.4, tilt: 7, lift: 0, loose: 0.22, fuzz: 0, round: 0.8 }),
  },
  tracts: [
    { name: 'belly', look: 'belly', region: { kind: 'band', s: [1.2, 6.3], phi: [0, 0.5], soft: 0.5 } },
    { name: 'vent', look: 'vent', region: { kind: 'band', s: [0, 1.9], phi: [0, 0.42], soft: 0.6 } },
    { name: 'flank', look: 'flank', region: { kind: 'band', s: [1.6, 4.6], phi: [0.32, 0.56], soft: 0.5 } },
    { name: 'back', look: 'back', region: { kind: 'band', s: [0.9, 6.4], phi: [0.56, 1] } },
    { name: 'scapular', look: 'scapular', region: { kind: 'band', s: [3.7, 5.6], phi: [0.56, 0.84], soft: 0.3 } },
    { name: 'wingPit', look: 'down', region: { kind: 'blob', at: [3.8, 0.44], r: [0.3, 0.035], soft: 0.5 } },
    { name: 'tailCoverts', look: 'covert', region: { kind: 'band', s: [0, 1.15], phi: [0.42, 1] } },
    { name: 'undertail', look: 'undertail', region: { kind: 'band', s: [0, 1.3], phi: [0, 0.4], soft: 0.3 } },
    { name: 'collar', look: 'collar', region: { kind: 'blob', at: [5.4, 0], r: [1.2, 0.5], soft: 0.6 } },
    { name: 'head', look: 'head', region: { kind: 'band', s: [6.15, 11], phi: [0, 1], soft: 0.35 } },
    { name: 'velvet', look: 'velvet', region: { kind: 'blob', at: [8.6, 0.5], r: [1.4, 0.2], soft: 0.3 } },
    { name: 'throat', look: 'throat', region: { kind: 'blob', at: [7.3, 0], r: [1.25, 0.2], pow: 2.4, soft: 0.25 } },
    { name: 'streakL', look: 'streak', region: { kind: 'streak', from: [7.9, 0.06], to: [6.5, 0.07], r: [0.1, 0.022] } },
    { name: 'streakC', look: 'streak', region: { kind: 'streak', from: [7.7, 0.0], to: [6.6, 0.0], r: [0.1, 0.018] } },
    { name: 'streakR', look: 'streak', region: { kind: 'streak', from: [7.9, 0.13], to: [6.6, 0.14], r: [0.1, 0.02] } },
    { name: 'eyeringUp', look: 'eyering', region: { kind: 'streak', from: [7.45, 0.62], to: [8.05, 0.62], r: [0.13, 0.024] } },
    { name: 'eyeringLo', look: 'eyering', region: { kind: 'streak', from: [7.45, 0.5], to: [8.05, 0.5], r: [0.13, 0.022] } },
  ],
  wing: {
    ...G.wing,
    upper: 0.12,
    fore: 0.15,
    hand: 0.14,
    primaries: 9,
    secondaries: 9,
    primaryLen: [0.38, 0.6],
    secondaryLen: [0.4, 0.34],
    primaryWidth: 0.07,
    secondaryWidth: 0.075,
    rest: { from: [5.1, 93], to: [0.5, 147], width: [0.055, 0.12, 0.045], height: 0.04, cross: [0.45, -0.015] },
    color: 0x2e2824,
    sheen: 0x6a5e54,
  },
  tail: { rectrices: 6, length: [0.78, 0.74], width: 0.12, droop: 50, restFan: 0.3, maxFan: 9, color: 0x1e1a18 },
  legs: { ...G.legs, spread: 0.085, toe: 0.1, color: 0x5a4636 },
  behaviour: { ...G.behaviour, breathHz: [1.4, 2.4], billUp: 4, wingEvery: [8, 18] },
};

/** American goldfinch, Spinus tristis (breeding male). */
export const GOLDFINCH: Species = {
  ...G,
  name: 'Spinus tristis',
  seed: 5113,
  sections: reshape(
    [
      [1.08, 1.0, 1.0],
      [1.06, 1.02, 1.06],
      [1.06, 1.04, 1.1],
      [1.08, 1.04, 1.14],
      [1.1, 1.04, 1.14],
      [1.08, 1.02, 1.1],
      [1.08, 1.02, 1.06],
      [1.16, 1.12, 1.12],
      [1.26, 1.2, 1.22],
      [1.5, 1.4, 1.45],
      [2.1, 1.9, 2.0],
    ],
    -0.015,
    [0, 0, 0, 0, 0.01, 0.012, 0.01, 0, -0.012, -0.035, -0.055],
  ),
  eye: { s: 7.8, phi: 0.56, radius: 0.042, inset: 0.84 },
  // short, conical, pale orange-pink: a seed-cracker
  bill: { length: 0.14, radius: 0.05, droop: 0.004, color: 0xe8a070 },
  skin: 0x2a2220,
  shading: { flank: 0.82, under: 0.85, patch: 0.15, gold: 0xc09018, goldAmount: 0.1 },
  looks: {
    body: plain(0xa88400, 0xffdc1e, { loose: 0.5 }),
    back: plain(0xc89e00, 0xf6d01a, { width: 0.032, rowStep: 0.31, tilt: 10, loose: 0.45, round: 0.78 }),
    scapular: plain(0xc49a00, 0xf2cc18, { width: 0.042, aspect: 3.1, rowStep: 0.25, tilt: 18, loose: 0.5, lift: 0.8 }),
    belly: plain(0xa88600, 0xffe22a, { width: 0.034, aspect: 2.4, rowStep: 0.24, tilt: 11, lift: 1.2, loose: 0.72, fuzz: 0.45, cup: 0.25 }),
    flank: plain(0xcca200, 0xfad620, { width: 0.036, aspect: 2.8, rowStep: 0.24, tilt: 12, lift: 1.3, loose: 0.85, fuzz: 0.5 }),
    vent: plain(0xc8c0a8, 0xfaf6ea, { width: 0.034, aspect: 2.6, rowStep: 0.24, loose: 0.85, fuzz: 0.7 }),
    down: plain(0x3a3020, 0x6a5a30, { width: 0.04, aspect: 2.6, tilt: 26, lift: 1.4, loose: 1, iriStrength: 0 }),
    collar: plain(0xd8ae00, 0xffe02a, { width: 0.028, aspect: 1.9, rowStep: 0.3, loose: 0.55, fuzz: 0.4 }),
    head: plain(0xd4aa00, 0xffde22, { width: 0.018, aspect: 1.8, rowStep: 0.34, lift: 0.45, loose: 0.4, fuzz: 0.25, round: 0.85 }),
    // the black cap: forehead and crown, crisp and a little glossy
    cap: plain(0x080808, 0x161616, { width: 0.017, aspect: 1.7, rowStep: 0.34, lift: 0.4, loose: 0.3, fuzz: 0.2, round: 0.9, iriStrength: 0.08, iriPower: 8 }),
    mask: plain(0x0c0c0c, 0x1a1a1a, { width: 0.014, aspect: 1.7, rowStep: 0.34, lift: 0.2, loose: 0.35, fuzz: 0.25 }),
    velvet: plain(0xc8a000, 0xf4d020, { width: 0.016, aspect: 1.6, rowStep: 0.28, tilt: 6, lift: 0.15, loose: 0.7, fuzz: 0.5 }),
    covert: plain(0x1a1814, 0x2e2a24, { width: 0.044, aspect: 2.6, rowStep: 0.33, tilt: 9, lift: 0.7, loose: 0.4 }),
    undertail: plain(0xc8c2b4, 0xfcfaf2, { width: 0.04, aspect: 2.9, rowStep: 0.26, tilt: 10, lift: 0.8, loose: 0.8, iriStrength: 0 }),
    // the wing: yellow shoulder, black coverts, two white bars (the tips of the median and greater coverts)
    shoulder: plain(0xd0a400, 0xfcd820, { width: 0.03, aspect: 2.2, rowStep: 0.4, tilt: 7, lift: 0, loose: 0.25, fuzz: 0, round: 0.8 }),
    wingCovert: plain(0x070707, 0x141414, { width: 0.03, aspect: 2.3, rowStep: 0.4, tilt: 7, lift: 0, loose: 0.2, fuzz: 0, round: 0.8, iriStrength: 0.06 }),
    barCovert: plain(0x0a0a0a, 0xf4f2ec, { width: 0.03, aspect: 2.3, rowStep: 0.4, tilt: 7, lift: 0, loose: 0.2, fuzz: 0, round: 0.85 }),
  },
  tracts: [
    { name: 'belly', look: 'belly', region: { kind: 'band', s: [1.0, 6.3], phi: [0, 0.5], soft: 0.5 } },
    { name: 'vent', look: 'vent', region: { kind: 'band', s: [0, 1.5], phi: [0, 0.42], soft: 0.6 } },
    { name: 'flank', look: 'flank', region: { kind: 'band', s: [1.4, 4.4], phi: [0.32, 0.56], soft: 0.5 } },
    { name: 'back', look: 'back', region: { kind: 'band', s: [0.9, 6.4], phi: [0.56, 1] } },
    { name: 'scapular', look: 'scapular', region: { kind: 'band', s: [3.7, 5.6], phi: [0.56, 0.84], soft: 0.3 } },
    { name: 'wingPit', look: 'down', region: { kind: 'blob', at: [3.8, 0.44], r: [0.3, 0.035], soft: 0.5 } },
    { name: 'tailCoverts', look: 'covert', region: { kind: 'band', s: [0, 1.1], phi: [0.45, 1] } },
    { name: 'undertail', look: 'undertail', region: { kind: 'band', s: [0, 1.3], phi: [0, 0.42], soft: 0.3 } },
    { name: 'collar', look: 'collar', region: { kind: 'blob', at: [5.4, 0], r: [1.2, 0.5], soft: 0.6 } },
    { name: 'head', look: 'head', region: { kind: 'band', s: [6.15, 11], phi: [0, 1], soft: 0.35 } },
    { name: 'velvet', look: 'velvet', region: { kind: 'blob', at: [7.4, 0], r: [1.2, 0.3], soft: 0.4 } },
    // the cap: from the bill base over the forehead to the crown, down to just above the eye
    { name: 'cap', look: 'cap', region: { kind: 'blob', at: [9.9, 1], r: [2.4, 0.44], pow: 4, soft: 0.03 } },
    { name: 'lores', look: 'mask', region: { kind: 'streak', from: [9.9, 0.62], to: [9.0, 0.6], r: [0.25, 0.05] } },
  ],
  wing: {
    ...G.wing,
    upper: 0.11,
    fore: 0.14,
    hand: 0.13,
    primaries: 9,
    secondaries: 9,
    primaryLen: [0.36, 0.56],
    secondaryLen: [0.36, 0.3],
    primaryWidth: 0.066,
    secondaryWidth: 0.07,
    rest: { from: [5.1, 93], to: [0.5, 147], width: [0.055, 0.118, 0.045], height: 0.04, cross: [0.4, -0.015] },
    covertRows: ['shoulder', 'shoulder', 'wingCovert', 'barCovert', 'wingCovert', 'wingCovert', 'barCovert'],
    color: 0x0c0c0c,
    sheen: 0x3c3c40,
  },
  tail: { rectrices: 6, length: [0.5, 0.6], width: 0.11, droop: 54, restFan: 0.3, maxFan: 9, color: 0x101010 },
  legs: { ...G.legs, spread: 0.08, toe: 0.095, color: 0xb88e78 },
  behaviour: { ...G.behaviour, breathHz: [2.2, 3.4], billUp: 4, wingEvery: [8, 18] },
};
