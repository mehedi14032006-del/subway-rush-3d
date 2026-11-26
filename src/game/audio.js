const AUDIO_CDN = 'https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds';

const SFX_FILES = {
  coin: { local: './assets/audio/coin.wav', cdn: `${AUDIO_CDN}/pluck_001.wav` },
  swipe: { local: './assets/audio/swipe.wav', cdn: `${AUDIO_CDN}/switch_004.wav` },
  jump: { local: './assets/audio/jump.wav', cdn: `${AUDIO_CDN}/maximize_006.wav` },
  roll: { local: './assets/audio/roll.wav', cdn: `${AUDIO_CDN}/minimize_006.wav` },
  crash: { local: './assets/audio/crash.wav', cdn: `${AUDIO_CDN}/error_003.wav` },
  powerup: { local: './assets/audio/powerup.wav', cdn: `${AUDIO_CDN}/confirmation_002.wav` },
  click: { local: './assets/audio/click.wav', cdn: `${AUDIO_CDN}/click_003.wav` },
  hoverboard: { local: './assets/audio/hoverboard.wav', cdn: `${AUDIO_CDN}/open_003.wav` }
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.muted = localStorage.getItem('sr3d_muted') === '1';
    this.coinStreak = 0;
    this.lastCoinTime = 0;
    this.musicTimer = null;
    this.musicStep = 0;
    this.isPlayingMusic = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.preloadSfx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  async preloadSfx() {
    if (!this.ctx) return;
    for (const [name, urls] of Object.entries(SFX_FILES)) {
      try {
        let res = await fetch(urls.local);
        if (!res.ok) res = await fetch(urls.cdn);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        this.buffers[name] = await this.ctx.decodeAudioData(arr);
      } catch {
        // Fallback to procedural synthesis if decode fails
      }
    }
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('sr3d_muted', m ? '1' : '0');
    if (m) this.stopMusic();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playBuffer(name, rate = 1.0, volume = 0.5) {
    if (this.muted || !this.ctx) return false;
    const buf = this.buffers[name];
    if (!buf) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
      return true;
    } catch {
      return false;
    }
  }

  playCoin() {
    if (this.muted) return;
    const now = performance.now();
    if (now - this.lastCoinTime < 420) {
      this.coinStreak = Math.min(14, this.coinStreak + 1);
    } else {
      this.coinStreak = 0;
    }
    this.lastCoinTime = now;
    const pitch = 1.0 + this.coinStreak * 0.055;
    if (!this.playBuffer('coin', pitch, 0.42)) {
      this.synthTone(780 * pitch, 1180 * pitch, 0.09, 'triangle', 0.14);
    }
  }

  playSwipe() {
    if (this.muted) return;
    if (!this.playBuffer('swipe', 1.35, 0.34)) {
      this.synthTone(260, 520, 0.07, 'sine', 0.12);
    }
  }

  playJump(high = false) {
    if (this.muted) return;
    if (!this.playBuffer('jump', high ? 1.25 : 1.0, 0.45)) {
      this.synthTone(240, high ? 820 : 620, 0.14, 'triangle', 0.16);
    }
  }

  playRoll() {
    if (this.muted) return;
    if (!this.playBuffer('roll', 1.15, 0.42)) {
      this.synthTone(340, 140, 0.11, 'sine', 0.14);
    }
  }

  playPowerup() {
    if (this.muted) return;
    if (!this.playBuffer('powerup', 1.05, 0.55)) {
      this.synthTone(440, 880, 0.22, 'triangle', 0.18);
    }
  }

  playHoverboard() {
    if (this.muted) return;
    this.playBuffer('hoverboard', 1.1, 0.52);
    this.synthTone(180, 560, 0.2, 'sawtooth', 0.1);
  }

  playShockwave() {
    if (this.muted) return;
    this.playBuffer('crash', 0.65, 0.65);
    this.synthTone(180, 38, 0.38, 'sawtooth', 0.25);
  }

  playCrash() {
    if (this.muted) return;
    if (!this.playBuffer('crash', 0.9, 0.6)) {
      this.synthTone(150, 42, 0.28, 'sawtooth', 0.24);
    }
  }

  playWhistle() {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2450, t);
    lfo.frequency.value = 34;
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.36);
    lfo.stop(t + 0.36);
  }

  playClick() {
    if (this.muted) return;
    if (!this.playBuffer('click', 1.1, 0.4)) {
      this.synthTone(520, 660, 0.04, 'sine', 0.1);
    }
  }

  synthTone(f0, f1, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  startMusic() {
    if (this.muted || this.isPlayingMusic) return;
    this.unlock();
    this.isPlayingMusic = true;
    this.musicStep = 0;

    // Energetic funky urban-runner bassline + beat (136 BPM 16th/8th groove)
    const bassNotes = [110, 0, 110, 130.8, 146.8, 0, 164.8, 146.8, 110, 0, 98, 110, 130.8, 146.8, 164.8, 196];
    const leadNotes = [440, 0, 523.25, 0, 587.33, 659.25, 0, 523.25, 440, 0, 392, 440, 523.25, 0, 659.25, 783.99];

    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx || !this.isPlayingMusic) return;
      const idx = this.musicStep % 16;

      // Kick drum on beats
      if (idx % 4 === 0) {
        this.synthTone(125, 42, 0.11, 'sine', 0.13);
      }
      // Snare/hat groove
      if (idx % 4 === 2) {
        this.synthTone(280, 120, 0.06, 'triangle', 0.06);
      }

      // Funky bass
      const bn = bassNotes[idx];
      if (bn > 0) {
        this.synthTone(bn, bn * 0.99, 0.12, 'sawtooth', 0.042);
      }
      // Bright lead accent every second bar
      if (this.musicStep >= 16) {
        const ln = leadNotes[idx];
        if (ln > 0 && idx % 2 === 0) {
          this.synthTone(ln, ln, 0.09, 'triangle', 0.028);
        }
      }
      this.musicStep = (this.musicStep + 1) % 32;
    }, 175);
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
