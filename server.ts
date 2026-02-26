import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

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
  timeLimit: number; // in seconds
}

let gameState: GameState = createNewGame(10, 10, 15);

function createNewGame(rows: number, cols: number, mines: number): GameState {
  const grid: Cell[][] = [];
  // ... existing grid creation ...
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = {
        r,
        c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
      };
    }
  }

  // Place mines
  let minesPlaced = 0;
  while (minesPlaced < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!grid[r][c].isMine) {
      grid[r][c].isMine = true;
      minesPlaced++;
    }
  }

  // Calculate neighbors
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
            count++;
          }
        }
      }
      grid[r][c].neighborMines = count;
    }
  }

  // Time limits based on difficulty
  let timeLimit = 120; // Easy: 2 mins
  if (rows === 16 && cols === 16) timeLimit = 300; // Medium: 5 mins
  if (rows === 16 && cols === 30) timeLimit = 600; // Hard: 10 mins

  return {
    grid,
    rows,
    cols,
    mines,
    status: "playing",
    startTime: Date.now(),
    endTime: null,
    timeLimit,
  };
}

function revealCell(r: number, c: number) {
  if (gameState.status !== "playing") return;
  const cell = gameState.grid[r][c];
  if (cell.isRevealed || cell.isFlagged) return;

  cell.isRevealed = true;

  if (cell.isMine) {
    gameState.status = "lost";
    gameState.endTime = Date.now();
    // Reveal all mines
    gameState.grid.forEach(row => row.forEach(cell => {
      if (cell.isMine) cell.isRevealed = true;
    }));
    return;
  }

  if (cell.neighborMines === 0) {
    // Flood fill
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
          revealCell(nr, nc);
        }
      }
    }
  }

  checkWin();
}

function checkWin() {
  let unrevealedSafeCells = 0;
  gameState.grid.forEach(row => row.forEach(cell => {
    if (!cell.isMine && !cell.isRevealed) unrevealedSafeCells++;
  }));

  if (unrevealedSafeCells === 0) {
    gameState.status = "won";
    gameState.endTime = Date.now();
  }
}

function checkTimeout() {
  if (gameState.status !== "playing" || !gameState.startTime) return false;
  const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
  if (elapsed >= gameState.timeLimit) {
    gameState.status = "lost";
    gameState.endTime = Date.now();
    // Reveal all mines
    gameState.grid.forEach(row => row.forEach(cell => {
      if (cell.isMine) cell.isRevealed = true;
    }));
    return true;
  }
  return false;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  // Check timeout every second
  setInterval(() => {
    if (checkTimeout()) {
      io.emit("gameUpdate", gameState);
    }
  }, 1000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    
    // Send current state to new user
    socket.emit("gameUpdate", gameState);

    socket.on("click", ({ r, c }) => {
      revealCell(r, c);
      io.emit("gameUpdate", gameState);
    });

    socket.on("flag", ({ r, c }) => {
      if (gameState.status !== "playing") return;
      const cell = gameState.grid[r][c];
      if (!cell.isRevealed) {
        cell.isFlagged = !cell.isFlagged;
        io.emit("gameUpdate", gameState);
      }
    });

    socket.on("reset", ({ rows, cols, mines }) => {
      gameState = createNewGame(rows || 10, cols || 10, mines || 15);
      io.emit("gameUpdate", gameState);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
