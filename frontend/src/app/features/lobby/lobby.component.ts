import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../../core/services/game.service';
import { AuthService } from '../../core/services/auth.service';
import { Scenario, SavedGameSummary } from '../../core/models/game.models';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="lobby">
      <header class="lobby-header">
        <h1>CIVilizaTu</h1>
        <div class="user-info">
          <span>{{ username }}</span>
          <button class="btn-sm" (click)="logout()">Logout</button>
        </div>
      </header>

      <div class="lobby-body">
        <!-- New Game -->
        <section class="panel">
          <h2>New Game</h2>
          <form [formGroup]="newGameForm" (ngSubmit)="startNewGame()">
            <label>Game Name
              <input formControlName="name" type="text" placeholder="My Empire" />
            </label>
            <label>Civilization
              <select formControlName="civ">
                <option value="aztec">Aztec Empire (Science +15%, Culture +10%)</option>
                <option value="rome">Roman Empire (Production +20%, Gold +10%)</option>
              </select>
            </label>
            <label>Scenario
              <select formControlName="scenarioId">
                <option *ngFor="let s of scenarios" [value]="s.id">{{ s.name }} ({{ s.difficulty }})</option>
              </select>
            </label>
            <button type="submit" [disabled]="newGameForm.invalid || creating" class="btn-primary">
              {{ creating ? 'Creating…' : 'Start New Game' }}
            </button>
          </form>
          <p class="error" *ngIf="createError">{{ createError }}</p>
        </section>

        <!-- Saved Games -->
        <section class="panel">
          <h2>Saved Games</h2>
          <p *ngIf="savedGames.length === 0" class="empty">No saved games yet.</p>
          <ul class="save-list">
            <li *ngFor="let g of savedGames" class="save-item" (click)="loadGame(g.id)">
              <div class="save-name">{{ g.name }} <span class="autosave" *ngIf="g.is_autosave">[autosave]</span></div>
              <div class="save-meta">Turn {{ g.turn }} · {{ g.last_saved | date:'short' }}</div>
              <div class="save-status" [class.won]="g.result.includes('player_win')" [class.lost]="g.result.includes('ai_win')">
                {{ formatResult(g.result) }}
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .lobby { min-height: 100vh; background: #1a1208; color: #d4c4a0; font-family: 'Rajdhani', sans-serif; }
    .lobby-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: #0e0a04; border-bottom: 2px solid #b8860b; }
    h1 { font-family: 'Cinzel', serif; color: #d4af37; font-size: 2rem; margin: 0; }
    .user-info { display: flex; align-items: center; gap: 1rem; }
    .btn-sm { background: #4a3520; border: 1px solid #8b6914; color: #d4c4a0; padding: 0.3rem 0.8rem; cursor: pointer; border-radius: 3px; }
    .btn-sm:hover { background: #6b5030; }
    .lobby-body { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; padding: 2rem; max-width: 1000px; margin: 0 auto; }
    .panel { background: #2c1e0f; border: 1px solid #6b5a3e; border-radius: 8px; padding: 1.5rem; }
    h2 { font-family: 'Cinzel', serif; color: #c8a96e; margin-top: 0; border-bottom: 1px solid #4a3520; padding-bottom: 0.5rem; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.3rem; }
    input, select { background: #1a1208; border: 1px solid #6b5a3e; color: #e8d8b0; padding: 0.5rem; border-radius: 4px; width: 100%; box-sizing: border-box; }
    input:focus, select:focus { outline: none; border-color: #d4af37; }
    .btn-primary { background: #8b6914; color: #fff8e1; border: none; padding: 0.75rem; border-radius: 4px; font-family: 'Cinzel', serif; font-size: 1rem; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #b8860b; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #ff6b6b; }
    .empty { color: #6b5a3e; font-style: italic; }
    .save-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .save-item { background: #1a1208; border: 1px solid #4a3520; border-radius: 4px; padding: 0.75rem; cursor: pointer; transition: border-color 0.2s; }
    .save-item:hover { border-color: #d4af37; }
    .save-name { font-weight: bold; color: #e8d8b0; }
    .autosave { font-size: 0.75rem; color: #8b6914; }
    .save-meta { font-size: 0.85rem; color: #9a8060; }
    .save-status { font-size: 0.8rem; }
    .save-status.won { color: #4caf50; }
    .save-status.lost { color: #f44336; }
    @media (max-width: 700px) { .lobby-body { grid-template-columns: 1fr; } }
  `]
})
export class LobbyComponent implements OnInit {
  scenarios: Scenario[] = [];
  savedGames: SavedGameSummary[] = [];
  creating = false;
  createError = '';
  username = '';

  newGameForm = this.fb.group({
    name: ['My Empire', Validators.required],
    civ: ['aztec', Validators.required],
    scenarioId: ['', Validators.required],
  });

  constructor(
    private fb: FormBuilder,
    private game: GameService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.username = this.auth.user?.username ?? '';
    this.game.getScenarios().subscribe(s => {
      this.scenarios = s;
      if (s.length > 0) { this.newGameForm.patchValue({ scenarioId: s[0].id }); }
    });
    this.game.getSavedGames().subscribe(g => this.savedGames = g);
  }

  startNewGame(): void {
    if (this.newGameForm.invalid) return;
    this.creating = true;
    this.createError = '';
    const { name, scenarioId, civ } = this.newGameForm.value;
    this.game.createGame(name!, scenarioId!, civ!).subscribe({
      next: (res) => this.loadGame(res.id),
      error: (e) => { this.createError = e.error?.detail || 'Failed to create game'; this.creating = false; },
    });
  }

  loadGame(id: string): void {
    this.router.navigate(['/game', id]);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  formatResult(result: string): string {
    if (result === 'ongoing') return 'In Progress';
    return result.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
