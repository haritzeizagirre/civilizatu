import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, City } from '../../../core/models/game.models';
import { GameService } from '../../../core/services/game.service';

interface BuildOption {
  id: string;
  name: string;
  cost: number;
  requires: string | null;
  emoji: string;
}

interface UnitOption {
  id: string;
  name: string;
  cost: number;
  requires: string | null;
  emoji: string;
}

const BUILDINGS: BuildOption[] = [
  { id: 'granary', name: 'Granary', cost: 50, requires: 'pottery', emoji: '🏪' },
  { id: 'barracks', name: 'Barracks', cost: 60, requires: 'bronze_working', emoji: '⚔' },
  { id: 'library', name: 'Library', cost: 75, requires: 'writing', emoji: '📚' },
  { id: 'market', name: 'Market', cost: 65, requires: 'currency', emoji: '🏪' },
  { id: 'workshop', name: 'Workshop', cost: 80, requires: 'iron_working', emoji: '🔨' },
  { id: 'aqueduct', name: 'Aqueduct', cost: 100, requires: 'construction', emoji: '🚿' },
  { id: 'temple', name: 'Temple', cost: 90, requires: 'philosophy', emoji: '🛕' },
  { id: 'colosseum', name: 'Colosseum', cost: 120, requires: 'civil_service', emoji: '🏟' },
  { id: 'university', name: 'University', cost: 160, requires: 'astronomy', emoji: '🎓' },
  { id: 'factory', name: 'Factory', cost: 200, requires: 'industrialization', emoji: '🏭' },
  { id: 'power_plant', name: 'Power Plant', cost: 250, requires: 'electricity', emoji: '⚡' },
  { id: 'space_shuttle', name: 'Space Shuttle', cost: 400, requires: 'space_flight', emoji: '🚀' },
];

const UNITS: UnitOption[] = [
  { id: 'warrior', name: 'Warrior', cost: 30, requires: null, emoji: '⚔' },
  { id: 'archer', name: 'Archer', cost: 40, requires: 'bronze_working', emoji: '🏹' },
  { id: 'settler', name: 'Settler', cost: 80, requires: null, emoji: '🏕' },
  { id: 'knight', name: 'Knight', cost: 70, requires: 'horseback_riding', emoji: '🐴' },
  { id: 'eagle_warrior', name: 'Eagle Warrior', cost: 55, requires: 'iron_working', emoji: '🦅' },
  { id: 'tank', name: 'Tank', cost: 180, requires: 'industrialization', emoji: '🪖' },
];

