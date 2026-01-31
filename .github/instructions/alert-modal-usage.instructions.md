---
applyTo: '**'
description: Guía para usar el componente AlertModal reusable en cualquier componente
---

# Alert Modal - Guía de Uso

## Descripción

`AlertModal` es un componente reusable para mostrar alertas modales con diferentes tipos (info, success, warning, error). Reemplaza el uso de `alert()` nativo del navegador con una interfaz consistente y moderna usando DaisyUI y Tailwind CSS.

## Características

- **4 tipos de alerta**: info, success, warning, error
- **Accesibilidad**: Soporte para ESC key y teclado
- **Animaciones**: Fade-in y backdrop blur
- **Responsive**: Funciona en todos los tamaños de pantalla
- **DaisyUI**: Integrado con el sistema de diseño del proyecto

## Implementación

### 1. Importar el Componente

```typescript
import { AlertModal, AlertType } from '@shared/components/alert-modal/alert-modal';

@Component({
  selector: 'app-my-component',
  imports: [AlertModal], // Agregar a imports
  // ...
})
export default class MyComponent {
  // ...
}
```

### 2. Crear Signals de Estado

```typescript
export default class MyComponent {
  // Signals para control del modal
  protected alertModalOpen = signal(false);
  protected alertTitle = signal('');
  protected alertMessage = signal('');
  protected alertType = signal<AlertType>('info');
}
```

### 3. Crear Métodos Helper

```typescript
/**
 * Muestra una alerta modal
 * @param title - Título de la alerta
 * @param message - Mensaje de la alerta
 * @param type - Tipo de alerta (info, success, warning, error)
 */
private showAlert(title: string, message: string, type: AlertType = 'info'): void {
  this.alertTitle.set(title);
  this.alertMessage.set(message);
  this.alertType.set(type);
  this.alertModalOpen.set(true);
}

/**
 * Cierra el modal de alerta
 */
protected closeAlert(): void {
  this.alertModalOpen.set(false);
}
```

### 4. Agregar al Template

```html
<!-- Alert Modal -->
@if (alertModalOpen()) {
<app-alert-modal
  [title]="alertTitle()"
  [message]="alertMessage()"
  [type]="alertType()"
  (closed)="closeAlert()"
/>
}
```

## Uso en el Código

### Reemplazar alert() Nativo

#### Antes (alert nativo)

```typescript
if (!this.userId()) {
  alert('⚠️ Debe seleccionar un usuario');
  return false;
}
```

#### Después (AlertModal)

```typescript
if (!this.userId()) {
  this.showAlert('Usuario requerido', 'Debe seleccionar un usuario', 'warning');
  return false;
}
```

## Tipos de Alerta

### 1. Info (Información)

```typescript
this.showAlert('Información', 'Los cambios se aplicarán automáticamente', 'info');
```

- **Color**: Azul
- **Icono**: ℹ️ Información
- **Uso**: Mensajes informativos generales

### 2. Success (Éxito)

```typescript
this.showAlert('Éxito', 'La orden se guardó correctamente', 'success');
```

- **Color**: Verde
- **Icono**: ✓ Check
- **Uso**: Operaciones exitosas, confirmaciones

### 3. Warning (Advertencia)

```typescript
this.showAlert('Advertencia', 'Debe completar todos los campos', 'warning');
```

- **Color**: Amarillo
- **Icono**: ⚠️ Triángulo de advertencia
- **Uso**: Validaciones, campos requeridos, advertencias

### 4. Error (Error)

```typescript
this.showAlert('Error', 'No se pudo conectar con el servidor', 'error');
```

- **Color**: Rojo
- **Icono**: ✕ Cruz
- **Uso**: Errores, excepciones, fallos

## Ejemplos Completos

### Ejemplo 1: Validación de Formulario

```typescript
private validateForm(): boolean {
  if (!this.form.name().value()) {
    this.showAlert('Campo requerido', 'El nombre es obligatorio', 'warning');
    return false;
  }

  if (!this.form.email().value()) {
    this.showAlert('Campo requerido', 'El email es obligatorio', 'warning');
    return false;
  }

  return true;
}
```

### Ejemplo 2: Operación Exitosa

```typescript
protected async saveData(): Promise<void> {
  try {
    await this.service.save(this.formData());
    this.showAlert(
      'Datos guardados',
      'Los datos se guardaron exitosamente',
      'success'
    );
  } catch (error) {
    this.showAlert(
      'Error al guardar',
      'No se pudieron guardar los datos. Intente nuevamente.',
      'error'
    );
  }
}
```

### Ejemplo 3: Confirmación de Acción

```typescript
protected deleteItem(): void {
  if (!this.selectedItem()) {
    this.showAlert('Selección requerida', 'Debe seleccionar un item', 'warning');
    return;
  }

  // Aquí podrías implementar lógica de confirmación adicional
  this.performDelete();
}
```

## API del Componente

### Inputs

| Input     | Tipo        | Descripción                                           | Requerido |
| --------- | ----------- | ----------------------------------------------------- | --------- |
| `title`   | `string`    | Título del modal                                      | Sí        |
| `message` | `string`    | Mensaje del modal                                     | Sí        |
| `type`    | `AlertType` | Tipo de alerta: 'info', 'success', 'warning', 'error' | No        |

### Outputs

| Output   | Tipo   | Descripción                       |
| -------- | ------ | --------------------------------- |
| `closed` | `void` | Emitido cuando se cierra el modal |

### Comportamiento

- **ESC Key**: Cierra el modal automáticamente
- **Click en overlay**: Cierra el modal
- **Click en botón OK**: Cierra el modal

## Best Practices

1. **Usa tipos semánticos**: No uses 'error' para warnings o viceversa
2. **Mensajes claros**: Escribe mensajes descriptivos y accionables
3. **Títulos cortos**: Mantén los títulos breves (2-4 palabras)
4. **Método helper privado**: Usa el método `showAlert()` privado para consistencia
5. **No acumules alertas**: Cierra una alerta antes de mostrar otra
6. **Evita alert() nativo**: Siempre usa AlertModal en lugar de `alert()` del navegador

## Ventajas sobre alert() Nativo

| Característica        | alert() Nativo | AlertModal |
| --------------------- | -------------- | ---------- |
| Personalizable        | ❌             | ✅         |
| Accesible             | ❌             | ✅         |
| Responsive            | ❌             | ✅         |
| Consistencia de UI    | ❌             | ✅         |
| Tipos diferenciados   | ❌             | ✅         |
| No bloquea la UI      | ❌             | ✅         |
| Animaciones           | ❌             | ✅         |
| Tematizable (DaisyUI) | ❌             | ✅         |

## Troubleshooting

### Error: "AlertModal is not used within the template"

**Solución**: Verifica que el componente esté agregado en el template:

```html
@if (alertModalOpen()) {
<app-alert-modal
  [title]="alertTitle()"
  [message]="alertMessage()"
  [type]="alertType()"
  (closed)="closeAlert()"
/>
}
```

### El modal no se cierra con ESC

**Solución**: Verifica que el host listener esté configurado en el componente:

```typescript
host: {
  '(document:keydown.escape)': 'onClose()',
},
```

### Los estilos no se aplican correctamente

**Solución**: Asegúrate de que Tailwind CSS y DaisyUI estén configurados en el proyecto.

## Referencias

- [DaisyUI Modal](https://daisyui.com/components/modal/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Angular Signals](https://angular.dev/guide/signals)
