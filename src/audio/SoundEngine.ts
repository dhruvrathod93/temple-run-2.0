import { PowerUpType } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private musicVolume = 0.45;
  private sfxVolume = 0.75;
  private musicMuted = false;
  private sfxMuted = false;

  private isMusicPlaying = false;
  private musicTimer: number | null = null;
  private stepIndex = 0;
  private currentTempoMultiplier = 1.0;

  // Pentatonic minor scale frequencies (D minor pentatonic: D4, F4, G4, A4, C5, D5, F5, A5)
  private readonly scale = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 880.0];
  private readonly bassNotes = [73.42, 73.42, 87.31, 98.0, 73.42, 110.0, 87.31, 65.41];

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.updateGains();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public setSettings(musicVol: number, sfxVol: number, musicMuted: boolean, sfxMuted: boolean) {
    this.musicVolume = Math.max(0, Math.min(1, musicVol));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVol));
    this.musicMuted = musicMuted;
    this.sfxMuted = sfxMuted;
    this.updateGains();
  }

  private updateGains() {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const targetMusic = this.musicMuted ? 0 : this.musicVolume * 0.32;
    const targetSfx = this.sfxMuted ? 0 : this.sfxVolume * 0.65;
    this.musicGain.gain.setTargetAtTime(targetMusic, now, 0.04);
    this.sfxGain.gain.setTargetAtTime(targetSfx, now, 0.02);
  }

  public setTempoMultiplier(mult: number) {
    this.currentTempoMultiplier = Math.max(0.85, Math.min(1.5, mult));
  }

  public startMusic() {
    if (this.isMusicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.isMusicPlaying = true;
    this.stepIndex = 0;
    this.scheduleNextBeat();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleNextBeat() {
    if (!this.isMusicPlaying) return;
    this.playMusicStep(this.stepIndex);
    this.stepIndex = (this.stepIndex + 1) % 16;

    // Base 16th-note step duration ~145ms, speeds up slightly with run speed
    const stepMs = Math.max(95, Math.round(145 / this.currentTempoMultiplier));
    this.musicTimer = window.setTimeout(() => this.scheduleNextBeat(), stepMs);
  }

  private playMusicStep(step: number) {
    if (this.musicMuted || this.musicVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;

    const now = ctx.currentTime;

    // 1. Tribal Low Tom / Kick on steps 0, 3, 6, 8, 12, 14
    if (step === 0 || step === 3 || step === 6 || step === 8 || step === 12 || step === 14) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const isAccent = step === 0 || step === 8;
      osc.frequency.setValueAtTime(isAccent ? 115 : 92, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

      gain.gain.setValueAtTime(isAccent ? 0.5 : 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.16);
    }

    // 2. Jungle Shaker on off-beats (steps 2, 4, 6, 10, 12, 15)
    if (step % 2 === 1 || step === 6) {
      this.triggerFilteredNoise(now, 0.035, 3800, 0.08, this.musicGain);
    }

    // 3. Deep Drone Bass every 8 steps
    if (step === 0 || step === 8) {
      const bassIdx = Math.floor((this.stepIndex / 2) % this.bassNotes.length);
      const freq = this.bassNotes[bassIdx] || 73.42;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.58);
    }

    // 4. Wooden Marimba / Kalman Melody on rhythmic steps
    const melodyPattern = [0, 3, 2, -1, 4, -1, 3, 1, 5, -1, 4, 2, 3, -1, 1, 0];
    const noteIdx = melodyPattern[step];
    if (noteIdx !== undefined && noteIdx >= 0) {
      const freq = this.scale[noteIdx % this.scale.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  }

  private triggerFilteredNoise(
    startTime: number,
    duration: number,
    centerFreq: number,
    peakGain: number,
    dest: AudioNode
  ) {
    if (!this.ctx) return;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, startTime);
    filter.Q.setValueAtTime(1.8, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // ==================== SOUND EFFECTS ====================

  public playFootstep(surface: 'stone' | 'wood' | 'cave' = 'stone') {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = surface === 'wood' ? 135 : surface === 'cave' ? 160 : 95;
    const jitter = (Math.random() - 0.5) * 18;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq + jitter, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.055);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playLaneSwitch() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.075);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playJump() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.16);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playSlide() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    this.triggerFilteredNoise(now, 0.22, 950, 0.25, this.sfxGain);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playCoin(combo = 0) {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const pitchBoost = Math.min(combo * 24, 360);
    const f1 = 880 + pitchBoost;
    const f2 = 1318.5 + pitchBoost * 1.25;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(f1, now);
    osc1.frequency.setValueAtTime(f2, now + 0.055);

    osc2.frequency.setValueAtTime(f1 * 1.5, now);
    osc2.frequency.setValueAtTime(f2 * 1.5, now + 0.055);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.23);
    osc2.stop(now + 0.23);
  }

  public playRareRelic() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const chord = [587.33, 880, 1174.66, 1760];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public playPowerUp(type: PowerUpType) {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const notes =
      type === 'shield'
        ? [392, 523.25, 659.25, 783.99]
        : type === 'speed_boost'
        ? [440, 587.33, 880, 1174.66]
        : [349.23, 440, 523.25, 698.46];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.26, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playShieldBreak() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    this.triggerFilteredNoise(now, 0.32, 2200, 0.38, this.sfxGain);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.28);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playTurnBonus() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.04;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playCollision() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    this.triggerFilteredNoise(now, 0.35, 420, 0.5, this.sfxGain);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.42);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public playGameOver() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const notes = [392.0, 349.23, 329.63, 293.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + 0.15 + i * 0.14;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  public playButtonClick() {
    if (this.sfxMuted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const soundEngine = new SoundEngine();
