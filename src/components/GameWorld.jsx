import React, { useEffect, useRef } from 'react';
import {
    WW, WH, EX, EY, ER, MAX_HP, DRAG, TURN, THR, MAX_SPD,
    BSPD, BLIFE, FIRE_CD, INV_T, PROX, ESCAPE_HOLD, RESPAWN_T,
    SPAWN_INT, MAX_ROC, INIT_ROC, TIERS, FACTIONS, BUOYS, STARS,
    R, L, D, AD, poly, mkRock, mkShip, sparks, AudioSys
} from '../gameLogic';

// Slower, more realistic movement
const REAL_THR = THR * 0.65;
const REAL_MAX_SPD = MAX_SPD * 0.75;
const REAL_DRAG = 0.992; // Less drag for more space feel

export default function GameWorld({ players, p1Faction, gfxMode, setPhase }) {
    const cvs = useRef(null);
    const gfxCvs = useRef(null);
    const G = useRef(null);
    const keys = useRef(new Set());
    const audioRef = useRef(null);
    const raf = useRef(null);

    const CTRL1 = { rL: "KeyA", rR: "KeyD", thr: "KeyW", fire: "Space" };
    const CTRL2 = { rL: "ArrowLeft", rR: "ArrowRight", thr: "ArrowUp", fire: "ShiftRight" };

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
            lastSave: { x: x, y: y }
        };
    }

    useEffect(() => {
        const canvas = cvs.current;
        const overlay = gfxCvs.current;
        let CW = 0, CH = 0;

        function resize() {
            CW = canvas.width = canvas.offsetWidth;
            CH = canvas.height = canvas.offsetHeight;
            overlay.width = CW;
            overlay.height = CH;
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

        function update() {
            if (!G.current) return;
            const g = G.current;
            const sys = audioRef.current;
            const { ships, bullets, rocks, parts, cam, buoys } = g;
            const k = keys.current;
            const [s0, s1] = ships;
            const allied = s0.alive && s1.alive && D(s0, s1) < PROX;

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

            ctx.fillStyle = isVex ? "#000" : "#020409";
            ctx.fillRect(0, 0, CW, CH);
            octx.clearRect(0, 0, CW, CH);

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
            }

            const drawGlow = (col, rad) => {
                if (!isVex) { ctx.shadowBlur = isRtx ? rad * 1.5 : rad; ctx.shadowColor = col; }
            };

            buoys.forEach(b => {
                const p = .8 + .2 * Math.sin(frame * 0.05);
                ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
                ctx.strokeStyle = b.active ? "#00ff88" : "#0088ff";
                ctx.lineWidth = isVex ? 2 : 1;
                drawGlow(ctx.strokeStyle, 10);
                isVex ? ctx.stroke() : (ctx.fillStyle = ctx.strokeStyle, ctx.fill());
                ctx.shadowBlur = 0;
            });

            rocks.forEach(r => {
                ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
                ctx.beginPath();
                r.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
                ctx.closePath();
                if (isVex) {
                    ctx.strokeStyle = "#888"; ctx.lineWidth = 2; ctx.stroke();
                } else {
                    ctx.fillStyle = ["#38342e", "#4a4642", "#5e5a56"][r.tier]; ctx.fill();
                    ctx.strokeStyle = ["#5c5852", "#787470", "#9a9896"][r.tier]; ctx.lineWidth = isRtx ? 2 : 1.5; ctx.stroke();
                }
                ctx.restore();
            });

            bullets.forEach(b => {
                const al = b.life / BLIFE;
                ctx.globalAlpha = al; ctx.fillStyle = isVex ? "#fff" : b.col;
                drawGlow(b.glow, isRtx ? 20 : 16);
                ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            parts.forEach(p => {
                ctx.globalAlpha = p.life; ctx.fillStyle = isVex ? "#fff" : (p.col || "#fff");
                if (p.type === "ghost") {
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
                    ctx.beginPath(); // Simple skull-ish wireframe
                    ctx.arc(0, 0, 8, Math.PI, 0); ctx.lineTo(6, 10); ctx.lineTo(-6, 10); ctx.closePath();
                    ctx.stroke();
                    ctx.beginPath(); ctx.arc(-3, -2, 1.5, 0, Math.PI*2); ctx.stroke();
                    ctx.beginPath(); ctx.arc(3, -2, 1.5, 0, Math.PI*2); ctx.stroke();
                    ctx.restore();
                } else {
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
                }
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            ships.forEach(s => {
                if (!s.alive) return;
                const blink = s.invT > 0 && Math.floor(frame / 4) % 2 === 0;
                
                // Thruster animations
                const drawThruster = (tx, ty, tang, size) => {
                    const fl = R(size * 0.6, size * 1.4);
                    const ef = ctx.createRadialGradient(tx, ty, 0, tx, ty, fl);
                    ef.addColorStop(0, "rgba(255,255,210,0.9)"); ef.addColorStop(0.3, s.col + "cc"); ef.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = ef; ctx.beginPath(); ctx.arc(tx, ty, fl, 0, Math.PI * 2); ctx.fill();
                };

                if (s.thrusting) drawThruster(s.x - Math.cos(s.ang) * 22, s.y - Math.sin(s.ang) * 22, s.ang, 35);
                if (s.turningL) drawThruster(s.x + Math.cos(s.ang + 0.6) * 18, s.y + Math.sin(s.ang + 0.6) * 18, s.ang, 12);
                if (s.turningR) drawThruster(s.x + Math.cos(s.ang - 0.6) * 18, s.y + Math.sin(s.ang - 0.6) * 18, s.ang, 12);

                if (!blink) {
                    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang + Math.PI / 2);
                    drawGlow(s.glow, isRtx ? 30 : 20);
                    ctx.beginPath();
                    // Buck Rogers styled ship - more detailed wireframe
                    ctx.moveTo(0, -26); ctx.lineTo(8, -10); ctx.lineTo(16, 10); ctx.lineTo(16, 20);
                    ctx.lineTo(6, 16); ctx.lineTo(0, 22); ctx.lineTo(-6, 16); ctx.lineTo(-16, 20);
                    ctx.lineTo(-16, 10); ctx.lineTo(-8, -10); ctx.closePath();
                    
                    if (isVex) {
                        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
                    } else {
                        ctx.fillStyle = s.col; ctx.fill();
                        ctx.strokeStyle = isRtx ? "#fff" : s.glow; ctx.lineWidth = 2; ctx.stroke();
                        // Cockpit
                        ctx.fillStyle = "rgba(180,230,255,0.7)"; ctx.beginPath(); ctx.ellipse(0, -10, 4, 7, 0, 0, Math.PI*2); ctx.fill();
                    }
                    ctx.restore();
                }
            });

            ctx.restore();

            // HUD
            ships.forEach((s, i) => {
                const lft = i === 0, bw = 162, bh = 8, bx = lft ? 18 : CW - 18 - bw, by = CH - 52;
                ctx.fillStyle = s.col; ctx.font = "bold 16px 'Orbitron',sans-serif";
                ctx.textAlign = lft ? "left" : "right";
                ctx.fillText(s.name + (s.isAI ? " (AI)" : ""), lft ? bx : bx + bw, by - 24);
                const hr = Math.max(0, s.hp / 100);
                ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(bx, by, bw, bh);
                ctx.fillStyle = hr > 0.5 ? s.col : hr > 0.25 ? "#ffaa00" : "#ff2200";
                ctx.fillRect(bx, by, bw * hr, bh);
            });
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
        };
    }, [players, p1Faction, gfxMode, setPhase]);

    return (
        <>
            <canvas ref={cvs} style={{ width: "100%", height: "100%", display: "block", position: "absolute", left: 0, top: 0 }} />
            <canvas ref={gfxCvs} style={{ width: "100%", height: "100%", display: "block", position: "absolute", left: 0, top: 0, pointerEvents: "none" }} />
        </>
    );
}
