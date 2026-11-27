import { Component, createRef, type ReactNode } from 'react';
import { ALGORITHM_TIMING } from '../Utilities/constants';
import { MONTHS_UPPER as MON } from '../Utilities/dates';

export interface TraceNode {
    id: string;
    code?: string;
    rf?: boolean;
    dispoType?: string;
}

interface AlgorithmTraceProps {
    nodes: TraceNode[];
    hold: boolean;
    onReveal: () => void;
    innerClassName?: string;
    children: ReactNode;
}

type Box = { x: number; y: number; w: number; h: number };
type Pt = [number, number];
interface Pair { key: string; j: number; a: TraceNode; b: TraceNode }
interface Seg { key: string; gU: SVGGElement; gO: SVGGElement; dU: SVGGElement; main: SVGPathElement; L: number; end: Pt; geo: string }
interface Ghost { el: HTMLElement; b: Box }
interface Branch { type: string; d: string; p: Pt; E?: Pt; C?: Pt; q?: Pt; rejoin?: boolean; dir?: number; term?: string; text?: string[] }
interface BranchCtx { gapTop: number; gapBot: number; text: string[]; main: SVGPathElement; L: number; t: number }

const NS = 'http://www.w3.org/2000/svg';
const LINE = 'var(--color-primary)';
const BG = 'var(--color-themewhite2)';
const INK2 = 'var(--color-tertiary)';
const ACCENT = 'var(--trace-accent)';
const DISPO: Record<string, { n: number; c: string }> = {
    'CAT I': { n: 1, c: 'var(--color-themeredred)' },
    'CAT II': { n: 2, c: 'var(--color-themeyellow)' },
    'CAT III': { n: 3, c: 'var(--color-themegreen)' },
    'CAT IV': { n: 4, c: 'var(--color-themeblue2)' },
};
const dispoOf = (t?: string) => DISPO[t ?? ''] ?? { n: 4, c: 'var(--color-themeblue3)' };

