import { useEffect, useMemo, useRef, useState } from "react";
import "./Game.css";


/** ======= Maze Setup ======= */
/** 0 = frei, 1 = Wand */
const MAZE = [
   [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
   [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
   [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
   [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
   [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
   [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
   [1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1],
   [1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,1,1,1,1],
   [1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,1,1,1],
   [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
   [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const CELL = 40; // Zellenbreite px

const DIRS = { //Bediehnung mit Pfeilen
  ArrowUp:    { x: 0,  y: -1 },
  ArrowDown:  { x: 0,  y: 1  },
  ArrowLeft:  { x: -1, y: 0  },
  ArrowRight: { x: 1,  y: 0  },
};

const START_PLAYER = { x: 9, y: 3 };
const START_GHOST  = { x: 9, y: 7 };

function add(pos, dir) {
  return { x: pos.x + dir.x, y: pos.y + dir.y };
}

function inside(x, y) {
   return y >= 0 && y < MAZE.length && x >= 0 && x < MAZE[0].length;
}

function isWall(x, y) {
   return !inside(x, y) || MAZE[y][x] === 1;
}

function eq(a, b) { 
   return a.x === b.x && a.y === b.y; 
}

function opposite(dir) {
  return { x: -dir.x, y: -dir.y };
}

function possibleCoinPositions() {
  let positions = [];
  for (let row = 0; row < MAZE.length; row++) {
    for (let col = 0; col < MAZE[row].length; col++) {
      if (MAZE[row][col] === 0 && !(col === START_PLAYER.x && row === START_PLAYER.y)) {
        positions.push({ x: col, y: row });
      }
    }
  }
  return positions[Math.floor(Math.random() * positions.length)];
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

const KEYS = Object.keys(DIRS);

export default function Game(){
    const cols = MAZE[0].length;
    const rows = MAZE.length;
    const boardPx = useMemo(() => ({ w: cols * CELL, h: rows * CELL }), [cols, rows]);
    
    const containerRef = useRef(null);
    const [player, setPlayer]   = useState(START_PLAYER);
    const [ghost, setGhost]     = useState(START_GHOST);
    const [ghostDir, setGhostDir] = useState({ x: 0, y: 0 });
    const [status, setStatus]   = useState("gameover"); // "playing" | "gameover"
    const [seconds, setSeconds] = useState(0);
    const [running, setRunning] = useState(false);
    const [coin, setCoin] = useState(possibleCoinPositions());
    const [count, setCount] = useState(0);
    
    // Fokus, damit Arrow Keys nicht scrollen
    useEffect(() => {
    containerRef.current?.focus();
     }, []);
    
    useEffect(() => {
        function onKeyDown(e) {
        
          if (!KEYS.includes(e.key)) return;
          if (status !== "playing") return;
          e.preventDefault();               // 1) Standard-Aktion stoppen (z. B. Scrollen)
          const dir = DIRS[e.key];          // 2) Richtung ∆x/∆y nachschlagen
          const next = add(player, dir);
          if(!isWall(next.x, next.y)){
            setPlayer(next);      // 3) Zustand auf Basis des *aktuellen* p aktualisieren
          }
          
    
  }

  window.addEventListener("keydown", onKeyDown, { passive: false }); // 4) Listener registrieren
  return () => window.removeEventListener("keydown", onKeyDown);     // 5) sauber abräumen
}, [player, status]); // 6) nur einmal beim Mount


// Geist-Ticker
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      setGhost(g => {
        const step = nextGhost(g, ghostDir);
        setGhostDir(step.dir);
        return step.pos;
      });
    }, 110); // alle 110ms ein Feld
     return () => clearInterval(id);
    // ghostDir absichtlich nicht als dep -> wird im Callback aktualisiert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  
// Kollision prüfen

  useEffect(() => {
     if(status === "playing" && eq(player, ghost) === true){
        setStatus("gameover")
     } 
  }, [player, status, ghost]);

  // coin sammeln

  useEffect(() => {
     if(status === "playing" && eq(player, coin) === true){
        setCoin(possibleCoinPositions());
        setCount(prev => prev + 1)
     } 
  }, [player, status, coin]);

   useEffect(() => {
      if (status !== "playing") return;
      setSeconds(0); // Timer bei Spielstart auf 0 setzen
      const interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }, [status]);
  
  function reset() {
    setPlayer(START_PLAYER);
    setGhost(START_GHOST);
    setGhostDir({ x: 0, y: 0 });
    setStatus("playing");
    setCoin(possibleCoinPositions());
    setCount(0);

  }
  function endGame() {
    setPlayer(START_PLAYER);
    setGhost(START_GHOST);
    setGhostDir({ x: 0, y: 0 });
    setStatus("gameover");
  }
    const toTransform = (pos) => `translate(${pos.x * CELL}px, ${pos.y * CELL}px)`;
    return (
    <div
      className="game"
      role="application"
      aria-label="Mini Game"
      tabIndex={0}
      ref={containerRef}
      style={{ outline: "none" }}
    >
      <div className="timerAndcounter">
         <span className="timer">Timer: {seconds}s</span>
         <span className="score">Score: {count}</span>
      </div>
      <div
        className="board"
        style={{ width: boardPx.w, height: boardPx.h, borderRadius: 12 }}
      >
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
        </div> {/* grid */}
        
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
          <div
            className="piece coin"
            style={{ transform: toTransform(coin) }}
            aria-label="Coin"
         />
        </div>
        
      </div> {/* board */}
      <div className="hud"> 
        <button className="button" onClick={reset}>Start</button>
        <button className="button" onClick={endGame}>End</button>
      </div>
    </div>
  );
}
