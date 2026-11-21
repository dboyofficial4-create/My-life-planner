/**
 * Draws a build as a simple front-view figure: proportions from the build's Figure, with the
 * areas it carries its muscle highlighted. Pure geometry (SVG path strings) so it can be tested
 * and rendered anywhere. A diagram of a shape, not a picture of a person.
 */
import type { Figure, Region } from './builds';

export const FIGURE_VIEWBOX = { width: 200, height: 360 } as const;
/** Ground line (feet) and the head top of an average-height figure, for the height marker. */
export const GROUND_Y = 350;
export const AVERAGE_TOP_Y = 37;

const CX = 100;
const OY = 18; // vertical offset so tall figures still fit
const r1 = (n: number) => Math.round(n * 10) / 10;
type Pt = [number, number];

/** A tapered limb from p1 (radius a) to p2 (radius b), bulging to `belly` at the middle. */
export function limb(p1: Pt, a: number, p2: Pt, b: number, belly = Math.max(a, b)): string {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy) || 1;
  const u: Pt = [dx / len, dy / len];
  const n: Pt = [-u[1], u[0]];
  const side = (s: 1 | -1) => {
    const s1: Pt = [p1[0] + n[0] * a * s, p1[1] + n[1] * a * s];
    const s2: Pt = [p2[0] + n[0] * b * s, p2[1] + n[1] * b * s];
    const mid: Pt = [(p1[0] + p2[0]) / 2 + n[0] * belly * s, (p1[1] + p2[1]) / 2 + n[1] * belly * s];
    // Control point so the curve passes through `mid` at its halfway point.
    const ctrl: Pt = [2 * mid[0] - (s1[0] + s2[0]) / 2, 2 * mid[1] - (s1[1] + s2[1]) / 2];
    return { s1, s2, ctrl };
  };
  const L = side(1);
  const R = side(-1);
  const p = (q: Pt) => `${r1(q[0])} ${r1(q[1])}`;
  return `M${p(L.s1)} Q${p(L.ctrl)} ${p(L.s2)} A${r1(b)} ${r1(b)} 0 0 0 ${p(R.s2)} Q${p(R.ctrl)} ${p(R.s1)} A${r1(a)} ${r1(a)} 0 0 0 ${p(L.s1)} Z`;
}

const circle = (x: number, y: number, r: number) => `M${r1(x - r)} ${r1(y)} a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0 a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0 Z`;
const ellipse = (x: number, y: number, rx: number, ry: number) => `M${r1(x - rx)} ${r1(y)} a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0 a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0 Z`;
const poly = (pts: Pt[]) => `M${pts.map((q) => `${r1(q[0])} ${r1(q[1])}`).join(' L')} Z`;

export interface FigureShapes {
  /** Every body shape; drawn together they make the silhouette. */
  body: string[];
  /** The torso alone (used to clip chest, core and back highlights). */
  torso: string;
  /** Highlight shapes per region. */
  regions: Partial<Record<Region, string[]>>;
  /** Light anatomy lines drawn over everything. */
  details: string[];
  /** SVG transform that applies the figure's height. */
  transform: string;
}

