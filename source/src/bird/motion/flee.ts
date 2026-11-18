import * as THREE from 'three';
import type { Pose } from '../pose';
import type { Rig } from '../rig';
import { clamp, lerp, rand, smoothstep } from '../util';
const smootherstep = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
import { createWingBlur, type WingBlur } from '../wingBlur';
import type { HopLayer } from './hop';
import type { Layer, Mind } from './mind';
import type { RuffleLayer } from './ruffle';
import type { TailLayer } from './tail';

// Gone in a blink. The bird gathers itself (a crouch, the wings coming a little
// off the body), then leaves: straight up and out of the picture in a quarter
// of a second, the wings a blur. A few seconds later it zips back in from the
// other side, flares over the perch with its tail spread, drops the last few
// centimetres onto the twig, folds its wings and shakes itself back into shape.
//
// The root is moved here while the bird is off the perch (the hop layer is put
// on hold and told where the bird came down).

export type FleePhase = 'idle' | 'ready' | 'takeoff' | 'away' | 'dart' | 'hover' | 'approach' | 'brake' | 'land';

const BLUR = 2; // pose.wing.spread value that hides the blades (the blur fan stands in)

/** the scene can move a hover point out of its way (the RISK tag perch: in front of it) */
export const tourGuard = { fix: (_p: THREE.Vector3) => {} };

export class FleeLayer implements Layer {
  readonly name = 'flee';
  /** seconds it stays away */
  awayFor: [number, number] = [2, 5];
  /** seconds between leaving of its own accord (it rarely does) */
  every: [number, number] = [16, 30];
  phase: FleePhase = 'idle';
  private t0 = 0;
  private dur = 0.4;
  private side = 1;
  private from = new THREE.Vector3();
  private out = new THREE.Vector3();
  private hover = new THREE.Vector3();
  private landAt = new THREE.Vector3();
  private far = new THREE.Vector3();
  private landX = 0;
  private nextAt: number;
  // the tour round the scene: darts from one hover point to the next (added for Vincent)
  private tour: THREE.Vector3[] = [];
  private leg = 0;
  private dartFrom = new THREE.Vector3();
  private yaw = 0;
  private yawFrom = 0;
  private yawTo = 0;
  /** where it may go: hover points are picked round home inside this box (rider space) */
  tourBox = { x: [-1.15, 1.25] as [number, number], y: [0.25, 0.95] as [number, number], z: [-0.45, 0.55] as [number, number] };
  // made up front, hidden: its shader compiles with the rest while loading, not on the first flight
  private blur: WingBlur;
  private shakeAt = -1;

  constructor(
    private mind: Mind,
    private rig: Rig,
    private root: THREE.Object3D,
    private hop: HopLayer,
    private ruffle: RuffleLayer,
    private tail: TailLayer,
  ) {
    this.nextAt = rand(mind.rng, 5, 8);
    this.blur = createWingBlur(rig);
  }

  /** off the perch, or about to be */
  get active() {
    return this.phase !== 'idle';
  }

  /** not there to be seen or fed */
  /** on the twig: not off it in the air (gathering itself to go and settling after landing count) */
  get perched() {
    return this.phase === 'idle' || this.phase === 'ready' || this.phase === 'land';
  }

  get gone() {
    return this.phase === 'away';
  }

  start() {
    const m = this.mind;
    if (this.active || this.hop.busy) return false;
    this.hop.hold = true;
    // whatever it was doing, it drops
    m.emit('startle', { strength: 1 });
    m.arousal = 1;
    m.freeze = 0;
    this.phase = 'ready';
    this.t0 = m.t;
    this.dur = rand(m.rng, 0.3, 0.48);
    this.side = m.rng() < 0.5 ? 1 : -1;
    this.nextAt = m.t + rand(m.rng, this.every[0], this.every[1]);
    return true;
  }

  private go(phase: FleePhase, dur: number) {
    this.phase = phase;
    this.t0 = this.mind.t;
    this.dur = dur;
  }

