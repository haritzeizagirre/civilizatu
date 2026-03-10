import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { WebSocketService, AiTurnMessage } from '../../core/services/websocket.service';
import { SoundService } from '../../core/services/sound.service';
import { GameState } from '../../core/models/game.models';
import { HexGridComponent } from './hex-grid/hex-grid.component';
import { HudComponent } from './hud/hud.component';
import { CityPanelComponent } from './city-panel/city-panel.component';
import { TechPanelComponent } from './tech-panel/tech-panel.component';
import { DiplomacyPanelComponent } from './diplomacy-panel/diplomacy-panel.component';
import { AiTurnOverlayComponent } from './ai-turn-overlay/ai-turn-overlay.component';
import { CheatConsoleComponent } from './cheat-console/cheat-console.component';
import { VictoryModalComponent } from './victory-modal/victory-modal.component';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    CommonModule,
    HexGridComponent,
    HudComponent,
    CityPanelComponent,
    TechPanelComponent,
    DiplomacyPanelComponent,
    AiTurnOverlayComponent,
    CheatConsoleComponent,
    VictoryModalComponent,
  ],
  template: `
    <div class="game-shell" *ngIf="state; else loading">
      <!-- Main map -->
      <app-hex-grid
        [state]="state"
        (unitSelected)="onUnitSelected($event)"
        (citySelected)="onCitySelected($event)"
        (moveUnit)="onMoveUnit($event)"
        (attackUnit)="onAttackUnit($event)"
      />

      <!-- HUD (top bar) -->
      <app-hud
        [state]="state"
        (endTurn)="onEndTurn()"
        (saveGame)="onSave()"
        (openTech)="showTech = true"
        (openDiplomacy)="showDiplomacy = true"
        (backToLobby)="backToLobby()"
      />

      <!-- Side panels -->
      <app-city-panel
        *ngIf="selectedCityId"
        [city]="selectedCity!"
        [state]="state"
        [gameId]="gameId"
        (close)="closePanels()"
      />
      <app-tech-panel
        *ngIf="showTech"
        [state]="state"
        [gameId]="gameId"
        (close)="showTech = false"
      />
      <app-diplomacy-panel
        *ngIf="showDiplomacy"
        [state]="state"
        [gameId]="gameId"
        (close)="showDiplomacy = false"
      />

      <!-- AI turn overlay (full-screen takeover) -->
      <app-ai-turn-overlay
        *ngIf="aiTurnActive"
        [messages]="aiMessages"
        [speed]="aiSpeed"
        (speedChange)="aiSpeed = $event"
        (done)="onAiTurnDone()"
      />

      <!-- Cheat console -->
      <app-cheat-console
        *ngIf="cheatOpen"
        [gameId]="gameId"
        [selectedCityId]="selectedCityId"
        (close)="cheatOpen = false"
      />

      <!-- Victory modal -->
      <app-victory-modal
        *ngIf="state.result !== 'ongoing'"
        [result]="state.result"
        [stats]="victoryStats"
        (restart)="backToLobby()"
      />
    </div>
    <ng-template #loading>
      <div class="loading-screen">Loading game…</div>
    </ng-template>
  `,
  styles: [`
    .game-shell { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: #0e0a04; }
    .loading-screen { display: flex; align-items: center; justify-content: center; height: 100vh; background: #0e0a04; color: #d4af37; font-family: 'Cinzel', serif; font-size: 1.5rem; }
  `]
})
export class GameComponent implements OnInit, OnDestroy {
  gameId = '';
  state: GameState | null = null;
  selectedCityId: string | null = null;
  showTech = false;
  showDiplomacy = false;
  cheatOpen = false;
  aiTurnActive = false;
  aiMessages: AiTurnMessage[] = [];
  aiSpeed = 1;

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private game: GameService,
    private ws: WebSocketService,
    private sound: SoundService,
  ) {}

  ngOnInit(): void {
    this.gameId = this.route.snapshot.paramMap.get('id')!;
    this.game.loadGame(this.gameId).subscribe();
    this.subs.add(this.game.gameState$.subscribe(s => {
      this.state = s;
      if (s?.result && s.result !== 'ongoing') {
        if (s.result.startsWith('player_win')) this.sound.playVictory();
        else this.sound.playDefeat();
      }
    }));
    this.subs.add(this.game.selectedCityId$.subscribe(id => this.selectedCityId = id));
    this.subs.add(this.ws.messages$.subscribe(msg => this.handleWsMessage(msg)));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.ws.disconnect();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      this.cheatOpen = !this.cheatOpen;
    }
  }

  get selectedCity() {
    return this.state?.player.cities.find(c => c.id === this.selectedCityId) ?? null;
  }

  get victoryStats() {
    if (!this.state) return null;
    return {
      turn: this.state.turn,
      techs: this.state.player.researched_techs.length,
      cities: this.state.player.cities.length,
      units: this.state.player.units.length,
    };
  }

  onUnitSelected(unitId: string): void { this.game.selectUnit(unitId); }
  onCitySelected(cityId: string): void { this.game.selectCity(cityId); }
  closePanels(): void { this.game.selectCity(null); this.game.selectUnit(null); }

  onMoveUnit(e: { unitId: string; x: number; y: number }): void {
    this.game.sendAction(this.gameId, 'moveUnit', { unitId: e.unitId, destination: { x: e.x, y: e.y } })
      .subscribe(() => this.sound.playMove());
  }

  onAttackUnit(e: { attackerUnitId: string; defenderUnitId: string }): void {
    this.game.sendAction(this.gameId, 'attackEnemy', e).subscribe(() => this.sound.playCombat());
  }

  onEndTurn(): void {
    this.game.endTurn(this.gameId).subscribe(s => {
      this.sound.playTurnEnd();
      if (s.current_player === 'ai') { this.startAiTurn(); }
    });
  }

  onSave(): void {
    this.game.saveGame(this.gameId).subscribe();
  }

  startAiTurn(): void {
    this.aiTurnActive = true;
    this.aiMessages = [];
    this.ws.connect(this.gameId);
  }

  handleWsMessage(msg: AiTurnMessage): void {
    this.aiMessages = [...this.aiMessages, msg];
    // Live map update: apply each state_after so AI units visually move step by step
    if (msg.state_after) {
      this.game.updateState(msg.state_after as unknown as GameState);
    }
    // Final state supersedes (contains fog-filtered AI data)
    if (msg.done && msg.final_state) {
      this.game.updateState(msg.final_state as unknown as GameState);
    }
  }

  onAiTurnDone(): void {
    this.aiTurnActive = false;
    this.ws.disconnect();
  }

  backToLobby(): void { this.router.navigate(['/lobby']); }
}
