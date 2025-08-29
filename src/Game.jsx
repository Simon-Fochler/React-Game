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
   [1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
   [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,1,0,1],
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
const START_GHOST = { x: 9, y: 7 };

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

function makeCoin() {
  return { id: Math.random().toString(36).slice(2), pos: possibleCoinPositions() };
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
/**Spieler sehen */
function searchPlayer(posGhost, posPlayer){
  // oben
  {
    let x = posGhost.x, y = posGhost.y;
    while (!isWall(x, y)) {
      if (posPlayer.x === x && posPlayer.y === y) return DIRS.ArrowUp;
      y--;
    }
  }
  // unten
  {
    let x = posGhost.x, y = posGhost.y;
    while (!isWall(x, y)) {
      if (posPlayer.x === x && posPlayer.y === y) return DIRS.ArrowDown;
      y++;
    }
  }
  // links
  {
    let x = posGhost.x, y = posGhost.y;
    while (!isWall(x, y)) {
      if (posPlayer.x === x && posPlayer.y === y) return DIRS.ArrowLeft;
      x--;
    }
  }
  // rechts
  {
    let x = posGhost.x, y = posGhost.y;
    while (!isWall(x, y)) {
      if (posPlayer.x === x && posPlayer.y === y) return DIRS.ArrowRight;
      x++;
    }
  }

  return null;
}
/** Einfaches “KI”-Schrittchen: wähle zufällige valide Richtung, meide Turnbacks wenn möglich */
function nextGhost(pos, lastDir, pos_player) {

  const playerFound = searchPlayer(pos, pos_player)
  console.log(playerFound);
  if(playerFound!== null){
    return {pos: add(pos, playerFound), dir: playerFound};
  }


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
    const [ghosts, setGhosts] = useState([
  { id: "g1", pos: START_GHOST, dir: { x: 0, y: 0 } }
]);
    const [ghostDir, setGhostDir] = useState({ x: 0, y: 0 });
    const [status, setStatus]   = useState("before game"); // "playing" | "gameover" | "before game"
    const [seconds, setSeconds] = useState(0);
    const [running, setRunning] = useState(false);
    const [coins, setCoins] = useState([makeCoin(), makeCoin(), makeCoin(), makeCoin(), makeCoin()]);
    const [count, setCount] = useState(0);
    const [infoOpen, setInfoOpen] = useState(true); //
    
   
    
    
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
    setGhosts(gs =>
      gs.map(g => {
        const step = nextGhost(g.pos, g.dir, player);
        return { ...g, pos: step.pos, dir: step.dir };
      })
    );
  }, 240); //Geschwindigkeit Geist
  return () => clearInterval(id);
}, [status, player]);

//Geister hinzufügen

useEffect(() => {
  if (status !== "playing") return;
  const id = setInterval(() => {
    setGhosts(gs => [
      ...gs,
      { id: "g" + (gs.length + 1), pos: START_GHOST, dir: { x: 0, y: 0 } }
    ]);
  }, 30000); // alle 30s
  return () => clearInterval(id);
}, [status]);
  
// Kollision prüfen
useEffect(() => {
  if (status !== "playing") return;
  if (ghosts.some(g => eq(player, g.pos))) {
    setStatus("gameover");
  }
}, [player, ghosts, status]);

  // coin sammeln

  useEffect(() => {
  if (status !== "playing") return;

  const hit = coins.find(c => eq(player, c.pos));
  if (hit) {
    setCoins(prevCoins =>
      prevCoins.map(c =>
        c.id === hit.id ? makeCoin() : c
      )
    );
    setCount(prev => prev + 1); // nur 1x erhöhen
  }
}, [player, status, coins]);



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
  setGhosts([
    { id: "g1", pos: START_GHOST, dir: { x: 0, y: 0 } }
  ]);
  setStatus("playing");
  setCoins([makeCoin(), makeCoin(), makeCoin(), makeCoin(), makeCoin()]);
  setCount(0);
}
  function endGame() {
  if (status !== "playing") return;
  setPlayer(START_PLAYER);
  setGhosts([
    { id: "g1", pos: START_GHOST, dir: { x: 0, y: 0 } }
  ]);
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
         <button className="infoBtn" onClick={() => setInfoOpen(true)}><i class="fa fa-icon w3-large">&#9432;</i></button>
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
          {ghosts.map(g => (
  <div
    key={g.id}
    className="piece ghost"
    style={{ transform: toTransform(g.pos) }}
  />
))}
        
         
         {coins.map(c => (
          <div
            key={c.id}
            className="piece coin"
            style={{ transform: toTransform(c.pos) }}
            aria-label="Coin"
           />
         ))}
  
        </div>
        
      </div>

      {/* InfoWindow */}
      {infoOpen && (
        <div className="backdrop" onClick={() => setInfoOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()} // Klick im Fenster nicht schließen
          >
            <div className="closeRow"><button className="closeButton" onClick={() => setInfoOpen(false)}>&#128473;</button></div>
            <h2 className="gameDescriptionH">Game Instructions</h2>
            <p className="gameDescription">Move the player using the arrow keys, collect coins, and avoid the ghost.</p>
            <button  className="button" onClick={() => {
    reset();           // Spiel zurücksetzen
    setInfoOpen(false); // Info-Fenster schließen
  }}>Start Game</button>
          </div>
        </div>
      )}
      

    {/* Gameover Page */}
      {status == "gameover" && (
        <div className="backdrop">
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()} // Klick im Fenster nicht schließen
          >
            <div className="closeRow"><button className="closeButton" onClick={() => setStatus("before playing")}>&#128473;</button></div>
            <h2 className="gameDescriptionH">GAMEOVER</h2>
            <div className="final-timerandscore">
               <span className="final-timer">Timer: {seconds}s</span>
               <br />
               <span className="final-score">Score: {count}</span>
            </div>
            <button  className="button" onClick={() => {
    reset();           // Spiel zurücksetzen
    setInfoOpen(false); // Info-Fenster schließen
  }}>Start Game</button>
          </div>
        </div>
      )}



      {/* board */}
      <div className="hud"> 
        <button className="button" onClick={reset}>Start</button>
        <button className="button" onClick={endGame}>End</button>
      </div>
    </div>
  );
}
