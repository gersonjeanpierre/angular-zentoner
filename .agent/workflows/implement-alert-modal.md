---
description: Implementa el componente AlertModal en un componente existente para manejar errores y notificaciones.
---

Sigue estos pasos para integrar `AlertModal` en el componente seleccionado:

1.  **Modificar el archivo TypeScript (.ts):**
    *   Importar `AlertModal` desde `@shared/components/alert-modal/alert-modal`.
    *   Agregar `AlertModal` al array de `imports` del decorador `@Component`.
    *   Agregar las propiedades de estado a la clase:
        ```typescript
        showAlert = false;
        alertTitle = '';
        alertMessage = '';
        alertType: 'info' | 'warning' | 'error' | 'success' = 'info';
        ```
    *   Agregar el método para cerrar el modal:
        ```typescript
        closeAlert() {
          this.showAlert = false;
        }
        ```
    *   Identificar el manejo de errores (por ejemplo, en `onSubmit` o `catch` de promesas) y reemplazar `alert()` o `console.error()` con la lógica del modal:
        ```typescript
        this.alertTitle = 'Título del Error';
        this.alertMessage = error.message; // o mensaje personalizado
        this.alertType = 'error';
        this.showAlert = true;
        ```

2.  **Modificar el archivo de plantilla (.html):**
    *   Ubicar el final del contenedor principal o el final del archivo.
    *   Agregar el bloque `@if` con el componente:
        ```html
        @if (showAlert) {
          <app-alert-modal
            [title]="alertTitle"
            [message]="alertMessage"
            [type]="alertType"
            (closed)="closeAlert()"
          />
        }
        ```
