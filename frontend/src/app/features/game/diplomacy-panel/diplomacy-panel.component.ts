import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../../../core/models/game.models';
import { GameService } from '../../../core/services/game.service';

type DiplomacyAction = 'declare_war' | 'propose_peace' | 'send_gold';

@Component({
  selector: 'app-diplomacy-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="diplomacy-panel">
      <div class="panel-header">
        <h3>🤝 Diplomacy</h3>
        <button class="close-btn" (click)="close.emit()">✕</button>
      </div>

      <div class="panel-body" *ngIf="state">
        <!-- Current status -->
        <div class="status-block">
          <span class="status-label">Status with AI:</span>
          <span class="status-badge" [class]="'status-' + status">
            {{ statusLabel }}
          </span>
        </div>

        <!-- Stats -->
        <div class="stats">
          <div class="stat"><span class="skey">Your cities</span><span class="sval">{{ state.player.cities.length }}</span></div>
          <div class="stat"><span class="skey">AI cities</span><span class="sval">{{ state.ai?.cities?.length ?? '?' }}</span></div>
          <div class="stat"><span class="skey">Your units</span><span class="sval">{{ state.player.units.length }}</span></div>
          <div class="stat"><span class="skey">Your gold</span><span class="sval">{{ state.player.resources.gold | number:'1.0-0' }}</span></div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button
            class="dip-btn war"
            *ngIf="status !== 'at_war'"
            (click)="doAction('declare_war')"
          >⚔ Declare War</button>

          <button
            class="dip-btn peace"
            *ngIf="status === 'at_war'"
            (click)="doAction('propose_peace')"
          >🕊 Propose Peace</button>

          <button
            class="dip-btn gold"
            [disabled]="state.player.resources.gold < 50"
            (click)="doAction('send_gold')"
          >💰 Send 50 Gold (tribute)</button>
        </div>

        <div class="flavor-text">
          <p *ngIf="status === 'war'">🔴 You are at war. Military might decides your fate.</p>
          <p *ngIf="status === 'peace'">🟢 Uneasy peace. The AI watches your every move.</p>
          <p *ngIf="status === 'alliance'">🔵 Allied. Victory chances greatly improved.</p>
        </div>
      </div>

      <div class="result-msg" *ngIf="resultMsg" [class.error]="isError">{{ resultMsg }}</div>
    </div>
  `,
  styles: [`
    .diplomacy-panel {
      background: #2c1e0f; border: 1px solid #6b5a3e; border-radius: 6px;
      width: 280px; display: flex; flex-direction: column; font-size: 0.82rem;
    }
    .panel-header {
      display: flex; align-items: center; background: #1a1208;
      padding: 8px 12px; border-bottom: 1px solid #6b5a3e;
    }
    h3 { color: #d4af37; font-family: Cinzel, serif; margin: 0; flex: 1; font-size: 0.95rem; }
    .close-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 1rem; }
    .close-btn:hover { color: #fff; }
    .panel-body { padding: 10px; display: flex; flex-direction: column; gap: 10px; }
    .status-block { display: flex; align-items: center; gap: 8px; }
    .status-label { color: #b0a080; }
    .status-badge { padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 0.75rem; }
    .status-war { background: #b71c1c; color: #ffcdd2; }
    .status-neutral { background: #e65100; color: #ffe0b2; }
    .status-peace { background: #1b5e20; color: #c8e6c9; }
    .status-alliance { background: #0d47a1; color: #bbdefb; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .stat { display: flex; justify-content: space-between; padding: 3px 6px; background: #3a2e1e; border-radius: 3px; }
    .skey { color: #b0a080; }
    .sval { color: #d4af37; font-weight: 700; }
    .actions { display: flex; flex-direction: column; gap: 6px; }
    .dip-btn {
      padding: 7px; border-radius: 5px; cursor: pointer; font-size: 0.82rem;
      font-weight: 700; border: none; transition: opacity 0.15s;
    }
    .dip-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .dip-btn.war { background: #b71c1c; color: #ffcdd2; }
    .dip-btn.war:hover { background: #c62828; }
    .dip-btn.peace { background: #1b5e20; color: #c8e6c9; }
    .dip-btn.peace:hover { background: #2e7d32; }
    .dip-btn.gold { background: #3d2c00; color: #d4af37; border: 1px solid #d4af37; }
    .dip-btn.gold:hover:not(:disabled) { background: #4a3500; }
    .flavor-text { margin-top: 4px; }
    .flavor-text p { color: #9e9e9e; margin: 0; font-size: 0.78rem; font-style: italic; }
    .result-msg { padding: 6px 12px; background: #1b5e20; color: #c8e6c9; font-size: 0.78rem; }
    .result-msg.error { background: #b71c1c; color: #ffcdd2; }
  `]
})
export class DiplomacyPanelComponent {
  @Input() state!: GameState;
  @Input() gameId!: string;
  @Output() close = new EventEmitter<void>();

  resultMsg = '';
  isError = false;

  constructor(private gameService: GameService) {}

  get status(): string { return this.state?.player?.diplomacy_status ?? 'peace'; }

  get statusLabel(): string {
    const map: Record<string, string> = {
      war: 'At War', peace: 'Peace', alliance: 'Alliance'
    };
    return map[this.status] ?? 'Peace';
  }

  doAction(action: DiplomacyAction): void {
    let actionType = '';
    let params: Record<string, any> = {};
    let goldToSend = 0;
    switch (action) {
      case 'declare_war':
        actionType = 'diplomacy';
        params = { move: 'declare_war' };
        break;
      case 'propose_peace':
        actionType = 'diplomacy';
        params = { move: 'propose_peace' };
        break;
      case 'send_gold':
        actionType = 'diplomacy';
        params = { move: 'send_gold', amount: 50 };
        goldToSend = 50;
        break;
    }
    if (goldToSend && this.state.player.resources.gold < goldToSend) {
      this.resultMsg = 'Not enough gold.'; this.isError = true; return;
    }
    this.gameService.sendAction(this.gameId, actionType, params).subscribe({
      next: () => { this.resultMsg = 'Diplomatic action sent.'; this.isError = false; },
      error: (e: any) => { this.resultMsg = e.error?.detail ?? 'Error'; this.isError = true; }
    });
  }
}
