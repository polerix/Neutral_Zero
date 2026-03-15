import React, { useEffect, useRef } from 'react';
import {
    WW, WH, EX, EY, ER, MAX_HP, DRAG, TURN, THR, MAX_SPD,
    BSPD, BLIFE, FIRE_CD, INV_T, PROX, ESCAPE_HOLD, RESPAWN_T,
    SPAWN_INT, MAX_ROC, INIT_ROC, TIERS, FACTIONS, BUOYS, STARS,
    R, L, D, AD, poly, mkRock, mkShip, sparks, AudioSys
} from '../gameLogic';

export default function GameWorld({ players, p1Faction, gfxMode, setPhase }) {
    const cvs = useRef(null);
    const gfxCvs = useRef(null);
    const G = useRef(null);
    const keys = useRef(new Set());
    const audioRef = useRef(null);
    const raf = useRef(null);

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
                lastSave: { x: WW / 2, y: WH - 230 }
            };
        }

        function update() {
            const g = G.current;
            const sys = audioRef.current;
            const { ships, bullets, rocks, parts, cam, buoys } = g;
            const k = keys.current;
            const [s0, s1] = ships;
            const allied = s0.alive && s1.alive && D(s0, s1) < PROX;

            sys.setShield(allied);

            if (s0.alive || s1.alive) {
                const midX = ships.reduce((a, s) => a + (s.alive ? s.x : 0), 0) / Math.max(1, ships.filter(s => s.alive).length);
                const midY = ships.reduce((a, s) => a + (s.alive ? s.y : 0), 0) / Math.max(1, ships.filter(s => s.alive).length);
                buoys.forEach(b => {
                    if (!b.active && Math.hypot(b.x - midX, b.y - midY) < 180) {
                        b.active = true; g.lastSave = { x: b.x, y: b.y }; sys.playShield();
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
                                s.invT = INV_T * 2; cam.sh = Math.max(cam.sh, 10); sys.playShield();
                            }
                        }
                    }
                }
            });

            ships.forEach((s, idx) => {
                if (!s.alive) return;

                if (s.isAI) {
                    const ally = ships[1 - idx];
                    if (ally.alive) {
                        const dAlly = D(s, ally);
                        if (dAlly > 150) {
                            const angAlly = Math.atan2(ally.y - s.y, ally.x - s.x);
                            const dAng = AD(s.ang, angAlly);
                            if (Math.abs(dAng) > TURN) s.ang += Math.sign(dAng) * TURN;
                            else { s.ang = angAlly; s.thrusting = true; }
                        } else { s.thrusting = false; }

                        let targetRock = null; let minD = 500;
                        rocks.forEach(r => { const dR = D(s, r); if (dR < minD) { minD = dR; targetRock = r; } });
                        if (targetRock) {
                            const angRock = Math.atan2(targetRock.y - s.y, targetRock.x - s.x);
                            const dAng = AD(s.ang, angRock);
                            if (minD < 300) {
                                if (Math.abs(dAng) > TURN) s.ang += Math.sign(dAng) * TURN;
                                else s.ang = angRock;
                            }
                            if (Math.abs(dAng) < 0.2 && minD < 400 && s.fireCD <= 0) {
                                bullets.push({
                                    x: s.x + Math.cos(s.ang) * 22, y: s.y + Math.sin(s.ang) * 22,
                                    vx: Math.cos(s.ang) * BSPD + s.vx * .3, vy: Math.sin(s.ang) * BSPD + s.vy * .3,
                                    life: BLIFE, col: s.col, glow: s.glow
                                });
                                s.fireCD = FIRE_CD; sys.playLaser(s.faction === "VYKOS");
                            }
                        }
                    } else {
                        s.thrusting = false;
                        let targetRock = null; let minD = 200;
                        rocks.forEach(r => { const dR = D(s, r); if (dR < minD) { minD = dR; targetRock = r; } });
                        if (targetRock) {
                            const angRock = Math.atan2(targetRock.y - s.y, targetRock.x - s.x);
                            s.ang = angRock + Math.PI; s.thrusting = true;
                        }
                    }
                } else {
                    if (k.has(s.controls.rL)) s.ang -= TURN;
                    if (k.has(s.controls.rR)) s.ang += TURN;
                    s.thrusting = k.has(s.controls.thr);
                    if (k.has(s.controls.fire) && s.fireCD <= 0) {
                        bullets.push({
                            x: s.x + Math.cos(s.ang) * 22, y: s.y + Math.sin(s.ang) * 22,
                            vx: Math.cos(s.ang) * BSPD + s.vx * .3, vy: Math.sin(s.ang) * BSPD + s.vy * .3,
                            life: BLIFE, col: s.col, glow: s.glow
                        });
                        s.fireCD = FIRE_CD; sys.playLaser(s.faction === "VYKOS");
                    }
                }

                if (s.thrusting) {
                    s.vx += Math.cos(s.ang) * THR; s.vy += Math.sin(s.ang) * THR;
                    const sp = Math.hypot(s.vx, s.vy);
                    if (sp > MAX_SPD) { s.vx = s.vx / sp * MAX_SPD; s.vy = s.vy / sp * MAX_SPD; }
                    if (g.frame % 3 === 0) sys.playThrust(0.5);
                }

                s.vx *= DRAG; s.vy *= DRAG;
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
                            sys.playExplosion();
                            const pCount = (gfxMode === "rtx" ? 2 : 1) * (r.tier === 0 ? 20 : r.tier === 1 ? 12 : 6);
                            parts.push(...sparks(r.x, r.y, r.tier === 0 ? "#665" : r.tier === 1 ? "#998" : "#bbb", pCount, r.tier === 0 ? 1.6 : 1.1));
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
                        sys.playExplosion();
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
                // If both are dead, we wait a bit then check if we should show lose screen or respawn
                // For now, let's keep the original "reload" logic but make it safer
                setTimeout(() => {
                    if (!G.current) return;
                    // Check if they are still both dead (to avoid double trigger)
                    if (!G.current.ships[0].alive && !G.current.ships[1].alive) {
                        const ls = G.current.lastSave;
                        initMapAt(ls.x, ls.y);
                        // Restore buoys
                        g.buoys.forEach((b, i) => { if (G.current) G.current.buoys[i].active = b.active; });
                        if (G.current) G.current.lastSave = ls;
                    }
                }, 1800);
            }

            g.parts = parts.filter(p => { p.x += p.vx; p.y += p.vy; p.vx *= .955; p.vy *= .955; p.life -= .016; return p.life > 0; });

            if (++g.spawnT >= SPAWN_INT && g.rocks.length < MAX_ROC) {
                g.spawnT = 0;
                const e = Math.floor(R(0, 4));
                const [sx, sy] = e === 0 ? [R(0, WW), 55] : e === 1 ? [R(0, WW), WH - 55] : e === 2 ? [55, R(300, WH - 300)] : [WW - 55, R(300, WH - 300)];
                const nr = mkRock(Math.random() < .5 ? 0 : Math.random() < .55 ? 1 : 2); nr.x = sx; nr.y = sy; g.rocks.push(nr);
            }

            const alive = ships.filter(s => s.alive);
            if (alive.length) {
                const cx = alive.reduce((a, s) => a + s.x, 0) / alive.length;
                const cy = alive.reduce((a, s) => a + s.y, 0) / alive.length;
                const sep = alive.length === 2 ? D(alive[0], alive[1]) : 0;
                cam.tx = cx; cam.ty = cy; cam.tz = alive.length === 2 ? Math.max(.42, Math.min(1.08, 570 / (sep + 175))) : 1.05;
                cam.x = L(cam.x, cam.tx, .055); cam.y = L(cam.y, cam.ty, .055); cam.z = L(cam.z, cam.tz, .028);
                cam.sh *= .86;
            } else {
                // If no one is alive, slowly zoom out or stay put
                cam.sh *= .86;
            }
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

                [[WW * .22, WH * .32, "rgba(18,5,55,.2)"], [WW * .78, WH * .65, "rgba(0,18,48,.16)"]].forEach(([nx, ny, nc]) => {
                    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, WW * .58);
                    ng.addColorStop(0, nc); ng.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = ng; ctx.fillRect(0, 0, WW, WH);
                });
            }

            const drawGlow = (col, rad) => {
                if (!isVex) { ctx.shadowBlur = isRtx ? rad * 1.5 : rad; ctx.shadowColor = col; }
            };

            buoys.forEach(b => {
                const p = .8 + .2 * Math.sin(frame * .05);
                if (!isVex) {
                    const col = b.active ? `rgba(0, 255, 128, ` : `rgba(0, 100, 255, `;
                    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, isRtx ? 80 : 60);
                    rg.addColorStop(0, col + `${.4 * p})`);
                    rg.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.arc(b.x, b.y, 60, 0, Math.PI * 2); ctx.fill();
                }
                ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
                ctx.strokeStyle = b.active ? "#00ff88" : "#0088ff";
                ctx.lineWidth = isVex ? 2 : 1;
                drawGlow(ctx.strokeStyle, 10);
                isVex ? ctx.stroke() : (ctx.fillStyle = ctx.strokeStyle, ctx.fill());
                ctx.shadowBlur = 0;
            });

            const pulse = .68 + .32 * Math.sin(frame * .042);
            const prog = Math.min(1, escT / ESCAPE_HOLD);
            if (!isVex) {
                const eg = ctx.createRadialGradient(EX, EY, 0, EX, EY, ER * 2.6);
                eg.addColorStop(0, `rgba(255,215,55,${.55 * pulse})`);
                eg.addColorStop(.45, `rgba(255,135,20,${.22 * pulse})`);
                eg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(EX, EY, ER * 2.6, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(EX, EY, ER * .65, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,245,160,${.28 * pulse})`; ctx.fill();
            }
            for (let ri = 0; ri < 4; ri++) {
                const rr = ER * (2.0 - ri * .3) * (1 + ri * .035 * pulse);
                ctx.beginPath(); ctx.arc(EX, EY, rr, 0, Math.PI * 2);
                ctx.strokeStyle = isVex ? "#ffdd50" : `rgba(255,200,50,${(.08 + ri * .06) * pulse})`;
                ctx.lineWidth = isVex ? 1 : 1.5 + ri * .6;
                if (isRtx) drawGlow("#ffaa00", 15);
                ctx.stroke(); ctx.shadowBlur = 0;
            }
            if (prog > 0) {
                ctx.beginPath(); ctx.arc(EX, EY, ER * 1.3, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
                ctx.strokeStyle = `rgba(255,255,100,${.85 + .15 * pulse})`; ctx.lineWidth = 5;
                if (isRtx) drawGlow("#ffdd50", 10);
                ctx.stroke(); ctx.shadowBlur = 0;
            }
            if (!isVex) {
                ctx.fillStyle = `rgba(255,210,65,${.78 * pulse})`;
                ctx.font = `bold ${Math.ceil(16 / cam.z)}px 'Orbitron',sans-serif`;
                ctx.textAlign = "center"; ctx.fillText("ESCAPE VECTOR", EX, EY + ER + 22);
            }

            rocks.forEach(r => {
                ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
                if (!isVex) {
                    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, r.r * 1.9);
                    rg.addColorStop(0, "rgba(70,58,44,0)"); rg.addColorStop(.6, "rgba(60,50,38,.12)"); rg.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r.r * 1.9, 0, Math.PI * 2); ctx.fill();
                }
                ctx.beginPath();
                r.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
                ctx.closePath();
                if (isVex) {
                    ctx.strokeStyle = "#888"; ctx.lineWidth = 2; ctx.stroke();
                } else {
                    ctx.fillStyle = ["#38342e", "#4a4642", "#5e5a56"][r.tier]; ctx.fill();
                    ctx.strokeStyle = ["#5c5852", "#787470", "#9a9896"][r.tier]; ctx.lineWidth = isRtx ? 2 : 1.5; ctx.stroke();
                }
                const dmg = TIERS[r.tier].hp - r.hp;
                if (dmg > 0) {
                    ctx.strokeStyle = isVex ? "#fff" : "rgba(255,72,18,.7)"; ctx.lineWidth = 1.2;
                    for (let d = 0; d < dmg; d++) {
                        const a = d / TIERS[r.tier].hp * Math.PI * 2;
                        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r.r * .38, Math.sin(a) * r.r * .38);
                        ctx.lineTo(Math.cos(a) * r.r * .82, Math.sin(a) * r.r * .82); ctx.stroke();
                    }
                }
                ctx.restore();
            });

            if (isRtx) ctx.globalCompositeOperation = "screen";
            bullets.forEach(b => {
                const al = b.life / BLIFE;
                ctx.globalAlpha = al; ctx.fillStyle = isVex ? "#fff" : b.col;
                drawGlow(b.glow, isRtx ? 20 : 16);
                ctx.beginPath();
                if (isVex) ctx.rect(b.x - 2, b.y - 2, 4, 4);
                else ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
                ctx.fill();
                if (!isVex) {
                    ctx.globalAlpha = al * .3; ctx.beginPath(); ctx.arc(b.x - b.vx * 2.8, b.y - b.vy * 2.8, 2, 0, Math.PI * 2); ctx.fill();
                }
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            if (isRtx) ctx.globalCompositeOperation = "source-over";

            if (isRtx) ctx.globalCompositeOperation = "lighter";
            parts.forEach(p => {
                ctx.globalAlpha = p.life; ctx.fillStyle = isVex ? "#fff" : p.col;
                if (isRtx) drawGlow(p.col, 10);
                ctx.beginPath();
                if (isVex) ctx.rect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
                else ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            if (isRtx) ctx.globalCompositeOperation = "source-over";

            const [sh0, sh1] = ships;
            if (sh0.alive && sh1.alive) {
                const d = D(sh0, sh1);
                if (d < PROX) {
                    const ba = (1 - d / PROX) * .28 * (0.65 + .35 * Math.sin(frame * .12));
                    if (isVex) {
                        ctx.globalAlpha = ba * 2; ctx.strokeStyle = "#fff"; ctx.setLineDash([10, 10]);
                        ctx.beginPath(); ctx.moveTo(sh0.x, sh0.y); ctx.lineTo(sh1.x, sh1.y); ctx.stroke();
                        ctx.setLineDash([]); ctx.globalAlpha = 1;
                    } else {
                        const bg = ctx.createLinearGradient(sh0.x, sh0.y, sh1.x, sh1.y);
                        bg.addColorStop(0, sh0.col); bg.addColorStop(1, sh1.col);
                        ctx.globalAlpha = ba; ctx.strokeStyle = bg; ctx.lineWidth = isRtx ? 3 : 2;
                        ctx.setLineDash([10, 8]);
                        drawGlow("#fff", isRtx ? 15 : 0);
                        ctx.beginPath(); ctx.moveTo(sh0.x, sh0.y); ctx.lineTo(sh1.x, sh1.y); ctx.stroke();
                        ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
                        [sh0, sh1].forEach(s => {
                            const ag = ctx.createRadialGradient(s.x, s.y, 8, s.x, s.y, isRtx ? 48 : 32);
                            ag.addColorStop(0, "rgba(255,255,255,0)"); ag.addColorStop(.7, s.col + (isRtx ? "44" : "22")); ag.addColorStop(1, "rgba(0,0,0,0)");
                            ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(s.x, s.y, isRtx ? 48 : 32, 0, Math.PI * 2); ctx.fill();
                        });
                    }
                }
            }

            ships.forEach(s => {
                if (!s.alive) return;
                const blink = s.invT > 0 && Math.floor(frame / 4) % 2 === 0;
                if (s.trail.length > 2 && !isVex) {
                    if (isRtx) ctx.globalCompositeOperation = "lighter";
                    for (let i = 1; i < s.trail.length; i++) {
                        const ta = (i / s.trail.length) * .55 * (blink ? .25 : 1);
                        ctx.globalAlpha = ta; ctx.strokeStyle = s.glow;
                        drawGlow(s.glow, isRtx ? 10 : 0);
                        ctx.lineWidth = (i / s.trail.length) * (isRtx ? 5 : 3.5);
                        ctx.beginPath(); ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y); ctx.lineTo(s.trail[i].x, s.trail[i].y); ctx.stroke();
                    }
                    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
                    if (isRtx) ctx.globalCompositeOperation = "source-over";
                }

                if (s.thrusting) {
                    const ex = s.x - Math.cos(s.ang) * 19, ey = s.y - Math.sin(s.ang) * 19;
                    if (isVex) {
                        ctx.fillStyle = "#fff";
                        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(s.ang - 0.3) * 10, ey - Math.sin(s.ang - 0.3) * 10); ctx.lineTo(ex - Math.cos(s.ang + 0.3) * 10, ey - Math.sin(s.ang + 0.3) * 10); ctx.fill();
                    } else {
                        const fl = R(22, isRtx ? 48 : 38);
                        const ef = ctx.createRadialGradient(ex, ey, 0, ex, ey, fl);
                        ef.addColorStop(0, "rgba(255,255,210,.95)"); ef.addColorStop(.3, s.col + (isRtx ? "ee" : "cc")); ef.addColorStop(1, "rgba(0,0,0,0)");
                        if (isRtx) { ctx.globalCompositeOperation = "lighter"; drawGlow(s.col, 20); }
                        ctx.fillStyle = ef; ctx.beginPath(); ctx.arc(ex, ey, fl, 0, Math.PI * 2); ctx.fill();
                        if (isRtx) { ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0; }
                    }
                }

                if (!blink) {
                    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang + Math.PI / 2);
                    drawGlow(s.glow, isRtx ? 30 : 20);
                    ctx.beginPath();
                    ctx.moveTo(0, -21); ctx.lineTo(14, 14); ctx.lineTo(5.5, 8); ctx.lineTo(0, 12); ctx.lineTo(-5.5, 8); ctx.lineTo(-14, 14);
                    ctx.closePath();
                    if (isVex) {
                        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
                    } else {
                        ctx.fillStyle = s.col; ctx.fill();
                        ctx.strokeStyle = isRtx ? "#fff" : s.glow; ctx.lineWidth = isRtx ? 2.5 : 1.8; ctx.stroke();
                        ctx.shadowBlur = 0;
                        ctx.fillStyle = "rgba(210,245,255,.8)";
                        ctx.beginPath(); ctx.ellipse(0, -7, 3.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.restore();
                }
            });

            ctx.restore();

            if (isRtx) {
                octx.fillStyle = "rgba(0, 0, 0, 0.1)";
                for (let i = 0; i < CH; i += 4) octx.fillRect(0, i, CW, 1);
                const vg = octx.createRadialGradient(CW / 2, CH / 2, CH * .3, CW / 2, CH / 2, CW * .9);
                vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,25,.8)");
                octx.fillStyle = vg; octx.fillRect(0, 0, CW, CH);
            } else if (!isVex) {
                const vg = ctx.createRadialGradient(CW / 2, CH / 2, CH * .26, CW / 2, CH / 2, CW * .9);
                vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,20,.7)");
                ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
            }

            const activeShips = ships.filter(s => s.alive);
            if (activeShips.length > 0) {
                const midX = activeShips.reduce((a, s) => a + s.x, 0) / activeShips.length;
                const midY = activeShips.reduce((a, s) => a + s.y, 0) / activeShips.length;
                const distEv = Math.hypot(EX - midX, EY - midY);
                const angEv = Math.atan2(EY - midY, EX - midX);
                if (distEv > 400) {
                    ctx.save();
                    ctx.translate(CW / 2 + Math.cos(angEv) * 150, CH / 2 + Math.sin(angEv) * 150);
                    ctx.rotate(angEv);
                    ctx.fillStyle = isVex ? "#ffdd50" : `rgba(255, 215, 50, ${0.4 + 0.3 * Math.sin(frame * 0.1)})`;
                    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 6); ctx.lineTo(-10, -6); ctx.fill();
                    ctx.rotate(-angEv);
                    ctx.font = "bold 10px 'Orbitron',sans-serif"; ctx.textAlign = "center";
                    ctx.fillText(Math.floor(distEv) + "m", 0, 20);
                    ctx.restore();
                }

                const nextBuoy = buoys.find(b => !b.active);
                if (nextBuoy) {
                    const distB = Math.hypot(nextBuoy.x - midX, nextBuoy.y - midY);
                    const angB = Math.atan2(nextBuoy.y - midY, nextBuoy.x - midX);
                    if (distB > 300) {
                        ctx.save();
                        ctx.translate(CW / 2 + Math.cos(angB) * 120, CH / 2 + Math.sin(angB) * 120);
                        ctx.rotate(angB);
                        ctx.fillStyle = isVex ? "#00ddff" : `rgba(0, 180, 255, ${0.4 + 0.3 * Math.sin(frame * 0.1)})`;
                        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-8, 5); ctx.lineTo(-8, -5); ctx.fill();
                        ctx.rotate(-angB);
                        ctx.font = "bold 10px 'Orbitron',sans-serif"; ctx.textAlign = "center";
                        ctx.fillText("SAVE: " + Math.floor(distB) + "m", 0, 20);
                        ctx.restore();
                    }
                }
            }

            ships.forEach((s, i) => {
                const lft = i === 0, bw = 162, bh = 8, bx = lft ? 18 : CW - 18 - bw, by = CH - 52;
                ctx.fillStyle = isVex ? "#fff" : s.col; ctx.font = "bold 16px 'Orbitron',sans-serif";
                ctx.textAlign = lft ? "left" : "right";
                ctx.fillText(s.name + (s.isAI ? " (AI)" : ""), lft ? bx : bx + bw, by - 24);
                ctx.fillStyle = isVex ? "#aaa" : "rgba(255,255,255,.6)"; ctx.font = "bold 12px 'Rajdhani',sans-serif";
                ctx.fillText(s.faction, lft ? bx : bx + bw, by - 8);
                ctx.fillStyle = isVex ? "#222" : "rgba(255,255,255,.15)"; ctx.fillRect(bx, by, bw, bh);
                const hr = Math.max(0, s.hp / 100);
                ctx.fillStyle = isVex ? "#fff" : (hr > .5 ? s.col : hr > .25 ? "#ffaa00" : "#ff2200");
                ctx.fillRect(bx, by, bw * hr, bh);
                if (!s.alive) {
                    if (s.respawnT > 0) {
                        ctx.fillStyle = isVex ? "#fff" : "rgba(255,255,200,.88)"; ctx.font = "bold 14px 'Orbitron',sans-serif";
                        ctx.textAlign = lft ? "left" : "right";
                        ctx.fillText(`RESPAWN: ${(s.respawnT / 60).toFixed(1)}s`, lft ? bx : bx + bw, by + bh + 16);
                    } else {
                        ctx.fillStyle = isVex ? "#fff" : "rgba(255,55,55,.88)"; ctx.font = "bold 16px 'Orbitron',sans-serif";
                        ctx.textAlign = lft ? "left" : "right"; ctx.fillText("HULL LOST", lft ? bx : bx + bw, by + bh + 16);
                    }
                }
            });

            if (ships.every(s => s.alive) && D(ships[0], ships[1]) < PROX) {
                const fl = .7 + .3 * Math.sin(frame * .1);
                ctx.fillStyle = isVex ? "#fff" : `rgba(180,255,220,${.6 * fl})`;
                ctx.font = "bold 12px 'Rajdhani',sans-serif"; ctx.textAlign = "center";
                ctx.fillText("▲ ALLIED SHIELD ACTIVE ▲", CW / 2, CH - 66);
            }

            if (escT > 0) {
                const p = escT / ESCAPE_HOLD, fl = .8 + .2 * Math.sin(frame * .09);
                ctx.fillStyle = isVex ? "#fff" : `rgba(255,220,80,${fl})`;
                ctx.font = "bold 18px 'Orbitron',sans-serif"; ctx.textAlign = "center";
                ctx.fillText("SYNCHRONIZING ESCAPE", CW / 2, CH - 36);
                ctx.fillStyle = isVex ? "#333" : "rgba(255,200,50,.22)"; ctx.fillRect(CW / 2 - 95, CH - 24, 190, 6);
                ctx.fillStyle = isVex ? "#fff" : `rgba(255,235,90,.92)`; ctx.fillRect(CW / 2 - 95, CH - 24, 190 * p, 6);
            }

            const fade = Math.max(0, 1 - g.frame / 380);
            if (fade > 0) {
                ctx.globalAlpha = fade * .5; ctx.fillStyle = "#fff";
                ctx.font = "bold 12px 'Rajdhani',sans-serif";
                ctx.textAlign = "left"; ctx.fillText(ships[0].isAI ? "P1 (AI Controlled)" : "P1 · WASD + SPACE", 20, 28);
                ctx.textAlign = "right"; ctx.fillText(ships[1].isAI ? "P2 (AI Controlled)" : "P2 · ARROWS + SHIFT", CW - 20, 28);
                ctx.globalAlpha = 1;
            }
        }

        function loop() {
            if (G.current) { update(); render(); }
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
