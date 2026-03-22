import React, { useEffect, useRef } from 'react';
import {
    WW, WH, EX, EY, ER, MAX_HP, DRAG, TURN, THR, MAX_SPD,
    BSPD, BLIFE, FIRE_CD, INV_T, PROX, ESCAPE_HOLD, RESPAWN_T,
    SPAWN_INT, MAX_ROC, INIT_ROC, TIERS, FACTIONS, BUOYS, STARS,
    R, L, D, AD, poly, mkRock, mkShip, sparks, AudioSys,
    TETHER_FLASH_T, TETHER_PULL
} from '../gameLogic';

// Slower, more realistic movement
const REAL_THR = THR * 0.65;
const REAL_MAX_SPD = MAX_SPD * 0.75;
const REAL_DRAG = 0.992; // Less drag for more space feel

const VEX_COL = "#e8ffdf";
const ROCK_FILL_COLS = ["#38342e", "#4a4642", "#5e5a56"];
const ROCK_STROKE_COLS = ["#5c5852", "#787470", "#9a9896"];
const CTRL1 = { rL: "KeyA", rR: "KeyD", thr: "KeyW", fire: "Space" };
const CTRL2 = { rL: "ArrowLeft", rR: "ArrowRight", thr: "ArrowUp", fire: "ShiftRight" };

// ── 3-D shield geometry ───────────────────────────────────────────────────────
const _PHI = (1 + Math.sqrt(5)) / 2, _IP = 1 / _PHI, _S3 = Math.sqrt(3);

// Cube: 8 vertices (±1,±1,±1), 12 edges
const CUBE_V = [
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
    [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1]
];
const CUBE_E = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7]
];

// Dodecahedron: 20 vertices, 30 edges  (circumradius = √3 × scale)
const DODEC_V = [
    [ 1, 1, 1],[ 1, 1,-1],[ 1,-1, 1],[ 1,-1,-1],
    [-1, 1, 1],[-1, 1,-1],[-1,-1, 1],[-1,-1,-1],
    [ 0, _IP, _PHI],[ 0, _IP,-_PHI],[ 0,-_IP, _PHI],[ 0,-_IP,-_PHI],
    [_IP, _PHI, 0],[_IP,-_PHI, 0],[-_IP, _PHI, 0],[-_IP,-_PHI, 0],
    [_PHI, 0, _IP],[_PHI, 0,-_IP],[-_PHI, 0, _IP],[-_PHI, 0,-_IP]
];
const DODEC_E = [
    [0,8],[0,12],[0,16],[1,9],[1,12],[1,17],[2,10],[2,13],[2,16],[3,11],[3,13],[3,17],
    [4,8],[4,14],[4,18],[5,9],[5,14],[5,19],[6,10],[6,15],[6,18],[7,11],[7,15],[7,19],
    [8,10],[9,11],[12,14],[13,15],[16,17],[18,19]
];

// Project a 3-D vertex [x,y,z] with Y-then-X rotation and orthographic output
function proj3(vx, vy, vz, rx, ry) {
    const x1 = vx * Math.cos(ry) + vz * Math.sin(ry);
    const z1 = -vx * Math.sin(ry) + vz * Math.cos(ry);
    const y2 = vy * Math.cos(rx) - z1 * Math.sin(rx);
    return [x1, y2];
}

// Draw a wireframe shape in world-space at (cx,cy)
function drawWire(ctx, verts, edges, rx, ry, scale, cx, cy, col, alpha, lw) {
    const pts = verts.map(([vx, vy, vz]) => {
        const [px, py] = proj3(vx, vy, vz, rx, ry);
        return [cx + px * scale, cy + py * scale];
    });
    ctx.save();
    ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = lw;
    ctx.shadowColor = col; ctx.shadowBlur = lw * 4;
    ctx.beginPath();
    edges.forEach(([a, b]) => { ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); });
    ctx.stroke();
    ctx.restore();
}

// ── Navigation helpers ────────────────────────────────────────────────────────
// World → screen
function w2s(wx, wy, cam, CW, CH) {
    return [(wx - cam.x) * cam.z + CW / 2, (wy - cam.y) * cam.z + CH / 2];
}
// Clamp a (possibly off-screen) screen point to the viewport edge with padding
function vpEdge(sx, sy, CW, CH, pad) {
    const cx = CW / 2, cy = CH / 2;
    const dx = sx - cx, dy = sy - cy;
    if (!dx && !dy) return [cx, cy];
    const t = Math.min((CW / 2 - pad) / Math.abs(dx), (CH / 2 - pad) / Math.abs(dy));
    return [cx + dx * t, cy + dy * t];
}
// Off-screen directional arrow at (ex,ey) pointing at angle ang; dashed = event horizon
function navArrow(ctx, ex, ey, ang, dist, dashed, col) {
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = dashed ? 1 : 1.5;
    ctx.globalAlpha = 0.9;
    if (dashed) ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(2, -5); ctx.lineTo(2, 5); ctx.closePath();
    dashed ? ctx.stroke() : ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-13, 0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // Distance label — perpendicular to arrow direction
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = col;
    ctx.font = "9px 'Orbitron',sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(dist), ex - Math.sin(ang) * 18, ey + Math.cos(ang) * 18);
    ctx.restore();
}

