import { useMemo } from 'react';

export default function Clock({ time, color, isActive, label }) {
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
        <div className={`clock-color-indicator ${color === 'w' ? 'white' : 'black'}`} />
        <span className="clock-player-name">{label}</span>
        <span className="clock-time">{formattedTime}</span>
      </div>
    </div>
  );
}
