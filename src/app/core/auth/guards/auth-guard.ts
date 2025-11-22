import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/auth/auth-service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const { data } = await authService.getSession();

  if (!data.session) {
    router.navigateByUrl('/auth/log-in');
  }
  return !!data.session;
};

export const authRedirectGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const { data } = await authService.getSession();

  if (data.session) {
    router.navigateByUrl('/');
  }
  return !data.session;
};
