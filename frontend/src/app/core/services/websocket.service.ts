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

    const url = `${environment.wsUrl}/api/games/ws/${gameId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Send auth token as first message
      this.ws!.send(JSON.stringify({ token: this.authService.token }));
    };

    this.ws.onmessage = (event) => {
      this.zone.run(() => {
        try {
          const msg: AiTurnMessage = JSON.parse(event.data);
          this._messages.next(msg);
        } catch (e) {
          console.error('WS parse error', e);
        }
      });
    };

    this.ws.onerror = (err) => {
      this.zone.run(() => this._messages.next({ error: 'WebSocket error' }));
    };

    this.ws.onclose = () => {
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
