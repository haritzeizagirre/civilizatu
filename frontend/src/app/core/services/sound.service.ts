import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;
  private _muted = false;

  get muted(): boolean { return this._muted; }

  toggleMute(): void { this._muted = !this._muted; }

  private _getCtx(): AudioContext {
    if (!this.ctx) { this.ctx = new AudioContext(); }
    // Resume if suspended (browsers require user interaction)
    if (this.ctx.state === 'suspended') { this.ctx.resume(); }
    return this.ctx;
  }

  private _playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.2): void {
    if (this._muted) return;
    try {
      const ctx = this._getCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(gain, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (_) { /* Audio not available */ }
  }

  private _chord(freqs: number[], duration: number, type: OscillatorType = 'sine', gain = 0.15): void {
    freqs.forEach(f => this._playTone(f, duration, type, gain));
  }

  // ─── Game sounds ─────────────────────────────────────────────────────────

  playMove(): void {
    this._playTone(440, 0.08, 'sine', 0.08);
  }

  playCombat(): void {
    // Clash impact: two descending sawtooth hits
    this._playTone(220, 0.12, 'sawtooth', 0.25);
    setTimeout(() => this._playTone(160, 0.18, 'sawtooth', 0.2), 90);
    setTimeout(() => this._playTone(110, 0.22, 'square', 0.12), 180);
  }

  playBuild(): void {
    // Rising hammering sound
    [330, 392, 494].forEach((f, i) => setTimeout(() => this._playTone(f, 0.15, 'triangle', 0.15), i * 70));
  }

  playResearch(): void {
    // Sci-fi ascending arpeggio
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._playTone(f, 0.2, 'sine', 0.12), i * 80)
    );
  }

  playDiplomacy(): void {
    // Soft warm chord
    setTimeout(() => this._chord([349, 440, 523], 0.5, 'sine', 0.1), 0);
    setTimeout(() => this._chord([392, 494, 587], 0.5, 'sine', 0.1), 300);
  }

  playWarDeclared(): void {
    // Tense descending tritones
    [440, 311, 220].forEach((f, i) =>
      setTimeout(() => this._playTone(f, 0.25, 'sawtooth', 0.2), i * 120)
    );
  }

  playTurnEnd(): void {
    [261, 329, 392, 523].forEach((f, i) =>
      setTimeout(() => this._playTone(f, 0.28, 'sine', 0.13), i * 90)
    );
  }

  playNotification(): void {
    this._playTone(880, 0.08, 'sine', 0.12);
    setTimeout(() => this._playTone(1109, 0.12, 'sine', 0.1), 80);
  }

  playError(): void {
    this._playTone(200, 0.15, 'square', 0.2);
    setTimeout(() => this._playTone(180, 0.2, 'square', 0.15), 100);
  }

  playVictory(): void {
    // Triumphant fanfare
    const melody = [523, 523, 523, 659, 523, 659, 784];
    melody.forEach((f, i) => setTimeout(() => this._playTone(f, 0.32, 'sine', 0.2), i * 140));
  }

  playDefeat(): void {
    [392, 349, 311, 261, 220].forEach((f, i) =>
      setTimeout(() => this._playTone(f, 0.38, 'sawtooth', 0.18), i * 160)
    );
  }
}
