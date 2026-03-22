import React from 'react';

export const Btn = ({ col = "#fff", bord, onClick, children }) => (
    <button onClick={onClick} style={{
        background: "none", border: `2px solid ${bord || col + "99"}`, color: col,
        padding: "14px 54px", fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", cursor: "pointer",
        textTransform: "uppercase", fontFamily: "'Orbitron', sans-serif",
        transition: "all .2s", borderRadius: 0,
        textShadow: `0 0 14px ${col}55`
    }}
        onMouseEnter={e => {
            e.currentTarget.style.background = col + "1a";
            e.currentTarget.style.borderColor = col;
            e.currentTarget.style.boxShadow = `0 0 22px ${col}44, inset 0 0 12px ${col}11`;
        }}
        onMouseLeave={e => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.borderColor = bord || col + "99";
            e.currentTarget.style.boxShadow = "none";
        }}>
        {children}
    </button>
);

export const ToggleBtn = ({ active, col, onClick, children }) => (
    <button onClick={onClick} style={{
        background: active ? col + "44" : "rgba(255,255,255,0.05)",
        border: `2px solid ${active ? col : "rgba(255,255,255,0.2)"}`,
        color: active ? col : "rgba(255,255,255,0.5)",
        padding: "8px 24px", fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer",
        fontFamily: "'Orbitron', sans-serif", transition: "all .2s"
    }}>
        {children}
    </button>
);

export const Sep = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "18px auto", width: 260 }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,#ff5500)" }} />
        <div style={{ width: 4, height: 4, background: "#ff8800", transform: "rotate(45deg)", flexShrink: 0 }} />
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#00ddff,transparent)" }} />
    </div>
);

export const OverlayStyle = {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    fontFamily: "'Rajdhani', sans-serif", color: "#fff",
    background: "rgba(0,0,8,.84)", backdropFilter: "blur(3px)"
};
