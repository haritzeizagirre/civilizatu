import {
  Component, Input, Output, EventEmitter, OnChanges, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiTurnMessage } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-ai-turn-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay" *ngIf="messages.length > 0">
      <!-- Header -->
      <div class="overlay-header">
        <span class="ai-tag">⚙ AI TURN</span>
        <span class="civ-name">Rome</span>
        <div class="controls">
          <button class="ctrl-btn" (click)="togglePause()">{{ paused ? '▶' : '⏸' }}</button>
          <button class="ctrl-btn" (click)="stepBack()" [disabled]="cursor <= 0">◀</button>
          <button class="ctrl-btn" (click)="stepForward()" [disabled]="cursor >= messages.length - 1">▶▶</button>
          <select class="speed-sel" [(ngModel)]="speed" (change)="onSpeedChange()">
            <option value="1">1×</option>
            <option value="0.5">2×</option>
            <option value="0.1">Instant</option>
          </select>
          <button class="skip-btn" (click)="skip()">Skip to End</button>
        </div>
      </div>

      <!-- Main action display -->
      <div class="action-display">
        <div class="action-icon">{{ currentActionEmoji }}</div>
        <div class="action-text">{{ currentActionText }}</div>
        <div class="action-progress">
          <div class="prog-fill" [style.width.%]="progressPct"></div>
        </div>
      </div>

      <!-- Message log -->
      <div class="message-log">
        <div
          class="log-entry"
          *ngFor="let msg of visibleMessages; let i = index"
          [class.current]="i === cursor"
          [class.done]="isDoneMsg(msg)"
        >
          <span class="log-icon">{{ msgIcon(msg) }}</span>
          <span class="log-text">{{ msgText(msg) }}</span>
        </div>
      </div>

      <!-- Reasoning (from done message) -->
      <div class="reasoning" *ngIf="reasoning">
        <div class="reasoning-label">AI Reasoning</div>
        <div class="reasoning-text">{{ reasoning }}</div>
      </div>

      <!-- Done state -->
      <div class="done-bar" *ngIf="isDone">
        <span>AI turn complete</span>
        <button class="done-btn" (click)="done.emit()">Continue ▶</button>
      </div>
    </div>
  `,
  styles: [`
    :host { position: absolute; inset: 0; z-index: 100; pointer-events: none; }
    .overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.82);
      display: flex; flex-direction: column; pointer-events: all;
      font-family: 'Rajdhani', sans-serif; color: #e0d5b0;
    }
    .overlay-header {
      display: flex; align-items: center; gap: 12px;
      background: #0d0805; padding: 10px 16px; border-bottom: 2px solid #d4af37;
    }
    .ai-tag { color: #ef9a9a; font-weight: 700; font-family: Cinzel, serif; font-size: 0.9rem; }
    .civ-name { color: #ef9a9a; font-family: Cinzel, serif; flex: 1; }
    .controls { display: flex; align-items: center; gap: 6px; }
    .ctrl-btn {
      background: #3a2e1e; border: 1px solid #6b5a3e; color: #d4af37;
      padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 0.85rem;
    }
    .ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ctrl-btn:hover:not(:disabled) { background: #4a3e2e; }
    .speed-sel { background: #3a2e1e; border: 1px solid #6b5a3e; color: #e0d5b0; padding: 3px 6px; border-radius: 3px; font-size: 0.8rem; }
    .skip-btn {
      background: #1a3a20; border: 1px solid #4caf50; color: #c8e6c9;
      padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 0.82rem; font-weight: 700;
    }
    .skip-btn:hover { background: #2e7d32; }
    .action-display {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 30px 20px; flex: 1; gap: 12px;
    }
    .action-icon { font-size: 4rem; line-height: 1; }
    .action-text { font-size: 1.4rem; font-family: Cinzel, serif; color: #d4af37; text-align: center; max-width: 400px; }
    .action-progress { width: 300px; height: 6px; background: #1a1208; border-radius: 3px; }
    .prog-fill { height: 100%; background: #ef9a9a; border-radius: 3px; transition: width 0.3s; }
    .message-log {
      max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.4);
      border-top: 1px solid #3a2e1e; padding: 6px 12px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .log-entry { display: flex; gap: 8px; font-size: 0.78rem; color: #9e9e9e; padding: 2px 0; }
    .log-entry.current { color: #d4af37; font-weight: 700; }
    .log-entry.done { color: #4caf50; }
    .log-icon { width: 16px; text-align: center; }
    .reasoning {
      background: rgba(0,0,0,0.5); border-top: 1px solid #6b5a3e;
      padding: 8px 16px; max-height: 80px; overflow-y: auto;
    }
    .reasoning-label { color: #90caf9; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .reasoning-text { color: #9e9e9e; font-size: 0.78rem; font-style: italic; }
    .done-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: #0d3320; border-top: 2px solid #4caf50; padding: 8px 16px;
    }
    .done-btn {
      background: #1b5e20; border: 1px solid #4caf50; color: #c8e6c9;
      padding: 6px 18px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 700;
    }
    .done-btn:hover { background: #2e7d32; }
  `]
})
export class AiTurnOverlayComponent implements OnChanges, OnDestroy {
  @Input() messages: AiTurnMessage[] = [];
  @Output() done = new EventEmitter<void>();
  @Output() speedChange = new EventEmitter<number>();

  @Input() speed = 1;
  paused = false;
  cursor = 0;
  isDone = false;
  reasoning = '';

  private timer: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    // New message added — if not paused and cursor is at end, advance
    if (!this.paused && this.cursor < this.messages.length - 1) {
      this.cursor = this.messages.length - 1;
    }
    // Check done
    const last = this.messages[this.messages.length - 1];
    if (last?.done) {
      this.isDone = true;
      this.reasoning = last.reasoning ?? '';
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void { clearTimeout(this.timer); }

  get visibleMessages(): AiTurnMessage[] { return this.messages; }

  get progressPct(): number {
    if (!this.messages.length) return 0;
    return ((this.cursor + 1) / this.messages.length) * 100;
  }

  get currentActionText(): string {
    const msg = this.messages[this.cursor];
    if (!msg) return 'AI is thinking...';
    return this.msgText(msg);
  }

  get currentActionEmoji(): string {
    const msg = this.messages[this.cursor];
    if (!msg) return '⚙';
    return this.msgIcon(msg);
  }

  msgIcon(msg: AiTurnMessage): string {
    if (msg.status && !msg.action && !msg.done) return '⚙';
    if (msg.done) return '✅';
    if (msg.error) return '❌';
    const action = msg.action ? Object.keys(msg.action)[0] : null;
    const icons: Record<string, string> = {
      moveUnit: '🚶', attackEnemy: '⚔', buildStructure: '🏗', trainUnit: '🪖',
      researchTechnology: '🔬', foundCity: '🏙', endTurn: '⏭'
    };
    return action ? (icons[action] ?? '▶') : '▶';
  }

  msgText(msg: AiTurnMessage): string {
    if (msg.status && !msg.action && !msg.done) return msg.status;
    if (msg.done) return 'AI turn finished.';
    if (msg.error) return msg.error;
    const actionObj = msg.action ?? {};
    const actionType = Object.keys(actionObj)[0] ?? '';
    const params: any = actionObj[actionType] ?? {};
    const labels: Record<string, string> = {
      moveUnit: `Moving unit to (${params.x ?? '?'}, ${params.y ?? '?'})`,
      attackEnemy: `Attacking unit`,
      buildStructure: `Building ${params.buildingType ?? '?'}`,
      trainUnit: `Training ${params.unitType ?? '?'}`,
      researchTechnology: `Researching ${params.techId ?? '?'}`,
      foundCity: `Founding new city`,
      endTurn: 'AI ends turn',
    };
    return labels[actionType] ?? `Action: ${actionType}`;
  }

  isDoneMsg(msg: AiTurnMessage): boolean { return !!msg.done; }

  togglePause(): void {
    this.paused = !this.paused;
    if (!this.paused) this.advance();
  }

  stepBack(): void { if (this.cursor > 0) { this.cursor--; this.cdr.markForCheck(); } }
  stepForward(): void { if (this.cursor < this.messages.length - 1) { this.cursor++; this.cdr.markForCheck(); } }

  onSpeedChange(): void { this.speedChange.emit(+this.speed); }

  skip(): void { this.done.emit(); }

  private advance(): void {
    if (this.paused || this.cursor >= this.messages.length - 1) return;
    this.timer = setTimeout(() => { this.cursor++; this.cdr.markForCheck(); this.advance(); }, +this.speed * 800);
  }
}
