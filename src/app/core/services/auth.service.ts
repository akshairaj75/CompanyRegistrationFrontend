import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';
import { environment } from '../../../environments/environment';


export const TOKEN_KEY = 'cr_auth_token';
export const USER_KEY = 'cr_auth_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly authUrl = `${environment.apiUrl.replace(/\/api\/company-app$/, '')}/api/auth`;

  // Reactive state signals
  readonly token = signal<string | null>(this.getStoredToken());
  readonly currentUser = signal<UserProfile | null>(this.getStoredUser());
  readonly isLoggedIn = computed(() => {
    const t = this.token();
    return !!t && !this.isTokenExpired(t);
  });

  constructor() {
    const token = this.token();
    if (token) {
      if (this.isTokenExpired(token)) {
        this.clearStorage();
        this.token.set(null);
        this.currentUser.set(null);
      } else {
        // Token is valid locally. Silently sync profile in background
        this.fetchCurrentUser().subscribe({
          next: (user) => {
            if (user) {
              this.currentUser.set(user);
              this.saveStorage(USER_KEY, JSON.stringify(user));
            }
          },
          error: (err) => {
            // Only log out if backend explicitly rejects the token with 401
            if (err?.status === 401) {
              this.logout();
            }
          }
        });
      }
    }
  }

  /**
   * Authenticate user with username/email and password
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/login`, credentials).pipe(
      tap((res) => {
        if (res && res.token) {
          const userProfile: UserProfile = {
            username: res.username,
            email: res.email,
            fullName: res.fullName,
            role: res.role
          };
          this.setSession(res.token, userProfile);
        }
      })
    );
  }

  /**
   * Register a new user account and initialize session
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/register`, data).pipe(
      tap((res) => {
        if (res && res.token) {
          const userProfile: UserProfile = {
            username: res.username,
            email: res.email,
            fullName: res.fullName,
            role: res.role
          };
          this.setSession(res.token, userProfile);
        }
      })
    );
  }

  /**
   * Fetch current authenticated user profile

   */
  fetchCurrentUser(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.authUrl}/me`);
  }

  /**
   * End session and redirect to login
   */
  logout(): void {
    this.clearStorage();
    this.token.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Save session in both sessionStorage and localStorage
   */
  private setSession(token: string, user: UserProfile): void {
    this.saveStorage(TOKEN_KEY, token);
    this.saveStorage(USER_KEY, JSON.stringify(user));
    this.token.set(token);
    this.currentUser.set(user);
  }

  /**
   * Read token from sessionStorage with fallback to localStorage
   */
  getStoredToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    if (token && !this.isTokenExpired(token)) {
      return token;
    }
    return null;
  }

  /**
   * Read user profile from sessionStorage with fallback to localStorage
   */
  getStoredUser(): UserProfile | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const userJson = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    if (userJson) {
      try {
        return JSON.parse(userJson) as UserProfile;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Check if a JWT token has expired using local payload exp claim
   */
  isTokenExpired(token: string | null): boolean {
    if (!token) {
      return true;
    }
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true;
      }
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      if (!decoded.exp) {
        return false;
      }
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTimeInSeconds;
    } catch {
      return true;
    }
  }

  private saveStorage(key: string, value: string): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(key, value);
        localStorage.setItem(key, value);
      } catch {
        // Ignore storage quota errors
      }
    }
  }

  private clearStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }
}
