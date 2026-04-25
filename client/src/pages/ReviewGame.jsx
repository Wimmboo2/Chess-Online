import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import MoveHistory from '../components/MoveHistory.jsx';

export default function ReviewGame() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  
  const moves = state.moves || [];
  const playerColor = state.playerColor || 'w';
  const opponentName = state.opponentName || 'Opponent';

  const [currentMoveIndex, setCurrentMoveIndex] = useState(moves.length);
  const [game, setGame] = useState(new Chess());

  // Rebuild the game state up to the current move index
  useEffect(() => {
    const newGame = new Chess();
    for (let i = 0; i < currentMoveIndex; i++) {
      try {
        newGame.move(moves[i]);
      } catch (e) {
        console.error('Invalid move in history:', moves[i]);
      }
    }
    setGame(newGame);
  }, [currentMoveIndex, moves]);

  const handleFirstMove = () => setCurrentMoveIndex(0);
  const handlePrevMove = () => setCurrentMoveIndex((prev) => Math.max(0, prev - 1));
  const handleNextMove = () => setCurrentMoveIndex((prev) => Math.min(moves.length, prev + 1));
  const handleLastMove = () => setCurrentMoveIndex(moves.length);

  const handleGoHome = () => {
    navigate('/');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrevMove();
      if (e.key === 'ArrowRight') handleNextMove();
      if (e.key === 'ArrowUp') handleFirstMove();
      if (e.key === 'ArrowDown') handleLastMove();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const boardOrientation = playerColor === 'b' ? 'black' : 'white';

  // Calculate the last move made for highlighting
  const lastMoveHighlight = useMemo(() => {
    if (currentMoveIndex === 0) return {};
    const newGame = new Chess();
    for (let i = 0; i < currentMoveIndex; i++) {
      newGame.move(moves[i]);
    }
    const history = newGame.history({ verbose: true });
    if (history.length > 0) {
      const last = history[history.length - 1];
      return {
        [last.from]: { background: 'rgba(255, 255, 100, 0.35)' },
        [last.to]: { background: 'rgba(255, 255, 100, 0.35)' },
      };
    }
    return {};
  }, [currentMoveIndex, moves]);

  return (
    <div className="game-container">
      <div className="game-board-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>Review Mode</h2>
          <div style={{ color: 'var(--text-secondary)' }}>
            {opponentName} ({boardOrientation === 'white' ? 'Black' : 'White'})
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '1', position: 'relative' }}>
          <Chessboard
            id="review-board"
            position={game.fen()}
            boardOrientation={boardOrientation}
            arePiecesDraggable={false}
            customSquareStyles={lastMoveHighlight}
            customBoardStyle={{
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
            customDarkSquareStyle={{ backgroundColor: '#b58863' }}
            customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            animationDuration={200}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            You ({boardOrientation === 'white' ? 'White' : 'Black'})
          </div>
          <div style={{ fontStyle: 'italic' }}>
            {game.turn() === 'w' ? 'White to move' : 'Black to move'}
          </div>
        </div>
      </div>

      <div className="game-sidebar">
        {/* We can use MoveHistory but it doesn't currently support clicking to jump. 
            We will wrap it or rebuild a small history list. */}
        <div className="move-history">
          <h3 className="history-title">Game History</h3>
          <div className="history-list">
            {moves.length === 0 ? (
              <div className="no-moves">No moves made</div>
            ) : (
              moves.reduce((result, move, index) => {
                if (index % 2 === 0) {
                  result.push([move]);
                } else {
                  result[result.length - 1].push(move);
                }
                return result;
              }, []).map((movePair, rowIndex) => (
                <div key={rowIndex} className="history-row">
                  <span className="move-number">{rowIndex + 1}.</span>
                  <span 
                    className={`move-san ${currentMoveIndex === rowIndex * 2 + 1 ? 'active-move' : ''}`}
                    onClick={() => setCurrentMoveIndex(rowIndex * 2 + 1)}
                    style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', background: currentMoveIndex === rowIndex * 2 + 1 ? 'var(--accent-gold)' : 'transparent', color: currentMoveIndex === rowIndex * 2 + 1 ? '#000' : 'inherit' }}
                  >
                    {movePair[0]}
                  </span>
                  {movePair[1] && (
                    <span 
                      className={`move-san ${currentMoveIndex === rowIndex * 2 + 2 ? 'active-move' : ''}`}
                      onClick={() => setCurrentMoveIndex(rowIndex * 2 + 2)}
                      style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', background: currentMoveIndex === rowIndex * 2 + 2 ? 'var(--accent-gold)' : 'transparent', color: currentMoveIndex === rowIndex * 2 + 2 ? '#000' : 'inherit' }}
                    >
                      {movePair[1]}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="review-controls" style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={handleFirstMove} disabled={currentMoveIndex === 0}>&laquo;</button>
          <button className="btn-secondary" onClick={handlePrevMove} disabled={currentMoveIndex === 0}>&lsaquo;</button>
          <button className="btn-secondary" onClick={handleNextMove} disabled={currentMoveIndex === moves.length}>&rsaquo;</button>
          <button className="btn-secondary" onClick={handleLastMove} disabled={currentMoveIndex === moves.length}>&raquo;</button>
        </div>

        <div className="game-controls" style={{ marginTop: '20px' }}>
          <button className="btn-primary" onClick={handleGoHome} style={{ width: '100%' }}>
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
