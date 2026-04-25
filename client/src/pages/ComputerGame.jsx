import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import ChessBoardComponent from '../components/ChessBoard.jsx';
import Clock from '../components/Clock.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import GameOverModal from '../components/GameOverModal.jsx';
import ResignButton from '../components/ResignButton.jsx';
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound, playDrawSound, playGameStartSound } from '../utils/sounds.js';

const STOCKFISH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

export default function ComputerGame() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  
  const playerColor = navState.playerColor || 'w';
  const difficulty = navState.difficulty || 'medium';
  const timeControl = navState.timeControl || 600000;

  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [timers, setTimers] = useState({ w: timeControl, b: timeControl });
  const [gameOver, setGameOver] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [isBotThinking, setIsBotThinking] = useState(false);

  const engineRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);

  // Initialize engine via Web Worker
  useEffect(() => {
    // We use a blob to load the cross-origin worker script
    const workerCode = `importScripts('${STOCKFISH_URL}');`;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    const worker = new Worker(url);
    engineRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.startsWith('bestmove')) {
        const moveMatch = msg.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (moveMatch && moveMatch[1]) {
          const move = moveMatch[1];
          handleEngineMove(move);
        }
      }
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    playGameStartSound();

    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  }, []);

  const getDepth = () => {
    if (difficulty === 'easy') return 2;
    if (difficulty === 'medium') return 8;
    return 15; // hard
  };

  // Bot move logic
  const handleEngineMove = useCallback((moveStr) => {
    setGame((prevGame) => {
      const gameCopy = new Chess(prevGame.fen());
      const from = moveStr.substring(0, 2);
      const to = moveStr.substring(2, 4);
      const promotion = moveStr.length === 5 ? moveStr[4] : undefined;

      let moveResult;
      try {
        moveResult = gameCopy.move({ from, to, promotion });
      } catch (err) {
        console.error('Engine returned illegal move:', moveStr, err);
        return prevGame;
      }

      if (moveResult) {
        setMoves((prev) => [...prev, moveResult.san]);
        setLastMove({ from, to });
        
        if (moveResult.san.includes('+') || moveResult.san.includes('#')) {
          playCheckSound();
        } else if (moveResult.flags.includes('c') || moveResult.san.includes('x')) {
          playCaptureSound();
        } else {
          playMoveSound();
        }

        const endState = checkGameEnd(gameCopy);
        if (endState) {
          setGameOver(endState);
          handleGameEndSound(endState);
        }
      }
      
      setIsBotThinking(false);
      lastTickRef.current = Date.now();
      return gameCopy;
    });
  }, []);

  // Tell engine to move if it's bot's turn
  useEffect(() => {
    if (gameOver || !engineRef.current) return;
    
    if (game.turn() !== playerColor && !isBotThinking) {
      setIsBotThinking(true);
      engineRef.current.postMessage(`position fen ${game.fen()}`);
      engineRef.current.postMessage(`go depth ${getDepth()}`);
    }
  }, [game, playerColor, gameOver, isBotThinking]);

  // Timer logic
  useEffect(() => {
    if (gameOver) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    lastTickRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      setTimers((prev) => {
        const activeColor = game.turn();
        const newTimers = { ...prev };
        newTimers[activeColor] -= elapsed;
        
        if (newTimers[activeColor] <= 0) {
          newTimers[activeColor] = 0;
          setGameOver({
            winner: activeColor === 'w' ? 'b' : 'w',
            reason: 'timeout',
          });
          playGameOverSound();
          clearInterval(timerIntervalRef.current);
        }
        return newTimers;
      });
    }, 100);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [game, gameOver]);

  const checkGameEnd = (currentGame) => {
    if (currentGame.isCheckmate()) {
      const winner = currentGame.turn() === 'w' ? 'b' : 'w';
      return { winner, reason: 'checkmate' };
    }
    if (currentGame.isStalemate()) {
      return { winner: null, reason: 'stalemate' };
    }
    if (currentGame.isThreefoldRepetition()) {
      return { winner: null, reason: 'repetition' };
    }
    if (currentGame.isInsufficientMaterial()) {
      return { winner: null, reason: 'insufficient material' };
    }
    if (currentGame.isDraw()) {
      return { winner: null, reason: '50-move rule' };
    }
    return null;
  };

  const handleGameEndSound = (endState) => {
    if (endState.reason.includes('draw') || endState.reason.includes('stalemate') || endState.reason.includes('repetition') || endState.reason.includes('material') || endState.reason.includes('rule')) {
      playDrawSound();
    } else {
      playGameOverSound();
    }
  };

  const onMove = useCallback(
    (from, to) => {
      if (gameOver || game.turn() !== playerColor) return false;

      const gameCopy = new Chess(game.fen());
      let move;
      try {
        move = gameCopy.move({ from, to, promotion: 'q' });
      } catch {
        return false;
      }

      if (!move) return false;

      setGame(gameCopy);
      setMoves((prev) => [...prev, move.san]);
      setLastMove({ from, to });
      
      if (move.san.includes('+') || move.san.includes('#')) {
        playCheckSound();
      } else if (move.flags.includes('c') || move.san.includes('x')) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
      
      lastTickRef.current = Date.now();

      const endState = checkGameEnd(gameCopy);
      if (endState) {
        setGameOver(endState);
        handleGameEndSound(endState);
      }

      return true;
    },
    [game, playerColor, gameOver]
  );

  const onResign = useCallback(() => {
    setGameOver({
      winner: playerColor === 'w' ? 'b' : 'w',
      reason: 'resignation',
    });
    playGameOverSound();
  }, [playerColor]);

  const onRematch = useCallback(() => {
    setGame(new Chess());
    setMoves([]);
    setTimers({ w: timeControl, b: timeControl });
    setGameOver(null);
    setLastMove(null);
    setIsBotThinking(false);
    lastTickRef.current = Date.now();
    playGameStartSound();
  }, [timeControl]);

  const onGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const onReviewGame = useCallback(() => {
    navigate('/review', { 
      state: { 
        moves, 
        playerColor, 
        opponentName: `Stockfish (${difficulty})`
      } 
    });
  }, [navigate, moves, playerColor, difficulty]);

  const opponentColor = playerColor === 'w' ? 'b' : 'w';

  return (
    <div className="game-container">
      <div className="game-board-section">
        {/* Opponent clock (top) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Clock
            time={timers[opponentColor]}
            color={opponentColor}
            isActive={!gameOver && game.turn() === opponentColor}
            label={`Stockfish (${difficulty})`}
          />
          {isBotThinking && (
            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Thinking...
            </div>
          )}
        </div>

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
          onReviewGame={onReviewGame}
          rematchRequested={false}
          rematchPending={false}
          opponentDisconnected={false}
        />
      )}
    </div>
  );
}