type SvgAttrs = Record<string, string | number>;
function sv<K extends keyof SVGElementTagNameMap>(tag: K, attrs: SvgAttrs, parent?: Element): SVGElementTagNameMap[K] {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
}
function css<T extends HTMLElement | SVGElement>(e: T, o: Partial<CSSStyleDeclaration>): T {
    Object.assign(e.style, o);
    return e;
}
function rngFrom(seed: number) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function hashStr(s: string) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
type Rng = () => number;
const R = (r: Rng, a: number, b: number) => a + r() * (b - a);
const pick = <T,>(r: Rng, arr: T[]) => arr[Math.floor(r() * arr.length)];
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const pad = (n: number) => String(n).padStart(2, '0');
const dtg = (ms: number) => {
    const d = new Date(ms);
    return `${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}L ${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};
const mmss = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sigOf = (nodes: TraceNode[]) => nodes.map(n => `${n.id}:${n.code ?? ''}:${n.rf ? 1 : 0}`).join('|');

function roundPath(pts: Pt[], r: number) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
        const l1 = Math.hypot(cx - px, cy - py) || 1, l2 = Math.hypot(nx - cx, ny - cy) || 1;
        const r1 = Math.min(r, l1 / 2), r2 = Math.min(r, l2 / 2);
        d += ` L${cx - (cx - px) / l1 * r1},${cy - (cy - py) / l1 * r1} Q${cx},${cy} ${cx + (nx - cx) / l2 * r2},${cy + (ny - cy) / l2 * r2}`;
    }
    const l = pts[pts.length - 1];
    return d + ` L${l[0]},${l[1]}`;
}

function glyphPaths(kind: string, [x, y]: Pt, s: number): string[] {
    if (kind === 'diamond') return [`M${x},${y - s} L${x + s},${y} L${x},${y + s} L${x - s},${y} Z`, `M${x},${y - s * .45} L${x + s * .45},${y} L${x},${y + s * .45} L${x - s * .45},${y} Z`];
    if (kind === 'tri') return [`M${x - s},${y - s * .6} L${x + s},${y - s * .6} L${x},${y + s} Z`];
    if (kind === 'ringticks') {
        let t = '';
        for (const a of [-90, 30, 150]) {
            const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
            t += `M${x + c * (s + 1.5)},${y + sn * (s + 1.5)} L${x + c * (s + 4.5)},${y + sn * (s + 4.5)} `;
        }
        return [`M${x + s},${y} A${s},${s} 0 1 1 ${x - s},${y} A${s},${s} 0 1 1 ${x + s},${y}`, t];
    }
    const w = s * .62, h = s * .95;
    return [`M${x - w},${y - h} L${x},${y} L${x - w},${y + h} L${x - 2 * w},${y} Z`, `M${x + w},${y - h} L${x + 2 * w},${y} L${x + w},${y + h} L${x},${y} Z`];
}

function glyphExtent(kind: string, dir: Pt, s: number) {
    if (kind === 'ddiamond') return Math.abs(dir[0]) > Math.abs(dir[1]) ? s * 1.24 : s * .95;
    if (kind === 'ring') return 3.4;
    return s;
}

export class AlgorithmTrace extends Component<AlgorithmTraceProps> {
    private wrap = createRef<HTMLDivElement>();
    private inner = createRef<HTMLDivElement>();
    private under = createRef<SVGSVGElement>();
    private over = createRef<SVGSVGElement>();
    private ghostLayer = createRef<HTMLDivElement>();
    private segs: (Seg | null)[] = [];
    private keys: (string | null)[] = [];
    private fx: { gU: SVGGElement; gO: SVGGElement } | null = null;
    private times = new Map<string, { at: number; t: number }>();
    private t0 = performance.now();
    private token = 0;
    private busy = false;
    private needRebuild = false;
    private width = 0;
    private ro: ResizeObserver | null = null;
    private rz: ReturnType<typeof setTimeout> | undefined;
    private nodesSig = '';

    componentDidMount() {
        this.nodesSig = sigOf(this.props.nodes);
        this.width = this.wrap.current?.clientWidth ?? 0;
        this.sync([], false);
        if (typeof ResizeObserver !== 'undefined' && this.inner.current) {
            this.ro = new ResizeObserver(() => this.onResize());
            this.ro.observe(this.inner.current);
        }
    }

    getSnapshotBeforeUpdate(prev: AlgorithmTraceProps): Ghost[] | null {
        if (sigOf(prev.nodes) === sigOf(this.props.nodes)) return null;
        const keep = new Set(this.props.nodes.map(n => n.id));
        const ghosts: Ghost[] = [];
        for (const n of prev.nodes) {
            if (keep.has(n.id)) continue;
            const el = this.cardEl(n.id);
            if (!el) continue;
            const host = el.closest<HTMLElement>('.animate-cardFadeUp');
            if (host && Number(getComputedStyle(host).opacity) < .5) continue;
            ghosts.push({ el: el.cloneNode(true) as HTMLElement, b: this.box(el) });
        }
        return ghosts;
    }

    componentDidUpdate(_prev: AlgorithmTraceProps, _state: unknown, snap: Ghost[] | null) {
        const sig = sigOf(this.props.nodes);
        if (sig !== this.nodesSig) {
            this.nodesSig = sig;
            this.sync(snap ?? [], true);
            return;
        }
        if (this.props.hold && !this.busy) this.props.onReveal();
    }

    componentWillUnmount() {
        this.token++;
        this.ro?.disconnect();
        clearTimeout(this.rz);
        this.busy = false;
        this.segs = [];
        this.keys = [];
        this.fx = null;
        this.under.current?.replaceChildren();
        this.over.current?.replaceChildren();
        this.ghostLayer.current?.replaceChildren();
    }

    private onResize() {
        this.sizeSvgs();
        const w = this.wrap.current?.clientWidth ?? 0;
        if (w === this.width) return;
        this.width = w;
        clearTimeout(this.rz);
        this.rz = setTimeout(() => {
            if (this.busy) this.needRebuild = true;
            else this.rebuildNow();
        }, 120);
    }

    private cardEl(id: string) {
        return this.inner.current?.querySelector<HTMLElement>(`[data-trace-card="${CSS.escape(id)}"]`) ?? null;
    }

    private box(e: HTMLElement): Box {
        const root = this.wrap.current;
        let x = 0, y = 0;
        let n: HTMLElement | null = e;
        while (n && n !== root) {
            x += n.offsetLeft; y += n.offsetTop;
            n = n.offsetParent as HTMLElement | null;
        }
        return { x, y, w: e.offsetWidth, h: e.offsetHeight };
    }

    private sizeSvgs() {
        const w = this.wrap.current?.clientWidth ?? 0, h = this.inner.current?.offsetHeight ?? 0;
        for (const s of [this.under.current, this.over.current]) {
            if (!s) continue;
            s.setAttribute('width', String(w));
            s.setAttribute('height', String(h));
            s.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }
    }

    private pairsOf(nodes: TraceNode[]): (Pair | null)[] {
        const out: (Pair | null)[] = [];
        for (let j = 1; j < nodes.length; j++) {
            const a = nodes[j - 1], b = nodes[j];
            out.push(a.rf ? null : { key: `${a.id}:${a.code ?? ''}>${b.id}`, j, a, b });
        }
        return out;
    }

    private geoOf(p: Pair) {
        const A = this.cardEl(p.a.id), B = this.cardEl(p.b.id);
        if (!A || !B) return '';
        const a = this.box(A), b = this.box(B);
        const ctrl = A.querySelector<HTMLElement>('[data-trace-on]');
        const c = ctrl ? this.box(ctrl) : null;
        return [a.x, a.y, a.w, a.h, b.x, b.y, b.w, c?.x ?? -1, c?.y ?? -1].join(',');
    }

    private sync(ghosts: Ghost[], reveal: boolean) {
        if (this.busy) {
            this.rebuildNow();
            if (reveal) this.props.onReveal();
            return;
        }
        const instant = reducedMotion();
        this.sizeSvgs();
        const pairs = this.pairsOf(this.props.nodes);
        const keys = pairs.map(p => p?.key ?? null);
        let k = 0;
        while (k < keys.length && k < this.keys.length && keys[k] === this.keys[k]) k++;

        for (let i = 0; i < k; i++) {
            const s = this.segs[i], p = pairs[i];
            if (!s || !p || this.geoOf(p) === s.geo) continue;
            s.gU.remove(); s.gO.remove();
            this.drawSegment(p, true);
            if (i === pairs.length - 1 && this.fx) {
                this.fx.gU.remove(); this.fx.gO.remove(); this.fx = null;
                this.dispoFx(true);
            }
        }

        const old = this.segs.slice(k);
        const oldKeys = this.keys.slice(k);
        this.segs.length = k;
        this.keys = keys;
        const fx = old.length && this.fx ? this.fx : null;
        if (fx) this.fx = null;
        for (const key of oldKeys) if (key) this.times.delete(key);
        const fresh = pairs.slice(k).filter((p): p is Pair => !!p);
        for (let i = k; i < pairs.length; i++) if (!pairs[i]) this.segs[i] = null;

        const tok = ++this.token;
        this.busy = true;
        let revealed = false;
        const doReveal = () => {
            if (revealed) return;
            revealed = true;
            if (reveal) this.props.onReveal();
        };
        const run = async () => {
            if (old.some(Boolean) || ghosts.length || fx) await this.retract(old, fx, ghosts, instant, tok);
            if (tok !== this.token) return;
            await Promise.all(fresh.map(p => this.drawSegment(p, instant, doReveal, tok)));
            doReveal();
            if (tok !== this.token) return;
            const nodes = this.props.nodes, last = nodes[nodes.length - 1];
            if (last?.dispoType && fresh.length && fresh[fresh.length - 1].b.id === last.id) this.dispoFx(instant);
            this.busy = false;
            if (this.needRebuild) { this.needRebuild = false; this.rebuildNow(); }
        };
        void run();
    }

    private rebuildNow() {
        this.token++;
        this.busy = false;
        this.needRebuild = false;
        this.under.current?.replaceChildren();
        this.over.current?.replaceChildren();
        this.ghostLayer.current?.replaceChildren();
        this.segs = [];
        this.fx = null;
        this.sizeSvgs();
        const pairs = this.pairsOf(this.props.nodes);
        this.keys = pairs.map(p => p?.key ?? null);
        pairs.forEach((p, i) => { if (p) this.drawSegment(p, true); else this.segs[i] = null; });
        const nodes = this.props.nodes, last = nodes[nodes.length - 1];
        if (last?.dispoType && pairs[pairs.length - 1]) this.dispoFx(true);
    }

    private retract(old: (Seg | null)[], fx: { gU: SVGGElement; gO: SVGGElement } | null, ghosts: Ghost[], instant: boolean, tok: number) {
        const dur = ALGORITHM_TIMING.TRACE_RETRACT;
        const segs = old.filter((s): s is Seg => !!s);
        const removeAll = () => { for (const s of segs) { s.gU.remove(); s.gO.remove(); } };
        if (fx) this.fadeRemove([fx.gU, fx.gO], instant ? 0 : 150);
        if (instant) { removeAll(); return Promise.resolve(); }
        const layer = this.ghostLayer.current;
        for (const g of ghosts) {
            if (!layer) break;
            css(g.el, { position: 'absolute', left: `${g.b.x}px`, top: `${g.b.y}px`, width: `${g.b.w}px`, margin: '0', pointerEvents: 'none' });
            g.el.removeAttribute('data-trace-card');
            layer.appendChild(g.el);
            const a = g.el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }], { duration: dur, fill: 'forwards' });
            a.onfinish = () => g.el.remove();
        }
        for (const s of segs) this.fadeRemove([s.dU, s.gO], dur * .6);
        return new Promise<void>(res => {
            const t0 = performance.now();
            const frame = (now: number) => {
                if (tok !== this.token) { removeAll(); return res(); }
                const e = Math.min(1, (now - t0) / dur), p = 1 - easeIn(e);
                for (const s of segs) s.main.style.strokeDashoffset = String(s.L * (1 - p));
                if (e < 1) requestAnimationFrame(frame);
                else { removeAll(); res(); }
            };
            requestAnimationFrame(frame);
        });
    }

    private strokePath(g: Element, d: string, o: { color: string; w: number; op?: number; cap?: string; dash?: string }) {
        const p = sv('path', { d, fill: 'none' }, g);
        css(p, { stroke: o.color, strokeWidth: String(o.w), opacity: String(o.op ?? 1), strokeLinecap: o.cap ?? 'butt', strokeLinejoin: 'round' });
        if (o.dash) p.style.strokeDasharray = o.dash;
        return p;
    }

    private drawIn(p: SVGPathElement, dur: number, delay: number, instant: boolean) {
        if (instant) return;
        if (p.style.strokeDasharray) {
            p.animate([{ opacity: 0 }, { opacity: p.style.opacity || 1 }], { duration: dur, delay, fill: 'backwards', easing: 'ease-out' });
            return;
        }
        const L = p.getTotalLength();
        p.style.strokeDasharray = `${L} ${L}`;
        p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: dur, delay, fill: 'backwards', easing: 'cubic-bezier(.33,1,.68,1)' });
    }

    private popIn(e: SVGElement | null, delay: number, instant: boolean, dur = 160) {
        if (instant || !e) return;
        css(e, { transformBox: 'fill-box', transformOrigin: 'center' });
        e.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: e.style.opacity || 1, transform: 'scale(1)' }], { duration: dur, delay, fill: 'backwards', easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }

    private pulse(g: Element, x: number, y: number, color: string, delay: number, scale = 4, w = 1.1) {
        const c = sv('circle', { cx: x, cy: y, r: 3 }, g);
        css(c, { fill: 'none', stroke: color, strokeWidth: String(w), transformBox: 'fill-box', transformOrigin: 'center', opacity: '0' });
        const a = c.animate([{ opacity: .9, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${scale})` }], { duration: 520, delay, easing: 'cubic-bezier(.22,1,.36,1)' });
        a.onfinish = () => c.remove();
    }

    private fadeRemove(els: Element[], dur: number) {
        for (const e of els) {
            if (!dur) { e.remove(); continue; }
            const a = e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, fill: 'forwards' });
            a.onfinish = () => e.remove();
        }
    }

    private typeText(t: SVGTextElement, str: string, delay: number, instant: boolean) {
        if (instant) { t.textContent = str; return; }
        t.textContent = '';
        let i = 0;
        setTimeout(() => {
            const id = setInterval(() => {
                t.textContent = str.slice(0, ++i);
                if (i >= str.length) clearInterval(id);
            }, 18);
        }, delay);
    }

    private glowNode(g: Element, x: number, y: number, color: string, delay: number, instant: boolean, size = 1) {
        const h = sv('circle', { cx: x, cy: y, r: 6.5 * size }, g); css(h, { fill: color, opacity: '.2' });
        const c = sv('circle', { cx: x, cy: y, r: 2.1 * size }, g); css(c, { fill: color });
        this.popIn(h, delay, instant, 360); this.popIn(c, delay, instant, 220);
    }

    private comet(g: Element, d: string, color: string, dur: number, delay: number) {
        for (const [w, op] of [[4, .25], [1.4, 1]]) {
            const p = this.strokePath(g, d, { color, w, op, cap: 'round' });
            const L = p.getTotalLength(), seg = Math.min(18, L * .4);
            p.style.strokeDasharray = `${seg} ${L + seg}`;
            p.style.strokeDashoffset = String(seg);
            const a = p.animate([{ strokeDashoffset: seg }, { strokeDashoffset: -L }], { duration: dur, delay, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
            a.onfinish = () => p.remove();
        }
    }

    private branchSpec(r: Rng, type: string, p: Pt, tan: Pt, W: number, ctx: BranchCtx): Branch {
        const vert = Math.abs(tan[1]) >= Math.abs(tan[0]);
        if (type === 'readout') {
            const away = Math.abs(tan[0]) > .25 ? -Math.sign(tan[0]) : (p[0] < W / 2 ? 1 : -1);
            const dir = (away > 0 ? W - p[0] : p[0]) >= 90 ? away : -away;
            let dy = R(r, 8, 16);
            if (p[1] + dy > ctx.gapBot - 16) dy = -dy;
            const k = vert ? Math.abs(dy) : 0, run = R(r, 10, 22);
            const pts: Pt[] = vert
                ? [p, [p[0] + dir * k, p[1] + dy], [p[0] + dir * (k + run), p[1] + dy]]
                : [p, [p[0], p[1] + dy], [p[0] + dir * run, p[1] + dy]];
            return { type, d: roundPath(pts, 3), p, E: pts[pts.length - 1], dir, text: ctx.text };
        }
        const t2 = ctx.t + R(r, .2, .34);
        if (type === 'spur' && vert && t2 < .95 && r() < .5) {
            const qp = ctx.main.getPointAtLength(t2 * ctx.L), q: Pt = [qp.x, qp.y];
            if (q[1] - p[1] > 26) {
                let ox = Math.sign(p[0] - W / 2) || 1;
                const off = R(r, 9, 18);
                const laneOf = (o: number) => o > 0 ? Math.max(p[0], q[0]) + off : Math.min(p[0], q[0]) - off;
                let lane = laneOf(ox);
                if (lane < 8 || lane > W - 8) { ox = -ox; lane = laneOf(ox); }
                return { type, rejoin: true, p, q, d: roundPath([p, [lane, p[1]], [lane, q[1]], q], 5) };
            }
        }
        let ox = Math.sign(p[0] - W / 2) || 1;
        let h = R(r, 18, 52);
        const v = R(r, 12, 30);
        if (p[0] + ox * h > W - 12 || p[0] + ox * h < 12) {
            const room = ox > 0 ? W - 12 - p[0] : p[0] - 12;
            if (room < 18) ox = -ox; else h = room;
        }
        const vy = p[1] + v > ctx.gapBot - 6 && p[1] - v > ctx.gapTop + 6 ? -1 : 1;
        const chamfer = r() < .45;
        let pts: Pt[], edir: Pt;
        if (vert) {
            if (chamfer) {
                const a = h * .45, c = v * .8;
                pts = [p, [p[0] + ox * a, p[1]], [p[0] + ox * (a + c), p[1] + vy * c], [p[0] + ox * (a + c + 8), p[1] + vy * c]];
                edir = [ox, 0];
            } else {
                pts = [p, [p[0] + ox * h, p[1]], [p[0] + ox * h, p[1] + vy * v]];
                edir = [0, vy];
            }
        } else if (chamfer) {
            const a = v * .5, c = Math.min(v * .8, h * .6);
            pts = [p, [p[0], p[1] + vy * a], [p[0] + ox * c, p[1] + vy * (a + c)], [p[0] + ox * (c + 8), p[1] + vy * (a + c)]];
            edir = [ox, 0];
        } else {
            pts = [p, [p[0], p[1] + vy * v], [p[0] + ox * h, p[1] + vy * v]];
            edir = [ox, 0];
        }
        const term = pick(r, ['ring', 'ring', 'diamond', 'tri', 'ringticks', 'ddiamond']);
        const E = pts[pts.length - 1], ext = glyphExtent(term, edir, 4.2);
        const C: Pt = [E[0] + edir[0] * ext, E[1] + edir[1] * ext];
        return { type, rejoin: false, p, E, C, term, d: roundPath(pts, chamfer ? 2 : 5) };
    }

    private drawBranch(g: Element, gTop: Element, s: Branch, instant: boolean) {
        if (s.type === 'readout') {
            const j = sv('circle', { cx: s.p[0], cy: s.p[1], r: 1.3 }, g); css(j, { fill: LINE, opacity: '.7' });
            this.popIn(j, 0, instant);
            const path = this.strokePath(g, s.d, { color: LINE, w: .7, op: .5 });
            const dur = 300;
            this.drawIn(path, dur, 0, instant);
            const dot = sv('circle', { cx: s.E![0], cy: s.E![1], r: 1.5 }, g);
            css(dot, { fill: LINE, opacity: '.7' });
            this.popIn(dot, dur, instant);
            const anchor = s.dir! < 0 ? 'end' : 'start', tx = s.E![0] + s.dir! * 5;
            s.text!.forEach((line, k) => {
                const t = sv('text', { class: 'trace-mono', x: tx, y: s.E![1] + 2.5 + k * 10, 'text-anchor': anchor }, gTop);
                css(t, { fill: INK2, opacity: k ? '.6' : '.95', stroke: BG, strokeWidth: '3', paintOrder: 'stroke', strokeLinejoin: 'round' });
                this.typeText(t, line, dur + k * 220, instant);
            });
            return;
        }
        const path = this.strokePath(g, s.d, { color: LINE, w: .8, op: s.type === 'pulse' ? .4 : .5 });
        const len = path.getTotalLength();
        const dur = 220 + len * 2.2;
        this.drawIn(path, dur, 0, instant);
        const j0 = sv('circle', { cx: s.p[0], cy: s.p[1], r: 1.4 }, g); css(j0, { fill: LINE, opacity: '.75' });
        this.popIn(j0, 0, instant);
        const cd = 480 + len * 3, arrive = dur + 80 + cd * .92;
        let gp: string[] | null = null;
        let endPt: Pt;
        if (s.rejoin) {
            endPt = s.q!;
            const j1 = sv('circle', { cx: endPt[0], cy: endPt[1], r: 2.2 }, g);
            css(j1, { fill: BG, stroke: LINE, strokeWidth: '.8', opacity: '.8' });
            this.popIn(j1, dur * .95, instant);
        } else {
            endPt = s.C!;
            if (s.term === 'ring') {
                const c = sv('circle', { cx: endPt[0], cy: endPt[1], r: 3.4 }, g);
                css(c, { fill: BG, stroke: LINE, strokeWidth: '.8', opacity: '.7' });
                this.popIn(c, dur * .9, instant);
            } else {
                gp = glyphPaths(s.term!, endPt, 4.2);
                gp.forEach(d => this.drawIn(this.strokePath(g, d, { color: LINE, w: .8, op: .65 }), 240, dur * .9, instant));
            }
        }
        if (!instant && (s.type === 'pulse' || s.rejoin)) {
            this.comet(g, s.d, ACCENT, cd, dur + 80);
            this.pulse(g, endPt[0], endPt[1], ACCENT, arrive, 3.5);
            gp?.forEach(d => {
                const f = this.strokePath(g, d, { color: ACCENT, w: 1.1, op: 0 });
                const a = f.animate([{ opacity: 0 }, { opacity: .9 }, { opacity: 0 }], { duration: 700, delay: arrive, easing: 'ease-out' });
                a.onfinish = () => f.remove();
            });
        }
    }

    private drawSegment(pr: Pair, instant: boolean, onReveal?: () => void, tok = this.token): Promise<void> {
        const idx = pr.j - 1;
        const A = this.cardEl(pr.a.id), B = this.cardEl(pr.b.id);
        const under = this.under.current, over = this.over.current, wrap = this.wrap.current;
        if (!A || !B || !under || !over || !wrap) {
            this.segs[idx] = null;
            onReveal?.();
            return Promise.resolve();
        }
        if (!this.times.has(pr.key)) this.times.set(pr.key, { at: Date.now(), t: performance.now() });
        const when = this.times.get(pr.key)!;
        const ctrl = A.querySelector<HTMLElement>('[data-trace-on]');
        const a = this.box(A), Bb = this.box(B);
        const W = wrap.clientWidth;
        const r = rngFrom(hashStr(`${pr.a.id}:${pr.a.code ?? ''}:${pr.j}`));
        const red = pr.b.dispoType ? dispoOf(pr.b.dispoType).n === 1 : false;
        const color = red ? DISPO['CAT I'].c : LINE;
        const glowC = red ? DISPO['CAT I'].c : ACCENT;
        const gut = Math.max(8, Math.min(a.x, W - a.x - a.w));

        const tight = gut < 24;
        let side: number, sx: number, sy: number;
        if (tight) {
            const b = ctrl ? this.box(ctrl) : { x: a.x, y: a.y, w: a.w, h: a.h };
            const bc = b.x + b.w / 2, ac = a.x + a.w / 2;
            side = Math.abs(bc - ac) < 4 ? (r() < .5 ? -1 : 1) : (bc < ac ? -1 : 1);
            const outer = side < 0 ? b.x : b.x + b.w;
            sx = Math.min(a.x + a.w - 20, Math.max(a.x + 20, outer + (bc - outer) * r()));
            sy = a.y + a.h;
        } else {
            if (ctrl) {
                const b = this.box(ctrl);
                const bc = b.x + b.w / 2, ac = a.x + a.w / 2;
                side = Math.abs(bc - ac) < 4 ? (r() < .5 ? -1 : 1) : (bc < ac ? -1 : 1);
                sy = b.y + b.h / 2;
            } else {
                side = r() < .5 ? -1 : 1;
                sy = a.y + a.h - Math.min(20, a.h / 2);
            }
            sx = side < 0 ? a.x : a.x + a.w;
        }
        const gapTop = a.y + a.h, gapBot = Bb.y, gh = gapBot - gapTop;
        const ex = Bb.x + Bb.w * R(r, .18, .82);
        const end: Pt = [ex, Bb.y];
        let d: string;
        if (tight) {
            const ly = R(r, gapTop + gh * .3, gapBot - gh * .3);
            d = Math.abs(ex - sx) < 24
                ? `M${sx},${sy} C${sx},${sy + gh * .5} ${ex},${Bb.y - gh * .5} ${ex},${Bb.y}`
                : roundPath([[sx, sy], [sx, ly], [ex, ly], [ex, Bb.y]], Math.min(R(r, 10, 18), gh * .3));
        } else if (r() < .5) {
            const ox = sx + side * R(r, gut * .45, gut * .8), k2 = R(r, gh * .35, gh * .7);
            d = `M${sx},${sy} L${ox - side * 6},${sy} Q${ox},${sy} ${ox},${sy + 6} C${ox},${gapTop + gh * R(r, .2, .45)} ${ex},${Bb.y - k2} ${ex},${Bb.y}`;
        } else {
            const laneX = sx + side * R(r, gut * .35, gut * .7), ly = R(r, gapTop + gh * .3, gapBot - gh * .3);
            d = roundPath([[sx, sy], [laneX, sy], [laneX, ly], [ex, ly], [ex, Bb.y]], R(r, 10, 18));
        }

        const gU = sv('g', {}, under), gO = sv('g', {}, over);
        const dU = sv('g', {}, gU);
        const glow = this.strokePath(gU, d, { color: glowC, w: 4, op: .2, cap: 'round' });
        const main = this.strokePath(gU, d, { color, w: 1.1 });
        const L = main.getTotalLength();
        main.style.strokeDasharray = glow.style.strokeDasharray = `${L} ${L}`;
        const sRing = sv('circle', { cx: sx, cy: sy, r: 3.4 }, gO);
        css(sRing, { fill: BG, stroke: color, strokeWidth: '1' });
        this.segs[idx] = { key: pr.key, gU, gO, dU, main, L, end, geo: this.geoOf(pr) };

        const decos: { t: number; fired?: boolean; run: (inst: boolean) => void }[] = [];
        if (r() < .5) {
            const o = r() < .5 ? -1 : 1, ex0 = o < 0 ? a.x : a.x + a.w;
            let y0 = R(r, a.y + 16, a.y + a.h - 16);
            if (o === side && Math.abs(y0 - sy) < 18) y0 = sy + (y0 < sy ? -1 : 1) * 18;
            y0 = Math.min(a.y + a.h - 10, Math.max(a.y + 10, y0));
            if (pick(r, ['scale', 'notch']) === 'scale') {
                const x = ex0 + o * R(r, gut * .3, gut * .55), h = R(r, 26, 44), top = y0 - h * R(r, .3, .7);
                const nd = 3 + Math.floor(r() * 3), cap = Math.floor(r() * nd);
                decos.push({ t: 0, run: inst => {
                    this.drawIn(this.strokePath(dU, `M${ex0},${y0} L${x},${y0}`, { color: LINE, w: .7, op: .5 }), 140, 0, inst);
                    this.drawIn(this.strokePath(dU, `M${x},${top} L${x},${top + h}`, { color: LINE, w: .7, op: .5 }), 260, 120, inst);
                    for (let k = 0; k < nd; k++) {
                        const yy = top + h * (k + .5) / nd;
                        const e = k === cap
                            ? sv('rect', { x: x - 2.2, y: yy - 5, width: 4.4, height: 10, rx: 2.2 }, dU)
                            : sv('circle', { cx: x, cy: yy, r: 1.3 }, dU);
                        css(e, k === cap ? { fill: BG, stroke: LINE, strokeWidth: '.8', opacity: '.8' } : { fill: LINE, opacity: '.65' });
                        this.popIn(e, 180 + k * 60, inst);
                    }
                } });
            } else {
                const x = ex0 + o * R(r, 5, 8), h = R(r, 20, 36), top = y0 - h / 2;
                const nt = 2 + Math.floor(r() * 2);
                decos.push({ t: 0, run: inst => {
                    this.drawIn(this.strokePath(dU, `M${x},${top} L${x},${top + h}`, { color: LINE, w: .8, op: .55 }), 220, 0, inst);
                    for (const yy of [top, top + h]) {
                        const q = sv('rect', { x: x - 1.6, y: yy - 1.6, width: 3.2, height: 3.2 }, dU);
                        css(q, { fill: LINE, opacity: '.6' });
                        this.popIn(q, 200, inst);
                    }
                    for (let k = 0; k < nt; k++) {
                        const yy = top + h * (k + 1) / (nt + 1), l = k % 2 ? 4 : 8;
                        this.drawIn(this.strokePath(dU, `M${x},${yy} L${x + o * l},${yy}`, { color: LINE, w: .7, op: .5 }), 120, 200 + k * 50, inst);
                    }
                } });
            }
        }

        const nb = pick(r, [1, 2, 2, 3]);
        const types = ['spur', 'pulse', 'readout'].sort(() => r() - .5);
        const readText = [dtg(when.at), `T+${mmss(when.t - this.t0)}`];
        for (let k = 0; k < nb; k++) {
            const type = types[k % 3];
            let t = R(r, .15, .85);
            if (type === 'readout') {
                for (let n = 0; n < 16; n++) {
                    const y = main.getPointAtLength(t * L).y;
                    if (y > gapTop + 8 && y < gapBot - 22) break;
                    t = R(r, .1, .95);
                }
            }
            const at = t * L;
            const p = main.getPointAtLength(at), q = main.getPointAtLength(Math.min(L, at + 1.5));
            const tl = Math.hypot(q.x - p.x, q.y - p.y) || 1;
            const spec = this.branchSpec(r, type, [p.x, p.y], [(q.x - p.x) / tl, (q.y - p.y) / tl], W, { gapTop, gapBot, text: readText, main, L, t });
            decos.push({ t, run: inst => this.drawBranch(dU, gO, spec, inst) });
        }

        const label = pr.a.code ? `${pad(pr.j)} ${pr.a.code}` : pad(pr.j);
        const txt = sv('text', { class: 'trace-mono', x: side < 0 ? a.x + 2 : a.x + a.w - 2, y: gapTop + 11, 'text-anchor': side < 0 ? 'start' : 'end' }, gO);
        css(txt, { fill: INK2, stroke: BG, strokeWidth: '3', paintOrder: 'stroke', strokeLinejoin: 'round' });

        const finish = () => {
            this.glowNode(gO, end[0], end[1], glowC, 0, instant);
            this.typeText(txt, label, 0, instant);
            if (instant) glow.style.opacity = '0';
            else glow.animate([{ opacity: .2 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
        };

        if (instant) {
            main.style.strokeDashoffset = '0'; glow.style.strokeDashoffset = '0';
            decos.forEach(dc => dc.run(true));
            onReveal?.();
            finish();
            return Promise.resolve();
        }

        this.popIn(sRing, 0, false, 200);
        const head = sv('g', {}, gO);
        const halo = sv('circle', { cx: sx, cy: sy, r: 6.5 }, head); css(halo, { fill: glowC, opacity: '.22' });
        const dot = sv('circle', { cx: sx, cy: sy, r: 2 }, head); css(dot, { fill: glowC });
        const dur = ALGORITHM_TIMING.TRACE_DRAW, t0 = performance.now();
        let revealed = false;
        main.style.strokeDashoffset = glow.style.strokeDashoffset = String(L);
        return new Promise<void>(resolve => {
            const frame = (now: number) => {
                if (tok !== this.token) { head.remove(); return resolve(); }
                const e = Math.min(1, (now - t0) / dur), p = easeOut(e);
                main.style.strokeDashoffset = glow.style.strokeDashoffset = String(L * (1 - p));
                const pt = main.getPointAtLength(L * p);
                for (const c of [halo, dot]) { c.setAttribute('cx', String(pt.x)); c.setAttribute('cy', String(pt.y)); }
                for (const dc of decos) if (!dc.fired && p >= dc.t) { dc.fired = true; dc.run(false); }
                if (!revealed && e >= ALGORITHM_TIMING.TRACE_REVEAL_AT) { revealed = true; onReveal?.(); }
                if (e < 1) requestAnimationFrame(frame);
                else { head.remove(); finish(); resolve(); }
            };
            requestAnimationFrame(frame);
        });
    }

    private dispoFx(instant: boolean) {
        const nodes = this.props.nodes, last = nodes[nodes.length - 1];
        const under = this.under.current, over = this.over.current, wrap = this.wrap.current;
        const B = last ? this.cardEl(last.id) : null;
        if (!last?.dispoType || !B || !under || !over || !wrap) return;
        const bb = this.box(B), d = dispoOf(last.dispoType), c = d.c;
        const r = rngFrom(hashStr(`${last.id}:fx`));
        const W = wrap.clientWidth;
        const gU = sv('g', {}, under), gO = sv('g', {}, over);
        this.fx = { gU, gO };
        const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
        const end = this.segs[nodes.length - 2]?.end ?? [cx, bb.y];
        if (!instant) this.pulse(gO, end[0], end[1], c, 0, 9, 1.4);

        if (d.n === 1) {
            const bases = [-40, 40, 140, -140, 0, 180];
            const n = 11 + Math.floor(r() * 5);
            for (let k = 0; k < n; k++) {
                const base = k < bases.length ? bases[k] : pick(r, bases);
                const ang = (base + R(r, -10, 10)) * Math.PI / 180;
                const len = R(r, bb.w * .35, bb.w * .78);
                const o: Pt = [cx + R(r, -24, 24), cy + R(r, -6, 6)];
                const e: Pt = [o[0] + Math.cos(ang) * len, o[1] + Math.sin(ang) * len];
                const p = this.strokePath(gU, `M${o} L${e}`, { color: r() < .55 ? c : LINE, w: pick(r, [.5, .8, 1.2, 2, 3.2]), cap: 'square' });
                this.drawIn(p, R(r, 150, 260), R(r, 0, 90), instant);
            }
            for (const [off, w] of [[-1, .6], [2, 1.8]]) {
                for (const tx of [-20, W + 20]) {
                    this.drawIn(this.strokePath(gU, `M${cx},${cy + off} L${tx},${cy + off}`, { color: LINE, w, op: .8 }), 220, 40, instant);
                }
            }
            for (let k = 0; k < 10; k++) {
                const edge = pick(r, ['t', 'b', 'l', 'r']);
                let x: number, y: number, ang: number;
                if (edge === 't') { x = R(r, bb.x + 10, bb.x + bb.w - 10); y = bb.y; ang = -90; }
                else if (edge === 'b') { x = R(r, bb.x + 10, bb.x + bb.w - 10); y = bb.y + bb.h; ang = 90; }
                else if (edge === 'l') { x = bb.x; y = R(r, bb.y + 8, bb.y + bb.h - 8); ang = 180; }
                else { x = bb.x + bb.w; y = R(r, bb.y + 8, bb.y + bb.h - 8); ang = 0; }
                ang += R(r, -45, 45);
                const pts: Pt[] = [[x, y]];
                for (let s = 0; s < 7; s++) {
                    ang += R(r, -30, 30);
                    const st = R(r, 4, 10);
                    x += Math.cos(ang * Math.PI / 180) * st; y += Math.sin(ang * Math.PI / 180) * st;
                    pts.push([x, y]);
                }
                const p = this.strokePath(gU, 'M' + pts.map(q => q.join(',')).join(' L'), { color: LINE, w: .4, op: .55 });
                this.drawIn(p, 380, R(r, 60, 200), instant);
            }
            for (let k = 0; k < 28; k++) {
                const ang = r() * Math.PI * 2;
                const x = cx + Math.cos(ang) * (bb.w / 2 + R(r, 4, 60)), y = cy + Math.sin(ang) * (bb.h / 2 + R(r, 4, 40));
                const s = sv('circle', { cx: x, cy: y, r: R(r, .4, 1.8) }, gU);
                css(s, { fill: r() < .4 ? c : LINE, opacity: String(R(r, .4, 1)) });
                this.popIn(s, R(r, 40, 280), instant, 180);
            }
            if (!instant) {
                for (let k = 0; k < 4; k++) {
                    const rc = sv('rect', { x: 0, y: R(r, bb.y - 18, bb.y + bb.h + 18), width: W, height: pick(r, [1, 1, 2, 3]) }, gO);
                    css(rc, { fill: c, opacity: '0' });
                    const a = rc.animate([
                        { opacity: 0, transform: 'translateX(-12px)' }, { opacity: .9, transform: 'translateX(8px)' },
                        { opacity: 0, transform: 'translateX(-4px)' }, { opacity: .7, transform: 'translateX(2px)' }, { opacity: 0, transform: 'none' },
                    ], { duration: 300, delay: k * 35 });
                    a.onfinish = () => rc.remove();
                }
                B.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(-1px)' }, { transform: 'none' }], { duration: 220, delay: 40 });
            }
            return;
        }

        const gut = Math.max(4, Math.min(bb.x, W - bb.x - bb.w) - 6);
        const rx = bb.w / 2 + Math.min(gut, bb.w * .1), ry = bb.h / 2 + R(r, 24, 40), tilt = R(r, -7, 7) * Math.PI / 180;
        const at = (th: number): Pt => {
            const x = Math.cos(th) * rx, y = Math.sin(th) * ry;
            return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
        };
        const th0 = Math.atan2((end[1] - cy) / ry, (end[0] - cx) / rx);
        const span = ({ 2: 200, 3: 270, 4: 360 } as Record<number, number>)[d.n] * Math.PI / 180;
        const dir = r() < .5 ? 1 : -1;
        const N = 72, pts: Pt[] = [];
        for (let k = 0; k <= N; k++) pts.push(at(th0 + dir * span * k / N));
        const orbit = this.strokePath(gU, 'M' + pts.map(p => p.join(',')).join(' L'), { color: c, w: .9, op: .85 });
        const odur = d.n === 4 ? 1000 : 800;
        this.drawIn(orbit, odur, 0, instant);
        const marks = [R(r, .25, .45), R(r, .6, .85)];
        marks.forEach((f, k) => {
            const p = at(th0 + dir * span * f);
            this.glowNode(gU, p[0], p[1], c, odur * f, instant, k === 0 ? 1 : .8);
        });
        const lp = at(th0 + dir * span * marks[1]);
        const lo = Math.sign(lp[0] - cx) || 1;
        const lx = lp[0] + lo * 14, ly = lp[1] + (lp[1] < cy ? -12 : 12);
        const leader = this.strokePath(gO, `M${lp[0] + lo * 3},${lp[1] + (ly - lp[1]) * .2} L${lx},${ly}`, { color: c, w: .7 });
        this.drawIn(leader, 160, odur * marks[1] + 80, instant);
        const t = sv('text', { class: 'trace-mono', x: lx + lo * 3, y: ly + 3, 'text-anchor': lo < 0 ? 'end' : 'start' }, gO);
        css(t, { fill: c, stroke: BG, strokeWidth: '3', paintOrder: 'stroke', strokeLinejoin: 'round' });
        this.typeText(t, last.dispoType, odur * marks[1] + 200, instant);
        if (d.n === 2) this.drawIn(this.strokePath(gU, `M-20,${cy} L${W + 20},${cy}`, { color: c, w: .5, op: .5 }), 500, 100, instant);
    }

    render() {
        const { hold, innerClassName, children } = this.props;
        return (
            <div ref={this.wrap} className="relative w-full overflow-x-clip" data-reveal-hold={hold}>
                <svg ref={this.under} aria-hidden="true" className="absolute left-0 top-0 overflow-visible pointer-events-none" />
                <div ref={this.ghostLayer} aria-hidden="true" className="absolute left-0 top-0 w-full pointer-events-none" />
                <div ref={this.inner} className={`relative z-[1] ${innerClassName ?? ''}`}>{children}</div>
                <svg ref={this.over} aria-hidden="true" className="absolute left-0 top-0 z-[2] overflow-visible pointer-events-none" />
            </div>
        );
    }
}
