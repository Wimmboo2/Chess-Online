import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket.js';

const TIME_CONTROLS = [
  { label: 'Rapid', value: 600000, desc: '10 min' },
  { label: 'Blitz', value: 300000, desc: '5 min' },
  { label: 'Bullet', value: 60000, desc: '1 min' },
];

export default function Home() {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState(600000);
  const [botMenuOpen, setBotMenuOpen] = useState(false);
  const [botColor, setBotColor] = useState('w'); // user color
  const [botDifficulty, setBotDifficulty] = useState('easy');
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    setError('');
    setLoading(true);

    socket.emit('createRoom', { timeControl: selectedTime });

    socket.once('roomCreated', ({ roomId }) => {
      setLoading(false);
      navigate(`/game/${roomId}`, { state: { timeControl: selectedTime } });
    });

    setTimeout(() => {
      setLoading(false);
    }, 5000);
  };

  const handleJoinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a room code.');
      return;
    }
    if (code.length < 4) {
      setError('Room code must be at least 4 characters.');
      return;
    }

    setError('');
    setLoading(true);

    socket.emit('joinRoom', { roomId: code });

    // Pass game data through navigation state so Game.jsx can initialize
    // without needing to catch the gameStart event itself
    socket.once('gameStart', ({ color, roomId, fen, timeControl }) => {
      setLoading(false);
      navigate(`/game/${roomId}`, {
        state: { color, fen, timeControl, joined: true },
      });
    });

    socket.once('error', ({ message }) => {
      setLoading(false);
      setError(message);
    });

    setTimeout(() => {
      setLoading(false);
    }, 5000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <span className="home-icon">♟</span>
        <h1 className="home-title">Chess Online</h1>
        <p className="home-subtitle">
          Play chess with friends in real-time.<br />
          Create a room or join one with a code.
        </p>

        {/* Time Control Selector */}
        <div className="time-control-selector">
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.value}
              className={`time-control-btn ${selectedTime === tc.value ? 'active' : ''}`}
              onClick={() => setSelectedTime(tc.value)}
            >
              <span className="tc-label">{tc.label}</span>
              <span className="tc-desc">{tc.desc}</span>
            </button>
          ))}
        </div>

        <button
          id="create-room-btn"
          className="btn-primary"
          onClick={handleCreateRoom}
          disabled={loading}
        >
          ✦ Create New Room
        </button>

        <button
          id="play-locally-btn"
          className="btn-secondary"
          onClick={() => navigate('/local', { state: { timeControl: selectedTime } })}
          style={{ marginTop: '10px' }}
        >
          🤝 Play Locally (Pass & Play)
        </button>

        <button
          id="play-bot-btn"
          className="btn-secondary"
          onClick={() => setBotMenuOpen(true)}
          style={{ marginTop: '10px', background: 'var(--bg-glass)' }}
        >
          🤖 Play vs Computer
        </button>

        <div className="home-divider">
          <span>or join a room</span>
        </div>

        <div className="input-group">
          <input
            id="join-code-input"
            type="text"
            className="input-field"
            placeholder="Enter code"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
          />
          <button
            id="join-room-btn"
            className="btn-secondary"
            onClick={handleJoinRoom}
            disabled={loading}
            style={{ width: 'auto', minWidth: '100px' }}
          >
            Join
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}
      </div>

      {/* Bot Setup Modal */}
      {botMenuOpen && (
        <div className="gameover-overlay">
          <div className="gameover-modal" style={{ textAlign: 'center' }}>
            <h2 className="gameover-title">Play vs Computer</h2>
            
            <div style={{ margin: '20px 0' }}>
              <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Choose Your Color:</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button 
                  className={`btn-secondary ${botColor === 'w' ? 'selected' : ''}`}
                  onClick={() => setBotColor('w')}
                  style={{ background: botColor === 'w' ? 'var(--accent-gold)' : '' }}
                >
                  White
                </button>
                <button 
                  className={`btn-secondary ${botColor === 'b' ? 'selected' : ''}`}
                  onClick={() => setBotColor('b')}
                  style={{ background: botColor === 'b' ? 'var(--accent-gold)' : '' }}
                >
                  Black
                </button>
              </div>
            </div>

            <div style={{ margin: '20px 0' }}>
              <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Difficulty:</p>
              <select 
                className="input-field" 
                value={botDifficulty} 
                onChange={(e) => setBotDifficulty(e.target.value)}
                style={{ width: '100%', marginBottom: '10px' }}
              >
                <option value="easy">Easy (Depth 2)</option>
                <option value="medium">Medium (Depth 8)</option>
                <option value="hard">Hard (Depth 15)</option>
              </select>
            </div>

            <div className="gameover-actions">
              <button
                className="btn-primary"
                onClick={() => navigate('/computer', { state: { playerColor: botColor, difficulty: botDifficulty, timeControl: selectedTime } })}
              >
                Start Game
              </button>
              <button
                className="btn-secondary"
                onClick={() => setBotMenuOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
