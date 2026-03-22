import React from 'react';
import { LORE } from '../gameLogic';
import { Btn, ToggleBtn, Sep, OverlayStyle } from './UIComponents';

export default function FactionsSelection({
    players, setPlayers,
    p1Faction, setP1Faction,
    gfxMode, setGfxMode,
    loreIdx, loreFading,
    onStart
}) {
    return (
        <div style={{ ...OverlayStyle, background: "url('/bg.jpg') center/cover no-repeat" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,12,.7)", backdropFilter: "blur(5px)" }} />
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 640, padding: "0 28px" }}>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 8, color: "#ff5500", marginBottom: 10, opacity: .8 }}>YEAR 2387 · NEUTRAL ZONE</div>
                <h1 style={{
                    fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(50px,9vw,90px)", fontWeight: 900,
                    letterSpacing: "0.18em", margin: "10px 0",
                    background: "linear-gradient(165deg,#ffffff 0%,#ffd98a 35%,#a8dcff 70%,#6688cc 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1,
                    textShadow: "none", filter: "drop-shadow(0 0 18px rgba(180,140,80,0.35))"
                }}>
                    NEUTRAL ZERO
                </h1>
                <Sep />

                <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <p style={{
                        fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(18px,2.5vw,20px)",
                        lineHeight: 1.85, color: "rgba(255,255,255,.9)",
                        opacity: loreFading ? 0 : 1, transition: "opacity 0.5s ease-in-out"
                    }}>
                        {LORE[loreIdx]}
                    </p>
                </div>

                <div style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)", padding: "22px 24px", margin: "24px 0", borderRadius: "2px", display: "flex", flexDirection: "column", gap: 15, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 32px rgba(0,0,0,0.5)" }}>

                    <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 2 }}>Mode:</span>
                        <ToggleBtn active={players === 1} col="#fff" onClick={() => setPlayers(1)}>1 PLAYER</ToggleBtn>
                        <ToggleBtn active={players === 2} col="#fff" onClick={() => setPlayers(2)}>2 PLAYER (CO-OP)</ToggleBtn>
                    </div>

                    <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 2 }}>Pilot 1:</span>
                        <ToggleBtn active={p1Faction === "vykos"} col="#ff5500" onClick={() => setP1Faction("vykos")}>
                            <span style={{ display: "block", fontSize: 13, letterSpacing: "0.2em" }}>VYKOS</span>
                            <span style={{ display: "block", fontSize: 9, letterSpacing: "0.18em", opacity: 0.6, fontWeight: 400, marginTop: 2 }}>VANGUARD CLASS</span>
                        </ToggleBtn>
                        <ToggleBtn active={p1Faction === "raelun"} col="#00ddff" onClick={() => setP1Faction("raelun")}>
                            <span style={{ display: "block", fontSize: 13, letterSpacing: "0.2em" }}>RAELUN</span>
                            <span style={{ display: "block", fontSize: 9, letterSpacing: "0.18em", opacity: 0.6, fontWeight: 400, marginTop: 2 }}>REMNANT CLASS</span>
                        </ToggleBtn>
                    </div>

                    <div style={{ display: "flex", gap: 15, justifyContent: "center", alignItems: "center", marginTop: 5 }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 2 }}>Graphics:</span>
                        <ToggleBtn active={gfxMode === "vectrex"} col="#55ff55" onClick={() => setGfxMode("vectrex")}>VECTREX (LOW)</ToggleBtn>
                        <ToggleBtn active={gfxMode === "normal"} col="#fff" onClick={() => setGfxMode("normal")}>NORMAL</ToggleBtn>
                        <ToggleBtn active={gfxMode === "rtx"} col="#ffaa00" onClick={() => setGfxMode("rtx")}>RTX (HIGH)</ToggleBtn>
                    </div>

                </div>

                <Btn col="#fff" onClick={onStart}>INITIATE CONTACT</Btn>
            </div>
        </div>
    );
}
