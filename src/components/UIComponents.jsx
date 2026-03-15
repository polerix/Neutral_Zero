import React from 'react';

export const Btn = ({ col = "#fff", bord, onClick, children }) => (
    <button onClick={onClick} style={{
        background: "none", border: `2px solid ${bord || col + "99"}`, color: col,
        padding: "14px 54px", fontSize: 16, fontWeight: 700, letterSpacing: 4, cursor: "pointer",
        textTransform: "uppercase", fontFamily: "'Orbitron', sans-serif",
        transition: "all .2s"
    }}
        onMouseEnter={e => { e.currentTarget.style.background = col + "18"; e.currentTarget.style.borderColor = col; }}
        onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = bord || col + "99"; }}>
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

export const Sep = () => <div style={{ width: 100, height: 1, background: "linear-gradient(90deg,#ff5500,#00ddff)", margin: "18px auto" }} />;

export const OverlayStyle = {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    fontFamily: "'Rajdhani', sans-serif", color: "#fff",
    background: "rgba(0,0,8,.84)", backdropFilter: "blur(3px)"
};
