import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth-service';

/**
 * Guard que verifica si el usuario tiene el role_id 5 (CASHIER)
 * Solo los usuarios con rol de cajero pueden acceder a rutas protegidas con este guard
 */
export const cashierRoleGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const userData = await authService.getUserProfileData();

    // Verificar si el usuario tiene el role_id 5 (CASHIER)
    const hasCashierRole = userData.roles && userData.roles.includes(5);

    if (!hasCashierRole) {
      console.warn('Acceso denegado: Usuario no tiene rol de cajero (role_id: 5)');
      router.navigate(['/dashboard']);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error al verificar rol de cajero:', error);
    router.navigate(['/auth/log-in']);
    return false;
  }
};
