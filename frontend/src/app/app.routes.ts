import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'lobby', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'lobby',
    loadComponent: () => import('./features/lobby/lobby.component').then(m => m.LobbyComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'game/:id',
    loadComponent: () => import('./features/game/game.component').then(m => m.GameComponent),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: 'lobby' }
];
