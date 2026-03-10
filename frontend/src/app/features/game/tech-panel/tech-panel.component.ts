import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../../../core/models/game.models';
import { GameService } from '../../../core/services/game.service';

interface TechNode {
  id: string;
  name: string;
  era: 'ancient' | 'classical' | 'modern';
  cost: number;
  requires: string[];
  emoji: string;
  description: string;
}

const TECH_TREE: TechNode[] = [
  // Ancient
  { id: 'agriculture', name: 'Agriculture', era: 'ancient', cost: 20, requires: [], emoji: '🌾', description: '+1 food on farms' },
  { id: 'pottery', name: 'Pottery', era: 'ancient', cost: 25, requires: [], emoji: '🏺', description: 'Enables Granary' },
  { id: 'bronze_working', name: 'Bronze Working', era: 'ancient', cost: 30, requires: [], emoji: '⚔', description: 'Enables Warrior, Barracks' },
  { id: 'animal_husbandry', name: 'Animal Husbandry', era: 'ancient', cost: 30, requires: ['agriculture'], emoji: '🐄', description: '+1 food on cattle' },
  { id: 'mining', name: 'Mining', era: 'ancient', cost: 35, requires: ['bronze_working'], emoji: '⛏', description: '+1 production on hills/resources' },
  { id: 'sailing', name: 'Sailing', era: 'ancient', cost: 40, requires: ['pottery'], emoji: '⛵', description: 'Enables ocean movement' },
  { id: 'writing', name: 'Writing', era: 'ancient', cost: 50, requires: ['pottery'], emoji: '✍', description: 'Enables Library' },
  // Classical
  { id: 'mathematics', name: 'Mathematics', era: 'classical', cost: 60, requires: ['writing', 'mining'], emoji: '📐', description: '+5% science' },
  { id: 'construction', name: 'Construction', era: 'classical', cost: 65, requires: ['mathematics'], emoji: '🏗', description: 'Enables Aqueduct' },
  { id: 'iron_working', name: 'Iron Working', era: 'classical', cost: 70, requires: ['bronze_working', 'mining'], emoji: '⚙', description: 'Enables Eagle Warrior, Workshop' },
  { id: 'horseback_riding', name: 'Horseback Riding', era: 'classical', cost: 65, requires: ['animal_husbandry'], emoji: '🐴', description: 'Enables Knight' },
  { id: 'currency', name: 'Currency', era: 'classical', cost: 75, requires: ['mathematics'], emoji: '💰', description: 'Enables Market; +10 gold/turn' },
  { id: 'philosophy', name: 'Philosophy', era: 'classical', cost: 80, requires: ['writing'], emoji: '🏛', description: 'Enables Temple; +5 culture/turn' },
  { id: 'machinery', name: 'Machinery', era: 'classical', cost: 90, requires: ['iron_working', 'construction'], emoji: '⚙', description: '+2 production in all cities' },
  { id: 'civil_service', name: 'Civil Service', era: 'classical', cost: 85, requires: ['currency', 'philosophy'], emoji: '📜', description: 'Enables Colosseum' },
  // Modern
  { id: 'astronomy', name: 'Astronomy', era: 'modern', cost: 100, requires: ['mathematics', 'sailing'], emoji: '🔭', description: 'Enables University' },
  { id: 'gunpowder', name: 'Gunpowder', era: 'modern', cost: 120, requires: ['iron_working', 'machinery'], emoji: '💣', description: '+3 attack for all units' },
  { id: 'industrialization', name: 'Industrialization', era: 'modern', cost: 150, requires: ['machinery', 'civil_service'], emoji: '🏭', description: 'Enables Factory, Tank' },
  { id: 'electricity', name: 'Electricity', era: 'modern', cost: 160, requires: ['industrialization'], emoji: '⚡', description: 'Enables Power Plant; +5 science' },
  { id: 'space_flight', name: 'Space Flight', era: 'modern', cost: 200, requires: ['electricity', 'astronomy'], emoji: '🚀', description: 'Enables Space Shuttle — Science Victory path' },
  { id: 'future_tech', name: 'Future Tech', era: 'modern', cost: 250, requires: ['space_flight'], emoji: '🌐', description: 'Unlocks Science Victory + +10 all yields' },
];

