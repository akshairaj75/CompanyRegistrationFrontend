import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService, TOKEN_KEY } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Safely resolve token from service signal or storage
  let token = authService.token();
  if (!token && typeof window !== 'undefined') {
    token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }

  // Never send internal auth tokens to external third-party APIs (like Google Cloud Vision)
  const isExternalUrl = req.url.includes('googleapis.com') || (req.url.startsWith('http') && !req.url.includes('/api/'));
  const isPublicAuthEndpoint = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register');

  let authReq = req;
  if (token && !isPublicAuthEndpoint && !isExternalUrl) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only trigger logout on 401 from our internal application backend, not external services
      if (error.status === 401 && !isPublicAuthEndpoint && !isExternalUrl) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
