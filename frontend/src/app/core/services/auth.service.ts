import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthState, LoginRequest, RegisterRequest, TokenResponse, User } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'civ_token';
  private readonly USER_KEY = 'civ_user';

  private _state = new BehaviorSubject<AuthState>(this._loadInitialState());
  readonly state$ = this._state.asObservable();

  constructor(private http: HttpClient) {}

  get isAuthenticated(): boolean { return !!this._state.value.token; }
  get token(): string | null { return this._state.value.token; }
  get user(): User | null { return this._state.value.user; }

  login(req: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${environment.apiUrl}/api/auth/login`, req).pipe(
      tap(res => this._setAuth(res))
    );
  }

  register(req: RegisterRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${environment.apiUrl}/api/auth/register`, req).pipe(
      tap(res => this._setAuth(res))
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._state.next({ user: null, token: null, isAuthenticated: false });
  }

  private _setAuth(res: TokenResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.access_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this._state.next({ user: res.user, token: res.access_token, isAuthenticated: true });
  }

  private _loadInitialState(): AuthState {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userStr = localStorage.getItem(this.USER_KEY);
    if (token && userStr) {
      try {
        return { user: JSON.parse(userStr), token, isAuthenticated: true };
      } catch { /* ignore */ }
    }
    return { user: null, token: null, isAuthenticated: false };
  }
}
