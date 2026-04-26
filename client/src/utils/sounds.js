let audioCtx = null;
let noiseBuffer = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  return audioCtx;
}

function getNoiseBuffer(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }

  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.6;
  }

  noiseBuffer = buffer;
  return buffer;
}

function scheduleTone(
  ctx,
  {
    start = 0,
    type = 'sine',
    frequency = 440,
    endFrequency = frequency,
    duration = 0.12,
    volume = 0.12,
    attack = 0.002,
    release = duration,
    detune = 0,
  }
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const startTime = ctx.currentTime + start;
  const endTime = startTime + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endTime);
  osc.detune.setValueAtTime(detune, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + release);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(endTime + 0.02);
}

function scheduleNoise(
  ctx,
  {
    start = 0,
    duration = 0.08,
    volume = 0.08,
    filterFrequency = 900,
    q = 0.8,
  }
) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const startTime = ctx.currentTime + start;
  const endTime = startTime + duration;

  source.buffer = getNoiseBuffer(ctx);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrequency, startTime);
  filter.Q.setValueAtTime(q, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(startTime);
  source.stop(endTime + 0.02);
}

function withContext(callback) {
  try {
    const ctx = getAudioContext();
    callback(ctx);
  } catch {
    // Ignore autoplay or audio init errors.
  }
}

function scheduleWoodHit(ctx, start, { frequency, endFrequency, volume, noiseVolume, filterFrequency }) {
  scheduleTone(ctx, {
    start,
    type: 'triangle',
    frequency,
    endFrequency,
    duration: 0.09,
    release: start + 0.09 - start,
    volume,
  });
  scheduleTone(ctx, {
    start: start + 0.002,
    type: 'sine',
    frequency: frequency * 0.72,
    endFrequency: Math.max(60, endFrequency * 0.7),
    duration: 0.11,
    release: 0.09,
    volume: volume * 0.55,
  });
  scheduleNoise(ctx, {
    start,
    duration: 0.06,
    volume: noiseVolume,
    filterFrequency,
    q: 1.2,
  });
}

export function playMoveSound() {
  withContext((ctx) => {
    scheduleWoodHit(ctx, 0, {
      frequency: 185,
      endFrequency: 118,
      volume: 0.12,
      noiseVolume: 0.038,
      filterFrequency: 720,
    });
  });
}

export function playCaptureSound() {
  withContext((ctx) => {
    scheduleWoodHit(ctx, 0, {
      frequency: 205,
      endFrequency: 122,
      volume: 0.17,
      noiseVolume: 0.055,
      filterFrequency: 880,
    });
    scheduleWoodHit(ctx, 0.028, {
      frequency: 128,
      endFrequency: 92,
      volume: 0.08,
      noiseVolume: 0.03,
      filterFrequency: 620,
    });
  });
}

export function playCastleSound() {
  withContext((ctx) => {
    scheduleWoodHit(ctx, 0, {
      frequency: 178,
      endFrequency: 116,
      volume: 0.11,
      noiseVolume: 0.034,
      filterFrequency: 700,
    });
    scheduleWoodHit(ctx, 0.085, {
      frequency: 168,
      endFrequency: 108,
      volume: 0.11,
      noiseVolume: 0.034,
      filterFrequency: 700,
    });
  });
}

export function playPremoveSound() {
  withContext((ctx) => {
    scheduleTone(ctx, {
      start: 0,
      type: 'triangle',
      frequency: 510,
      endFrequency: 360,
      duration: 0.05,
      release: 0.045,
      volume: 0.05,
    });
    scheduleNoise(ctx, {
      start: 0.002,
      duration: 0.03,
      volume: 0.015,
      filterFrequency: 1600,
      q: 1.5,
    });
  });
}

export function playCheckSound() {
  withContext((ctx) => {
    scheduleTone(ctx, {
      start: 0,
      type: 'sawtooth',
      frequency: 740,
      endFrequency: 820,
      duration: 0.12,
      release: 0.11,
      volume: 0.05,
    });
    scheduleTone(ctx, {
      start: 0.018,
      type: 'triangle',
      frequency: 1110,
      endFrequency: 980,
      duration: 0.15,
      release: 0.12,
      volume: 0.07,
      detune: 6,
    });
  });
}

export function playGameStartSound() {
  withContext((ctx) => {
    scheduleTone(ctx, {
      start: 0,
      type: 'sine',
      frequency: 523,
      endFrequency: 523,
      duration: 0.16,
      release: 0.14,
      volume: 0.09,
    });
    scheduleTone(ctx, {
      start: 0.07,
      type: 'sine',
      frequency: 659,
      endFrequency: 659,
      duration: 0.18,
      release: 0.16,
      volume: 0.085,
    });
  });
}

export function playWinSound() {
  withContext((ctx) => {
    [
      { frequency: 523, start: 0 },
      { frequency: 659, start: 0.05 },
      { frequency: 784, start: 0.1 },
      { frequency: 1046, start: 0.16 },
    ].forEach(({ frequency, start }) => {
      scheduleTone(ctx, {
        start,
        type: 'sine',
        frequency,
        endFrequency: frequency,
        duration: 0.28,
        release: 0.26,
        volume: 0.08,
      });
    });
  });
}

export function playLossSound() {
  withContext((ctx) => {
    [
      { frequency: 294, endFrequency: 250, start: 0, duration: 0.18 },
      { frequency: 220, endFrequency: 180, start: 0.11, duration: 0.2 },
      { frequency: 165, endFrequency: 130, start: 0.24, duration: 0.28 },
    ].forEach(({ frequency, endFrequency, start, duration }) => {
      scheduleTone(ctx, {
        start,
        type: 'triangle',
        frequency,
        endFrequency,
        duration,
        release: duration - 0.02,
        volume: 0.09,
      });
    });
  });
}

export function playDrawSound() {
  withContext((ctx) => {
    scheduleTone(ctx, {
      start: 0,
      type: 'sine',
      frequency: 392,
      endFrequency: 392,
      duration: 0.22,
      release: 0.2,
      volume: 0.06,
    });
    scheduleTone(ctx, {
      start: 0.02,
      type: 'sine',
      frequency: 523,
      endFrequency: 523,
      duration: 0.22,
      release: 0.2,
      volume: 0.05,
    });
  });
}

export function playGameEndSound(outcome) {
  if (outcome === 'draw') {
    playDrawSound();
    return;
  }

  if (outcome === 'loss') {
    playLossSound();
    return;
  }

  playWinSound();
}
