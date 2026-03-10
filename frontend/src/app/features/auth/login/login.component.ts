import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-backdrop">
      <div class="auth-card">
        <h1 class="title">CIVilizaTu</h1>
        <h2>Login</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>Username
            <input formControlName="username" type="text" autocomplete="username" />
          </label>
          <label>Password
            <input formControlName="password" type="password" autocomplete="current-password" />
          </label>
          <p class="error" *ngIf="error">{{ error }}</p>
          <button type="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Logging in…' : 'Login' }}
          </button>
        </form>
        <p class="link">No account? <a routerLink="/register">Register</a></p>
      </div>
    </div>
  `,
  styles: [`
    .auth-backdrop { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #1a1208; }
    .auth-card { background: #2c1e0f; border: 2px solid #b8860b; border-radius: 8px; padding: 2rem; width: 100%; max-width: 380px; }
    .title { font-family: 'Cinzel', serif; color: #d4af37; text-align: center; margin-bottom: 0.5rem; font-size: 2rem; }
    h2 { color: #c8a96e; text-align: center; margin-bottom: 1.5rem; font-family: 'Rajdhani', sans-serif; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.3rem; color: #d4c4a0; font-family: 'Rajdhani', sans-serif; }
    input { background: #1a1208; border: 1px solid #6b5a3e; color: #e8d8b0; padding: 0.5rem; border-radius: 4px; }
    input:focus { outline: none; border-color: #d4af37; }
    button { background: #8b6914; color: #fff8e1; border: none; padding: 0.75rem; border-radius: 4px; font-family: 'Cinzel', serif; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
    button:hover:not(:disabled) { background: #b8860b; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #ff6b6b; text-align: center; }
    .link { text-align: center; color: #9a8060; margin-top: 1rem; }
    .link a { color: #d4af37; }
  `]
})
export class LoginComponent {
  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  error = '';
  loading = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { username, password } = this.form.value;
    this.auth.login({ username: username!, password: password! }).subscribe({
      next: () => this.router.navigate(['/lobby']),
      error: (e: any) => { this.error = e.error?.detail || 'Login failed'; this.loading = false; },
    });
  }
}
