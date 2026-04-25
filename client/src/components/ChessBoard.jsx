import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';

export default function ChessBoardComponent({ game, playerColor, onMove, lastMove, gameOver }) {
  // Board orientation based on player color
  const boardOrientation = playerColor === 'b' ? 'black' : 'white';

  // Handle piece drop
  const onDrop = (sourceSquare, targetSquare) => {
    return onMove(sourceSquare, targetSquare);
  };

  // Highlight last move squares
  const customSquareStyles = useMemo(() => {
    const styles = {};

    if (lastMove) {
      styles[lastMove.from] = {
        background: 'rgba(255, 255, 100, 0.35)',
      };
      styles[lastMove.to] = {
        background: 'rgba(255, 255, 100, 0.35)',
      };
    }

    // Highlight king in check
    if (game.inCheck()) {
      const board = game.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === game.turn()) {
            const file = String.fromCharCode(97 + c);
            const rank = 8 - r;
            const square = `${file}${rank}`;
            styles[square] = {
              background: 'radial-gradient(circle, rgba(255,0,0,0.5) 0%, rgba(255,0,0,0.15) 70%, transparent 100%)',
              borderRadius: '50%',
            };
          }
        }
      }
    }

    return styles;
  }, [lastMove, game]);

  // Can the player interact with the board?
  const isDraggable = !gameOver && game.turn() === playerColor;

  return (
    <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '1' }}>
      <Chessboard
        id="game-board"
        position={game.fen()}
        onPieceDrop={onDrop}
        boardOrientation={boardOrientation}
        arePiecesDraggable={isDraggable}
        customSquareStyles={customSquareStyles}
        customBoardStyle={{
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#b58863' }}
        customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
        animationDuration={200}
      />
    </div>
  );
}
