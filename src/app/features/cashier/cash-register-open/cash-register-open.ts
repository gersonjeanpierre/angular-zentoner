import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, required, min } from '@angular/forms/signals';
import { CashRegisterService } from '@core/services/cash-register-service';
import { AuthService } from '@core/services/auth-service';
import { OpenSessionPayload, SessionType } from '@data/models/sales/cash-register.model';
import { v7 as uuidv7 } from 'uuid';

interface OpenSessionFormModel {
  opening_balance: number;
  session_type: SessionType;
  opening_notes: string;
}

@Component({
  selector: 'app-cash-register-open',
  imports: [FormField],
  templateUrl: './cash-register-open.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CashRegisterOpen implements OnInit {
  private cashRegisterService = inject(CashRegisterService);
  private authService = inject(AuthService);
  private router = inject(Router);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);
  protected userData = signal<any>(null);

  // Form Model
  protected formModel = signal<OpenSessionFormModel>({
    opening_balance: 0,
    session_type: 'PARCIAL',
    opening_notes: '',
  });

  // Form Instance
  protected openSessionForm = form(this.formModel, (schema) => {
    required(schema.opening_balance, { message: 'El balance inicial es requerido' });
    min(schema.opening_balance, 0, { message: 'El balance no puede ser negativo' });
    required(schema.session_type, { message: 'Seleccione el tipo de sesión' });
  });

  // Computed
  protected isFormValid = computed(() => {
    return (
      !this.openSessionForm.opening_balance().invalid() &&
      !this.openSessionForm.session_type().invalid()
    );
  });

  // Session Types
  protected sessionTypes: { value: SessionType; label: string; description: string }[] = [
    {
      value: 'PARCIAL',
      label: 'Parcial',
      description: 'Sesión durante el día, varios cajeros pueden tener sesiones parciales',
    },
    {
      value: 'FINAL',
      label: 'Final',
      description: 'Cierre de caja al final del día, consolida todas las ventas',
    },
  ];

  ngOnInit(): void {
    this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    await this.loadUserData();
    await this.checkExistingSession();
  }

  private async loadUserData() {
    try {
      const data = await this.authService.getUserProfileData();
      this.userData.set(data);
    } catch (error) {
      console.error('Error al cargar datos de usuario:', error);
      this.error.set('Error al cargar datos de usuario');
    }
  }

  private async checkExistingSession() {
    try {
      const user = this.userData();
      if (!user) return;

      // Obtener shopId directamente de metadatos
      const shopId = user.shopId;
      if (!shopId) return;

      // Verificar si ya existe una sesión abierta en este shop
      const openSession = await this.cashRegisterService.getOpenSessionByShop(shopId);

      if (openSession) {
        // Verificar si la sesión es del mismo cajero (user_id === employee_id)
        if (openSession.cashierId === user.id) {
          this.error.set('Ya tienes una sesión abierta. Debes cerrarla antes de abrir una nueva.');
        } else {
          this.error.set(
            `Este local ya tiene una sesión activa (Sesión #${openSession.sessionNumber}). ` +
              'Debes esperar a que el cajero actual cierre su sesión.',
          );
        }

        // Redirigir después de 3 segundos
        setTimeout(() => {
          this.router.navigate(['/caja/acceso-denegado'], {
            state: {
              reason: this.error(),
              session: openSession,
            },
          });
        }, 3000);
      }
    } catch (error) {
      console.log('No hay sesión abierta en este local');
    }
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    if (!this.isFormValid()) {
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const formData = this.formModel();
      const user = this.userData();

      if (!user) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      // Obtener shopId de metadatos (localStorage)
      const shopId = user.shopId;

      if (!shopId) {
        throw new Error('No se encontró tienda asignada en los metadatos del usuario');
      }

      // Payload simple: shopId de metadata + userId como cashierId
      const payload: OpenSessionPayload = {
        id: uuidv7(),
        shopId: shopId,
        cashierId: user.id, // user_id === employee_id
        openingBalance: formData.opening_balance,
        sessionType: formData.session_type,
        openingNotes: formData.opening_notes || undefined,
      };

      await this.cashRegisterService.openSession(payload);

      this.success.set(true);

      setTimeout(() => {
        this.router.navigate(['/caja/dashboard']);
      }, 1500);
    } catch (err: any) {
      console.error('[Cash Register OPEN Component]Error al abrir sesión:', err);
      this.error.set(err.message || 'Error al abrir la sesión de caja');
    } finally {
      this.loading.set(false);
    }
  }

  protected cancel() {
    this.router.navigate(['/caja/dashboard']);
  }
}
