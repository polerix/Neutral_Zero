export const WW = 2400, WH = 2400;
export const EX = WW / 2, EY = 120, ER = 78;
export const MAX_HP = 100, DRAG = 0.983, TURN = 0.063, THR = 0.20, MAX_SPD = 5.8;
export const BSPD = 10, BLIFE = 50, FIRE_CD = 14, INV_T = 72;
export const PROX = 320, ESCAPE_HOLD = 145, RESPAWN_T = 240;
export const SPAWN_INT = 195, MAX_ROC = 75, INIT_ROC = 50;

export const TIERS = [
    { r: 46, hp: 4, spd: .48, next: 2 },
    { r: 25, hp: 2, spd: .90, next: 2 },
    { r: 12, hp: 1, spd: 1.65, next: 0 }
];

export const FACTIONS = {
    vykos: { name: "VANGUARD", faction: "VYKOS", col: "#ff5500", glow: "#ff8800" },
    raelun: { name: "REMNANT", faction: "RAELUN", col: "#00ddff", glow: "#44ffff" }
};

export const LORE = [
    "The Vykos and the Raelun have been at war for ninety years.",
    "One ship each — stranded together in a rogue asteroid field.",
    "Waypoint buoys are drifting - they are unlocked.",
    "No relay. No reinforcements. No other option.",
    "If the signal never comes, both fleets hold the border line. Forever."
];

export const BUOYS = [
    { x: WW / 2, y: WH - 800 },
    { x: WW / 4, y: WH / 2 },
    { x: (WW / 4) * 3, y: WH / 2 },
    { x: WW / 2, y: WH / 3 }
];

export const R = (a, b) => Math.random() * (b - a) + a;
export const L = (a, b, t) => a + (b - a) * t;
export const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const AD = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

export function poly(n, r) { return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, ri = r * R(.7, 1.32); return [Math.cos(a) * ri, Math.sin(a) * ri] }); }

export function mkRock(tier = 0, ax = WW / 2, ay = WH - 220) {
    const td = TIERS[tier]; let x, y, t = 0;
    do { x = R(100, WW - 100); y = R(300, WH - 400); t++; } while (Math.hypot(x - ax, y - ay) < 400 && t < 30);
    const a = R(0, Math.PI * 2), s = R(td.spd * .6, td.spd * 1.5);
    return {
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: R(0, Math.PI * 2), spin: R(-.025, .025),
        tier, hp: td.hp, r: td.r, pts: poly(Math.floor(R(7, 12)), td.r), id: Math.random()
    };
}

export function mkShip(facData, x0, y0, controls, isAI) {
    return {
        ...facData, x: x0, y: y0, x0, y0, vx: 0, vy: 0, ang: -Math.PI / 2,
        hp: MAX_HP, alive: true, fireCD: 0, invT: 0, trail: [], thrusting: false,
        controls, isAI, respawnT: 0
    };
}

export function sparks(x, y, col, n = 12, spd = 1) {
    return Array.from({ length: n }, () => {
        const a = R(0, Math.PI * 2), s = R(.8, 4.5) * spd;
        return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: R(.5, 1), r: R(1.5, 4.5), col };
    });
}

export const STARS = [
    Array.from({ length: 140 }, () => ({ x: R(0, WW), y: R(0, WH), r: R(.4, 1.2), a: R(.3, .7) })),
    Array.from({ length: 75 }, () => ({ x: R(0, WW), y: R(0, WH), r: R(.8, 1.8), a: R(.5, .9) })),
    Array.from({ length: 38 }, () => ({ x: R(0, WW), y: R(0, WH), r: R(1.2, 2.5), a: R(.7, 1) }))
];

export class AudioSys {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.targetEnergy = 0.5;
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);

        this.shieldOsc = this.ctx.createOscillator();
        this.shieldOsc.type = 'sine';
        this.shieldOsc.frequency.value = 55;
        this.shieldGain = this.ctx.createGain();
        this.shieldGain.gain.value = 0;
        this.shieldOsc.connect(this.shieldGain);
        this.shieldGain.connect(this.master);
        this.shieldOsc.start();
    }
    resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
    playLaser(isVykos) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = isVykos ? 'square' : 'sawtooth';
        osc.frequency.setValueAtTime(isVykos ? 880 : 1200, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.15);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(g); g.connect(this.master);
        osc.start(t); osc.stop(t + 0.15);
    }
    playThrust(vol) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        const lfo = this.ctx.createOscillator();
        lfo.type = 'square'; lfo.frequency.value = 50;
        const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 100;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 400;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol * 0.1, t);
        g.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.connect(filter); filter.connect(g); g.connect(this.master);
        lfo.start(t); osc.start(t);
        lfo.stop(t + 0.1); osc.stop(t + 0.1);
    }
    playExplosion() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(); osc.type = 'square';
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, t);
        filter.frequency.linearRampToValueAtTime(50, t + 0.8);
        const lfo = this.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 20;
        const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 40;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
        osc.connect(filter); filter.connect(g); g.connect(this.master);
        lfo.start(t); osc.start(t);
        lfo.stop(t + 0.8); osc.stop(t + 0.8);
    }
    setShield(active) {
        const t = this.ctx.currentTime;
        this.shieldGain.gain.setTargetAtTime(active ? 0.3 : 0, t, 0.1);
    }
}
