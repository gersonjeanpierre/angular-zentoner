import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { LogoLaserVeloz } from '../../../shared/components/logo-laser-veloz/logo-laser-veloz';
import {
  form,
  Field,
  required,
  email,
  minLength,
  maxLength,
  debounce,
} from '@angular/forms/signals';
import { AuthService } from '@core/services/auth-service';
import { AlertModal } from '@shared/components/alert-modal/alert-modal';
import { TranslateService } from '@ngx-translate/core';

import { ShopService } from '@core/services/shop-service';
import { ROLE_USER } from 'src/app/data/constants/role-user';

interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  selectedRoles: string[];
  shopId: string;
}

interface RoleType {
  name: string;
  label: string;
}

@Component({
  selector: 'app-sign-up',
  imports: [LogoLaserVeloz, AlertModal, Field],
  templateUrl: './sign-up.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SignUp implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly shopService = inject(ShopService);

  protected readonly availableShops = signal<{ id: string; name: string }[]>([]);
  protected readonly availableRoles = signal<RoleType[]>([]);

  // Modal de alerta
  protected readonly isLoading = signal(false);
  protected readonly alertMessage = signal('');
  protected readonly alertTitle = signal('');
  protected readonly showModal = signal(false);
  protected readonly alertType = signal<'info' | 'warning' | 'error' | 'success'>('success');

  // Signal Form Model
  protected readonly signUpModel = signal<SignUpData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    selectedRoles: [],
    shopId: '',
  });

  // Signal Form with validation
  protected readonly signUpForm = form(this.signUpModel, (schemaPath) => {
    required(schemaPath.email, { message: 'El email es requerido' });
    email(schemaPath.email, { message: 'Ingrese un email válido' });
    minLength(schemaPath.email, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.email, 40, { message: 'Máximo 40 caracteres' });
    debounce(schemaPath.email, 500);

    required(schemaPath.password, { message: 'La contraseña es requerida' });
    minLength(schemaPath.password, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.password, 20, { message: 'Máximo 20 caracteres' });

    required(schemaPath.firstName, { message: 'El nombre es requerido' });
    minLength(schemaPath.firstName, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(schemaPath.firstName, 35, { message: 'Máximo 35 caracteres' });

    required(schemaPath.lastName, { message: 'El apellido es requerido' });
    minLength(schemaPath.lastName, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(schemaPath.lastName, 80, { message: 'Máximo 80 caracteres' });

    required(schemaPath.shopId, { message: 'Debe seleccionar una tienda' });
  });

  // Computed signal para validar si al menos un rol está seleccionado
  protected readonly hasSelectedRoles = computed(() => {
    return this.signUpForm.selectedRoles().value().length > 0;
  });

  // Computed signal para verificar si el formulario es válido
  protected readonly isFormValid = computed(() => {
    return (
      this.signUpForm.email().valid() &&
      this.signUpForm.password().valid() &&
      this.signUpForm.firstName().valid() &&
      this.signUpForm.lastName().valid() &&
      this.signUpForm.shopId().valid() &&
      this.hasSelectedRoles()
    );
  });

  async ngOnInit() {
    this.loadShops();
    this.setTranslateRoles();
  }

  protected async loadShops() {
    this.isLoading.set(true);
    try {
      const result = await this.shopService.getShopDetails({ deletedAt: null });
      this.availableShops.set(
        (result.data ?? []).map((shop: { id: string; name: string }) => ({
          id: shop.id,
          name: shop.name,
        })),
      );
    } catch (error) {
      this.availableShops.set([]);
      this.showAlert(
        'Error al cargar tiendas',
        'No se pudieron cargar las tiendas disponibles',
        'error',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  protected onRoleChange(roleName: string, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    const currentRoles = this.signUpForm.selectedRoles().value();

    if (isChecked) {
      this.signUpForm.selectedRoles().value.set([...currentRoles, roleName]);
    } else {
      this.signUpForm.selectedRoles().value.set(currentRoles.filter((r) => r !== roleName));
    }
  }

  protected isRoleSelected(roleName: string): boolean {
    return this.signUpForm.selectedRoles().value().includes(roleName);
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    // Validar formulario y roles
    if (!this.isFormValid()) {
      this.showAlert(
        'Datos incompletos',
        'Complete todos los campos y seleccione al menos un rol.',
        'warning',
      );
      return;
    }

    this.isLoading.set(true);
    const formData = this.signUpModel();

    const payload = {
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      authEmail: formData.email,
      shopId: formData.shopId,
      initialRoleNames: formData.selectedRoles,
    };

    try {
      const result = await this.authService.createEmployee(payload);
      this.showAlert(
        '¡Registro exitoso!',
        `La cuenta del empleado ha sido creada con éxito. ID: ${result.user_id}.`,
        'success',
      );
      this.resetForm();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'GENERIC_SERVER_ERROR';
      this.showAlert('¡Error al registrar!', this.getErrorTranslation(errorMessage), 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  private resetForm() {
    this.signUpModel.set({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      selectedRoles: [],
      shopId: '',
    });
  }

  private showAlert(
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success',
  ) {
    this.showModal.set(true);
    this.alertTitle.set(title);
    this.alertMessage.set(message);
    this.alertType.set(type);
  }

  private getErrorTranslation(message: string): string {
    return (
      this.translate.instant(`auth.errors.${message}`) ||
      this.translate.instant('auth.errors.generic')
    );
  }

  private async setTranslateRoles() {
    const translate = await Promise.all(
      ROLE_USER.map(async (role: { name: string }) => {
        const label = await this.translate.get(`auth.roles.${role.name}`).toPromise();
        return { name: role.name, label };
      }),
    );
    this.availableRoles.set(translate);
  }
}