@Component({
  selector: 'app-city-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="city-panel" *ngIf="city">
      <div class="panel-header">
        <h3>{{ city.name }}</h3>
        <span class="pop">Pop: {{ city.population }}</span>
        <button class="close-btn" (click)="close.emit()">✕</button>
      </div>

      <div class="panel-body">
        <!-- City yields -->
        <div class="yields">
          <span title="Food">🌾 {{ city.yields.food }}/turn</span>
          <span title="Production">⚙ {{ city.yields.production }}/turn</span>
          <span title="Science">🔬 {{ city.yields.science }}/turn</span>
          <span title="Gold">💰 {{ city.yields.gold }}/turn</span>
          <span title="Culture">🎭 {{ city.yields.culture }}/turn</span>
        </div>

        <!-- Production queue -->
        <div class="section" *ngIf="city.production_queue">
          <h4>Building Queue</h4>
          <div class="queue-item">{{ city.production_queue.item_type }} ({{ city.production_queue.turns_remaining }} turns)</div>
        </div>

        <!-- Buildings -->
        <div class="section">
          <h4>Buildings ({{ city.buildings.length }})</h4>
          <div class="built-list">
            <span class="built" *ngFor="let b of city.buildings">{{ buildingEmoji(b.building_type) }} {{ b.building_type }}</span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button [class.active]="tab === 'build'" (click)="tab='build'">Build</button>
          <button [class.active]="tab === 'train'" (click)="tab='train'">Train Unit</button>
        </div>

        <!-- Build tab -->
        <div *ngIf="tab === 'build'" class="options">
          <div
            class="option"
            *ngFor="let b of availableBuildings"
            [class.locked]="!canBuild(b)"
            [title]="b.requires ? 'Requires: ' + b.requires : ''"
            (click)="buildBuilding(b)"
          >
            <span class="opt-icon">{{ b.emoji }}</span>
            <div class="opt-info">
              <span class="opt-name">{{ b.name }}</span>
              <span class="opt-cost">⚙ {{ b.cost }}</span>
            </div>
            <span class="lock" *ngIf="!canBuild(b)">🔒</span>
          </div>
        </div>

        <!-- Train tab -->
        <div *ngIf="tab === 'train'" class="options">
          <div
            class="option"
            *ngFor="let u of availableUnits"
            [class.locked]="!canTrain(u)"
            [title]="u.requires ? 'Requires: ' + u.requires : ''"
            (click)="trainUnit(u)"
          >
            <span class="opt-icon">{{ u.emoji }}</span>
            <div class="opt-info">
              <span class="opt-name">{{ u.name }}</span>
              <span class="opt-cost">⚙ {{ u.cost }}</span>
            </div>
            <span class="lock" *ngIf="!canTrain(u)">🔒</span>
          </div>
        </div>
      </div>

      <div class="result-msg" *ngIf="resultMsg" [class.error]="isError">{{ resultMsg }}</div>
    </div>
  `,
  styles: [`
    .city-panel {
      background: #2c1e0f; border: 1px solid #6b5a3e; border-radius: 6px;
      width: 300px; display: flex; flex-direction: column; overflow: hidden;
      max-height: 100%; font-size: 0.82rem;
    }
    .panel-header {
      display: flex; align-items: center; gap: 8px;
      background: #1a1208; padding: 8px 12px; border-bottom: 1px solid #6b5a3e;
    }
    h3 { color: #d4af37; font-family: Cinzel, serif; margin: 0; flex: 1; font-size: 0.95rem; }
    .pop { color: #b0a080; font-size: 0.75rem; }
    .close-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 1rem; }
    .close-btn:hover { color: #fff; }
    .panel-body { overflow-y: auto; padding: 8px; flex: 1; }
    .yields { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; color: #e0d5b0; }
    .section { margin-bottom: 8px; }
    h4 { color: #d4af37; margin: 4px 0; font-size: 0.8rem; }
    .built-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .built { background: #3a2e1e; border-radius: 3px; padding: 2px 6px; color: #c8a96e; font-size: 0.75rem; }
    .queue-item { color: #90caf9; font-size: 0.75rem; }
    .tabs { display: flex; gap: 4px; margin: 8px 0 4px; }
    .tabs button {
      flex: 1; padding: 4px; border: 1px solid #6b5a3e; background: #3a2e1e; color: #b0a080;
      border-radius: 4px; cursor: pointer; font-size: 0.78rem;
    }
    .tabs button.active { background: #4a3e2e; color: #d4af37; border-color: #d4af37; }
    .options { display: flex; flex-direction: column; gap: 4px; }
    .option {
      display: flex; align-items: center; gap: 8px; padding: 5px 8px;
      border: 1px solid #4a3e2e; border-radius: 4px; cursor: pointer; background: #3a2e1e;
      transition: background 0.15s;
    }
    .option:hover:not(.locked) { background: #4a3e2e; border-color: #d4af37; }
    .option.locked { opacity: 0.5; cursor: not-allowed; }
    .opt-icon { font-size: 1.1rem; }
    .opt-info { flex: 1; display: flex; flex-direction: column; }
    .opt-name { color: #e0d5b0; }
    .opt-cost { color: #d4af37; font-size: 0.72rem; }
    .lock { font-size: 0.8rem; }
    .result-msg { padding: 6px 12px; background: #1b5e20; color: #c8e6c9; font-size: 0.78rem; }
    .result-msg.error { background: #b71c1c; color: #ffcdd2; }
  `]
})
export class CityPanelComponent {
  @Input() city!: City;
  @Input() state!: GameState;
  @Input() gameId!: string;
  @Output() close = new EventEmitter<void>();

  tab: 'build' | 'train' = 'build';
  resultMsg = '';
  isError = false;

  constructor(private gameService: GameService) {}

  get availableBuildings(): BuildOption[] {
    return BUILDINGS.filter(b => !this.city.buildings.some((existing: any) => existing.building_type === b.id));
  }

  get availableUnits(): UnitOption[] { return UNITS; }

  canBuild(b: BuildOption): boolean {
    if (!b.requires) return true;
    return this.state.player.researched_techs?.includes(b.requires) ?? false;
  }

  canTrain(u: UnitOption): boolean {
    if (!u.requires) return true;
    return this.state.player.researched_techs?.includes(u.requires) ?? false;
  }

  buildingEmoji(id: string): string {
    return BUILDINGS.find(b => b.id === id)?.emoji ?? '🏛';
  }

  buildBuilding(b: BuildOption): void {
    if (!this.canBuild(b)) return;
    this.gameService.sendAction(this.gameId, 'buildStructure', {
      cityId: this.city.id, buildingType: b.id
    }).subscribe({
      next: () => { this.resultMsg = `${b.name} added to queue!`; this.isError = false; },
      error: (e: any) => { this.resultMsg = e.error?.detail ?? 'Error'; this.isError = true; }
    });
  }

  trainUnit(u: UnitOption): void {
    if (!this.canTrain(u)) return;
    this.gameService.sendAction(this.gameId, 'trainUnit', {
      cityId: this.city.id, unitType: u.id
    }).subscribe({
      next: () => { this.resultMsg = `${u.name} training started!`; this.isError = false; },
      error: (e: any) => { this.resultMsg = e.error?.detail ?? 'Error'; this.isError = true; }
    });
  }
}
