import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { playPremoveSound } from '../utils/sounds.js';

export default function ChessBoardComponent({ game, playerColor, onMove, lastMove, gameOver }) {
  const boardOrientation = playerColor === 'b' ? 'black' : 'white';

  // State for Highlights & Premoves
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [premove, setPremove] = useState(null); // { from, to }

  const boardRef = useRef(null);

  // ── Premove Execution Loop ──
  useEffect(() => {
    if (!premove || gameOver || game.turn() !== playerColor) return;

    // It's our turn now! Is the premove still legal?
    const gameCopy = new Chess(game.fen());
    let move;
    try {
      move = gameCopy.move({ from: premove.from, to: premove.to, promotion: 'q' });
    } catch {
      // Illegal move
    }

    if (move) {
      onMove(premove.from, premove.to);
    }
    setPremove(null);
  }, [game, playerColor, gameOver, premove, onMove]);

  // ── Move Logic ──
  const selectPiece = useCallback(
    (square) => {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      const newOptions = {};
      moves.forEach((m) => {
        const isCapture = m.flags.includes('c') || game.get(m.to);
        newOptions[m.to] = {
          background: isCapture
            ? 'radial-gradient(circle, transparent 0%, transparent 60%, rgba(0,0,0,0.2) 65%, rgba(0,0,0,0.2) 80%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.2) 20%, transparent 25%)',
          borderRadius: '50%',
        };
      });
      setOptionSquares(newOptions);
    },
    [game]
  );

  const onSquareClick = (square) => {
    if (gameOver) return;

    if (game.turn() !== playerColor && playerColor) {
      if (selectedSquare) {
        if (selectedSquare !== square) {
          setPremove({ from: selectedSquare, to: square });
          playPremoveSound();
        }
        setSelectedSquare(null);
        setOptionSquares({});
      } else {
        const piece = game.get(square);
        if (piece && piece.color === playerColor) {
          setSelectedSquare(square);
          setOptionSquares({});
        }
      }
      return;
    }

    if (selectedSquare) {
      const moves = game.moves({ square: selectedSquare, verbose: true });
      const move = moves.find((m) => m.to === square);
      
      if (move) {
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setOptionSquares({});
        return;
      }

      const piece = game.get(square);
      if (piece && piece.color === game.turn() && piece.color === playerColor) {
        selectPiece(square);
        return;
      }

      setSelectedSquare(null);
      setOptionSquares({});
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn() && piece.color === playerColor) {
        selectPiece(square);
      }
    }
  };

  const onDrop = (sourceSquare, targetSquare) => {
    if (gameOver) return false;

    if (game.turn() === playerColor) {
      setSelectedSquare(null);
      setOptionSquares({});
      return onMove(sourceSquare, targetSquare);
    }

    if (game.turn() !== playerColor && playerColor) {
      const piece = game.get(sourceSquare);
      if (piece && piece.color === playerColor) {
        setPremove({ from: sourceSquare, to: targetSquare });
        playPremoveSound();
        setSelectedSquare(null);
        setOptionSquares({});
      }
      return false; 
    }

    return false;
  };

  // ── Combined Styles ──
  const customSquareStyles = useMemo(() => {
    const styles = {};

    if (lastMove) {
      styles[lastMove.from] = { background: 'rgba(255, 255, 100, 0.35)' };
      styles[lastMove.to] = { background: 'rgba(255, 255, 100, 0.35)' };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { background: 'rgba(255, 255, 50, 0.5)' };
    }

    Object.keys(optionSquares).forEach((sq) => {
      styles[sq] = { ...styles[sq], ...optionSquares[sq] };
    });

    if (premove) {
      styles[premove.from] = { background: 'rgba(128, 0, 128, 0.4)' };
      styles[premove.to] = { background: 'rgba(128, 0, 128, 0.4)' };
    }

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
              ...styles[square],
              background: 'radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.3) 60%, transparent 100%)',
            };
          }
        }
      }
    }

    return styles;
  }, [lastMove, game, selectedSquare, optionSquares, premove]);

  const isDraggable = !gameOver;

  return (
    <div 
      ref={boardRef}
      style={{ width: '100%', maxWidth: '640px', aspectRatio: '1', position: 'relative' }}
    >
      <Chessboard
        id="game-board"
        position={game.fen()}
        onPieceDrop={onDrop}
        onSquareClick={onSquareClick}
        boardOrientation={boardOrientation}
        arePiecesDraggable={isDraggable}
        customSquareStyles={customSquareStyles}
        areArrowsAllowed={false}
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
