// angular/src/app/app.config.ts
// Configuración raíz de la aplicación Angular (standalone components)
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter }                                  from '@angular/router';
import { provideHttpClient, withInterceptors }            from '@angular/common/http';
import { HTTP_INTERCEPTORS }                              from '@angular/common/http';
import { AuthInterceptor }                                from './interceptors/auth.interceptor';

// Con interceptores funcionales (Angular 17+):
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // provideRouter(routes),
    provideHttpClient(),

    // RF-02: Interceptor que inyecta JWT en cada request
    {
      provide:    HTTP_INTERCEPTORS,
      useClass:   AuthInterceptor,
      multi:      true,
    },
  ],
};