export function figureShapes(f: Figure): FigureShapes {
  const y = (v: number) => v + OY;
  const { S, C, L, W, H, N, d, A, Fa, T, c } = f;

  // Torso outline: right side top to bottom, then mirrored back up the left.
  const R = (x: number) => CX + x;
  const Lx = (x: number) => CX - x;
  const torso = [
    `M${r1(R(N))} ${y(46)}`,
    `C${r1(R(N + 4))} ${y(56)} ${r1(R(S - 14))} ${y(58)} ${r1(R(S - 5))} ${y(62)}`,
    `C${r1(R(S + 1))} ${y(66)} ${r1(R(L + 3))} ${y(80)} ${r1(R(L))} ${y(94)}`,
    `C${r1(R(L - 1))} ${y(110)} ${r1(R(W))} ${y(124)} ${r1(R(W))} ${y(138)}`,
    `C${r1(R(W))} ${y(150)} ${r1(R(H))} ${y(156)} ${r1(R(H))} ${y(170)}`,
    `C${r1(R(H))} ${y(180)} ${r1(R(4))} ${y(186)} ${r1(CX)} ${y(188)}`,
    `C${r1(Lx(4))} ${y(186)} ${r1(Lx(H))} ${y(180)} ${r1(Lx(H))} ${y(170)}`,
    `C${r1(Lx(H))} ${y(156)} ${r1(Lx(W))} ${y(150)} ${r1(Lx(W))} ${y(138)}`,
    `C${r1(Lx(W))} ${y(124)} ${r1(Lx(L - 1))} ${y(110)} ${r1(Lx(L))} ${y(94)}`,
    `C${r1(Lx(L + 3))} ${y(80)} ${r1(Lx(S + 1))} ${y(66)} ${r1(Lx(S - 5))} ${y(62)}`,
    `C${r1(Lx(S - 14))} ${y(58)} ${r1(Lx(N + 4))} ${y(56)} ${r1(Lx(N))} ${y(46)}`,
    'Z',
  ].join(' ');

  const head = circle(CX, y(34), 14.5);
  const neck = poly([[CX - N, y(40)], [CX + N, y(40)], [CX + N + 1, y(56)], [CX - N - 1, y(56)]]);

  const body: string[] = [head, neck, torso];
  const details: string[] = [];
  const regions: Partial<Record<Region, string[]>> = { shoulders: [], arms: [], legs: [], calves: [], chest: [], core: [], back: [], hips: [], neck: [] };

  for (const s of [1, -1] as const) {
    const X = (x: number) => CX + s * x;
    // Arms hang slightly away from the body.
    const shoulder: Pt = [X(S - 5), y(70)];
    const elbow: Pt = [X(S + 4), y(128)];
    const wrist: Pt = [X(S + 8), y(180)];
    const upper = limb(shoulder, A, elbow, A * 0.72, A * 1.05);
    const fore = limb(elbow, A * 0.7, wrist, 4, Fa);
    const hand = ellipse(X(S + 8.5), y(188), 5.2, 7.5);
    const delt = ellipse(X(S - 4.5), y(70), d, d * 1.15);
    // Legs.
    const hipX = Math.max(H * 0.5, T * 0.7 + 1);
    const thighTop: Pt = [X(hipX), y(178)];
    const knee: Pt = [X(hipX * 0.84), y(250)];
    const ankle: Pt = [X(hipX * 0.8), y(322)];
    const kneeR = T * 0.5 + 2.5;
    const thigh = limb(thighTop, T, knee, kneeR, T * 1.04);
    const calf = limb(knee, kneeR * 0.92, ankle, 4.2, c);
    const foot = ellipse(X(hipX * 0.8 + 4), y(328), 9, 4.5);
    body.push(delt, upper, fore, hand, thigh, calf, foot);

    regions.shoulders!.push(delt);
    regions.arms!.push(upper, fore);
    regions.legs!.push(thigh, calf);
    regions.calves!.push(calf);
    regions.chest!.push(ellipse(X(C * 0.46), y(84), C * 0.5, 12.5));
    regions.back!.push(`M${r1(X(L + 3))} ${y(78)} Q${r1(X(L + 3))} ${y(112)} ${r1(X(W + 1))} ${y(138)} L${r1(X(W - 5))} ${y(132)} Q${r1(X(L - 7))} ${y(104)} ${r1(X(C * 0.7))} ${y(80)} Z`);
    // Light anatomy lines: under the chest, the knee.
    details.push(`M${r1(X(3))} ${y(96)} Q${r1(X(C * 0.5))} ${y(101)} ${r1(X(C * 0.92))} ${y(90)}`);
    details.push(`M${r1(knee[0] - kneeR * 0.5)} ${y(246)} Q${r1(knee[0])} ${y(252)} ${r1(knee[0] + kneeR * 0.5)} ${y(246)}`);
    regions.neck!.push(poly([[X(N + 1), y(48)], [X(S - 8), y(62)], [X(N + 1), y(62)]]));
  }
  regions.neck!.push(neck);
  const coreW = W * 0.62;
  regions.core!.push(`M${r1(CX - coreW)} ${y(108)} Q${r1(CX)} ${y(100)} ${r1(CX + coreW)} ${y(108)} L${r1(CX + coreW * 0.86)} ${y(166)} Q${r1(CX)} ${y(176)} ${r1(CX - coreW * 0.86)} ${y(166)} Z`);
  details.push(`M${CX} ${y(102)} L${CX} ${y(170)}`, `M${r1(CX - coreW * 0.7)} ${y(126)} L${r1(CX + coreW * 0.7)} ${y(126)}`, `M${r1(CX - coreW * 0.75)} ${y(146)} L${r1(CX + coreW * 0.75)} ${y(146)}`);
  regions.hips!.push(ellipse(CX, y(176), H + 3, 15));

  const h = f.h;
  return { body, torso, regions, details, transform: `translate(${CX} ${GROUND_Y}) scale(${h}) translate(${-CX} ${-GROUND_Y})` };
}

/** Regions whose highlights sit on the torso (clipped to it so they don't spill onto the arms). */
export const TORSO_REGIONS: Region[] = ['chest', 'core', 'back'];
