import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LogoLaserVeloz } from '@shared/components/logo-laser-veloz/logo-laser-veloz';
import { AuthService } from '@core/auth/auth-service';
import { AlertModal } from '@shared/components/alert-modal/alert-modal';
import { form, Field, required, email, minLength, maxLength } from '@angular/forms/signals';

interface LoginData {
  email: string;
  password: string;
}

@Component({
  selector: 'app-log-in',
  imports: [LogoLaserVeloz, AlertModal, Field],
  templateUrl: './log-in.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LogIn {
  private authService = inject(AuthService);
  private router = inject(Router);

  showAlert = signal(false);
  alertTitle = signal('');
  alertMessage = signal('');
  alertType = signal<'info' | 'warning' | 'error' | 'success'>('info');

  loginModel = signal<LoginData>({
    email: '',
    password: '',
  });

  loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email, { message: 'El email es requerido' });
    email(schemaPath.email, { message: 'Ingrese un email válido' });
    minLength(schemaPath.email, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.email, 40, { message: 'Máximo 40 caracteres' });

    required(schemaPath.password, { message: 'La contraseña es requerida' });
    minLength(schemaPath.password, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(schemaPath.password, 20, { message: 'Máximo 20 caracteres' });
  });

  async onSubmit(event: Event) {
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

  closeAlert() {
    this.showAlert.set(false);
  }
}