  update(m: Mind, p: Pose) {
    if (this.phase === 'idle') {
      if (!m.quiet && m.t >= this.nextAt && !m.eating && m.freeze <= 0) this.start();
      if (this.shakeAt > 0 && m.t >= this.shakeAt) {
        this.shakeAt = -1;
        this.ruffle.trigger(m, 'shake', 0.7);
      }
      if (this.phase === 'idle') return;
    }
    const root = this.root;
    const u = clamp((m.t - this.t0) / this.dur, 0, 1);
    let spread = 0;
    let blur = 0;
    let tilt = 0.6;
    m.gazeLock = this.phase !== 'land';

    switch (this.phase) {
      case 'ready': {
        // getting ready: down on the legs, wings coming off the body, everything slicked flat
        const k = Math.sin(u * Math.PI * 0.5);
        p.bodyShift.y -= 0.04 * k;
        p.bodyShift.z += 0.02 * k;
        p.bodyPitch += 0.34 * k;
        p.headShift.y -= 0.012 * k;
        p.fluff -= 0.12 * k;
        p.tailFan += 0.35 * k;
        p.tailPitch -= 0.12 * k;
        spread = 0.42 * smoothstep(0, 0.8, u);
        const tremble = Math.sin(m.t * 46 * Math.PI) * 0.05 * k;
        for (const s of ['L', 'R'] as const) {
          p.wing[s].lift += 0.25 * k + tremble;
          p.wing[s].droop += 0.08 * k;
        }
        if (u >= 1) {
          this.from.copy(root.position);
          this.out.set(this.side * 0.55, 1, 0.12).normalize();
          this.planTour(m);
          m.emit('perch', { x: this.from.x, push: 1, on: false, side: 0.4 });
          this.go('takeoff', 0.27);
        }
        break;
      }
      case 'takeoff': {
        // the legs throw it off the twig and the wings take over at once
        root.position.copy(this.from).addScaledVector(this.out, 0.3 * u + 0.25 * u * u);
        spread = BLUR;
        blur = smoothstep(0, 0.12, u);
        p.grip = 1 - smoothstep(0, 0.15, u);
        p.bodyShift.y += 0.03 * smoothstep(0, 0.3, u);
        // leaning into it as it leaves, the wings up behind the back
        p.bodyPitch += lerp(0.34, 0.1, smoothstep(0, 0.6, u));
        tilt = 0.95;
        p.bodyRoll += -this.side * 0.25 * u;
        p.tailFan += 0.8;
        p.tailPitch -= 0.25;
        p.fluff -= 0.14;
        if (u >= 1) {
          this.leg = 0;
          this.startDart(m);
        }
        break;
      }
      case 'away': {
        spread = BLUR;
        if (u >= 1) {
          // back to the perch: near where it likes to sit, in from the other side
          this.landX = this.hop.home + rand(m.rng, -0.12, 0.12);
          this.landX = this.hop.place(this.landX, this.landAt);
          this.hover.copy(this.landAt);
          this.hover.y += 0.2;
          this.far.copy(this.hover).add(new THREE.Vector3(-this.side * rand(m.rng, 3.2, 4.4), rand(m.rng, 1.8, 3), rand(m.rng, -1.2, -0.3)));
          root.position.copy(this.far);
          this.yawFrom = this.yaw;
          this.go('approach', rand(m.rng, 0.42, 0.55));
        }
        break;
      }
      case 'dart': {
        // a quick straight dash, eased at both ends, leaning into it
        const e = smootherstep(u);
        const to = this.tour[this.leg];
        root.position.copy(this.dartFrom).lerp(to, e);
        root.position.y += Math.sin(u * Math.PI) * 0.08;
        this.yaw = lerpAngle(this.yawFrom, this.yawTo, smoothstep(0, 0.35, u));
        spread = BLUR;
        blur = 1;
        p.grip = 0;
        const lean = Math.sin(u * Math.PI);
        p.bodyPitch += lerp(-0.1, 0.75, lean);
        tilt = lerp(0.4, 0.95, lean);
        p.tailFan += 0.3 + 0.5 * (1 - lean);
        p.tailPitch -= 0.15;
        p.fluff -= 0.12;
        if (u >= 1) this.go('hover', rand(m.rng, 0.9, 1.7));
        break;
      }
      case 'hover': {
        // hangs in the air at the flower height, bobbing, turning to look
        const to = this.tour[this.leg];
        root.position.copy(to);
        root.position.y += 0.018 * Math.sin(m.t * 9) + 0.01 * Math.sin(m.t * 23);
        root.position.x += 0.012 * Math.sin(m.t * 6.3);
        this.yaw = lerpAngle(this.yaw, this.faceYaw(to) + 0.35 * Math.sin(m.t * 1.7), 0.08);
        spread = BLUR;
        blur = 1;
        p.grip = 0;
        p.bodyPitch -= 0.2;
        tilt = 0.4;
        p.tailFan += 0.6 + 0.3 * Math.sin(m.t * 5);
        p.tailPitch -= 0.25 + 0.1 * Math.sin(m.t * 7);
        if (u >= 1) {
          this.leg++;
          if (this.leg < this.tour.length) this.startDart(m);
          else {
            this.landX = this.hop.home + rand(m.rng, -0.12, 0.12);
            this.landX = this.hop.place(this.landX, this.landAt);
            this.hover.copy(this.landAt);
            this.hover.y += 0.2;
            this.far.copy(root.position);
            this.yawFrom = this.yaw;
            this.go('approach', rand(m.rng, 0.75, 0.95));
          }
        }
        break;
      }
      case 'approach': {
        this.yaw = lerpAngle(this.yawFrom, 0, smoothstep(0.2, 0.9, u));
        // in fast, head first, shedding speed all the way
        const e = 1 - Math.pow(1 - u, 3);
        root.position.copy(this.far).lerp(this.hover, e);
        spread = BLUR;
        blur = 1;
        p.grip = 0;
        p.bodyPitch += lerp(0.5, -0.32, smoothstep(0.35, 1, u));
        tilt = lerp(0.9, 0.35, smoothstep(0.35, 1, u));
        p.bodyRoll += this.side * 0.3 * (1 - e);
        p.tailFan += lerp(0.3, 1, smoothstep(0.4, 1, u));
        p.tailPitch -= 0.3 * smoothstep(0.4, 1, u);
        p.fluff -= 0.1;
        if (u >= 1) this.go('brake', rand(m.rng, 0.45, 0.62));
        break;
      }
      case 'brake': {
        this.yaw = 0;
        // hangs over the twig for a moment, body upright, tail spread, then lets itself down
        const down = smoothstep(0.6, 1, u);
        tilt = 0.35;
        root.position.copy(this.hover).lerp(this.landAt, down);
        root.position.y += 0.015 * Math.sin(m.t * 31) * (1 - down);
        root.position.x += 0.008 * Math.sin(m.t * 23) * (1 - down);
        spread = BLUR;
        blur = 1;
        p.grip = smoothstep(0.8, 1, u) * 0.5;
        p.bodyPitch -= lerp(0.32, 0.05, down);
        p.bodyShift.y += 0.02 * (1 - down);
        p.tailFan += 1;
        p.tailPitch -= lerp(0.3, 0.1, down);
        if (u >= 1) {
          root.position.copy(this.landAt);
          this.hop.landed();
          m.emit('perch', { x: this.landAt.x, push: 0.85, on: true, side: rand(m.rng, -1, 1) });
          this.tail.flick(m, 1.2);
          this.go('land', 0.5);
        }
        break;
      }
      case 'land': {
        // on the twig: the toes close, the wings fold, the tail shuts
        root.position.copy(this.landAt);
        spread = u < 0.12 ? BLUR : 1 - smoothstep(0.12, 0.75, u);
        blur = 1 - smoothstep(0, 0.14, u);
        p.grip = 0.5 + 0.5 * smoothstep(0, 0.25, u);
        p.tailFan += 0.8 * (1 - smoothstep(0, 0.8, u));
        for (const s of ['L', 'R'] as const) p.wing[s].lift += 0.3 * Math.sin(Math.PI * smoothstep(0.5, 1, u));
        if (u >= 1) {
          this.phase = 'idle';
          this.hop.hold = false;
          m.gazeLock = false;
          this.shakeAt = m.t + rand(m.rng, 0.25, 0.6);
          m.freeze = 0.3;
        }
        break;
      }
      default:
        break;
    }
    // now and then a frame catches the wing itself, sharp, at one end of its stroke
    if (spread === BLUR && blur > 0.9 && Math.random() < 0.3) {
      spread = 1;
      blur *= 0.55;
      const fwd = Math.random() < 0.5;
      for (const s of ['L', 'R'] as const) {
        p.wing[s].sweep = fwd ? rand(Math.random, 0.7, 1.0) : -rand(Math.random, 0.9, 1.25);
        p.wing[s].raise = (fwd ? -0.1 : 0.45) + tilt * 0.4;
      }
    }
    root.rotation.y = this.phase === 'land' || this.phase === 'ready' ? 0 : this.yaw;
    p.wing.L.spread = p.wing.R.spread = spread;
    this.blur.set(blur, tilt);
    this.hop.follow();
  }

