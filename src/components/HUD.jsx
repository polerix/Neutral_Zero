import React from 'react';
import { Btn, Sep, OverlayStyle } from './UIComponents';

export function MissionComplete({ onMenu }) {
    return (
        <div style={OverlayStyle}>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 560, padding: "0 28px" }}>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 10, color: "#ffdd50", marginBottom: 12, opacity: .85 }}>MISSION COMPLETE</div>
                <h1 style={{
                    fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(34px,7vw,64px)", fontWeight: 900, letterSpacing: 2, margin: "8px 0 14px",
                    background: "linear-gradient(180deg,#ffe066 0%,#ffaa00 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1
                }}>BOTH SIDES ESCAPED</h1>
                <Sep />
                <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, lineHeight: 1.85, color: "rgba(255,255,255,.8)", marginBottom: 16 }}>
                    Against ninety years of doctrine, they covered each other through the field.
                </p>
                <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 17, color: "rgba(255,220,80,.9)", marginBottom: 10 }}>
                    The ceasefire transmission reached both fleets simultaneously.
                </p>
                <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: "bold", color: "#fff", marginBottom: 36, letterSpacing: 1 }}>
                    The war ended that day.
                </p>
                <Btn col="#ffdd50" onClick={onMenu}>MAIN MENU</Btn>
            </div>
        </div>
    );
}

export function MissionFailed({ onMenu }) {
    return (
        <div style={OverlayStyle}>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 560, padding: "0 28px" }}>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 10, color: "#ff3300", marginBottom: 12, opacity: .85 }}>CONTACT LOST</div>
                <h1 style={{
                    fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(34px,7vw,64px)", fontWeight: 900, letterSpacing: 2, margin: "8px 0 14px",
                    color: "rgba(255,75,45,.92)", lineHeight: 1
                }}>NO SURVIVORS</h1>
                <Sep />
                <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, lineHeight: 1.85, color: "rgba(255,255,255,.7)", marginBottom: 16 }}>
                    The fleets held position at the border.
                </p>
                <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 17, color: "rgba(255,140,50,.85)", marginBottom: 10 }}>
                    The signal never comes.
                </p>
                <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: "bold", color: "rgba(255,80,50,.9)", marginBottom: 36, letterSpacing: 1 }}>
                    The war continued for forty more years.
                </p>
                <Btn col="#ff5533" onClick={onMenu}>MAIN MENU</Btn>
            </div>
        </div>
    );
}
