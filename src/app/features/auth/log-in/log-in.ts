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

interface CredentialsData {
  email: string;
  password: string;
}

interface ShopSelectionData {
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

  // Signals
  protected readonly showAlert = signal(false);
  protected readonly alertTitle = signal('');
  protected readonly alertMessage = signal('');
  protected readonly alertType = signal<'info' | 'warning' | 'error' | 'success'>('info');
  protected readonly currentStep = signal<'credentials' | 'shop-selection'>('credentials');
  protected readonly isLoadingShops = signal(false);
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

  // Credentials Form
  protected readonly credentialsModel = signal<CredentialsData>({
    email: '',
    password: '',
  });

  protected readonly credentialsForm = form(this.credentialsModel, (schemaPath) => {
    required(schemaPath.email, { message: 'El email es requerido' });
    email(schemaPath.email, { message: 'Ingrese un email válido' });
    minLength(schemaPath.email, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.email, 40, { message: 'Máximo 40 caracteres' });
    debounce(schemaPath.email, 500);

    required(schemaPath.password, { message: 'La contraseña es requerida' });
    minLength(schemaPath.password, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.password, 20, { message: 'Máximo 20 caracteres' });
  });

  // Shop Selection Form
  protected readonly shopSelectionModel = signal<ShopSelectionData>({
    shopId: '',
  });

  protected readonly shopSelectionForm = form(this.shopSelectionModel, (schemaPath) => {
    required(schemaPath.shopId, { message: 'La tienda es requerida' });
  });

  protected async onCredentialsSubmit(event: Event) {
    event.preventDefault();
    if (this.credentialsForm.email().invalid() || this.credentialsForm.password().invalid()) {
      return;
    }

    const { email, password } = this.credentialsModel();

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

    // Usuario autenticado correctamente, cargar tiendas si es necesario
    this.isLoadingShops.set(true);
    try {
      // Solo hace fetch si Dexie está vacío, usa caché en llamadas posteriores
      await this.shopService.ensureShopsLoaded();
      this.currentStep.set('shop-selection');
    } catch (error) {
      console.error('Error al cargar las tiendas:', error);
      this.alertTitle.set('Error al cargar tiendas');
      this.alertMessage.set('No se pudieron cargar las tiendas disponibles');
      this.alertType.set('error');
      this.showAlert.set(true);
    } finally {
      this.isLoadingShops.set(false);
    }
  }

  protected async onShopSelectionSubmit(event: Event) {
    event.preventDefault();
    if (this.shopSelectionForm.shopId().invalid()) {
      return;
    }

    const { shopId } = this.shopSelectionModel();

    await this.authService.updateMetadata({
      shopId: shopId,
    });
    this.router.navigateByUrl('/');
  }

  protected goBackToCredentials() {
    this.currentStep.set('credentials');
    this.shopSelectionModel.set({ shopId: '' });
  }

  protected closeAlert() {
    this.showAlert.set(false);
  }
}
