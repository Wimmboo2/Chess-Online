require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const PORT = process.env.PORT || 3001;

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow localhost, the exact configured CLIENT_URL, and any vercel preview deployments
      if (
        origin === "http://localhost:5173" || 
        origin === CLIENT_URL || 
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
  },
});

// ─── In-memory game store ───────────────────────────────────────────
const rooms = new Map();

const VALID_TIME_CONTROLS = [60000, 300000, 600000]; // 1, 5, 10 min

function generateRoomId() {
  return uuidv4().substring(0, 6).toUpperCase();
}

function createRoomState(timeControl) {
  const tc = VALID_TIME_CONTROLS.includes(timeControl) ? timeControl : 600000;
  return {
    players: [], // [{ id, color }]
    chess: new Chess(),
    moves: [],
    timeControl: tc,
    timers: { w: tc, b: tc },
    activeColor: "w",
    timerInterval: null,
    gameOver: false,
    rematchRequests: new Set(),
    lastTickTime: null,
  };
}

function stopTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
    room.lastTickTime = null;
  }
}

function startTimer(room, roomId) {
  stopTimer(room);
  room.lastTickTime = Date.now();

  room.timerInterval = setInterval(() => {
    if (room.gameOver) {
      stopTimer(room);
      return;
    }

    const now = Date.now();
    const elapsed = now - room.lastTickTime;
    room.lastTickTime = now;
    room.timers[room.activeColor] -= elapsed;

    // Broadcast timer update
    io.to(roomId).emit("timerUpdate", {
      w: Math.max(0, room.timers.w),
      b: Math.max(0, room.timers.b),
    });

    // Check timeout
    if (room.timers[room.activeColor] <= 0) {
      room.timers[room.activeColor] = 0;
      room.gameOver = true;
      stopTimer(room);

      const winner = room.activeColor === "w" ? "b" : "w";
      io.to(roomId).emit("gameOver", {
        winner,
        reason: "timeout",
      });
    }
  }, 100);
}

function getPlayerColor(room, socketId) {
  const player = room.players.find((p) => p.id === socketId);
  return player ? player.color : null;
}

function getOpponentSocket(room, socketId) {
  const opponent = room.players.find((p) => p.id !== socketId);
  return opponent ? opponent.id : null;
}

function checkGameEnd(room, roomId) {
  const chess = room.chess;

  if (chess.isCheckmate()) {
    room.gameOver = true;
    stopTimer(room);
    const winner = chess.turn() === "w" ? "b" : "w";
    io.to(roomId).emit("gameOver", { winner, reason: "checkmate" });
    return true;
  }

  if (chess.isStalemate()) {
    room.gameOver = true;
    stopTimer(room);
    io.to(roomId).emit("gameOver", { winner: null, reason: "stalemate" });
    return true;
  }

  if (chess.isThreefoldRepetition()) {
    room.gameOver = true;
    stopTimer(room);
    io.to(roomId).emit("gameOver", {
      winner: null,
      reason: "repetition",
    });
    return true;
  }

  if (chess.isInsufficientMaterial()) {
    room.gameOver = true;
    stopTimer(room);
    io.to(roomId).emit("gameOver", {
      winner: null,
      reason: "insufficient material",
    });
    return true;
  }

  if (chess.isDraw()) {
    // If not stalemate, repetition, or insufficient material, it must be the 50-move rule
    room.gameOver = true;
    stopTimer(room);
    io.to(roomId).emit("gameOver", { winner: null, reason: "50-move rule" });
    return true;
  }

  return false;
}

