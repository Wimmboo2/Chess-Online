import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import socket from '../socket.js';
import ChessBoardComponent from '../components/ChessBoard.jsx';
import Clock from '../components/Clock.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import GameOverModal from '../components/GameOverModal.jsx';
import ResignButton from '../components/ResignButton.jsx';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we arrived with game data from the join flow
  const navState = location.state || {};

  // Game state
  const [game, setGame] = useState(() => {
    if (navState.fen) {
      const g = new Chess();
      g.load(navState.fen);
      return g;
    }
    return new Chess();
  });
  const [playerColor, setPlayerColor] = useState(navState.color || null);
  const [gameStarted, setGameStarted] = useState(!!navState.joined);
  const [moves, setMoves] = useState([]);
  const [timers, setTimers] = useState(() => {
    const tc = navState.timeControl || 600000;
    return { w: tc, b: tc };
  });
  const [gameOver, setGameOver] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const gameRef = useRef(game);
  gameRef.current = game;

  // ── Socket event handlers ──
  useEffect(() => {
    const handleGameStart = ({ color, fen, timeControl }) => {
      const newGame = new Chess();
      if (fen) newGame.load(fen);
      setGame(newGame);
      setPlayerColor(color);
      setGameStarted(true);
      setMoves([]);
      const tc = timeControl || 600000;
      setTimers({ w: tc, b: tc });
      setGameOver(null);
      setLastMove(null);
      setRematchRequested(false);
      setRematchPending(false);
      setOpponentDisconnected(false);
    };

    const handleMoveMade = ({ from, to, fen, moves: allMoves }) => {
      const newGame = new Chess();
      newGame.load(fen);
      setGame(newGame);
      setMoves(allMoves);
      setLastMove({ from, to });
    };

    const handleTimerUpdate = ({ w, b }) => {
      setTimers({ w, b });
    };

    const handleGameOver = ({ winner, reason }) => {
      setGameOver({ winner, reason });
    };

    const handleRematchPending = () => {
      setRematchPending(true);
    };

    const handleRematchRequested = () => {
      setRematchRequested(true);
    };

    const handleOpponentDisconnected = () => {
      setOpponentDisconnected(true);
    };

    const handleError = ({ message }) => {
      console.error('Socket error:', message);
    };

    socket.on('gameStart', handleGameStart);
    socket.on('moveMade', handleMoveMade);
    socket.on('timerUpdate', handleTimerUpdate);
    socket.on('gameOver', handleGameOver);
    socket.on('rematchPending', handleRematchPending);
    socket.on('rematchRequested', handleRematchRequested);
    socket.on('opponentDisconnected', handleOpponentDisconnected);
    socket.on('error', handleError);

    return () => {
      socket.off('gameStart', handleGameStart);
      socket.off('moveMade', handleMoveMade);
      socket.off('timerUpdate', handleTimerUpdate);
      socket.off('gameOver', handleGameOver);
      socket.off('rematchPending', handleRematchPending);
      socket.off('rematchRequested', handleRematchRequested);
      socket.off('opponentDisconnected', handleOpponentDisconnected);
      socket.off('error', handleError);
    };
  }, []);

  // ── Move handler ──
  const onMove = useCallback(
    (from, to) => {
      if (gameOver) return false;
      if (game.turn() !== playerColor) return false;

      const gameCopy = new Chess(game.fen());
      let move;
      try {
        move = gameCopy.move({ from, to, promotion: 'q' });
      } catch {
        return false;
      }

      if (!move) return false;

      socket.emit('move', {
        roomId,
        from,
        to,
        promotion: 'q',
      });

      return true;
    },
    [game, playerColor, roomId, gameOver]
  );

  // ── Resign handler ──
  const onResign = useCallback(() => {
    socket.emit('resign', { roomId });
  }, [roomId]);

  // ── Rematch handler ──
  const onRematch = useCallback(() => {
    socket.emit('rematchRequest', { roomId });
    setRematchRequested(true);
  }, [roomId]);

  // ── Go home ──
  const onGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // ── Copy room code ──
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Determine opponent color ──
  const opponentColor = playerColor === 'w' ? 'b' : 'w';

  // ── Waiting for opponent ──
  if (!gameStarted) {
    return (
      <div className="waiting-container">
        <div className="waiting-card">
          <span className="home-icon">⏳</span>
          <h2 className="waiting-title">Waiting for Opponent</h2>
          <p className="waiting-subtitle">
            Share this room code with a friend to start playing
          </p>

          <div
            className="room-code-display"
            onClick={copyRoomCode}
            title="Click to copy"
          >
            {roomId}
          </div>

          <p className="waiting-hint">Click the code to copy it</p>

          <div className="waiting-spinner">
            <span className="spinner-dot"></span>
            <span className="spinner-dot"></span>
            <span className="spinner-dot"></span>
            <span style={{ marginLeft: '8px' }}>Waiting for player to join...</span>
          </div>
        </div>

        {copied && <div className="copy-toast">Room code copied!</div>}
      </div>
    );
  }

  // ── Main game view ──
  return (
    <div className="game-container">
      <div className="game-board-section">
        {/* Opponent clock (top) */}
        <Clock
          time={timers[opponentColor]}
          color={opponentColor}
          isActive={!gameOver && game.turn() === opponentColor}
          label={opponentColor === 'w' ? 'White' : 'Black'}
        />

        {/* Chess board */}
        <ChessBoardComponent
          game={game}
          playerColor={playerColor}
          onMove={onMove}
          lastMove={lastMove}
          gameOver={!!gameOver}
        />

        {/* Player clock (bottom) */}
        <Clock
          time={timers[playerColor]}
          color={playerColor}
          isActive={!gameOver && game.turn() === playerColor}
          label={playerColor === 'w' ? 'White (You)' : 'Black (You)'}
        />
      </div>

      <div className="game-sidebar">
        <MoveHistory moves={moves} />

        <div className="game-controls">
          <ResignButton onResign={onResign} disabled={!!gameOver} />
        </div>
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <GameOverModal
          gameOver={gameOver}
          playerColor={playerColor}
          onRematch={onRematch}
          onGoHome={onGoHome}
          rematchRequested={rematchRequested}
          rematchPending={rematchPending}
          opponentDisconnected={opponentDisconnected}
        />
      )}

      {copied && <div className="copy-toast">Room code copied!</div>}
    </div>
  );
}
