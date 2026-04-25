export default function GameOverModal({
  gameOver,
  playerColor,
  onRematch,
  onGoHome,
  rematchRequested,
  rematchPending,
  opponentDisconnected,
}) {
  const { winner, reason } = gameOver;

  // Determine result from player's perspective
  const isWin = winner === playerColor;
  const isDraw = winner === null;
  const isLoss = !isDraw && !isWin;

  // Result text
  let titleText = '';
  let titleClass = '';
  let icon = '';

  if (isDraw) {
    titleText = 'Draw';
    titleClass = 'gameover-title draw';
    icon = '🤝';
  } else if (isWin) {
    titleText = 'You Win!';
    titleClass = 'gameover-title win';
    icon = '🏆';
  } else {
    titleText = 'You Lose';
    titleClass = 'gameover-title lose';
    icon = '😞';
  }

  // Reason text
  const reasonTextMap = {
    checkmate: isDraw ? '' : isWin ? 'Checkmate! Well played.' : 'Checkmate.',
    timeout: isDraw ? '' : isWin ? 'Opponent ran out of time.' : 'You ran out of time.',
    resignation: isWin ? 'Opponent resigned.' : 'You resigned.',
    stalemate: 'Stalemate — no legal moves available.',
    draw: 'Draw by agreement.',
    repetition: 'Draw by threefold repetition.',
    'insufficient material': 'Draw by insufficient material.',
    abandonment: isWin ? 'Opponent disconnected.' : 'You disconnected.',
  };

  const reasonText = reasonTextMap[reason] || reason;

  return (
    <div className="gameover-overlay">
      <div className="gameover-modal">
        <span className="gameover-icon">{icon}</span>
        <h2 className={titleClass}>{titleText}</h2>
        <p className="gameover-reason">{reasonText}</p>

        <div className="gameover-actions">
          {!opponentDisconnected && (
            <button
              id="rematch-btn"
              className="btn-primary"
              onClick={onRematch}
              disabled={rematchRequested}
            >
              {rematchRequested ? '✓ Rematch Requested' : '⟳ Rematch'}
            </button>
          )}

          {rematchRequested && !rematchPending && (
            <p className="rematch-status">Waiting for opponent to accept...</p>
          )}

          {rematchPending && !rematchRequested && (
            <p className="rematch-status">Opponent wants a rematch!</p>
          )}

          <button
            id="go-home-btn"
            className="btn-secondary"
            onClick={onGoHome}
          >
            ← Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
