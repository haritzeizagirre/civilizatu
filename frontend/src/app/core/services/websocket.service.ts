import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface AiTurnMessage {
  status?: string;
  action_index?: number;
  total?: number;
  action?: Record<string, unknown>;
  event?: Record<string, unknown>;
  state_after?: Record<string, unknown>;
  done?: boolean;
  reasoning?: string;
  analysis?: string;
  final_state?: Record<string, unknown>;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;

  private _messages = new Subject<AiTurnMessage>();
  readonly messages$ = this._messages.asObservable();

  constructor(private authService: AuthService, private zone: NgZone) {}

  connect(gameId: string): void {
    if (this.ws) { this.disconnect(); }

    // In development, wsUrl is set (e.g. 'ws://localhost:8000') → direct to backend
    // In production (Docker/nginx), wsUrl is empty → proxy via nginx at /api-backend
    let url: string;
    if (environment.wsUrl) {
      url = `${environment.wsUrl}/api/games/ws/${gameId}`;
    } else {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      url = `${scheme}://${window.location.host}/api-backend/api/games/ws/${gameId}`;
    }
    console.log('[WS] Connecting to', url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected to', url);
      // Send auth token as first message
      this.ws!.send(JSON.stringify({ token: this.authService.token }));
    };

    this.ws.onmessage = (event) => {
      this.zone.run(() => {
        try {
          const msg: AiTurnMessage = JSON.parse(event.data);
          console.log('[WS] Message:', msg);
          this._messages.next(msg);
        } catch (e) {
          console.error('[WS] parse error', e);
        }
      });
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this.zone.run(() => this._messages.next({ error: 'WebSocket error' }));
    };

    this.ws.onclose = (ev) => {
      console.log('[WS] Closed. Code:', ev.code, 'Reason:', ev.reason);
      this.ws = null;
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
