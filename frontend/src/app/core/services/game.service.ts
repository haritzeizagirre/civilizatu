import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GameState, Scenario, SavedGameSummary, ActionRequest } from '../models/game.models';

@Injectable({ providedIn: 'root' })
export class GameService {
  private _gameState = new BehaviorSubject<GameState | null>(null);
  readonly gameState$ = this._gameState.asObservable();

  private _selectedUnitId = new BehaviorSubject<string | null>(null);
  readonly selectedUnitId$ = this._selectedUnitId.asObservable();

  private _selectedCityId = new BehaviorSubject<string | null>(null);
  readonly selectedCityId$ = this._selectedCityId.asObservable();

  constructor(private http: HttpClient) {}

  get state(): GameState | null { return this._gameState.value; }

  // ─── Scenarios ──────────────────────────────────────────────────────────
  getScenarios(): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${environment.apiUrl}/api/scenarios/`);
  }

  // ─── Game CRUD ──────────────────────────────────────────────────────────
  getSavedGames(): Observable<SavedGameSummary[]> {
    return this.http.get<SavedGameSummary[]>(`${environment.apiUrl}/api/games/`);
  }

  createGame(name: string, scenarioId: string, playerCiv: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${environment.apiUrl}/api/games/`, {
      name, scenario_id: scenarioId, player_civ: playerCiv
    });
  }

  loadGame(gameId: string): Observable<GameState> {
    return this.http.get<GameState>(`${environment.apiUrl}/api/games/${gameId}`).pipe(
      tap(state => this._gameState.next(state))
    );
  }

  saveGame(gameId: string, name?: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/api/games/${gameId}/save`, { name });
  }

  // ─── Actions ────────────────────────────────────────────────────────────
  sendAction(gameId: string, actionType: string, details: Record<string, unknown> = {}): Observable<GameState> {
    const body: ActionRequest = { action_type: actionType, details };
    return this.http.post<GameState>(`${environment.apiUrl}/api/games/${gameId}/action`, body).pipe(
      tap(state => this._gameState.next(state))
    );
  }

  endTurn(gameId: string): Observable<GameState> {
    return this.http.post<GameState>(`${environment.apiUrl}/api/games/${gameId}/end-turn`, {}).pipe(
      tap(state => this._gameState.next(state))
    );
  }

  sendCheat(gameId: string, cheatCode: string, target?: Record<string, unknown>): Observable<GameState> {
    return this.http.post<GameState>(`${environment.apiUrl}/api/games/${gameId}/cheat`, {
      cheat_code: cheatCode, target
    }).pipe(
      tap(state => this._gameState.next(state))
    );
  }

  // ─── Selection state ────────────────────────────────────────────────────
  selectUnit(unitId: string | null): void { this._selectedUnitId.next(unitId); }
  selectCity(cityId: string | null): void { this._selectedCityId.next(cityId); }

  updateState(state: GameState): void { this._gameState.next(state); }
}
