import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../../core/services/game.service';

const CHEAT_CODES = [
  { code: 'eraiki_guztiak', desc: 'Build all buildings in all cities' },
  { code: 'berehalako_porrota', desc: 'Instant defeat (for testing)' },
  { code: 'berehalako_garaipena', desc: 'Instant victory' },
  { code: 'tanke_eskuadroia', desc: 'Spawn 5 tanks in capital' },
  { code: 'teknologia_aurreratua', desc: 'Research all technologies' },
  { code: 'maila_igo', desc: 'Upgrade all units to veteran' },
  { code: 'baliabide_maximoak', desc: 'Max out all resources' },
  { code: 'mugimendu_infinitua', desc: 'Infinite movement for units' },
  { code: 'zorion_maximoa', desc: 'Max happiness in all cities' },
  { code: 'mapa_agertu', desc: 'Reveal the entire map' },
];

@Component({
  selector: 'app-cheat-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="console-panel">
      <div class="console-header">
        <span class="console-title">💀 Cheat Console</span>
        <button class="close-btn" (click)="close.emit()">✕</button>
      </div>

      <div class="console-body">
        <div class="log" #logEl>
          <div class="log-line welcome">// CIVilizaTu cheat console — Type a code and press Enter</div>
          <div class="log-line" *ngFor="let l of log" [class.error]="l.error" [class.success]="l.success">
            <span class="log-prompt">{{ l.prompt ? '> ' + l.prompt : '' }}</span>
            <span class="log-msg">{{ l.msg }}</span>
          </div>
        </div>

        <div class="input-row">
          <span class="prompt-sym">></span>
          <input
            #inputEl
            class="console-input"
            [(ngModel)]="inputValue"
            (keydown.enter)="submit()"
            (keydown.ArrowUp)="historyBack()"
            (keydown.ArrowDown)="historyForward()"
            placeholder="Enter cheat code..."
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <!-- Reference -->
        <div class="code-list">
          <div class="code-list-header">Available codes</div>
          <div class="code-item" *ngFor="let c of codes" (click)="inputValue = c.code">
            <span class="code-str">{{ c.code }}</span>
            <span class="code-desc">{{ c.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .console-panel {
      background: #0a0a0a; border: 1px solid #d4af37; border-radius: 6px;
      width: 500px; max-height: 480px; display: flex; flex-direction: column;
      font-family: 'Courier New', monospace; font-size: 0.8rem;
    }
    .console-header {
      display: flex; align-items: center; background: #1a1208;
      padding: 6px 12px; border-bottom: 1px solid #d4af37;
    }
    .console-title { color: #d4af37; flex: 1; font-family: Cinzel, serif; font-size: 0.85rem; }
    .close-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 1rem; }
    .close-btn:hover { color: #fff; }
    .console-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
    .log { flex: 1; overflow-y: auto; padding: 8px; max-height: 160px; background: #050505; }
    .log-line { color: #c8c8c8; margin-bottom: 2px; white-space: pre-wrap; word-break: break-all; }
    .log-line.welcome { color: #666; }
    .log-line.error .log-msg { color: #ef9a9a; }
    .log-line.success .log-msg { color: #a5d6a7; }
    .log-prompt { color: #d4af37; margin-right: 4px; }
    .input-row { display: flex; align-items: center; padding: 4px 8px; border-top: 1px solid #222; background: #050505; }
    .prompt-sym { color: #d4af37; margin-right: 6px; font-weight: 700; }
    .console-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #c8c8c8; font-family: 'Courier New', monospace; font-size: 0.8rem; caret-color: #d4af37;
    }
    .code-list { overflow-y: auto; border-top: 1px solid #222; max-height: 180px; }
    .code-list-header { color: #666; font-size: 0.68rem; padding: 3px 8px; background: #0a0a0a; position: sticky; top: 0; }
    .code-item { display: flex; gap: 8px; padding: 3px 8px; cursor: pointer; transition: background 0.1s; }
    .code-item:hover { background: #1a1208; }
    .code-str { color: #d4af37; min-width: 200px; }
    .code-desc { color: #888; font-size: 0.75rem; }
  `]
})
export class CheatConsoleComponent {
  @Input() gameId!: string;
  @Input() selectedCityId: string | null = null;
  @Output() close = new EventEmitter<void>();
  @ViewChild('logEl') logEl!: ElementRef<HTMLDivElement>;
  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;

  inputValue = '';
  log: { prompt?: string; msg: string; error?: boolean; success?: boolean }[] = [];
  codes = CHEAT_CODES;
  private history: string[] = [];
  private histIdx = -1;

  constructor(private gameService: GameService) {}

  submit(): void {
    const code = this.inputValue.trim();
    if (!code) return;
    this.history.unshift(code);
    this.histIdx = -1;
    this.log.push({ prompt: code, msg: '' });
    this.inputValue = '';

    const params: Record<string, any> = {};
    if (this.selectedCityId) params['cityId'] = this.selectedCityId;

    this.gameService.sendCheat(this.gameId, code, params).subscribe({
      next: () => {
        this.log.push({ msg: 'Cheat applied!', success: true });
        this.scrollLog();
      },
      error: (e: any) => {
        this.log.push({ msg: e.error?.detail ?? 'Invalid cheat or cheats disabled.', error: true });
        this.scrollLog();
      }
    });
    this.scrollLog();
  }

  historyBack(): void {
    if (this.histIdx < this.history.length - 1) {
      this.histIdx++;
      this.inputValue = this.history[this.histIdx];
    }
  }

  historyForward(): void {
    if (this.histIdx > 0) {
      this.histIdx--;
      this.inputValue = this.history[this.histIdx];
    } else {
      this.histIdx = -1;
      this.inputValue = '';
    }
  }

  private scrollLog(): void {
    setTimeout(() => {
      const el = this.logEl?.nativeElement;
      if (el) { el.scrollTop = el.scrollHeight; }
    }, 0);
  }
}
