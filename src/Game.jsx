import { useEffect, useMemo, useRef, useState } from "react";
import "./Game.css";

/** ======= Maze Setup ======= */
/** 0 = frei, 1 = Wand */
const MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,1,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,1,1,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,1,1,1,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,1,0,0,0,1,0,1],
  [1,0,1,1,1,1,0,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,1,1,1,1,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,1,1,1,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const CELL = 32; // px
const DIRS = {
  ArrowUp:    { x: 0,  y: -1 },
  ArrowDown:  { x: 0,  y: 1  },
  ArrowLeft:  { x: -1, y: 0  },
  ArrowRight: { x: 1,  y: 0  },
};
const KEYS = Object.keys(DIRS);

/** Startpositionen (x,y) im Raster */
const START_PLAYER = { x: 1, y: 1 };
const START_GHOST  = { x: 12, y: 13 };

function inside(x, y) {
  return y >= 0 && y < MAZE.length && x >= 0 && x < MAZE[0].length;
}
function isWall(x, y) {
  return !inside(x, y) || MAZE[y][x] === 1;
}
function eq(a, b) { return a.x === b.x && a.y === b.y; }

function add(pos, dir) {
  return { x: pos.x + dir.x, y: pos.y + dir.y };
}

function opposite(dir) {
  return { x: -dir.x, y: -dir.y };
}

/** Einfaches “KI”-Schrittchen: wähle zufällige valide Richtung, meide Turnbacks wenn möglich */
function nextGhost(pos, lastDir) {
  const candidates = [DIRS.ArrowUp, DIRS.ArrowDown, DIRS.ArrowLeft, DIRS.ArrowRight]
    .filter(d => !isWall(pos.x + d.x, pos.y + d.y));

  if (candidates.length === 0) return { pos, dir: lastDir };

  const withoutReverse = candidates.filter(d => !(lastDir && d.x === -lastDir.x && d.y === -lastDir.y));
  const pool = withoutReverse.length > 0 ? withoutReverse : candidates;
  const choice = pool[Math.floor(Math.random() * pool.length)];

  return { pos: add(pos, choice), dir: choice };
}

/** WebAudio: kurzer Beep (kein Asset nötig) */
function useBeep() {
  const ctxRef = useRef(null);
  useEffect(() => {
    // wird erst bei erster Interaktion erstellt (Autoplay-Policy)
    const handler = () => {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  const beep = (freq = 520, dur = 0.06, type = "square") => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, dur * 1000);
  };

  return beep;
}

export default function Game() {
  const cols = MAZE[0].length;
  const rows = MAZE.length;
  const boardPx = useMemo(() => ({ w: cols * CELL, h: rows * CELL }), [cols, rows]);

  const [player, setPlayer]   = useState(START_PLAYER);
  const [ghost, setGhost]     = useState(START_GHOST);
  const [ghostDir, setGhostDir] = useState({ x: 0, y: 0 });
  const [status, setStatus]   = useState("playing"); // "playing" | "gameover"
  const [moves, setMoves]     = useState(0);
  const containerRef = useRef(null);
  const beep = useBeep();

  // Fokus, damit Arrow Keys nicht scrollen
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Player Input
  useEffect(() => {
    function onKeyDown(e) {
      if (status !== "playing") return;
      if (!KEYS.includes(e.key)) return;
      e.preventDefault();

      const dir = DIRS[e.key];
      const next = add(player, dir);
      if (!isWall(next.x, next.y)) {
        setPlayer(next);
        setMoves(m => m + 1);
        beep(650, 0.045, "square");
      }
    }
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player, status, beep]);

  // Geist-Ticker
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      setGhost(g => {
        const step = nextGhost(g, ghostDir);
        setGhostDir(step.dir);
        return step.pos;
      });
    }, 220); // alle 220ms ein Feld
    return () => clearInterval(id);
    // ghostDir absichtlich nicht als dep -> wird im Callback aktualisiert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Kollision prüfen
  useEffect(() => {
    if (status === "playing" && eq(player, ghost)) {
      setStatus("gameover");
      beep(180, 0.18, "sawtooth");
      beep(140, 0.18, "sawtooth");
    }
  }, [player, ghost, status, beep]);

  function reset() {
    setPlayer(START_PLAYER);
    setGhost(START_GHOST);
    setGhostDir({ x: 0, y: 0 });
    setMoves(0);
    setStatus("playing");
  }

  // Pixel-Position aus Raster
  const toTransform = (pos) => `translate(${pos.x * CELL}px, ${pos.y * CELL}px)`;

  return (
    <div
      className="game"
      role="application"
      aria-label="Pac-Man Light"
      tabIndex={0}
      ref={containerRef}
      style={{ outline: "none" }}
    >
      <div
        className="board"
        style={{ width: boardPx.w, height: boardPx.h, borderRadius: 12 }}
      >
        {/* Bodenraster */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
            gridTemplateRows: `repeat(${rows}, ${CELL}px)`,
          }}
        >
          {MAZE.flatMap((row, y) =>
            row.map((cell, x) => (
              <div
                key={`${x}:${y}`}
                className={`cell ${cell === 1 ? "wall" : "floor"}`}
              />
            ))
          )}
        </div>

        {/* Figuren-Ebene */}
        <div className="pieces">
          <div
            className="piece player"
            style={{ transform: toTransform(player) }}
            aria-label="Player"
          />
          <div
            className="piece ghost"
            style={{ transform: toTransform(ghost) }}
            aria-label="Ghost"
          />
        </div>
      </div>

      <div className="hud">
        <div className="status">{status === "playing" ? "Spielt…" : "Game Over"}</div>
        <div>Züge: {moves}</div>
        <button className="button" onClick={reset}>Neu starten</button>
        <div>Steuerung: Pfeiltasten</div>
      </div>
    </div>
  );
}
