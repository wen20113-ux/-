import React, { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Bomb, Flag, RefreshCw, Trophy, Skull, Clock, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Cell {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

interface GameState {
  grid: Cell[][];
  rows: number;
  cols: number;
  mines: number;
  status: "playing" | "won" | "lost";
  startTime: number | null;
  endTime: number | null;
  timeLimit: number;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("connect", () => setConnected(true));
    newSocket.on("disconnect", () => setConnected(false));
    newSocket.on("gameUpdate", (state: GameState) => {
      setGameState(state);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    let interval: number;
    if (gameState?.status === "playing" && gameState.startTime) {
      interval = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameState.startTime!) / 1000);
        setTimer(Math.max(0, gameState.timeLimit - elapsed));
      }, 1000);
    } else if (gameState?.status !== "playing" && gameState?.startTime && gameState?.endTime) {
      const elapsed = Math.floor((gameState.endTime - gameState.startTime) / 1000);
      setTimer(Math.max(0, gameState.timeLimit - elapsed));
    } else if (gameState?.timeLimit) {
      setTimer(gameState.timeLimit);
    }
    return () => clearInterval(interval);
  }, [gameState?.status, gameState?.startTime, gameState?.endTime, gameState?.timeLimit]);

  const handleCellClick = useCallback((r: number, c: number) => {
    if (socket && gameState?.status === "playing") {
      socket.emit("click", { r, c });
    }
  }, [socket, gameState?.status]);

  const handleCellRightClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (socket && gameState?.status === "playing") {
      socket.emit("flag", { r, c });
    }
  }, [socket, gameState?.status]);

  const handleReset = useCallback((difficulty: "easy" | "medium" | "hard") => {
    if (!socket) return;
    let config = { rows: 10, cols: 10, mines: 15 };
    if (difficulty === "medium") config = { rows: 16, cols: 16, mines: 40 };
    if (difficulty === "hard") config = { rows: 16, cols: 30, mines: 99 };
    socket.emit("reset", config);
  }, [socket]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="uppercase tracking-[0.3em] text-sm animate-pulse">Initializing ROG Protocol...</p>
        </div>
      </div>
    );
  }

  const flagsUsed = gameState.grid.flat().filter(c => c.isFlagged).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-600/50 relative overflow-hidden">
      {/* ROG Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(45deg, #ff0000 25%, transparent 25%, transparent 50%, #ff0000 50%, #ff0000 75%, transparent 75%, transparent)' , backgroundSize: '100px 100px' }} />
      </div>

      {/* Header */}
      <header className="border-b-2 border-red-600 bg-neutral-900/80 backdrop-blur-xl sticky top-0 z-10 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-sm transform -skew-x-12 flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              <Bomb className="w-7 h-7 text-black transform skew-x-12" />
            </div>
            <div>
              <h1 className="font-black text-2xl tracking-tighter italic uppercase">ROG Minesweeper</h1>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-500/70 font-bold">
                <span className={cn("w-2 h-2 rounded-full animate-pulse", connected ? "bg-red-600 shadow-[0_0_5px_#ff0000]" : "bg-neutral-700")} />
                {connected ? "System Online" : "Link Severed"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-black">Countdown</span>
              <div className={cn(
                "flex items-center gap-1.5 font-mono text-3xl font-black italic",
                timer < 30 ? "text-red-500 animate-pulse" : "text-white"
              )}>
                <Clock className="w-5 h-5" />
                {timer.toString().padStart(3, '0')}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-black">Threats</span>
              <div className="flex items-center gap-1.5 font-mono text-3xl font-black italic text-red-600">
                <Flag className="w-5 h-5" />
                {Math.max(0, gameState.mines - flagsUsed).toString().padStart(3, '0')}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col items-center gap-8 relative z-0">
        {/* Game Status Banner */}
        <AnimatePresence mode="wait">
          {gameState.status !== "playing" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotateX: -20 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-md p-6 rounded-sm transform -skew-x-6 flex items-center justify-between border-l-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                gameState.status === "won" 
                  ? "bg-neutral-900 border-red-600 text-white" 
                  : "bg-red-900/20 border-red-600 text-red-500"
              )}
            >
              <div className="flex items-center gap-4 transform skew-x-6">
                <div className={cn(
                  "w-14 h-14 rounded-sm flex items-center justify-center shadow-lg",
                  gameState.status === "won" ? "bg-red-600 text-black" : "bg-black text-red-600 border border-red-600"
                )}>
                  {gameState.status === "won" ? <Trophy className="w-8 h-8" /> : <Skull className="w-8 h-8" />}
                </div>
                <div>
                  <h2 className="font-black text-xl uppercase italic tracking-tighter">
                    {gameState.status === "won" ? "Mission Clear" : "System Failure"}
                  </h2>
                  <p className="text-xs uppercase tracking-widest opacity-70">
                    {gameState.status === "won" ? "All threats neutralized" : "Critical breach detected"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleReset("easy")}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-black font-black uppercase italic tracking-tighter rounded-sm transition-all hover:scale-105 active:scale-95 transform skew-x-6"
              >
                Reboot
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Difficulty Selector */}
        <div className="flex gap-1 p-1 bg-neutral-900 border border-red-600/30 rounded-sm transform -skew-x-12">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <button
              key={d}
              onClick={() => handleReset(d)}
              className="px-6 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-red-600 hover:text-black active:scale-95 transform skew-x-12"
            >
              {d}
            </button>
          ))}
        </div>

        {/* The Grid */}
        <div 
          className="p-6 bg-neutral-900 border-2 border-red-600/50 shadow-[0_0_40px_rgba(220,38,38,0.15)] relative"
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${gameState.cols}, minmax(32px, 1fr))`,
            gap: '2px'
          }}
        >
          {/* Grid Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-10" />
          
          {gameState.grid.map((row, r) => 
            row.map((cell, c) => (
              <CellComponent 
                key={`${r}-${c}`} 
                cell={cell} 
                onClick={() => handleCellClick(r, c)}
                onContextMenu={(e) => handleCellRightClick(e, r, c)}
                gameStatus={gameState.status}
              />
            ))
          )}
        </div>

        {/* Footer Info */}
        <div className="flex flex-wrap justify-center gap-10 text-red-500/50 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Multi-Link Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-neutral-800 border border-red-600/30" />
            <span>Reveal Sector</span>
          </div>
          <div className="flex items-center gap-2">
            <Flag className="w-3 h-3 text-red-600 fill-red-600" />
            <span>Mark Threat</span>
          </div>
        </div>
      </main>
    </div>
  );
}

interface CellComponentProps {
  cell: Cell;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  gameStatus: string;
  key?: string;
}

function CellComponent({ 
  cell, 
  onClick, 
  onContextMenu,
  gameStatus
}: CellComponentProps) {
  const isRevealed = cell.isRevealed;
  const isMine = cell.isMine;
  const isFlagged = cell.isFlagged;

  const getNumberColor = (n: number) => {
    const colors = [
      "", "text-blue-400", "text-red-500", "text-red-600", 
      "text-red-700", "text-red-800", "text-red-900", 
      "text-white", "text-white"
    ];
    return colors[n] || "text-white";
  };

  return (
    <motion.button
      whileHover={!isRevealed && gameStatus === "playing" ? { scale: 1.05, backgroundColor: "rgba(220,38,38,0.2)" } : {}}
      whileTap={!isRevealed && gameStatus === "playing" ? { scale: 0.9 } : {}}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-sm md:text-base font-black italic transition-all duration-150 relative overflow-hidden",
        isRevealed 
          ? (isMine ? "bg-red-600 text-black shadow-[0_0_15px_#ff0000]" : "bg-neutral-800/80 text-white border border-red-600/10")
          : "bg-neutral-900 border border-red-600/20 shadow-inner",
        !isRevealed && "hover:border-red-600/50"
      )}
    >
      {isRevealed ? (
        isMine ? (
          <Bomb className="w-5 h-5 animate-pulse" />
        ) : (
          cell.neighborMines > 0 ? (
            <span className={cn(getNumberColor(cell.neighborMines), "drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]")}>
              {cell.neighborMines}
            </span>
          ) : null
        )
      ) : (
        isFlagged ? (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
          >
            <Flag className="w-4 h-4 text-red-600 fill-red-600 drop-shadow-[0_0_8px_#ff0000]" />
          </motion.div>
        ) : null
      )}
    </motion.button>
  );
}


