import { useMemo } from 'react';

export default function Clock({
  time,
  color,
  isActive,
  label,
  capturedPieces = [],
  materialAdvantage = 0,
  sideContent = null,
}) {
  const isLowTime = time < 30000; // < 30 seconds

  const formattedTime = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(time / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [time]);

  const containerClass = [
    'clock-container',
    isActive ? 'active' : '',
    isActive && isLowTime ? 'low-time' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="clock-wrapper">
      <div className={containerClass}>
        <div className="clock-main-row">
          <div className="clock-player-meta">
            <div className={`clock-color-indicator ${color === 'w' ? 'white' : 'black'}`} />
            <span className="clock-player-name">{label}</span>
          </div>
          <div className="clock-main-right">
            {sideContent ? <div className="clock-side-content">{sideContent}</div> : null}
            <span className="clock-time">{formattedTime}</span>
          </div>
        </div>

        {(capturedPieces.length > 0 || materialAdvantage > 0) && (
          <div className="clock-capture-row">
            <div className="clock-captured-pieces" aria-label={`${label} captured pieces`}>
              {capturedPieces.map((piece) => (
                <span
                  key={piece.id}
                  className={`captured-piece captured-piece-${piece.color === 'w' ? 'white' : 'black'}`}
                >
                  {piece.icon}
                </span>
              ))}
            </div>
            {materialAdvantage > 0 ? (
              <span className="clock-material-advantage">+{materialAdvantage}</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
