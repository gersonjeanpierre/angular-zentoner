import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LogoLaserVeloz } from '@shared/components/logo-laser-veloz/logo-laser-veloz';
import { AuthService } from '@core/services/auth-service';
import { AlertModal } from '@shared/components/alert-modal/alert-modal';
import {
  form,
  FormField,
  required,
  email,
  minLength,
  maxLength,
  debounce,
} from '@angular/forms/signals';
import { toSignal } from '@angular/core/rxjs-interop';
import { ShopService } from '@core/services/shop-service';

interface LoginData {
  email: string;
  password: string;
  shopId: string;
}

@Component({
  selector: 'app-log-in',
  imports: [LogoLaserVeloz, AlertModal, FormField],
  templateUrl: './log-in.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LogIn {
  // Services
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly shopService = inject(ShopService);

  // Signals and Forms
  protected readonly showAlert = signal(false);
  protected readonly alertTitle = signal('');
  protected readonly alertMessage = signal('');
  protected readonly alertType = signal<'info' | 'warning' | 'error' | 'success'>('info');
  protected readonly loginModel = signal<LoginData>({
    email: '',
    password: '',
    shopId: '',
  });
  protected readonly shops = toSignal(this.shopService.dataShops$, { initialValue: [] });

  protected readonly availableShops = computed(() => {
    const result = this.shops();
    return (result ?? [])
      .filter((shop) => shop.id)
      .map((shop) => ({
        id: shop.id,
        name: shop.name,
      }));
  });

  protected readonly loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email, { message: 'El email es requerido' });
    email(schemaPath.email, { message: 'Ingrese un email válido' });
    minLength(schemaPath.email, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.email, 40, { message: 'Máximo 40 caracteres' });
    debounce(schemaPath.email, 500);

    required(schemaPath.password, { message: 'La contraseña es requerida' });
    minLength(schemaPath.password, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.password, 20, { message: 'Máximo 20 caracteres' });

    required(schemaPath.shopId, { message: 'La tienda es requerida' });
  });

  protected async onSubmit(event: Event) {
    event.preventDefault();
    if (this.loginForm.email().invalid() || this.loginForm.password().invalid()) return;

    const { email, password, shopId } = this.loginModel();

    const { error } = await this.authService.logIn({
      email,
      password,
    });

    if (error) {
      console.error('Error en login:', error);
      this.alertTitle.set('Error al iniciar sesión');
      this.alertMessage.set(error.message);
      this.alertType.set('error');
      this.showAlert.set(true);
      return;
    }

    await this.authService.updateMetadata({
      shopId: shopId,
    });
    this.router.navigateByUrl('/');
  }

  protected closeAlert() {
    this.showAlert.set(false);
  }
}
