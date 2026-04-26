const INITIAL_PIECE_COUNTS = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
};

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const PIECE_ICON_MAP = {
  w: {
    p: '♙',
    n: '♘',
    b: '♗',
    r: '♖',
    q: '♕',
  },
  b: {
    p: '♟',
    n: '♞',
    b: '♝',
    r: '♜',
    q: '♛',
  },
};

const MATERIAL_ORDER = ['q', 'r', 'b', 'n', 'p'];

function getMissingPieces(game, color) {
  const remaining = {
    p: 0,
    n: 0,
    b: 0,
    r: 0,
    q: 0,
  };

  game.board().forEach((row) => {
    row.forEach((piece) => {
      if (piece && piece.color === color && remaining[piece.type] !== undefined) {
        remaining[piece.type] += 1;
      }
    });
  });

  return MATERIAL_ORDER.reduce((missing, type) => {
    missing[type] = Math.max(0, INITIAL_PIECE_COUNTS[type] - remaining[type]);
    return missing;
  }, {});
}

function expandCapturedPieces(missingPieces, capturedColor) {
  return MATERIAL_ORDER.flatMap((type) =>
    Array.from({ length: missingPieces[type] }, (_, index) => ({
      id: `${capturedColor}-${type}-${index}`,
      type,
      color: capturedColor,
      icon: PIECE_ICON_MAP[capturedColor][type],
      value: PIECE_VALUES[type],
    }))
  );
}

function getCapturedValue(capturedPieces) {
  return capturedPieces.reduce((total, piece) => total + piece.value, 0);
}

export function analyzeMoveEvent(game, from, to, promotion = 'q') {
  const gameCopy = new game.constructor(game.fen());

  try {
    const move = gameCopy.move({ from, to, promotion });
    if (!move) {
      return null;
    }

    return {
      move,
      san: move.san,
      isCheck: move.san.includes('+') || move.san.includes('#'),
      isCapture: move.flags.includes('c') || move.flags.includes('e') || move.san.includes('x'),
      isCastle: move.flags.includes('k') || move.flags.includes('q'),
    };
  } catch {
    return null;
  }
}

export function getMoveSoundType(moveEvent) {
  if (!moveEvent) return 'move';
  if (moveEvent.isCheck) return 'check';
  if (moveEvent.isCastle) return 'castle';
  if (moveEvent.isCapture) return 'capture';
  return 'move';
}

export function getOutcomeSound(gameOver, playerColor) {
  const reason = gameOver?.reason?.toLowerCase() || '';
  const isDraw =
    !gameOver?.winner ||
    reason.includes('draw') ||
    reason.includes('stalemate') ||
    reason.includes('repetition') ||
    reason.includes('material') ||
    reason.includes('rule');

  if (isDraw) {
    return 'draw';
  }

  if (!playerColor) {
    return 'win';
  }

  return gameOver.winner === playerColor ? 'win' : 'loss';
}

export function getMaterialState(game) {
  const missingWhite = getMissingPieces(game, 'w');
  const missingBlack = getMissingPieces(game, 'b');

  const capturedByBlack = expandCapturedPieces(missingWhite, 'w');
  const capturedByWhite = expandCapturedPieces(missingBlack, 'b');

  const whiteCapturedValue = getCapturedValue(capturedByWhite);
  const blackCapturedValue = getCapturedValue(capturedByBlack);

  return {
    w: {
      capturedPieces: capturedByWhite,
      materialAdvantage: Math.max(0, whiteCapturedValue - blackCapturedValue),
    },
    b: {
      capturedPieces: capturedByBlack,
      materialAdvantage: Math.max(0, blackCapturedValue - whiteCapturedValue),
    },
  };
}
