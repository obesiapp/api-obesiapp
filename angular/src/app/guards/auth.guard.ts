// angular/src/app/guards/auth.guard.ts
// Guard que protege rutas requiriendo sesión activa
import { inject }              from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService }         from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────

// angular/src/app/guards/role.guard.ts
// Guard que restringe rutas según el rol del usuario
import { CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth     = inject(AuthService);
  const router   = inject(Router);
  const required = route.data['roles'] as string[] ?? [];

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (required.length && !auth.hasRole(...required)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};

// ─── Uso en app.routes.ts ────────────────────────────────────────────────────
/*
export const routes: Routes = [
  { path: 'login',       component: LoginComponent },
  {
    path:       'dashboard',
    component:  DashboardComponent,
    canActivate:[authGuard, roleGuard],
    data:       { roles: ['guardian', 'admin'] }
  },
  {
    path:       'child',
    component:  ChildHomeComponent,
    canActivate:[authGuard, roleGuard],
    data:       { roles: ['child'] }
  },
  { path: '**', redirectTo: 'login' }
];
*/