  /** the bird's place in the air at the scene's flowers and open spots: 3 to 5 points, near enough to see */
  private planTour(m: Mind) {
    const b = this.tourBox;
    const home = this.from;
    const n = 3 + Math.floor(m.rng() * 3);
    this.tour = [];
    let side = this.side;
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3();
      for (let k = 0; k < 8; k++) {
        p.set(rand(m.rng, b.x[0], b.x[1]), rand(m.rng, b.y[0], b.y[1]), rand(m.rng, b.z[0], b.z[1]));
        // alternate sides of the perch, and don't hang right where it sits
        if (Math.sign(p.x - home.x) === side && p.distanceTo(home) > 0.45 && (i === 0 || p.distanceTo(this.tour[i - 1]) > 0.6)) break;
      }
      p.y += home.y;
      tourGuard.fix(p);
      this.tour.push(p);
      side = -side;
    }
  }
  private faceYaw(at: THREE.Vector3) {
    // faces the camera side (+z), turned a little toward the twig's middle
    return clamp(-at.x * 0.5, -0.9, 0.9);
  }
  private startDart(m: Mind) {
    const to = this.tour[this.leg];
    this.dartFrom.copy(this.root.position);
    const d = to.clone().sub(this.dartFrom);
    this.yawFrom = this.yaw;
    // turns its body toward where it's going, but never shows the camera its back for long
    this.yawTo = clamp(Math.atan2(d.x, d.z + 0.6), -1.4, 1.4);
    this.go('dart', clamp(0.32 + d.length() * 0.28, 0.4, 0.85));
  }
  dispose() {
    this.blur.dispose();
  }
}