@Component({
  selector: 'app-tech-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tech-panel">
      <div class="panel-header">
        <h3>Technology Tree</h3>
        <button class="close-btn" (click)="close.emit()">✕</button>
      </div>

      <div class="era-section" *ngFor="let era of ['ancient', 'classical', 'modern']">
        <div class="era-label">{{ era | titlecase }} Era</div>
        <div class="tech-row">
          <div
            class="tech-card"
            *ngFor="let tech of techsByEra(era)"
            [class.researched]="isResearched(tech.id)"
            [class.in-progress]="isInProgress(tech.id)"
            [class.available]="isAvailable(tech)"
            [class.locked]="!isAvailable(tech) && !isResearched(tech.id) && !isInProgress(tech.id)"
            (click)="selectTech(tech)"
            [title]="tech.description + (tech.requires.length ? ' | Requires: ' + tech.requires.join(', ') : '')"
          >
            <span class="tech-icon">{{ tech.emoji }}</span>
            <div class="tech-name">{{ tech.name }}</div>
            <div class="tech-cost" *ngIf="!isResearched(tech.id)">🔬 {{ tech.cost }}</div>
            <div class="in-prog-bar" *ngIf="isInProgress(tech.id)">
              <div class="in-prog-fill" [style.width.%]="inProgressPct"></div>
            </div>
            <div class="researched-badge" *ngIf="isResearched(tech.id)">✓</div>
          </div>
        </div>
      </div>

      <div class="result-msg" *ngIf="resultMsg" [class.error]="isError">{{ resultMsg }}</div>
    </div>
  `,
  styles: [`
    .tech-panel {
      background: #2c1e0f; border: 1px solid #6b5a3e; border-radius: 6px;
      width: 100%; max-height: 100%; display: flex; flex-direction: column; font-size: 0.8rem;
    }
    .panel-header {
      display: flex; align-items: center; background: #1a1208;
      padding: 8px 12px; border-bottom: 1px solid #6b5a3e;
    }
    h3 { color: #d4af37; font-family: Cinzel, serif; margin: 0; flex: 1; font-size: 0.95rem; }
    .close-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 1rem; }
    .close-btn:hover { color: #fff; }
    .era-section { padding: 6px 10px; border-bottom: 1px solid #3a2e1e; }
    .era-label { color: #d4af37; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .tech-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .tech-card {
      width: 90px; padding: 6px; border-radius: 5px; border: 1px solid #4a3e2e;
      cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px;
      background: #3a2e1e; transition: border-color 0.15s, background 0.15s; position: relative;
    }
    .tech-card.researched { background: #1b3a2e; border-color: #4caf50; }
    .tech-card.in-progress { background: #1a2c45; border-color: #90caf9; animation: pulse 1.5s infinite; }
    .tech-card.available { border-color: #d4af37; cursor: pointer; }
    .tech-card.available:hover { background: #4a3e2e; }
    .tech-card.locked { opacity: 0.45; cursor: not-allowed; }
    @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(144,202,249,0.4); } 50% { box-shadow: 0 0 0 4px rgba(144,202,249,0); } }
    .tech-icon { font-size: 1.2rem; }
    .tech-name { color: #e0d5b0; font-size: 0.7rem; text-align: center; line-height: 1.2; }
    .tech-cost { color: #90caf9; font-size: 0.65rem; }
    .in-prog-bar { width: 100%; height: 4px; background: #1a2c45; border-radius: 2px; margin-top: 2px; }
    .in-prog-fill { height: 100%; background: #90caf9; border-radius: 2px; transition: width 0.3s; }
    .researched-badge { position: absolute; top: 3px; right: 5px; color: #4caf50; font-size: 0.8rem; font-weight: 700; }
    .result-msg { padding: 6px 12px; background: #1b5e20; color: #c8e6c9; font-size: 0.78rem; }
    .result-msg.error { background: #b71c1c; color: #ffcdd2; }
  `]
})
export class TechPanelComponent {
  @Input() state!: GameState;
  @Input() gameId!: string;
  @Output() close = new EventEmitter<void>();

  resultMsg = '';
  isError = false;

  constructor(private gameService: GameService) {}

  techsByEra(era: string): TechNode[] { return TECH_TREE.filter(t => t.era === era); }
  isResearched(id: string): boolean { return this.state?.player.researched_techs?.includes(id) ?? false; }
  isInProgress(id: string): boolean { return this.state?.player.current_research === id; }
  isAvailable(tech: TechNode): boolean {
    if (this.isResearched(tech.id)) return false;
    return tech.requires.every(r => this.isResearched(r));
  }

  get inProgressPct(): number {
    const rp = this.state?.player.research_progress ?? 0;
    const tid = this.state?.player.current_research;
    if (!tid) return 0;
    const tech = TECH_TREE.find(t => t.id === tid);
    return Math.min(100, (rp / (tech?.cost ?? 100)) * 100);
  }

  selectTech(tech: TechNode): void {
    if (!this.isAvailable(tech)) return;
    this.gameService.sendAction(this.gameId, 'researchTechnology', { techId: tech.id }).subscribe({
      next: () => { this.resultMsg = `Researching ${tech.name}!`; this.isError = false; },
      error: (e: any) => { this.resultMsg = e.error?.detail ?? 'Error'; this.isError = true; }
    });
  }
}
