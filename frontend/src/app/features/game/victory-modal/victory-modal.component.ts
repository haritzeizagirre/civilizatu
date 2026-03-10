import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameResult } from '../../../core/models/game.models';

interface ResultConfig {
  isWin: boolean;
  title: string;
  subtitle: string;
  icon: string;
  bgClass: string;
}

const RESULT_CONFIGS: Record<string, ResultConfig> = {
  player_win_conquest:  { isWin: true,  title: 'Conquest Victory!',   subtitle: 'You crushed all enemy cities. Civilization bows before you.', icon: '⚔', bgClass: 'win-conquest' },
  player_win_science:   { isWin: true,  title: 'Science Victory!',    subtitle: 'Your spaceships pierce the cosmos. Humanity looks to the stars.', icon: '🚀', bgClass: 'win-science' },
  player_win_culture:   { isWin: true,  title: 'Cultural Victory!',   subtitle: 'Your culture shines across the ages. History remembers you.', icon: '🎭', bgClass: 'win-culture' },
  player_win_domination:{ isWin: true,  title: 'Domination Victory!', subtitle: 'You controlled the most territory at the end of time.', icon: '🏆', bgClass: 'win-domination' },
  ai_win_conquest:      { isWin: false, title: 'Defeat',              subtitle: 'Rome consumed your lands. Rise again next time.', icon: '🔥', bgClass: 'lose' },
  ai_win_science:       { isWin: false, title: 'Defeat',              subtitle: 'Rome reached the stars before you. Science waits for no one.', icon: '💫', bgClass: 'lose' },
  ai_win_culture:       { isWin: false, title: 'Defeat',              subtitle: 'Rome\'s culture overshadowed yours. Study harder.', icon: '📜', bgClass: 'lose' },
  ai_win_domination:    { isWin: false, title: 'Defeat',              subtitle: 'Rome dominated the age. Better luck next game.', icon: '🛡', bgClass: 'lose' },
};

@Component({
  selector: 'app-victory-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" *ngIf="result">
      <div class="modal" [class]="config.bgClass">
        <div class="modal-icon">{{ config.icon }}</div>
        <h2 class="modal-title">{{ config.title }}</h2>
        <p class="modal-sub">{{ config.subtitle }}</p>

        <div class="stats-row" *ngIf="stats">
          <div class="stat-item">
            <span class="skey">Turns survived</span>
            <span class="sval">{{ stats.turn }}</span>
          </div>
          <div class="stat-item">
            <span class="skey">Technologies</span>
            <span class="sval">{{ stats.techs }}</span>
          </div>
          <div class="stat-item">
            <span class="skey">Cities</span>
            <span class="sval">{{ stats.cities }}</span>
          </div>
          <div class="stat-item">
            <span class="skey">Units trained</span>
            <span class="sval">{{ stats.units }}</span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-lobby" (click)="restart.emit()">🏠 Main Menu</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      z-index: 200; font-family: Rajdhani, sans-serif;
    }
    .modal {
      width: 440px; border-radius: 12px; padding: 40px 32px;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      border: 2px solid;
      animation: appear 0.4s ease;
    }
    @keyframes appear { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .win-conquest { background: linear-gradient(160deg, #1a0505 0%, #4a0000 100%); border-color: #ef5350; }
    .win-science  { background: linear-gradient(160deg, #001428 0%, #0d3a6a 100%); border-color: #90caf9; }
    .win-culture  { background: linear-gradient(160deg, #1a0535 0%, #4a0070 100%); border-color: #ce93d8; }
    .win-domination { background: linear-gradient(160deg, #1a1200 0%, #4a3500 100%); border-color: #d4af37; }
    .lose { background: linear-gradient(160deg, #0a0a0a 0%, #1f1f1f 100%); border-color: #616161; }
    .modal-icon { font-size: 5rem; }
    .modal-title { font-family: Cinzel, serif; font-size: 1.8rem; color: #d4af37; margin: 0; text-align: center; }
    .modal-sub { color: #b0a080; text-align: center; line-height: 1.5; font-size: 0.95rem; margin: 0; }
    .stats-row { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
    .stat-item { display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 8px 14px; }
    .skey { color: #9e9e9e; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .sval { color: #d4af37; font-size: 1.3rem; font-weight: 700; }
    .modal-actions { display: flex; gap: 10px; margin-top: 8px; }
    .btn-lobby {
      background: #3a2e1e; border: 1px solid #d4af37; color: #d4af37;
      padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 1rem; font-weight: 700; font-family: Rajdhani, sans-serif;
      transition: background 0.15s;
    }
    .btn-lobby:hover { background: #4a3e2e; }
  `]
})
export class VictoryModalComponent {
  @Input() result!: GameResult;
  @Input() stats: { turn: number; techs: number; cities: number; units: number } | null = null;
  @Output() restart = new EventEmitter<void>();

  get config(): ResultConfig {
    return RESULT_CONFIGS[this.result] ?? {
      isWin: false, title: 'Game Over', subtitle: '', icon: '🏁', bgClass: 'lose'
    };
  }
}
