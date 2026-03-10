import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../../../core/models/game.models';

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hud" *ngIf="state">
      <!-- Left: Civ + Turn -->
      <div class="hud-block civ-info">
        <span class="civ-name">{{ state.player.civ_id | titlecase }}</span>
        <span class="turn-info">Turn {{ state.turn }}</span>
      </div>

      <!-- Center: Resources -->
      <div class="hud-block resources">
        <div class="res" title="Food">🌾 {{ state.player.resources.food | number:'1.0-0' }}</div>
        <div class="res" title="Production">⚙ {{ state.player.resources.production | number:'1.0-0' }}</div>
        <div class="res" title="Science">🔬 {{ state.player.resources.science | number:'1.0-0' }}</div>
        <div class="res" title="Gold">💰 {{ state.player.resources.gold | number:'1.0-0' }}</div>
        <div class="res" title="Culture">🎭 {{ state.player.resources.culture | number:'1.0-0' }}</div>
      </div>

      <!-- Center-right: Research -->
      <div class="hud-block research" *ngIf="state.player.current_research">
        <div class="research-label">🔬 {{ state.player.current_research.replace('_', ' ') | titlecase }}</div>
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="researchPct"></div>
        </div>
        <span class="research-turns">{{ turnsLeft }} turns</span>
      </div>
      <div class="hud-block research muted" *ngIf="!state.player.current_research">
        No research
      </div>

      <!-- Right: Actions -->
      <div class="hud-block actions">
        <button class="hud-btn" (click)="saveGame.emit()" title="Save">💾</button>
        <button class="hud-btn" (click)="openTech.emit()" title="Technology">🧪</button>
        <button class="hud-btn" (click)="openDiplomacy.emit()" title="Diplomacy">🤝</button>
        <button class="hud-btn" (click)="backToLobby.emit()" title="Menu">🏠</button>
        <button
          class="hud-btn end-turn"
          [disabled]="aiTurn"
          (click)="endTurn.emit()"
          title="End Turn"
        >
          {{ aiTurn ? 'AI Turn...' : 'End Turn' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .hud {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      background: linear-gradient(180deg, #1a1208 0%, #2c1e0f 100%);
      border-bottom: 2px solid #6b5a3e;
      height: 56px;
      flex-shrink: 0;
    }
    .hud-block { display: flex; align-items: center; gap: 8px; }
    .civ-info { flex-direction: column; align-items: flex-start; gap: 0; min-width: 110px; }
    .civ-name { color: #d4af37; font-family: Cinzel, serif; font-size: 0.85rem; font-weight: 700; }
    .turn-info { color: #b0a080; font-size: 0.7rem; }
    .resources { gap: 14px; }
    .res { color: #e0d5b0; font-size: 0.82rem; white-space: nowrap; }
    .research { flex-direction: column; gap: 2px; align-items: flex-start; min-width: 140px; }
    .research-label { color: #90caf9; font-size: 0.75rem; white-space: nowrap; overflow: hidden; max-width: 140px; text-overflow: ellipsis; }
    .progress-bar { width: 100%; height: 5px; background: #3a2e1e; border-radius: 3px; }
    .progress-fill { height: 100%; background: #90caf9; border-radius: 3px; transition: width 0.3s; }
    .research-turns { color: #9e9e9e; font-size: 0.68rem; }
    .muted { color: #888; font-size: 0.75rem; }
    .actions { margin-left: auto; gap: 6px; }
    .hud-btn {
      background: #3a2e1e; border: 1px solid #6b5a3e; color: #d4af37;
      padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.82rem;
      transition: background 0.15s;
    }
    .hud-btn:hover { background: #4a3e2e; }
    .hud-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .end-turn { background: #1b5e20; border-color: #4caf50; color: #c8e6c9; font-weight: 700; min-width: 90px; }
    .end-turn:hover:not(:disabled) { background: #2e7d32; }
  `]
})
export class HudComponent {
  @Input() state!: GameState;
  @Input() aiTurn = false;
  @Output() endTurn = new EventEmitter<void>();
  @Output() saveGame = new EventEmitter<void>();
  @Output() openTech = new EventEmitter<void>();
  @Output() openDiplomacy = new EventEmitter<void>();
  @Output() backToLobby = new EventEmitter<void>();

  get researchPct(): number {
    const rp = this.state?.player.research_progress ?? 0;
    const tech = this.state?.player.current_research;
    if (!tech) return 0;
    const costs: Record<string, number> = {
      agriculture: 20, bronze_working: 30, pottery: 25, animal_husbandry: 30,
      mining: 35, sailing: 40, writing: 50, mathematics: 60, construction: 65,
      iron_working: 70, horseback_riding: 65, currency: 75, philosophy: 80,
      machinery: 90, civil_service: 85, astronomy: 100, gunpowder: 120,
      industrialization: 150, electricity: 160, space_flight: 200, future_tech: 250,
    };
    const cost = costs[tech] ?? 100;
    return Math.min(100, (rp / cost) * 100);
  }

  get turnsLeft(): number {
    const sciencePerTurn = this.state?.player.resources.science ?? 0;
    if (sciencePerTurn <= 0) return 99;
    const rp = this.state?.player.research_progress ?? 0;
    const tech = this.state?.player.current_research;
    if (!tech) return 0;
    const costs: Record<string, number> = {
      agriculture: 20, bronze_working: 30, pottery: 25, animal_husbandry: 30,
      mining: 35, sailing: 40, writing: 50, mathematics: 60, construction: 65,
      iron_working: 70, horseback_riding: 65, currency: 75, philosophy: 80,
      machinery: 90, civil_service: 85, astronomy: 100, gunpowder: 120,
      industrialization: 150, electricity: 160, space_flight: 200, future_tech: 250,
    };
    const cost = costs[tech] ?? 100;
    return Math.max(1, Math.ceil((cost - rp) / sciencePerTurn));
  }
}