// ─── Socket.io connection handling ──────────────────────────────────
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ── Create Room ──
  socket.on("createRoom", (data) => {
    const timeControl = data?.timeControl || 600000;
    const roomId = generateRoomId();
    const room = createRoomState(timeControl);
    rooms.set(roomId, room);

    socket.join(roomId);
    room.players.push({ id: socket.id, color: null });

    socket.emit("roomCreated", { roomId });
    console.log(`Room ${roomId} created by ${socket.id} (${timeControl / 1000}s)`);
  });

  // ── Join Room ──
  socket.on("joinRoom", ({ roomId }) => {
    const code = roomId?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit("error", { message: "Room not found. Check the code and try again." });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("error", { message: "Room is full." });
      return;
    }

    if (room.players.some((p) => p.id === socket.id)) {
      socket.emit("error", { message: "You are already in this room." });
      return;
    }

    socket.join(code);
    room.players.push({ id: socket.id, color: null });

    // Randomly assign colors
    const colors = Math.random() < 0.5 ? ["w", "b"] : ["b", "w"];
    room.players[0].color = colors[0];
    room.players[1].color = colors[1];

    // Notify both players
    room.players.forEach((player) => {
      io.to(player.id).emit("gameStart", {
        color: player.color,
        roomId: code,
        fen: room.chess.fen(),
        timeControl: room.timeControl,
      });
    });

    // Start the clock
    startTimer(room, code);
    console.log(`Room ${code} — game started`);
  });

  // ── Move ──
  socket.on("move", ({ roomId, from, to, promotion }) => {
    const code = roomId?.toUpperCase();
    const room = rooms.get(code);

    if (!room || room.gameOver) return;

    const playerColor = getPlayerColor(room, socket.id);
    if (!playerColor) return;

    // Make sure it's this player's turn
    if (room.chess.turn() !== playerColor) return;

    // Attempt the move
    let move;
    try {
      move = room.chess.move({ from, to, promotion: promotion || "q" });
    } catch {
      // Illegal move — silently ignore
      return;
    }

    if (!move) return;

    // Record move
    room.moves.push(move.san);

    // Switch active timer
    room.activeColor = room.chess.turn();
    room.lastTickTime = Date.now();

    // Broadcast the move
    io.to(code).emit("moveMade", {
      from: move.from,
      to: move.to,
      san: move.san,
      fen: room.chess.fen(),
      moves: [...room.moves],
    });

    // Send updated timers immediately
    io.to(code).emit("timerUpdate", {
      w: Math.max(0, room.timers.w),
      b: Math.max(0, room.timers.b),
    });

    // Check if game is over
    checkGameEnd(room, code);
  });

  // ── Resign ──
  socket.on("resign", ({ roomId }) => {
    const code = roomId?.toUpperCase();
    const room = rooms.get(code);

    if (!room || room.gameOver) return;

    const playerColor = getPlayerColor(room, socket.id);
    if (!playerColor) return;

    room.gameOver = true;
    stopTimer(room);

    const winner = playerColor === "w" ? "b" : "w";
    io.to(code).emit("gameOver", { winner, reason: "resignation" });
    console.log(`Room ${code} — ${playerColor} resigned`);
  });

  // ── Draw Offer ──
  socket.on("offerDraw", ({ roomId }) => {
    const code = roomId?.toUpperCase();
    const room = rooms.get(code);

    if (!room || room.gameOver) return;

    const opponentId = getOpponentSocket(room, socket.id);
    if (opponentId) {
      io.to(opponentId).emit("drawOffered");
    }
  });

  // ── Draw Response ──
  socket.on("respondDraw", ({ roomId, accept }) => {
    const code = roomId?.toUpperCase();
    const room = rooms.get(code);

    if (!room || room.gameOver) return;

    if (accept) {
      room.gameOver = true;
      stopTimer(room);
      io.to(code).emit("gameOver", { winner: null, reason: "draw agreement" });
      console.log(`Room ${code} — Draw agreed`);
    } else {
      const opponentId = getOpponentSocket(room, socket.id);
      if (opponentId) {
        io.to(opponentId).emit("drawDeclined");
      }
    }
  });

  // ── Rematch Request ──
  socket.on("rematchRequest", ({ roomId }) => {
    const code = roomId?.toUpperCase();
    const room = rooms.get(code);

    if (!room) return;

    room.rematchRequests.add(socket.id);

    if (room.rematchRequests.size >= 2) {
      // Both players want a rematch — reset the game
      room.chess = new Chess();
      room.moves = [];
      const tc = room.timeControl;
      room.timers = { w: tc, b: tc };
      room.activeColor = "w";
      room.gameOver = false;
      room.rematchRequests.clear();

      // Swap colors
      room.players.forEach((p) => {
        p.color = p.color === "w" ? "b" : "w";
      });

      // Notify both players
      room.players.forEach((player) => {
        io.to(player.id).emit("gameStart", {
          color: player.color,
          roomId: code,
          fen: room.chess.fen(),
          timeControl: tc,
        });
      });

      startTimer(room, code);
      console.log(`Room ${code} — rematch started`);
    } else {
      // Notify opponent that rematch was requested
      const opponentId = getOpponentSocket(room, socket.id);
      if (opponentId) {
        io.to(opponentId).emit("rematchPending");
      }
      // Also confirm to the requester
      socket.emit("rematchRequested");
    }
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex === -1) continue;

      const playerColor = room.players[playerIndex].color;

      if (!room.gameOver && room.players.length === 2 && playerColor) {
        // Game was in progress — opponent wins
        room.gameOver = true;
        stopTimer(room);

        const winner = playerColor === "w" ? "b" : "w";
        io.to(roomId).emit("gameOver", {
          winner,
          reason: "abandonment",
        });
        io.to(roomId).emit("opponentDisconnected");
      }

      // Remove player
      room.players.splice(playerIndex, 1);

      // Clean up empty rooms after a delay
      if (room.players.length === 0) {
        setTimeout(() => {
          if (rooms.has(roomId) && rooms.get(roomId).players.length === 0) {
            stopTimer(rooms.get(roomId));
            rooms.delete(roomId);
            console.log(`Room ${roomId} cleaned up`);
          }
        }, 60000);
      }
    }
  });
});

// ─── Health check endpoint ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "Chess server running", rooms: rooms.size });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`♟ Chess server listening on port ${PORT}`);
  console.log(`  Accepting connections from: ${CLIENT_URL}`);
});
