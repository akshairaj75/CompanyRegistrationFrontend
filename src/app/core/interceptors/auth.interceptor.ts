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

  const isPublicAuthEndpoint = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register');

  let authReq = req;
  if (token && !isPublicAuthEndpoint) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicAuthEndpoint) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
