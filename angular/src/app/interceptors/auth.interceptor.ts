// angular/src/app/interceptors/auth.interceptor.ts
// Inyecta el token JWT en el header Authorization de cada petición HTTP
import { Injectable }                         from '@angular/core';
import { HttpInterceptor, HttpRequest,
         HttpHandler, HttpEvent,
         HttpErrorResponse }                  from '@angular/common/http';
import { Observable, throwError }             from 'rxjs';
import { catchError }                         from 'rxjs/operators';
import { AuthService }                        from '../services/auth.service';
import { Router }                             from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private auth: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.getToken();

    // Clonar la request e inyectar el token si existe
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        // Token expirado o inválido → redirigir al login
        if (err.status === 401 || err.status === 403) {
          this.auth.logout();
        }
        return throwError(() => err);
      })
    );
  }
}
