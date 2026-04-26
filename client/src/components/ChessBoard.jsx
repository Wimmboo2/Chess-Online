import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { playPremoveSound } from '../utils/sounds.js';

const ANNOTATION_COLOR = '#4ade80';

function getSquareCenter(square, orientation) {
  const fileIndex = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);

  const xIndex = orientation === 'black' ? 7 - fileIndex : fileIndex;
  const yIndex = orientation === 'black' ? rank - 1 : 8 - rank;

  return {
    x: (xIndex + 0.5) * 12.5,
    y: (yIndex + 0.5) * 12.5,
  };
}

function areAnnotationsEqual(first, second) {
  if (!first || !second || first.type !== second.type) return false;
  if (first.type === 'circle') {
    return first.square === second.square;
  }
  return first.from === second.from && first.to === second.to;
}

export default function ChessBoardComponent({ game, playerColor, onMove, lastMove, gameOver }) {
  const boardOrientation = playerColor === 'b' ? 'black' : 'white';

  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [premove, setPremove] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [rightDrag, setRightDrag] = useState(null);

  const boardRef = useRef(null);
  const rightDragRef = useRef(null);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setOptionSquares({});
  }, []);

  const cancelPremove = useCallback(() => {
    setPremove(null);
  }, []);

  const getSquareFromPoint = useCallback(
    (clientX, clientY) => {
      if (!boardRef.current) return null;

      const rect = boardRef.current.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }

      const squareSize = rect.width / 8;
      const boardX = Math.min(7, Math.max(0, Math.floor((clientX - rect.left) / squareSize)));
      const boardY = Math.min(7, Math.max(0, Math.floor((clientY - rect.top) / squareSize)));

      const fileIndex = boardOrientation === 'black' ? 7 - boardX : boardX;
      const rank = boardOrientation === 'black' ? boardY + 1 : 8 - boardY;

      return `${String.fromCharCode(97 + fileIndex)}${rank}`;
    },
    [boardOrientation]
  );

  const toggleAnnotation = useCallback((annotation) => {
    setAnnotations((current) => {
      const exists = current.some((item) => areAnnotationsEqual(item, annotation));
      if (exists) {
        return current.filter((item) => !areAnnotationsEqual(item, annotation));
      }
      return [...current, annotation];
    });
  }, []);

  useEffect(() => {
    if (!premove || gameOver || game.turn() !== playerColor) return;

    const gameCopy = new Chess(game.fen());
    let move;
    try {
      move = gameCopy.move({ from: premove.from, to: premove.to, promotion: 'q' });
    } catch {
      move = null;
    }

    if (move) {
      onMove(premove.from, premove.to);
    }
    setPremove(null);
  }, [game, playerColor, gameOver, premove, onMove]);

  useEffect(() => {
    const handleWindowMouseMove = (event) => {
      const activeDrag = rightDragRef.current;
      if (!activeDrag) return;

      const hoveredSquare = getSquareFromPoint(event.clientX, event.clientY);
      const previewTo = hoveredSquare || activeDrag.startSquare;

      const nextDrag = {
        ...activeDrag,
        previewTo,
      };

      rightDragRef.current = nextDrag;
      setRightDrag(nextDrag);
    };

    const handleWindowMouseUp = (event) => {
      const activeDrag = rightDragRef.current;
      if (!activeDrag || event.button !== 2) return;

      const endSquare = getSquareFromPoint(event.clientX, event.clientY);
      if (endSquare) {
        if (endSquare === activeDrag.startSquare) {
          toggleAnnotation({ type: 'circle', square: activeDrag.startSquare });
        } else {
          toggleAnnotation({ type: 'arrow', from: activeDrag.startSquare, to: endSquare });
        }
      }

      rightDragRef.current = null;
      setRightDrag(null);
    };

    const handleWindowMouseDown = (event) => {
      if (event.button === 0) {
        setAnnotations([]);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        cancelPremove();
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('mousedown', handleWindowMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelPremove, getSquareFromPoint, toggleAnnotation]);

  const selectPiece = useCallback(
    (square) => {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      const newOptions = {};
      moves.forEach((move) => {
        const isCapture = move.flags.includes('c') || game.get(move.to);
        newOptions[move.to] = {
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
        clearSelection();
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
      const move = moves.find((candidate) => candidate.to === square);

      if (move) {
        onMove(selectedSquare, square);
        clearSelection();
        return;
      }

      const piece = game.get(square);
      if (piece && piece.color === game.turn() && piece.color === playerColor) {
        selectPiece(square);
        return;
      }

      clearSelection();
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn() && piece.color === playerColor) {
        selectPiece(square);
      }
    }
  };

  const onDrop = (sourceSquare, targetSquare) => {
    clearSelection();

    if (gameOver || !targetSquare) return false;

    if (game.turn() === playerColor) {
      return onMove(sourceSquare, targetSquare);
    }

    if (game.turn() !== playerColor && playerColor) {
      const piece = game.get(sourceSquare);
      if (piece && piece.color === playerColor) {
        setPremove({ from: sourceSquare, to: targetSquare });
        playPremoveSound();
      }
      return false;
    }

    return false;
  };

  const onPieceDragBegin = (_piece, sourceSquare) => {
    if (gameOver) return;

    const sourcePiece = game.get(sourceSquare);
    if (!sourcePiece) return;

    if (game.turn() !== playerColor && playerColor) {
      setSelectedSquare(sourceSquare);
      setOptionSquares({});
      return;
    }

    if (sourcePiece.color === game.turn() && sourcePiece.color === playerColor) {
      selectPiece(sourceSquare);
    }
  };

  const onPieceDragEnd = () => {
    clearSelection();
  };

  const onBoardMouseDown = useCallback(
    (event) => {
      if (event.button !== 2) return;

      event.preventDefault();

      if (premove) {
        cancelPremove();
        clearSelection();
        return;
      }

      const startSquare = getSquareFromPoint(event.clientX, event.clientY);
      if (!startSquare) return;

      clearSelection();

      const nextDrag = {
        startSquare,
        previewTo: startSquare,
      };

      rightDragRef.current = nextDrag;
      setRightDrag(nextDrag);
    },
    [cancelPremove, clearSelection, getSquareFromPoint, premove]
  );

  const annotationMarkup = useMemo(() => {
    const renderArrow = (from, to, key, dashed = false) => {
      const start = getSquareCenter(from, boardOrientation);
      const end = getSquareCenter(to, boardOrientation);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const shortenBy = 4.2;
      const targetX = end.x - (dx / length) * shortenBy;
      const targetY = end.y - (dy / length) * shortenBy;

      return (
        <line
          key={key}
          x1={start.x}
          y1={start.y}
          x2={targetX}
          y2={targetY}
          stroke={ANNOTATION_COLOR}
          strokeWidth="2.1"
          strokeLinecap="round"
          markerEnd="url(#board-arrowhead)"
          opacity={dashed ? '0.72' : '0.82'}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      );
    };

    const renderCircle = (square, key) => {
      const center = getSquareCenter(square, boardOrientation);
      return (
        <circle
          key={key}
          cx={center.x}
          cy={center.y}
          r="4.2"
          fill="rgba(74, 222, 128, 0.22)"
          stroke={ANNOTATION_COLOR}
          strokeWidth="1.6"
          opacity="0.88"
        />
      );
    };

    const shapes = annotations.map((annotation, index) =>
      annotation.type === 'circle'
        ? renderCircle(annotation.square, `circle-${annotation.square}-${index}`)
        : renderArrow(annotation.from, annotation.to, `arrow-${annotation.from}-${annotation.to}-${index}`)
    );

    if (
      rightDrag &&
      rightDrag.previewTo &&
      rightDrag.previewTo !== rightDrag.startSquare
    ) {
      shapes.push(
        renderArrow(
          rightDrag.startSquare,
          rightDrag.previewTo,
          'arrow-preview',
          true
        )
      );
    } else if (rightDrag?.startSquare) {
      shapes.push(renderCircle(rightDrag.startSquare, 'circle-preview'));
    }

    return shapes;
  }, [annotations, boardOrientation, rightDrag]);

  const customSquareStyles = useMemo(() => {
    const styles = {};

    if (lastMove) {
      styles[lastMove.from] = { background: 'rgba(255, 255, 100, 0.35)' };
      styles[lastMove.to] = { background: 'rgba(255, 255, 100, 0.35)' };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { background: 'rgba(255, 255, 50, 0.5)' };
    }

    Object.keys(optionSquares).forEach((square) => {
      styles[square] = { ...styles[square], ...optionSquares[square] };
    });

    if (premove) {
      styles[premove.from] = { background: 'rgba(128, 0, 128, 0.4)' };
      styles[premove.to] = { background: 'rgba(128, 0, 128, 0.4)' };
    }

    if (game.inCheck()) {
      const board = game.board();
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const piece = board[row][col];
          if (piece && piece.type === 'k' && piece.color === game.turn()) {
            const file = String.fromCharCode(97 + col);
            const rank = 8 - row;
            const square = `${file}${rank}`;
            styles[square] = {
              ...styles[square],
              background:
                'radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.3) 60%, transparent 100%)',
            };
          }
        }
      }
    }

    return styles;
  }, [game, lastMove, optionSquares, premove, selectedSquare]);

  return (
    <div
      ref={boardRef}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={onBoardMouseDown}
      style={{
        width: '100%',
        maxWidth: '640px',
        aspectRatio: '1',
        position: 'relative',
      }}
    >
      <Chessboard
        id="game-board"
        position={game.fen()}
        onPieceDrop={onDrop}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDragEnd={onPieceDragEnd}
        onSquareClick={onSquareClick}
        boardOrientation={boardOrientation}
        arePiecesDraggable={!gameOver}
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

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      >
        <defs>
          <marker
            id="board-arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5.2"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 z" fill={ANNOTATION_COLOR} />
          </marker>
        </defs>
        {annotationMarkup}
      </svg>
    </div>
  );
}
