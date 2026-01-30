import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth-service';
import { CashRegisterService } from '@core/services/cash-register-service';

/**
 * Guard que verifica si el usuario tiene el role_id 4 o 5 (CASHIER)
 * y valida el acceso al dashboard según las sesiones abiertas
 * Solo los usuarios con rol de cajero pueden acceder a rutas protegidas con este guard
 */
export const cashierRoleGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const cashRegisterService = inject(CashRegisterService);
  const router = inject(Router);

  try {
    const userData = await authService.getUserProfileData();

    // Verificar si el usuario tiene el role_id  5 (CASHIER)
    const hasCashierRole = userData.roles && userData.roles.includes(5);

    if (!hasCashierRole) {
      console.warn('Acceso denegado: Usuario no tiene rol de cajero (role_id: 4 o 5)');
      router.navigate(['/dashboard']);
      return false;
    }

    // Si está accediendo al dashboard, verificar sesiones
    if (state.url.includes('/caja/dashboard') || state.url === '/caja' || state.url === '/caja/') {
      const shopId = userData.shopId;

      if (!shopId) {
        console.warn('Acceso denegado: Usuario no tiene tienda asignada');
        router.navigate(['/dashboard']);
        return false;
      }

      // Verificar acceso al dashboard
      const accessCheck = await cashRegisterService.checkDashboardAccess(userData.id, shopId);

      if (!accessCheck.canAccess) {
        console.warn('Acceso denegado al dashboard:', accessCheck.reason);
        // Redirigir a una página de error o información
        router.navigate(['/caja/acceso-denegado'], {
          state: { reason: accessCheck.reason, session: accessCheck.session },
        });
        return false;
      }

      // Si tiene acceso y hay una sesión, cargarla
      if (accessCheck.session) {
        cashRegisterService.currentSession.set(accessCheck.session);
      }
    }

    return true;
  } catch (error) {
    console.error('Error al verificar rol de cajero:', error);
    router.navigate(['/auth/log-in']);
    return false;
  }
};
