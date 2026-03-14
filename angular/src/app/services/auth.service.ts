// angular/src/app/services/auth.service.ts
// RF-02 — Servicio de autenticación Angular: login, JWT, logout, guard
import { Injectable }       from '@angular/core';
import { HttpClient }       from '@angular/common/http';
import { Router }           from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { jwtDecode }        from 'jwt-decode';
import { environment }      from '../../environments/environment';

export interface AuthUser {
  accountId:  string;
  role:       'child' | 'guardian' | 'admin';
  username:   string;
  guardianId?: string;
  childId?:    string;
  exp:         number;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token:     string;
    expiresIn: string;
    user:      Omit<AuthUser, 'exp'>;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly TOKEN_KEY = 'hk_token';
  private readonly API       = `${environment.apiUrl}/auth`;

  // BehaviorSubject para que los componentes reaccionen a cambios de sesión
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getDecodedToken());
  currentUser$               = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  // ── Login ──────────────────────────────────────────────────────────────────
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API}/login`, { username, password })
      .pipe(tap(response => {
        if (response.success) {
          sessionStorage.setItem(this.TOKEN_KEY, response.data.token);
          const decoded = this.getDecodedToken();
          this.currentUserSubject.next(decoded);
        }
      }));
  }

  // ── Registro de tutor ──────────────────────────────────────────────────────
  register(data: { username: string; email: string; password: string; displayName?: string }) {
    return this.http.post(`${this.API}/register`, data);
  }

  // ── Cambio de contraseña ───────────────────────────────────────────────────
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post(`${this.API}/change-password`, { currentPassword, newPassword });
  }

  // ── Token helpers ──────────────────────────────────────────────────────────
  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  getDecodedToken(): AuthUser | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return jwtDecode<AuthUser>(token);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const user = this.getDecodedToken();
    if (!user) return false;
    return Date.now() < user.exp * 1000;
  }

  hasRole(...roles: string[]): boolean {
    const user = this.getDecodedToken();
    return !!user && roles.includes(user.role);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}
