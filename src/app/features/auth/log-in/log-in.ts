import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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

interface LoginData {
  email: string;
  password: string;
}

@Component({
  selector: 'app-log-in',
  imports: [LogoLaserVeloz, AlertModal, FormField],
  templateUrl: './log-in.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LogIn {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly showAlert = signal(false);
  protected readonly alertTitle = signal('');
  protected readonly alertMessage = signal('');
  protected readonly alertType = signal<'info' | 'warning' | 'error' | 'success'>('info');

  protected readonly loginModel = signal<LoginData>({
    email: '',
    password: '',
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
  });

  protected async onSubmit(event: Event) {
    event.preventDefault();
    if (this.loginForm.email().invalid() || this.loginForm.password().invalid()) return;

    const { email, password } = this.loginModel();

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

    this.router.navigateByUrl('/');
  }

  protected closeAlert() {
    this.showAlert.set(false);
  }
}
