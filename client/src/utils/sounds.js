// Procedural Sound Effects using Web Audio API

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Helper to play a short sine/triangle blip with an envelope
function playTone(freq, type, duration, vol) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore errors if audio context fails (e.g. strict autoplay policy before interaction)
  }
}

export function playMoveSound() {
  // A muted, wooden "thud"
  playTone(150, 'sine', 0.1, 0.3);
  setTimeout(() => playTone(200, 'sine', 0.05, 0.1), 20);
}

export function playCaptureSound() {
  // A sharper, slightly higher pitch for capture
  playTone(300, 'triangle', 0.1, 0.2);
  setTimeout(() => playTone(150, 'sine', 0.1, 0.2), 30);
}

export function playCheckSound() {
  // Alerting double blip
  playTone(400, 'sine', 0.15, 0.3);
  setTimeout(() => playTone(600, 'sine', 0.2, 0.3), 100);
}

export function playGameStartSound() {
  // Rising sequence
  playTone(300, 'sine', 0.2, 0.2);
  setTimeout(() => playTone(400, 'sine', 0.2, 0.2), 100);
  setTimeout(() => playTone(500, 'sine', 0.3, 0.2), 200);
}

export function playGameOverSound() {
  // Falling sequence (loss/win generic)
  playTone(500, 'sine', 0.2, 0.2);
  setTimeout(() => playTone(400, 'sine', 0.2, 0.2), 150);
  setTimeout(() => playTone(250, 'triangle', 0.4, 0.3), 300);
}

export function playDrawSound() {
  // Neutral flat tone
  playTone(300, 'sine', 0.3, 0.2);
  setTimeout(() => playTone(300, 'sine', 0.4, 0.1), 150);
}
