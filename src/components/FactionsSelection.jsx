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
                    fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(50px,9vw,90px)", fontWeight: 900, letterSpacing: 3, margin: "10px 0",
                    background: "linear-gradient(175deg,#ffffff 0%,#a8dcff 60%,#66aadd 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1
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

                <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", padding: "20px", margin: "24px 0", borderRadius: "8px", display: "flex", flexDirection: "column", gap: 15 }}>

                    <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 2 }}>Mode:</span>
                        <ToggleBtn active={players === 1} col="#fff" onClick={() => setPlayers(1)}>1 PLAYER</ToggleBtn>
                        <ToggleBtn active={players === 2} col="#fff" onClick={() => setPlayers(2)}>2 PLAYER (CO-OP)</ToggleBtn>
                    </div>

                    <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 2 }}>Pilot 1:</span>
                        <ToggleBtn active={p1Faction === "vykos"} col="#ff5500" onClick={() => setP1Faction("vykos")}>VYKOS</ToggleBtn>
                        <ToggleBtn active={p1Faction === "raelun"} col="#00ddff" onClick={() => setP1Faction("raelun")}>RAELUN</ToggleBtn>
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
