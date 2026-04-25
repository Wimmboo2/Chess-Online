import { useState } from 'react';

export default function ResignButton({ onResign, disabled }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleResignClick = () => {
    if (disabled) return;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    onResign();
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <button
        id="resign-btn"
        className="btn-danger"
        onClick={handleResignClick}
        disabled={disabled}
        style={{ flex: 1 }}
      >
        ⚑ Resign
      </button>

      {showConfirm && (
        <div className="resign-confirm-overlay" onClick={handleCancel}>
          <div
            className="resign-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Resign this game?</h3>
            <p>Your opponent will be declared the winner. This cannot be undone.</p>
            <div className="resign-confirm-actions">
              <button className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleConfirm}>
                ⚑ Yes, Resign
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