// Off-screen arrow or on-screen distance label for a nav target
function renderNavIndicator(ctx, sx, sy, label, dashed, col, CW, CH, PAD, isVex, labelOffY) {
    if (sx < -30 || sx > CW + 30 || sy < -30 || sy > CH + 30) {
        const [ex, ey] = vpEdge(sx, sy, CW, CH, PAD);
        navArrow(ctx, ex, ey, Math.atan2(sy - CH / 2, sx - CW / 2), label, dashed, col);
    } else {
        ctx.save();
        ctx.fillStyle = col; ctx.globalAlpha = 0.9;
        ctx.font = "9px 'Orbitron',sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        if (!isVex) { ctx.shadowColor = col; ctx.shadowBlur = 6; }
        ctx.fillText(String(label), sx, sy - labelOffY);
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

export default function GameWorld({ players, p1Faction, gfxMode, setPhase }) {
    const cvs = useRef(null);
    const gfxCvs = useRef(null);
    const G = useRef(null);
    const keys = useRef(new Set());
    const audioRef = useRef(null);
    const raf = useRef(null);
    const overrideBtnRef = useRef(null);

    function getShipsState() {
        const startX = WW / 2; const startY = WH - 230;
        let s1, s2;
        if (p1Faction === 'vykos') {
            s1 = mkShip(FACTIONS.vykos, startX - 95, startY, CTRL1, false);
            s2 = mkShip(FACTIONS.raelun, startX + 95, startY, CTRL2, players === 1);
        } else {
            s1 = mkShip(FACTIONS.raelun, startX - 95, startY, CTRL1, false);
            s2 = mkShip(FACTIONS.vykos, startX + 95, startY, CTRL2, players === 1);
        }
        return [s1, s2];
    }

    function initMapAt(x, y) {
        if (!audioRef.current) audioRef.current = new AudioSys();
        audioRef.current.resume();

        const shps = getShipsState();
        shps.forEach(s => { s.x = x + (s.x0 - WW / 2); s.y = y; });

        G.current = {
            ships: shps, bullets: [], parts: [],
            rocks: Array.from({ length: INIT_ROC }, (_, i) => mkRock(i < 18 ? 0 : i < 36 ? 1 : 2, x, y)),
            cam: { x: x, y: y, z: 1, tx: x, ty: y, tz: 1, sh: 0 },
            escT: 0, spawnT: 0, frame: 0,
            buoys: BUOYS.map(b => ({ ...b, active: false })),
            lastSave: { x: x, y: y },
            tetherOverride: false, tetherMaxT: 0,
            shieldAng: { rx: 0, ry: 0 }
        };
    }

    useEffect(() => {
        const canvas = cvs.current;
        const overlay = gfxCvs.current;
        let CW = 0, CH = 0;
        let scanCanvas = null;

        function resize() {
            CW = canvas.width = canvas.offsetWidth;
            CH = canvas.height = canvas.offsetHeight;
            overlay.width = CW;
            overlay.height = CH;
            // Pre-render Vectrex scanline pattern
            scanCanvas = document.createElement('canvas');
            scanCanvas.width = CW; scanCanvas.height = CH;
            const sc = scanCanvas.getContext('2d');
            sc.fillStyle = "rgba(0,0,0,0.13)";
            for (let sy2 = 0; sy2 < CH; sy2 += 2) sc.fillRect(0, sy2, CW, 1);
        }
        resize();
        window.addEventListener("resize", resize);

        const onKD = e => {
            keys.current.add(e.code);
            if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
        };
        const onKU = e => keys.current.delete(e.code);
        window.addEventListener("keydown", onKD);
        window.addEventListener("keyup", onKU);

        const onClick = e => {
            const g = G.current;
            if (!g) return;
            const [s0, s1] = g.ships;
            if (!s0.alive || !s1.alive || g.tetherOverride || g.tetherMaxT < TETHER_FLASH_T) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const btn = overrideBtnRef.current;
            if (btn && mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                g.tetherOverride = true;
                g.tetherMaxT = 0;
            }
        };
        canvas.addEventListener("click", onClick);

        function update() {
            if (!G.current) return;
            const g = G.current;
            const sys = audioRef.current;
            const { ships, bullets, rocks, parts, cam, buoys } = g;
            const k = keys.current;
            const [s0, s1] = ships;
            const dist = D(s0, s1);
            const bothAlive = s0.alive && s1.alive;

            // Auto-reconnect tether when ships return within range
            if (bothAlive && dist < PROX && g.tetherOverride) {
                g.tetherOverride = false;
            }

            // Track time spent at or beyond tether limit
            if (bothAlive && !g.tetherOverride) {
                if (dist >= PROX * 0.9) g.tetherMaxT++;
                else g.tetherMaxT = Math.max(0, g.tetherMaxT - 2);
            } else {
                g.tetherMaxT = 0;
            }

            // Auto-navigation pull: ramp in as ships approach PROX
            if (bothAlive && !g.tetherOverride && dist > PROX * 0.55) {
                const pull = TETHER_PULL * Math.min(1, (dist - PROX * 0.55) / (PROX * 0.45));
                ships.forEach((s, idx) => {
                    if (!s.alive) return;
                    const other = ships[1 - idx];
                    const a = Math.atan2(other.y - s.y, other.x - s.x);
                    s.vx += Math.cos(a) * pull;
                    s.vy += Math.sin(a) * pull;
                });
            }

            // Advance shield rotation each frame
            g.shieldAng.rx = (g.shieldAng.rx + 0.008) % (Math.PI * 2);
            g.shieldAng.ry = (g.shieldAng.ry + 0.013) % (Math.PI * 2);

            const allied = bothAlive && dist < PROX;

            if (sys) sys.setShield(allied);

            if (s0.alive || s1.alive) {
                const aliveList = ships.filter(s => s.alive);
                const midX = aliveList.reduce((a, s) => a + s.x, 0) / aliveList.length;
                const midY = aliveList.reduce((a, s) => a + s.y, 0) / aliveList.length;
                buoys.forEach(b => {
                    if (!b.active && Math.hypot(b.x - midX, b.y - midY) < 180) {
                        b.active = true; g.lastSave = { x: b.x, y: b.y }; 
                        if (sys) sys.playShield();
                    }
                });
            }

            ships.forEach((s, idx) => {
                if (!s.alive) {
                    const other = ships[1 - idx];
                    if (other.alive) {
                        if (s.respawnT > 0) {
                            s.respawnT--;
                            if (s.respawnT <= 0) {
                                s.alive = true; s.hp = MAX_HP;
                                s.x = other.x + R(-40, 40); s.y = other.y + R(-40, 40);
                                s.vx = other.vx; s.vy = other.vy;
                                s.invT = INV_T * 2; cam.sh = Math.max(cam.sh, 10); 
                                if (sys) sys.playShield();
                            }
                        }
                    }
                    return;
                }

                s.thrusting = false;
                s.turningL = false;
                s.turningR = false;

                if (s.isAI) {
                    const ally = ships[1 - idx];
                    if (ally.alive) {
                        const dAlly = D(s, ally);
                        if (dAlly > 150) {
                            const angAlly = Math.atan2(ally.y - s.y, ally.x - s.x);
                            const dAng = AD(s.ang, angAlly);
                            if (Math.abs(dAng) > TURN) {
                                s.ang += Math.sign(dAng) * TURN;
                                if (dAng > 0) s.turningR = true; else s.turningL = true;
                            } else { s.ang = angAlly; s.thrusting = true; }
                        }

                        let targetRock = null; let minD = 500;
                        rocks.forEach(r => { const dR = D(s, r); if (dR < minD) { minD = dR; targetRock = r; } });
                        if (targetRock) {
                            const angRock = Math.atan2(targetRock.y - s.y, targetRock.x - s.x);
                            const dAng = AD(s.ang, angRock);
                            if (minD < 300) {
                                if (Math.abs(dAng) > TURN) {
                                    s.ang += Math.sign(dAng) * TURN;
                                    if (dAng > 0) s.turningR = true; else s.turningL = true;
                                } else s.ang = angRock;
                            }
                            if (Math.abs(dAng) < 0.2 && minD < 400 && s.fireCD <= 0) {
                                bullets.push({
                                    x: s.x + Math.cos(s.ang) * 22, y: s.y + Math.sin(s.ang) * 22,
                                    vx: Math.cos(s.ang) * BSPD + s.vx * .3, vy: Math.sin(s.ang) * BSPD + s.vy * .3,
                                    life: BLIFE, col: s.col, glow: s.glow
                                });
                                s.fireCD = FIRE_CD; if (sys) sys.playLaser(s.faction === "VYKOS");
                            }
                        }
                    } else {
                        let targetRock = null; let minD = 200;
                        rocks.forEach(r => { const dR = D(s, r); if (dR < minD) { minD = dR; targetRock = r; } });
                        if (targetRock) {
                            const angRock = Math.atan2(targetRock.y - s.y, targetRock.x - s.x);
                            const dAng = AD(s.ang, angRock + Math.PI);
                            if (Math.abs(dAng) > TURN) {
                                s.ang += Math.sign(dAng) * TURN;
                                if (dAng > 0) s.turningR = true; else s.turningL = true;
                            } else { s.ang = angRock + Math.PI; s.thrusting = true; }
                        }
                    }
                } else {
                    if (k.has(s.controls.rL)) { s.ang -= TURN; s.turningL = true; }
                    if (k.has(s.controls.rR)) { s.ang += TURN; s.turningR = true; }
                    s.thrusting = k.has(s.controls.thr);
                    if (k.has(s.controls.fire) && s.fireCD <= 0) {
                        bullets.push({
                            x: s.x + Math.cos(s.ang) * 22, y: s.y + Math.sin(s.ang) * 22,
                            vx: Math.cos(s.ang) * BSPD + s.vx * .3, vy: Math.sin(s.ang) * BSPD + s.vy * .3,
                            life: BLIFE, col: s.col, glow: s.glow
                        });
                        s.fireCD = FIRE_CD; if (sys) sys.playLaser(s.faction === "VYKOS");
                    }
                }

                if (s.thrusting) {
                    s.vx += Math.cos(s.ang) * REAL_THR; s.vy += Math.sin(s.ang) * REAL_THR;
                    const sp = Math.hypot(s.vx, s.vy);
                    if (sp > REAL_MAX_SPD) { s.vx = s.vx / sp * REAL_MAX_SPD; s.vy = s.vy / sp * REAL_MAX_SPD; }
                    if (g.frame % 3 === 0 && sys) sys.playThrust(0.5);
                }

                s.vx *= REAL_DRAG; s.vy *= REAL_DRAG;
                s.x += s.vx; s.y += s.vy;
                if (s.x < 0) s.x = WW; if (s.x > WW) s.x = 0; if (s.y < 0) s.y = WH; if (s.y > WH) s.y = 0;
                s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 30) s.trail.shift();
                if (s.fireCD > 0) s.fireCD--; if (s.invT > 0) s.invT--;
            });

            const bothIn = ships.every(s => s.alive && D(s, { x: EX, y: EY }) < ER);
            if (bothIn) { g.escT++; if (g.escT >= ESCAPE_HOLD) { setPhase("win"); return; } }
            else g.escT = Math.max(0, g.escT - 1);

            const bKill = new Set(), rKill = new Set(), rNew = [];
            bullets.forEach((b, bi) => {
                b.x += b.vx; b.y += b.vy; b.life--;
                if (b.x < 0) b.x = WW; if (b.x > WW) b.x = 0; if (b.y < 0) b.y = WH; if (b.y > WH) b.y = 0;
                if (b.life <= 0) { bKill.add(bi); return; }
                rocks.forEach((r, ri) => {
                    if (rKill.has(ri) || bKill.has(bi)) return;
                    if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
                        bKill.add(bi); parts.push(...sparks(b.x, b.y, b.col, (gfxMode === "rtx" ? 10 : 5), .7));
                        r.hp--;
                        if (r.hp <= 0) {
                            rKill.add(ri);
                            cam.sh = Math.max(cam.sh, r.tier === 0 ? 8 : r.tier === 1 ? 5 : 2);
                            if (sys) sys.playExplosion();
                            const pCount = (gfxMode === "rtx" ? 2 : 1) * (r.tier === 0 ? 20 : r.tier === 1 ? 12 : 6);
                            parts.push(...sparks(r.x, r.y, r.tier === 0 ? "#665" : r.tier === 1 ? "#998" : "#bbb", pCount, r.tier === 0 ? 1.6 : 1.1));
                            
                            // Space Ghost Skeletons logic
                            if (Math.random() < 0.12) {
                                parts.push({
                                    x: r.x, y: r.y, vx: r.vx * 0.5, vy: r.vy * 0.5,
                                    life: 3.5, type: "ghost", rot: R(0, Math.PI * 2), spin: R(-0.02, 0.02)
                                });
                            }

                            if (r.tier < 2 && rocks.length < MAX_ROC) {
                                for (let n = 0; n < TIERS[r.tier].next; n++) {
                                    const na = R(0, Math.PI * 2), nt = r.tier + 1, ntd = TIERS[nt];
                                    rNew.push({
                                        x: r.x + Math.cos(na) * r.r * .8, y: r.y + Math.sin(na) * r.r * .8,
                                        vx: Math.cos(na) * R(ntd.spd * .7, ntd.spd * 1.4), vy: Math.sin(na) * R(ntd.spd * .7, ntd.spd * 1.4),
                                        rot: R(0, Math.PI * 2), spin: R(-.03, .03), tier: nt, hp: ntd.hp, r: ntd.r,
                                        pts: poly(Math.floor(R(6, 11)), ntd.r), id: Math.random()
                                    });
                                }
                            }
                        }
                    }
                });
            });
            g.bullets = bullets.filter((_, i) => !bKill.has(i));
            g.rocks = [...rocks.filter((_, i) => !rKill.has(i)), ...rNew];

            let wipeout = false;
            g.rocks.forEach(r => {
                r.x += r.vx; r.y += r.vy; r.rot += r.spin;
                if (r.x < -90) r.x = WW + 90; if (r.x > WW + 90) r.x = -90;
                if (r.y < -90) r.y = WH + 90; if (r.y > WH + 90) r.y = -90;
                ships.forEach(s => {
                    if (!s.alive || s.invT > 0) return;
                    if (Math.hypot(s.x - r.x, s.y - r.y) < r.r + 13) {
                        const dmg = (3 - r.tier) * 10 * (allied ? .72 : 1);
                        s.hp -= dmg; s.invT = INV_T; cam.sh = Math.max(cam.sh, 14);
                        if (sys) sys.playExplosion();
                        parts.push(...sparks(s.x, s.y, s.col, (gfxMode === "rtx" ? 18 : 9), 1));
                        if (s.hp <= 0) {
                            s.hp = 0; s.alive = false; s.respawnT = RESPAWN_T; cam.sh = 24;
                            parts.push(...sparks(s.x, s.y, s.col, (gfxMode === "rtx" ? 64 : 32), 2));
                            parts.push({ type: "shockwave", x: s.x, y: s.y, life: 1, col: s.col });
                            if (!ships[0].alive && !ships[1].alive) wipeout = true;
                        }
                    }
                });
            });

            if (wipeout) {
                setTimeout(() => {
                    if (!G.current) return;
                    if (!G.current.ships[0].alive && !G.current.ships[1].alive) {
                        const ls = G.current.lastSave;
                        initMapAt(ls.x, ls.y);
                        // Restore buoys
                        if (G.current) {
                           g.buoys.forEach((b, i) => { if (G.current.buoys[i]) G.current.buoys[i].active = b.active; });
                           G.current.lastSave = ls;
                        }
                    }
                }, 1800);
            }

            g.parts = parts.filter(p => {
                p.x += (p.vx || 0); p.y += (p.vy || 0);
                if (p.type === "ghost") { p.rot += p.spin; p.life -= 0.008; }
                else if (p.type === "shockwave") { p.life -= 0.032; }
                else { p.vx *= .955; p.vy *= .955; p.life -= .016; }
                return p.life > 0;
            });

            if (++g.spawnT >= SPAWN_INT && g.rocks.length < MAX_ROC) {
                g.spawnT = 0;
                const e = Math.floor(R(0, 4));
                const [sx, sy] = e === 0 ? [R(0, WW), 55] : e === 1 ? [R(0, WW), WH - 55] : e === 2 ? [55, R(300, WH - 300)] : [WW - 55, R(300, WH - 300)];
                const nr = mkRock(Math.random() < .5 ? 0 : Math.random() < .55 ? 1 : 2); nr.x = sx; nr.y = sy; g.rocks.push(nr);
            }

            const aliveList = ships.filter(s => s.alive);
            if (aliveList.length) {
                const cx = aliveList.reduce((a, s) => a + s.x, 0) / aliveList.length;
                const cy = aliveList.reduce((a, s) => a + s.y, 0) / aliveList.length;
                const sep = aliveList.length === 2 ? D(aliveList[0], aliveList[1]) : 0;
                cam.tx = cx; cam.ty = cy; cam.tz = aliveList.length === 2 ? Math.max(.42, Math.min(1.08, 570 / (sep + 175))) : 1.05;
                cam.x = L(cam.x, cam.tx, .055); cam.y = L(cam.y, cam.ty, .055); cam.z = L(cam.z, cam.tz, .028);
                cam.sh *= .86;
            } else { cam.sh *= .86; }
            g.frame++;
        }

        function render() {
            if (!G.current) return;
            const ctx = canvas.getContext("2d", { alpha: false });
            const octx = gfxCvs.current.getContext("2d");
            const isVex = gfxMode === "vectrex";
            const isRtx = gfxMode === "rtx";
            const g = G.current;
            const { ships, bullets, rocks, parts, cam, escT, frame, buoys } = g;

            // Pre-compute nav targets once per frame
            const navAlive = ships.filter(s => s.alive);
            const navCX = navAlive.length ? navAlive.reduce((a, s) => a + s.x, 0) / navAlive.length : cam.x;
            const navCY = navAlive.length ? navAlive.reduce((a, s) => a + s.y, 0) / navAlive.length : cam.y;
            const nextWP = navAlive.length
                ? buoys.filter(b => !b.active).sort((a, b) =>
                    Math.hypot(a.x - navCX, a.y - navCY) - Math.hypot(b.x - navCX, b.y - navCY))[0]
                : null;

            ctx.fillStyle = isVex ? "#000" : "#020409";
            ctx.fillRect(0, 0, CW, CH);
            octx.clearRect(0, 0, CW, CH);

            // ── Atmospheric background (non-vectrex, screen-space) ────────────
            if (!isVex) {
                ctx.save();
                // Nebula haze blobs
                [
                    [CW * 0.68, CH * 0.32, CW * 0.52, "rgba(90,55,18,0.07)"],
                    [CW * 0.22, CH * 0.58, CW * 0.42, "rgba(18,44,90,0.08)"],
                    [CW * 0.5,  CH * 0.75, CW * 0.38, "rgba(55,18,80,0.05)"]
                ].forEach(([nx, ny, nr, nc]) => {
                    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
                    ng.addColorStop(0, nc); ng.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
                });
                // Distant planet limb — lower-left, barely moves (0.025 parallax)
                const pox = (cam.x - WW / 2) * 0.025, poy = (cam.y - WH / 2) * 0.025;
                const px = CW * 0.1 - pox, py = CH * 0.88 - poy, pr = Math.min(CW, CH) * 0.54;
                const pg = ctx.createRadialGradient(px, py, pr * 0.28, px, py, pr);
                pg.addColorStop(0, "rgba(105,72,22,0.22)");
                pg.addColorStop(0.55, "rgba(68,44,12,0.14)");
                pg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }

            const sx = cam.sh > 0 ? R(-cam.sh, cam.sh) : 0, sy = cam.sh > 0 ? R(-cam.sh, cam.sh) : 0;
            ctx.save();
            ctx.translate(CW / 2 + sx, CH / 2 + sy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);

            if (!isVex) {
                const PLX = [.06, .16, .32];
                STARS.forEach((layer, li) => {
                    layer.forEach(s => {
                        const ox = (cam.x - WW / 2) * PLX[li], oy = (cam.y - WH / 2) * PLX[li];
                        const dx = ((s.x - ox) % WW + WW) % WW, dy = ((s.y - oy) % WH + WH) % WH;
                        ctx.globalAlpha = s.a; ctx.fillStyle = "#fff";
                        ctx.beginPath(); ctx.arc(dx, dy, s.r, 0, Math.PI * 2); ctx.fill();
                    });
                }); ctx.globalAlpha = 1;
            } else {
                // Vectrex phosphor star field — fixed sparse dots
                ctx.fillStyle = VEX_COL;
                STARS[2].forEach(s => {
                    const ox = (cam.x - WW / 2) * 0.32, oy = (cam.y - WH / 2) * 0.32;
                    const dx = ((s.x - ox) % WW + WW) % WW, dy = ((s.y - oy) % WH + WH) % WH;
                    ctx.globalAlpha = s.a * 0.6;
                    ctx.fillRect(dx, dy, 1, 1);
                });
                ctx.globalAlpha = 1;
            }

            // ── Escape zone target rings ──────────────────────────────────────
            {
                const pulse = 0.96 + 0.04 * Math.sin(frame * 0.025);
                if (!isVex) {
                    ctx.save();
                    [[ER, 0.55, 1.5], [ER * 1.22 * pulse, 0.28, 1], [ER * 1.5 * pulse, 0.12, 1]].forEach(([r, a, lw]) => {
                        ctx.beginPath(); ctx.arc(EX, EY, r, 0, Math.PI * 2);
                        ctx.strokeStyle = "#ffcc44"; ctx.lineWidth = lw;
                        ctx.globalAlpha = a; ctx.shadowColor = "#ffcc44"; ctx.shadowBlur = 10;
                        ctx.stroke();
                    });
                    if (escT > 0) {
                        const sw = frame * 0.05;
                        ctx.globalAlpha = Math.min(1, escT / 30) * 0.18;
                        ctx.fillStyle = "rgba(255,200,50,1)";
                        ctx.shadowBlur = 0;
                        ctx.beginPath(); ctx.moveTo(EX, EY); ctx.arc(EX, EY, ER * 1.55, sw, sw + 0.55); ctx.closePath(); ctx.fill();
                    }
                    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
                    ctx.restore();
                } else {
                    ctx.beginPath(); ctx.arc(EX, EY, ER, 0, Math.PI * 2);
                    ctx.strokeStyle = VEX_COL; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.4; ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }

            const drawGlow = (col, rad) => {
                if (!isVex) { ctx.shadowBlur = isRtx ? rad * 1.5 : rad; ctx.shadowColor = col; }
            };

            buoys.forEach(b => {
                const bp = .8 + .2 * Math.sin(frame * 0.05);
                ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
                const buoyCol = b.active ? "#00ff88" : "#0088ff";
                ctx.strokeStyle = isVex ? VEX_COL : buoyCol;
                ctx.lineWidth = isVex ? 1.5 : 1;
                ctx.globalAlpha = isVex ? bp * 0.7 : 1;
                drawGlow(buoyCol, 10);
                isVex ? ctx.stroke() : (ctx.fillStyle = buoyCol, ctx.fill());
                ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            });

            // ── Next-waypoint target reticle (world space) ────────────────────
            if (nextWP) {
                const wpCol = isVex ? VEX_COL : "#ffcc44";
                const tr = 24 + 3 * Math.sin(frame * 0.07);
                ctx.save();
                ctx.strokeStyle = wpCol;
                ctx.lineWidth = isVex ? 1 : 1.5;
                ctx.globalAlpha = 0.85;
                if (!isVex) { ctx.shadowColor = wpCol; ctx.shadowBlur = 8; }
                // Dashed orbit ring
                ctx.setLineDash([5, 5]);
                ctx.beginPath(); ctx.arc(nextWP.x, nextWP.y, tr, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                // Four axis ticks extending outward
                [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
                    const cos = Math.cos(a), sin = Math.sin(a);
                    ctx.beginPath();
                    ctx.moveTo(nextWP.x + cos * (tr + 2), nextWP.y + sin * (tr + 2));
                    ctx.lineTo(nextWP.x + cos * (tr + 9), nextWP.y + sin * (tr + 9));
                    ctx.stroke();
                });
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            rocks.forEach(r => {
                // Motion blur trail (non-vectrex, moving rocks)
                if (!isVex) {
                    const spd2 = r.vx * r.vx + r.vy * r.vy;
                    if (spd2 > 0.08) {
                        ctx.save();
                        ctx.translate(r.x - r.vx * 2, r.y - r.vy * 2); ctx.rotate(r.rot - r.spin * 2);
                        ctx.beginPath();
                        r.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
                        ctx.closePath();
                        ctx.fillStyle = ROCK_FILL_COLS[r.tier]; ctx.globalAlpha = 0.22;
                        ctx.fill(); ctx.restore();
                        ctx.globalAlpha = 1;
                    }
                }
                ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
                ctx.beginPath();
                r.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
                ctx.closePath();
                if (isVex) {
                    ctx.strokeStyle = VEX_COL; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
                } else {
                    ctx.fillStyle = ROCK_FILL_COLS[r.tier]; ctx.fill();
                    ctx.strokeStyle = ROCK_STROKE_COLS[r.tier]; ctx.lineWidth = isRtx ? 2 : 1.5; ctx.stroke();
                }
                ctx.restore();
            });

            bullets.forEach(b => {
                const al = b.life / BLIFE;
                ctx.globalAlpha = al; ctx.fillStyle = isVex ? VEX_COL : b.col;
                drawGlow(b.glow, isRtx ? 20 : 16);
                ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            parts.forEach(p => {
                if (p.type === "shockwave") {
                    const sr = (1 - p.life) * 135;
                    ctx.save();
                    ctx.globalAlpha = p.life * (isVex ? 0.5 : 0.8);
                    ctx.strokeStyle = isVex ? VEX_COL : p.col;
                    ctx.lineWidth = isVex ? 1 : Math.max(0.5, 3.5 * p.life);
                    if (!isVex) { ctx.shadowColor = p.col; ctx.shadowBlur = 18; }
                    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, sr), 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                    return;
                }
                ctx.globalAlpha = p.life; ctx.fillStyle = isVex ? VEX_COL : (p.col || "#fff");
                if (p.type === "ghost") {
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    const gc = isVex ? VEX_COL : "rgba(255,255,255,0.4)";
                    ctx.strokeStyle = gc; ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(0, 0, 8, Math.PI, 0); ctx.lineTo(6, 10); ctx.lineTo(-6, 10); ctx.closePath();
                    ctx.stroke();
                    ctx.beginPath(); ctx.arc(-3, -2, 1.5, 0, Math.PI * 2); ctx.stroke();
                    ctx.beginPath(); ctx.arc(3, -2, 1.5, 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                } else {
                    if (!isVex) { ctx.shadowColor = p.col || "#fff"; ctx.shadowBlur = isRtx ? 6 : 0; }
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            ships.forEach(s => {
                if (!s.alive) return;
                const blink = s.invT > 0 && Math.floor(frame / 4) % 2 === 0;
                const isVykos = s.glow.startsWith("#ff");
                const deepCorona = isVykos ? "rgba(80,8,0," : "rgba(0,8,75,";

                // ── Thruster flames ───────────────────────────────────────────
                const drawThruster = (tx, ty, _tang, size) => {
                    if (isVex) {
                        // Vectrex: single dot
                        ctx.globalAlpha = 0.7;
                        ctx.fillStyle = VEX_COL;
                        ctx.beginPath(); ctx.arc(tx, ty, size * 0.15, 0, Math.PI * 2); ctx.fill();
                        ctx.globalAlpha = 1;
                        return;
                    }
                    const fl = R(size * 0.5, size * 1.7);
                    // Layer 1 — deep corona (complement, wide)
                    const ef3 = ctx.createRadialGradient(tx, ty, 0, tx, ty, fl * 1.85);
                    ef3.addColorStop(0, deepCorona + "0.28)"); ef3.addColorStop(1, deepCorona + "0)");
                    ctx.fillStyle = ef3; ctx.beginPath(); ctx.arc(tx, ty, fl * 1.85, 0, Math.PI * 2); ctx.fill();
                    // Layer 2 — faction colour mid
                    const ef2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, fl);
                    ef2.addColorStop(0, s.col + "cc"); ef2.addColorStop(0.5, s.col + "55"); ef2.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = ef2; ctx.beginPath(); ctx.arc(tx, ty, fl, 0, Math.PI * 2); ctx.fill();
                    // Layer 3 — hot white plasma core
                    const ef1 = ctx.createRadialGradient(tx, ty, 0, tx, ty, fl * 0.2);
                    ef1.addColorStop(0, "rgba(255,255,225,0.95)"); ef1.addColorStop(1, "rgba(255,255,225,0)");
                    ctx.fillStyle = ef1; ctx.beginPath(); ctx.arc(tx, ty, fl * 0.2, 0, Math.PI * 2); ctx.fill();
                };

                if (s.thrusting) drawThruster(s.x - Math.cos(s.ang) * 22, s.y - Math.sin(s.ang) * 22, s.ang, 35);
                if (s.turningL) drawThruster(s.x + Math.cos(s.ang + 0.6) * 18, s.y + Math.sin(s.ang + 0.6) * 18, s.ang, 12);
                if (s.turningR) drawThruster(s.x + Math.cos(s.ang - 0.6) * 18, s.y + Math.sin(s.ang - 0.6) * 18, s.ang, 12);

                if (!blink) {
                    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang + Math.PI / 2);
                    drawGlow(s.glow, isRtx ? 30 : 20);

                    // Hull path (reused for fill + clip reference)
                    const hullPath = () => {
                        ctx.beginPath();
                        ctx.moveTo(0, -26); ctx.lineTo(8, -10); ctx.lineTo(16, 10); ctx.lineTo(16, 20);
                        ctx.lineTo(6, 16); ctx.lineTo(0, 22); ctx.lineTo(-6, 16); ctx.lineTo(-16, 20);
                        ctx.lineTo(-16, 10); ctx.lineTo(-8, -10); ctx.closePath();
                    };
                    hullPath();

                    if (isVex) {
                        ctx.strokeStyle = VEX_COL; ctx.lineWidth = 1.5; ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
                    } else {
                        ctx.fillStyle = s.col; ctx.fill();

                        // Panel stripe — Foss-style hull marking
                        ctx.save();
                        ctx.clip(); // clip to hull shape
                        ctx.fillStyle = s.glow + "44";
                        ctx.fillRect(-14, 3, 28, 5);
                        ctx.fillStyle = s.glow + "66";
                        ctx.fillRect(-14, 3, 9, 5);
                        ctx.restore();

                        // Hull outline
                        hullPath();
                        ctx.strokeStyle = isRtx ? "#ffffff" : s.glow; ctx.lineWidth = 2; ctx.stroke();

                        // Edge highlight — leading edges catch the light
                        ctx.strokeStyle = s.glow + "99"; ctx.lineWidth = 1;
                        ctx.shadowColor = s.glow; ctx.shadowBlur = isRtx ? 8 : 4;
                        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(8, -10); ctx.lineTo(16, 10); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-8, -10); ctx.lineTo(-16, 10); ctx.stroke();
                        ctx.shadowBlur = 0;

                        // Iridescent cockpit — thin-film canopy lens
                        const hue = (frame * 1.8 + (isVykos ? 0 : 180)) % 360;
                        ctx.fillStyle = `hsla(${hue},65%,75%,0.58)`;
                        ctx.beginPath(); ctx.ellipse(0, -10, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
                        // Canopy glint
                        ctx.fillStyle = "rgba(255,255,255,0.5)";
                        ctx.beginPath(); ctx.ellipse(-1, -13, 1.5, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.restore();
                }
            });

            // ── Shield wireframes ─────────────────────────────────────────────
            const { shieldAng, tetherOverride, tetherMaxT } = g;
            const [ss0, ss1] = ships;
            const shDist = (ss0.alive && ss1.alive) ? D(ss0, ss1) : 0;
            const shAllied = ss0.alive && ss1.alive && shDist < PROX;

            if (shAllied) {
                // Merged dodecahedron centered between ships
                const mx = (ss0.x + ss1.x) / 2, my = (ss0.y + ss1.y) / 2;
                const dodecScale = Math.max(28, (shDist / 2 + 32) / _S3);
                drawWire(ctx, DODEC_V, DODEC_E, shieldAng.rx, shieldAng.ry, dodecScale,
                    mx, my, isVex ? "#fff" : "#88ddff", isVex ? 0.35 : 0.45, 1);
            } else {
                // Individual cube shields on each alive ship
                ships.forEach(s => {
                    if (!s.alive) return;
                    const cubeCol = isVex ? "#fff" : s.glow;
                    drawWire(ctx, CUBE_V, CUBE_E, shieldAng.rx, shieldAng.ry, 21,
                        s.x, s.y, cubeCol, 0.5, 1.2);
                });
            }

            // ── Tether energy conduit ─────────────────────────────────────────
            if (ss0.alive && ss1.alive && !tetherOverride) {
                const flashingRed = tetherMaxT >= TETHER_FLASH_T && Math.sin(g.frame * Math.PI / 12) > 0;
                ctx.save();
                if (isVex) {
                    // Vectrex: single clean phosphor line
                    ctx.strokeStyle = flashingRed ? "#e8ffdf" : "rgba(232,255,223,0.35)";
                    ctx.lineWidth = flashingRed ? 1.5 : 0.8;
                    ctx.beginPath(); ctx.moveTo(ss0.x, ss0.y); ctx.lineTo(ss1.x, ss1.y); ctx.stroke();
                } else {
                    // Normal/RTX: three-layer energy conduit
                    const outerC = flashingRed ? "rgba(255,55,0,0.14)"  : "rgba(30,90,200,0.14)";
                    const midC   = flashingRed ? "rgba(255,80,20,0.38)" : "rgba(80,160,255,0.32)";
                    const coreC  = flashingRed ? "#ff7755"               : "#cce8ff";
                    // Outer glow tube
                    ctx.strokeStyle = outerC; ctx.lineWidth = 6; ctx.beginPath();
                    ctx.moveTo(ss0.x, ss0.y); ctx.lineTo(ss1.x, ss1.y); ctx.stroke();
                    // Mid tube
                    ctx.strokeStyle = midC; ctx.lineWidth = 2.5; ctx.beginPath();
                    ctx.moveTo(ss0.x, ss0.y); ctx.lineTo(ss1.x, ss1.y); ctx.stroke();
                    // Core thread
                    ctx.strokeStyle = coreC; ctx.lineWidth = 0.8;
                    ctx.shadowColor = coreC; ctx.shadowBlur = flashingRed ? 12 : 6;
                    ctx.beginPath(); ctx.moveTo(ss0.x, ss0.y); ctx.lineTo(ss1.x, ss1.y); ctx.stroke();
                    ctx.shadowBlur = 0;
                }
                ctx.restore();
            }

            ctx.restore();

            // ── Vectrex CRT overlay ───────────────────────────────────────────
            if (isVex) {
                // Scanlines (pre-rendered offscreen)
                if (scanCanvas) ctx.drawImage(scanCanvas, 0, 0);
                // Vignette
                const vig = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.22, CW / 2, CH / 2, CH * 0.72);
                vig.addColorStop(0, "rgba(0,0,0,0)");
                vig.addColorStop(1, "rgba(0,0,0,0.58)");
                ctx.fillStyle = vig; ctx.fillRect(0, 0, CW, CH);
            }

            // ── HUD ───────────────────────────────────────────────────────────
            // Cockpit instrument shelf line
            ctx.fillStyle = isVex ? `${VEX_COL}18` : "rgba(255,255,255,0.05)";
            ctx.fillRect(0, CH - 72, CW, 1);

            ships.forEach((s, i) => {
                const lft = i === 0;
                const bw = 162, bh = 10, bx = lft ? 20 : CW - 20 - bw, by = CH - 50;
                const hp = Math.max(0, s.hp / 100);
                const barCol = hp > 0.5 ? s.col : hp > 0.25 ? "#ffb300" : "#ff2200";
                ctx.textAlign = lft ? "left" : "right";

                if (isVex) {
                    // Vectrex: text-only phosphor readout
                    const SEGS = 10, filled = Math.round(hp * SEGS);
                    const hpBar = "■".repeat(filled) + "□".repeat(SEGS - filled);
                    ctx.fillStyle = VEX_COL;
                    ctx.font = "bold 11px 'Orbitron',sans-serif";
                    ctx.fillText(s.name, lft ? bx : bx + bw, by - 20);
                    ctx.font = "10px 'Courier New',monospace";
                    ctx.fillText(hpBar, lft ? bx : bx + bw, by - 4);
                } else {
                    // Micro-label
                    ctx.fillStyle = s.col + "77";
                    ctx.font = "7px 'Orbitron',sans-serif";
                    ctx.fillText("PILOT INTEGRITY", lft ? bx : bx + bw, by - 26);

                    // Ship name + underline nameplate
                    ctx.fillStyle = s.col;
                    ctx.font = `bold 14px 'Orbitron',sans-serif`;
                    const nameStr = s.name + (s.isAI ? " (AI)" : "");
                    ctx.fillText(nameStr, lft ? bx : bx + bw, by - 14);
                    const nmW = Math.min(ctx.measureText(nameStr).width, bw);
                    ctx.strokeStyle = s.col + "99"; ctx.lineWidth = 1;
                    ctx.beginPath();
                    if (lft) { ctx.moveTo(bx, by - 11); ctx.lineTo(bx + nmW, by - 11); }
                    else     { ctx.moveTo(bx + bw - nmW, by - 11); ctx.lineTo(bx + bw, by - 11); }
                    ctx.stroke();

                    // Corner brackets
                    const bk = 6;
                    ctx.strokeStyle = s.col + "66"; ctx.lineWidth = 1;
                    ctx.beginPath();
                    if (lft) {
                        ctx.moveTo(bx - 5 + bk, by - 2); ctx.lineTo(bx - 5, by - 2);
                        ctx.lineTo(bx - 5, by + bh + 2); ctx.lineTo(bx - 5 + bk, by + bh + 2);
                    } else {
                        ctx.moveTo(bx + bw + 5 - bk, by - 2); ctx.lineTo(bx + bw + 5, by - 2);
                        ctx.lineTo(bx + bw + 5, by + bh + 2); ctx.lineTo(bx + bw + 5 - bk, by + bh + 2);
                    }
                    ctx.stroke();

                    // Segmented LED health bar
                    const SEGS = 10, gap = 2, segW = (bw - gap * (SEGS - 1)) / SEGS;
                    const filledSegs = Math.ceil(hp * SEGS);
                    for (let j = 0; j < SEGS; j++) {
                        const sx2 = bx + j * (segW + gap);
                        ctx.fillStyle = j < filledSegs ? barCol : "rgba(255,255,255,0.07)";
                        if (j < filledSegs) {
                            ctx.shadowColor = barCol;
                            ctx.shadowBlur = hp <= 0.3 && j < filledSegs ? 8 : (isRtx ? 4 : 0);
                        } else { ctx.shadowBlur = 0; }
                        ctx.fillRect(sx2, by, segW, bh);
                    }
                    ctx.shadowBlur = 0;
                }
            });

            // ── Navigation indicators (screen space) ─────────────────────────
            if (navAlive.length > 0) {
                const navCol = isVex ? VEX_COL : "#ffcc44";
                const PAD = 42; // px from viewport edge

                if (nextWP) {
                    const distWP = Math.round(Math.hypot(nextWP.x - navCX, nextWP.y - navCY));
                    const [wpSX, wpSY] = w2s(nextWP.x, nextWP.y, cam, CW, CH);
                    renderNavIndicator(ctx, wpSX, wpSY, distWP, false, navCol, CW, CH, PAD, isVex, (24 + 12) * cam.z);
                }

                const distEH = Math.max(0, Math.round(Math.hypot(EX - navCX, EY - navCY) - ER));
                const [ehSX, ehSY] = w2s(EX, EY, cam, CW, CH);
                renderNavIndicator(ctx, ehSX, ehSY, distEH === 0 ? "ENTER" : distEH, true, navCol, CW, CH, PAD, isVex, (ER * 1.5 + 10) * cam.z);
            }

            // Override tether button (appears after 5 s at max tether distance)
            const { tetherOverride: tOvr, tetherMaxT: tMaxT } = g;
            const [hs0, hs1] = ships;
            const showOverrideBtn = hs0.alive && hs1.alive && !tOvr && tMaxT >= TETHER_FLASH_T;
            const BTN_W = 230, BTN_H = 38;
            const btnX = CW / 2 - BTN_W / 2, btnY = CH - 102;
            overrideBtnRef.current = showOverrideBtn ? { x: btnX, y: btnY, w: BTN_W, h: BTN_H } : null;
            if (showOverrideBtn) {
                const pulse = 0.65 + 0.35 * Math.abs(Math.sin(g.frame * 0.08));
                ctx.save();
                ctx.globalAlpha = pulse;
                ctx.fillStyle = "rgba(160,0,0,0.8)";
                ctx.strokeStyle = "#ff3300"; ctx.lineWidth = 2;
                ctx.shadowColor = "#ff2200"; ctx.shadowBlur = 16;
                ctx.fillRect(btnX, btnY, BTN_W, BTN_H);
                ctx.strokeRect(btnX, btnY, BTN_W, BTN_H);
                ctx.globalAlpha = 1;
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 13px 'Orbitron',sans-serif";
                ctx.textAlign = "center";
                ctx.shadowBlur = 0;
                ctx.fillText("OVERRIDE TETHER", CW / 2, btnY + 24);
                ctx.restore();
            } else if (tOvr && hs0.alive && hs1.alive) {
                // Show reconnect hint when overridden
                ctx.save();
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = "#88aacc";
                ctx.font = "12px 'Orbitron',sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("TETHER RELEASED — return to range to reconnect", CW / 2, CH - 74);
                ctx.restore();
            }
        }

        function loop() {
            update(); render();
            raf.current = requestAnimationFrame(loop);
        }

        initMapAt(WW / 2, WH - 230);
        raf.current = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf.current);
            window.removeEventListener("resize", resize);
            window.removeEventListener("keydown", onKD);
            window.removeEventListener("keyup", onKU);
            canvas.removeEventListener("click", onClick);
        };
    }, [players, p1Faction, gfxMode, setPhase]);

    return (
        <>
            <canvas ref={cvs} style={{ width: "100%", height: "100%", display: "block", position: "absolute", left: 0, top: 0 }} />
            <canvas ref={gfxCvs} style={{ width: "100%", height: "100%", display: "block", position: "absolute", left: 0, top: 0, pointerEvents: "none" }} />
        </>
    );
}
