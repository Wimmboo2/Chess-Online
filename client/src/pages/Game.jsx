import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import socket from '../socket.js';
import ChessBoardComponent from '../components/ChessBoard.jsx';
import Clock from '../components/Clock.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import GameOverModal from '../components/GameOverModal.jsx';
import ResignButton from '../components/ResignButton.jsx';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playGameStartSound,
  playCastleSound,
  playGameEndSound,
} from '../utils/sounds.js';
import {
  analyzeMoveEvent,
  getMaterialState,
  getMoveSoundType,
  getOutcomeSound,
} from '../utils/gamePresentation.js';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};

  const [game, setGame] = useState(() => {
    if (navState.fen) {
      const initialGame = new Chess();
      initialGame.load(navState.fen);
      return initialGame;
    }
    return new Chess();
  });
  const [playerColor, setPlayerColor] = useState(navState.color || null);
  const [gameStarted, setGameStarted] = useState(!!navState.joined);
  const [moves, setMoves] = useState([]);
  const [timers, setTimers] = useState(() => {
    const timeControl = navState.timeControl || 600000;
    return { w: timeControl, b: timeControl };
  });
  const [gameOver, setGameOver] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [drawOfferPending, setDrawOfferPending] = useState(false);
  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false);
  const [drawNotice, setDrawNotice] = useState('');

  const gameRef = useRef(game);
  const playerColorRef = useRef(playerColor);
  const drawNoticeTimeoutRef = useRef(null);

  gameRef.current = game;
  playerColorRef.current = playerColor;

  const showDrawNotice = useCallback((message) => {
    if (drawNoticeTimeoutRef.current) {
      clearTimeout(drawNoticeTimeoutRef.current);
    }

    setDrawNotice(message);
    drawNoticeTimeoutRef.current = setTimeout(() => {
      setDrawNotice('');
      drawNoticeTimeoutRef.current = null;
    }, 3000);
  }, []);

  const playMoveEventSound = useCallback((soundType) => {
    if (soundType === 'check') {
      playCheckSound();
      return;
    }

    if (soundType === 'castle') {
      playCastleSound();
      return;
    }

    if (soundType === 'capture') {
      playCaptureSound();
      return;
    }

    playMoveSound();
  }, []);

  const materialState = useMemo(() => getMaterialState(game), [game]);

  useEffect(() => {
    const handleGameStart = ({ color, fen, timeControl }) => {
      const nextGame = new Chess();
      if (fen) nextGame.load(fen);

      setGame(nextGame);
      setPlayerColor(color);
      setGameStarted(true);
      setMoves([]);
      setTimers({ w: timeControl || 600000, b: timeControl || 600000 });
      setGameOver(null);
      setLastMove(null);
      setRematchRequested(false);
      setRematchPending(false);
      setDrawOfferPending(false);
      setIncomingDrawOffer(false);
      setDrawNotice('');
      if (drawNoticeTimeoutRef.current) {
        clearTimeout(drawNoticeTimeoutRef.current);
        drawNoticeTimeoutRef.current = null;
      }
      playGameStartSound();
    };

    const handleMoveMade = ({ from, to, fen, moves: allMoves }) => {
      const moveEvent = analyzeMoveEvent(gameRef.current, from, to, 'q');
      const nextGame = new Chess();
      nextGame.load(fen);

      setGame(nextGame);
      setMoves(allMoves);
      setLastMove({ from, to });
      playMoveEventSound(getMoveSoundType(moveEvent));
    };

    const handleTimerUpdate = ({ w, b }) => {
      setTimers({ w, b });
    };

    const handleGameOver = ({ winner, reason }) => {
      const nextGameOver = { winner, reason };
      setGameOver(nextGameOver);
      playGameEndSound(getOutcomeSound(nextGameOver, playerColorRef.current));
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

    const handleDrawOffered = () => {
      setIncomingDrawOffer(true);
    };

    const handleDrawDeclined = () => {
      setDrawOfferPending(false);
      showDrawNotice('Draw offer declined.');
    };

    const handleDrawOfferBlocked = ({ remainingMoves }) => {
      setDrawOfferPending(false);
      showDrawNotice(
        `You can offer a draw again in ${remainingMoves} move${remainingMoves === 1 ? '' : 's'}.`
      );
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
    socket.on('drawOffered', handleDrawOffered);
    socket.on('drawDeclined', handleDrawDeclined);
    socket.on('drawOfferBlocked', handleDrawOfferBlocked);
    socket.on('error', handleError);

    return () => {
      socket.off('gameStart', handleGameStart);
      socket.off('moveMade', handleMoveMade);
      socket.off('timerUpdate', handleTimerUpdate);
      socket.off('gameOver', handleGameOver);
      socket.off('rematchPending', handleRematchPending);
      socket.off('rematchRequested', handleRematchRequested);
      socket.off('opponentDisconnected', handleOpponentDisconnected);
      socket.off('drawOffered', handleDrawOffered);
      socket.off('drawDeclined', handleDrawDeclined);
      socket.off('drawOfferBlocked', handleDrawOfferBlocked);
      socket.off('error', handleError);
    };
  }, [playMoveEventSound, showDrawNotice]);

  useEffect(() => {
    return () => {
      if (drawNoticeTimeoutRef.current) {
        clearTimeout(drawNoticeTimeoutRef.current);
      }
    };
  }, []);

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
    [game, gameOver, playerColor, roomId]
  );

  const onResign = useCallback(() => {
    socket.emit('resign', { roomId });
  }, [roomId]);

  const onOfferDraw = useCallback(() => {
    socket.emit('offerDraw', { roomId });
    setDrawOfferPending(true);
  }, [roomId]);

  const onRespondDraw = useCallback(
    (accept) => {
      socket.emit('respondDraw', { roomId, accept });
      setIncomingDrawOffer(false);
      if (!accept) {
        showDrawNotice('Draw offer declined.');
      }
    },
    [roomId, showDrawNotice]
  );

  const onRematch = useCallback(() => {
    socket.emit('rematchRequest', { roomId });
    setRematchRequested(true);
  }, [roomId]);

  const onGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const onReviewGame = useCallback(() => {
    navigate('/review', {
      state: {
        moves,
        playerColor,
        opponentName: 'Opponent',
      },
    });
  }, [moves, navigate, playerColor]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const opponentColor = playerColor === 'w' ? 'b' : 'w';

  if (!gameStarted) {
    return (
      <div className="waiting-container">
        <div className="waiting-card">
          <span className="home-icon">...</span>
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

  return (
    <div className="game-container">
      <div className="game-board-section">
        <Clock
          time={timers[opponentColor]}
          color={opponentColor}
          isActive={!gameOver && game.turn() === opponentColor}
          label={opponentColor === 'w' ? 'White' : 'Black'}
          capturedPieces={materialState[opponentColor]?.capturedPieces}
          materialAdvantage={materialState[opponentColor]?.materialAdvantage}
        />

        <ChessBoardComponent
          game={game}
          playerColor={playerColor}
          onMove={onMove}
          lastMove={lastMove}
          gameOver={!!gameOver}
        />

        <Clock
          time={timers[playerColor]}
          color={playerColor}
          isActive={!gameOver && game.turn() === playerColor}
          label={playerColor === 'w' ? 'White (You)' : 'Black (You)'}
          capturedPieces={materialState[playerColor]?.capturedPieces}
          materialAdvantage={materialState[playerColor]?.materialAdvantage}
        />
      </div>

      <div className="game-sidebar">
        <MoveHistory moves={moves} />

        <div className="game-controls">
          <button
            className="btn-secondary"
            onClick={onOfferDraw}
            disabled={!!gameOver || drawOfferPending || incomingDrawOffer}
          >
            {drawOfferPending ? 'Draw Offered...' : 'Offer Draw'}
          </button>
          <ResignButton onResign={onResign} disabled={!!gameOver} />
        </div>
      </div>

      {incomingDrawOffer && !gameOver && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            width: 'min(300px, calc(100vw - 32px))',
            padding: '14px',
            background: 'rgba(18, 18, 26, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.35)',
            zIndex: 120,
            backdropFilter: 'blur(14px)',
          }}
        >
          <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>
            Draw Offer
          </div>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              lineHeight: 1.45,
              marginBottom: '12px',
            }}
          >
            {opponentColor === 'w' ? 'White' : 'Black'} is offering a draw.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-primary btn-small"
              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
              onClick={() => onRespondDraw(true)}
            >
              Accept
            </button>
            <button
              className="btn-secondary btn-small"
              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
              onClick={() => onRespondDraw(false)}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {drawNotice && (
        <div
          style={{
            position: 'fixed',
            top: incomingDrawOffer && !gameOver ? '146px' : '20px',
            right: '20px',
            width: 'min(300px, calc(100vw - 32px))',
            padding: '12px 14px',
            background: 'rgba(10, 10, 15, 0.96)',
            border: '1px solid rgba(212, 168, 67, 0.28)',
            color: 'var(--text-primary)',
            borderRadius: '12px',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.35)',
            zIndex: 119,
            backdropFilter: 'blur(14px)',
            fontSize: '0.84rem',
            lineHeight: 1.45,
          }}
        >
          {drawNotice}
        </div>
      )}

      {gameOver && (
        <GameOverModal
          gameOver={gameOver}
          playerColor={playerColor}
          onRematch={onRematch}
          onGoHome={onGoHome}
          onReviewGame={onReviewGame}
          rematchRequested={rematchRequested}
          rematchPending={rematchPending}
          opponentDisconnected={opponentDisconnected}
        />
      )}

      {copied && <div className="copy-toast">Room code copied!</div>}
    </div>
  );
}
