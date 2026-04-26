import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import ChessBoardComponent from '../components/ChessBoard.jsx';
import Clock from '../components/Clock.jsx';
import MoveHistory from '../components/MoveHistory.jsx';
import GameOverModal from '../components/GameOverModal.jsx';
import ResignButton from '../components/ResignButton.jsx';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCastleSound,
  playGameEndSound,
  playGameStartSound,
} from '../utils/sounds.js';
import { getMaterialState, getMoveSoundType, getOutcomeSound } from '../utils/gamePresentation.js';

export default function LocalGame() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  const timeControl = navState.timeControl || 600000;

  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [timers, setTimers] = useState({ w: timeControl, b: timeControl });
  const [gameOver, setGameOver] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [activeColor, setActiveColor] = useState('w');

  const lastTickRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);

  const materialState = useMemo(() => getMaterialState(game), [game]);

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

  // Auto-draw checks
  const checkGameEnd = useCallback((currentGame, currentActiveColor) => {
    if (currentGame.isCheckmate()) {
      const winner = currentActiveColor === 'w' ? 'b' : 'w';
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
      // Catch-all for 50-move rule since others are explicitly checked
      return { winner: null, reason: 'draw' };
    }
    return null;
  }, []);

  // Timer logic
  useEffect(() => {
    playGameStartSound();
  }, []);

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
        const newTimers = { ...prev };
        newTimers[activeColor] -= elapsed;
        
        if (newTimers[activeColor] <= 0) {
          newTimers[activeColor] = 0;
          setGameOver({
            winner: activeColor === 'w' ? 'b' : 'w',
            reason: 'timeout',
          });
          playGameEndSound('win');
          clearInterval(timerIntervalRef.current);
        }
        return newTimers;
      });
    }, 100);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeColor, gameOver]);

  // Move handler
  const onMove = useCallback(
    (from, to) => {
      if (gameOver) return false;

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
      
      playMoveEventSound(
        getMoveSoundType({
          move,
          san: move.san,
          isCheck: move.san.includes('+') || move.san.includes('#'),
          isCapture: move.flags.includes('c') || move.flags.includes('e') || move.san.includes('x'),
          isCastle: move.flags.includes('k') || move.flags.includes('q'),
        })
      );
      
      const newActiveColor = gameCopy.turn();
      setActiveColor(newActiveColor);
      lastTickRef.current = Date.now(); // reset tick for accurate timing

      const endState = checkGameEnd(gameCopy, activeColor);
      if (endState) {
        setGameOver(endState);
        playGameEndSound(getOutcomeSound(endState));
      }

      return true;
    },
    [game, activeColor, gameOver, checkGameEnd, playMoveEventSound]
  );

  const onResign = useCallback(() => {
    setGameOver({
      winner: activeColor === 'w' ? 'b' : 'w',
      reason: 'resignation',
    });
    playGameEndSound('win');
  }, [activeColor]);

  const onRematch = useCallback(() => {
    setGame(new Chess());
    setMoves([]);
    setTimers({ w: timeControl, b: timeControl });
    setGameOver(null);
    setLastMove(null);
    setActiveColor('w');
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
        playerColor: 'w', 
        opponentName: 'Local Player'
      } 
    });
  }, [navigate, moves]);

  const boardOrientation = activeColor === 'b' ? 'black' : 'white';
  const opponentColor = activeColor === 'w' ? 'b' : 'w';

  return (
    <div className="game-container">
      <div className="game-board-section">
        {/* Opponent clock (top) */}
        <Clock
          time={timers[opponentColor]}
          color={opponentColor}
          isActive={!gameOver && false} // opponent is never active in local view
          label={opponentColor === 'w' ? 'White' : 'Black'}
          capturedPieces={materialState[opponentColor]?.capturedPieces}
          materialAdvantage={materialState[opponentColor]?.materialAdvantage}
        />

        {/* Chess board */}
        <ChessBoardComponent
          game={game}
          playerColor={activeColor} // The board is always oriented to the active player
          onMove={onMove}
          lastMove={lastMove}
          gameOver={!!gameOver}
        />

        {/* Player clock (bottom) */}
        <Clock
          time={timers[activeColor]}
          color={activeColor}
          isActive={!gameOver}
          label={activeColor === 'w' ? 'White (To Move)' : 'Black (To Move)'}
          capturedPieces={materialState[activeColor]?.capturedPieces}
          materialAdvantage={materialState[activeColor]?.materialAdvantage}
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
          playerColor={activeColor} // Relative to the active player who just lost/won/drew
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
