import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;

  private _getCtx(): AudioContext {
    if (!this.ctx) { this.ctx = new AudioContext(); }
    return this.ctx;
  }

  private _playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.2): void {
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

  playMove(): void { this._playTone(440, 0.1, 'sine', 0.1); }
  playCombat(): void {
    this._playTone(200, 0.15, 'sawtooth', 0.3);
    setTimeout(() => this._playTone(150, 0.2, 'sawtooth', 0.2), 100);
  }
  playBuild(): void { this._playTone(523, 0.2, 'sine', 0.15); }
  playTurnEnd(): void {
    [261, 329, 392, 523].forEach((f, i) => setTimeout(() => this._playTone(f, 0.3), i * 100));
  }
  playVictory(): void {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._playTone(f, 0.4), i * 150));
  }
  playDefeat(): void {
    [392, 329, 261, 196].forEach((f, i) => setTimeout(() => this._playTone(f, 0.4, 'sawtooth'), i * 150));
  }
}
