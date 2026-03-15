import React, { useState, useEffect } from 'react';
import FactionsSelection from './components/FactionsSelection';
import GameWorld from './components/GameWorld';
import { MissionComplete, MissionFailed } from './components/HUD';

export default function NeutralZero() {
    const [phase, setPhase] = useState("intro");
    const [players, setPlayers] = useState(1);
    const [p1Faction, setP1Faction] = useState("vykos");
    const [gfxMode, setGfxMode] = useState("normal");
    const [loreIdx, setLoreIdx] = useState(0);
    const [loreFading, setLoreFading] = useState(false);

    // Lore text carousel effect
    useEffect(() => {
        if (phase !== "intro") return;
        const cycle = setInterval(() => {
            setLoreFading(true);
            setTimeout(() => {
                setLoreIdx((i) => (i + 1) % 5); // 5 is LORE.length
                setLoreFading(false);
            }, 500);
        }, 4500);
        return () => clearInterval(cycle);
    }, [phase]);

    return (
        <div style={{ position: "fixed", inset: 0, background: "#020409", overflow: "hidden" }}>
            {phase === "playing" && (
                <GameWorld
                    players={players}
                    p1Faction={p1Faction}
                    gfxMode={gfxMode}
                    setPhase={setPhase}
                />
            )}

            {phase === "intro" && (
                <FactionsSelection
                    players={players}
                    setPlayers={setPlayers}
                    p1Faction={p1Faction}
                    setP1Faction={setP1Faction}
                    gfxMode={gfxMode}
                    setGfxMode={setGfxMode}
                    loreIdx={loreIdx}
                    loreFading={loreFading}
                    onStart={() => setPhase("playing")}
                />
            )}

            {phase === "win" && <MissionComplete onMenu={() => setPhase("intro")} />}
            {phase === "lose" && <MissionFailed onMenu={() => setPhase("intro")} />}
        </div>
    );
}
