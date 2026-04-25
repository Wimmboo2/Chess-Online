import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export default function ChessBoardComponent({ game, playerColor, onMove, lastMove, gameOver }) {
  const boardOrientation = playerColor === 'b' ? 'black' : 'white';

  // State for Highlights & Premoves
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [premove, setPremove] = useState(null); // { from, to }

  // State for Custom Annotations
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [customArrows, setCustomArrows] = useState([]); // [ [start, end, color] ]
  const [drawingArrow, setDrawingArrow] = useState(null); // { start, end, color }

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
        setSelectedSquare(null);
        setOptionSquares({});
      }
      return false; 
    }

    return false;
  };

  // ── Annotations (Arrows & Circles) ──
  const getSquareFromCoords = (x, y) => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;

    const size = rect.width / 8;
    const col = Math.floor((x - rect.left) / size);
    const row = Math.floor((y - rect.top) / size);
    
    const safeCol = Math.max(0, Math.min(7, col));
    const safeRow = Math.max(0, Math.min(7, row));

    const file = String.fromCharCode(97 + (boardOrientation === 'white' ? safeCol : 7 - safeCol));
    const rank = boardOrientation === 'white' ? 8 - safeRow : safeRow + 1;
    
    return `${file}${rank}`;
  };

  const getSquareCenter = (sq) => {
    if (!sq) return { x: 0, y: 0 };
    const fileIndex = sq.charCodeAt(0) - 97;
    const rankIndex = parseInt(sq[1], 10) - 1;

    const col = boardOrientation === 'white' ? fileIndex : 7 - fileIndex;
    const row = boardOrientation === 'white' ? 7 - rankIndex : rankIndex;

    return {
      x: col * 12.5 + 6.25,
      y: row * 12.5 + 6.25,
    };
  };

  const handleMouseDown = useCallback((e) => {
    if (e.button === 2) {
      setPremove(null);
      const sq = getSquareFromCoords(e.clientX, e.clientY);
      if (sq) {
        let color = 'rgba(21, 120, 27, 0.8)'; // green
        if (e.shiftKey) color = 'rgba(235, 151, 78, 0.8)'; // yellow/orange
        if (e.altKey) color = 'rgba(200, 30, 30, 0.8)'; // red
        
        setDrawingArrow({ start: sq, end: sq, color });
      }
    } else if (e.button === 0) {
      setCustomArrows([]);
      setRightClickedSquares({});
    }
  }, [boardOrientation]);

  // Keep a ref to the latest drawing arrow to avoid rebinding global listeners on every drag tick
  const drawingArrowRef = useRef(drawingArrow);
  useEffect(() => {
    drawingArrowRef.current = drawingArrow;
  }, [drawingArrow]);

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      const current = drawingArrowRef.current;
      if (current) {
        const sq = getSquareFromCoords(e.clientX, e.clientY);
        if (sq && sq !== current.end) {
          setDrawingArrow((prev) => prev ? { ...prev, end: sq } : null);
        }
      }
    };

    const handleWindowMouseUp = (e) => {
      const current = drawingArrowRef.current;
      if (!current) return;
      
      // Only finalize the shape if it's a right click release
      if (e.button === 2) {
        const sq = getSquareFromCoords(e.clientX, e.clientY);
        if (sq) {
          if (sq === current.start) {
            setRightClickedSquares((prev) => {
              const next = { ...prev };
              if (next[sq]) {
                delete next[sq];
              } else {
                const fillColor = current.color.replace('0.8)', '0.5)');
                next[sq] = { backgroundColor: fillColor };
              }
              return next;
            });
          } else {
            setCustomArrows((prev) => [...prev, [current.start, sq, current.color]]);
          }
        }
      }
      
      // ALWAYS clear drawing state on ANY mouse up to prevent sticking
      setDrawingArrow(null);
    };

    const handleGlobalContextMenu = () => {
      if (drawingArrowRef.current) {
        setDrawingArrow(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('contextmenu', handleGlobalContextMenu);
    
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  }, [boardOrientation]); // Only rebind if orientation changes

  // Prevent context menu anywhere on the document while using the app
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

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

    Object.keys(rightClickedSquares).forEach((sq) => {
      styles[sq] = { ...styles[sq], ...rightClickedSquares[sq] };
    });

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
  }, [lastMove, game, selectedSquare, optionSquares, premove, rightClickedSquares]);

  const isDraggable = !gameOver;

  const getMarkerId = (color) => {
    if (color.includes('235, 151, 78')) return 'arrow-yellow';
    if (color.includes('200, 30, 30')) return 'arrow-red';
    return 'arrow-green';
  };

  return (
    <div 
      ref={boardRef}
      onMouseDown={handleMouseDown}
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

      {/* Custom SVG Overlay for Multi-colored Arrows */}
      <svg 
        viewBox="0 0 100 100" 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
      >
        <defs>
          <marker id="arrow-green" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 4 2, 0 4" fill="rgba(21, 120, 27, 0.8)" />
          </marker>
          <marker id="arrow-yellow" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 4 2, 0 4" fill="rgba(235, 151, 78, 0.8)" />
          </marker>
          <marker id="arrow-red" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 4 2, 0 4" fill="rgba(200, 30, 30, 0.8)" />
          </marker>
        </defs>
        
        {customArrows.map((arrow, i) => {
          const [start, end, color] = arrow;
          const startPos = getSquareCenter(start);
          const endPos = getSquareCenter(end);
          
          const dx = endPos.x - startPos.x;
          const dy = endPos.y - startPos.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length === 0) return null;
          const shorten = 3.5;
          const ratio = Math.max(0, (length - shorten) / length);
          
          return (
            <line
              key={i}
              x1={startPos.x}
              y1={startPos.y}
              x2={startPos.x + dx * ratio}
              y2={startPos.y + dy * ratio}
              stroke={color}
              strokeWidth="1.8"
              strokeLinecap="round"
              markerEnd={`url(#${getMarkerId(color)})`}
            />
          );
        })}

        {drawingArrow && drawingArrow.end && drawingArrow.start !== drawingArrow.end && (() => {
          const startPos = getSquareCenter(drawingArrow.start);
          const endPos = getSquareCenter(drawingArrow.end);
          const dx = endPos.x - startPos.x;
          const dy = endPos.y - startPos.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const shorten = 3.5;
          const ratio = Math.max(0, (length - shorten) / length);
          
          return (
            <line
              x1={startPos.x}
              y1={startPos.y}
              x2={startPos.x + dx * ratio}
              y2={startPos.y + dy * ratio}
              stroke={drawingArrow.color}
              strokeWidth="1.8"
              strokeLinecap="round"
              markerEnd={`url(#${getMarkerId(drawingArrow.color)})`}
            />
          );
        })()}
      </svg>
    </div>
  );
}
