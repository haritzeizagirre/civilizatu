export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginRequest { username: string; password: string; }
export interface RegisterRequest { username: string; email: string; password: string; }

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
