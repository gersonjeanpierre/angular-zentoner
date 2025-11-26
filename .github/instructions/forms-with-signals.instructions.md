---
description: Guía práctica para implementar formularios con Angular Signal Forms usando Tailwind CSS y DaisyUI
---

# Forms with Signals - Workflow

## Conceptos Clave

Signal Forms usa Angular signals para gestionar el estado de formularios de forma reactiva y type-safe, proporcionando sincronización automática entre el modelo de datos y la UI.

## Pasos de Implementación

### 1. Crear el modelo del formulario con `signal()`

```typescript
interface LoginData {
  email: string;
  password: string;
}

const loginModel = signal<LoginData>({
  email: '',
  password: '',
});
```

### 2. Crear el FieldTree con `form()`

```typescript
const loginForm = form(loginModel);

// Acceso a campos con dot notation
loginForm.email
loginForm.password
```

### 3. Vincular inputs HTML con `[field]` directive

```html
<input type="email" [field]="loginForm.email" class="input input-bordered w-full" />
<input type="password" [field]="loginForm.password" class="input input-bordered w-full" />
```

**Nota:** El directive `[field]` sincroniza automáticamente atributos como `required`, `disabled`, y `readonly`.

### 4. Leer valores con `value()`

```typescript
// Obtener FieldState
loginForm.email() // Returns FieldState

// Leer valor actual
const currentEmail = loginForm.email().value();
```

```html
<!-- Renderizar valor reactivo -->
<p class="text-base-content">Email: {{ loginForm.email().value() }}</p>
```

### 5. Actualizar valores con `set()`

```typescript
// Actualizar programáticamente
loginForm.email().value.set('alice@wonderland.com');

// El modelo signal también se actualiza
console.log(loginModel().email); // 'alice@wonderland.com'
```

## Tipos de Inputs Soportados (con DaisyUI)

### Text Inputs
```html
<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Name</span>
  </label>
  <input type="text" [field]="form.name" class="input input-bordered w-full" />
</div>

<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Email</span>
  </label>
  <input type="email" [field]="form.email" class="input input-bordered w-full" />
</div>

<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Message</span>
  </label>
  <textarea [field]="form.message" class="textarea textarea-bordered h-24" placeholder="Bio"></textarea>
</div>
```

### Numbers
```html
<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Age</span>
  </label>
  <input type="number" [field]="form.age" class="input input-bordered w-full" />
</div>
```

### Date y Time
```html
<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Date</span>
  </label>
  <input type="date" [field]="form.eventDate" class="input input-bordered w-full" />
</div>

<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Time</span>
  </label>
  <input type="time" [field]="form.eventTime" class="input input-bordered w-full" />
</div>
```

**Conversión a Date object:**
```typescript
const dateObject = new Date(form.eventDate().value());
```

### Checkboxes
```html
<!-- Single checkbox -->
<div class="form-control">
  <label class="label cursor-pointer justify-start gap-2">
    <input type="checkbox" [field]="form.agreeToTerms" class="checkbox" />
    <span class="label-text">I agree to the terms</span>
  </label>
</div>

<!-- Multiple checkboxes -->
<div class="form-control">
  <label class="label cursor-pointer justify-start gap-2">
    <input type="checkbox" [field]="form.emailNotifications" class="checkbox" />
    <span class="label-text">Email notifications</span>
  </label>
</div>
<div class="form-control">
  <label class="label cursor-pointer justify-start gap-2">
    <input type="checkbox" [field]="form.smsNotifications" class="checkbox" />
    <span class="label-text">SMS notifications</span>
  </label>
</div>
```

### Radio Buttons
```html
<div class="form-control">
  <label class="label cursor-pointer justify-start gap-2">
    <input type="radio" value="free" [field]="form.plan" class="radio" />
    <span class="label-text">Free</span>
  </label>
</div>
<div class="form-control">
  <label class="label cursor-pointer justify-start gap-2">
    <input type="radio" value="premium" [field]="form.plan" class="radio" />
    <span class="label-text">Premium</span>
  </label>
</div>
```

### Select Dropdowns
```html
<!-- Static options -->
<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Country</span>
  </label>
  <select [field]="form.country" class="select select-bordered">
    <option value="">Select a country</option>
    <option value="us">United States</option>
  </select>
</div>

<!-- Dynamic options -->
<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Product</span>
  </label>
  <select [field]="form.productId" class="select select-bordered">
    <option value="">Select a product</option>
    @for (product of products; track product.id) {
      <option [value]="product.id">{{ product.name }}</option>
    }
  </select>
</div>
```

## Validación

### Aplicar Validadores

```typescript
const loginForm = form(loginModel, (schemaPath) => {
  // Validadores comunes
  required(schemaPath.email, { message: 'Email is required' });
  email(schemaPath.email, { message: 'Please enter a valid email address' });
  required(schemaPath.password, { message: 'Password is required' });
  minLength(schemaPath.password, 8, { message: 'Password must be at least 8 characters' });
  
  // Debounce para mejor UX
  debounce(schemaPath.email, 500);
});
```

### Validadores Disponibles

- `required()` - Campo obligatorio
- `email()` - Formato de email válido
- `min()` / `max()` - Rangos numéricos
- `minLength()` / `maxLength()` - Longitud de string o colección
- `pattern()` - Validación con regex
- `debounce()` - Retrasa validación hasta que el usuario deje de escribir

### Mostrar Errores en Template

```html
<div class="form-control w-full">
  <label class="label">
    <span class="label-text">Email</span>
  </label>
  <input type="email" [field]="loginForm.email" class="input input-bordered w-full" 
         [class.input-error]="loginForm.email().touched() && loginForm.email().invalid()" />
  
  @if (loginForm.email().touched() && loginForm.email().invalid()) {
    <div class="label">
      @for (error of loginForm.email().errors(); track error) {
        <span class="label-text-alt text-error">{{ error.message }}</span>
      }
    </div>
  }
</div>
```

### Field State Signals

| Signal | Descripción |
|--------|-------------|
| `valid()` | `true` si pasa todas las validaciones |
| `touched()` | `true` si el usuario ha enfocado y desenfocado el campo |
| `dirty()` | `true` si el usuario ha cambiado el valor |
| `disabled()` | `true` si el campo está deshabilitado |
| `pending()` | `true` si validación async está en progreso |
| `errors()` | Array de errores con `kind` y `message` |

## Ejemplo Completo

### Component TypeScript

```typescript
import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { form, Field, required, email } from '@angular/forms/signals';

interface LoginData {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  templateUrl: 'login.html',
  imports: [Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  loginModel = signal<LoginData>({
    email: '',
    password: '',
  });

  loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' });
    email(schemaPath.email, { message: 'Enter a valid email address' });
    required(schemaPath.password, { message: 'Password is required' });
  });

  onSubmit(event: Event) {
    event.preventDefault();
    const credentials = this.loginModel();
    console.log('Logging in with:', credentials);
    // await this.authService.login(credentials);
  }
}
```

### Template HTML

```html
<form (submit)="onSubmit($event)" class="flex flex-col gap-4 max-w-md mx-auto p-4 bg-base-200 rounded-box shadow-lg">
  <h2 class="text-2xl font-bold text-center mb-4">Login</h2>
  
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text">Email</span>
    </label>
    <input type="email" [field]="loginForm.email" class="input input-bordered w-full" 
           [class.input-error]="loginForm.email().touched() && loginForm.email().invalid()" />
    @if (loginForm.email().touched() && loginForm.email().invalid()) {
      <div class="label">
        @for (error of loginForm.email().errors(); track error) {
          <span class="label-text-alt text-error">{{ error.message }}</span>
        }
      </div>
    }
  </div>

  <div class="form-control w-full">
    <label class="label">
      <span class="label-text">Password</span>
    </label>
    <input type="password" [field]="loginForm.password" class="input input-bordered w-full" 
           [class.input-error]="loginForm.password().touched() && loginForm.password().invalid()" />
    @if (loginForm.password().touched() && loginForm.password().invalid()) {
      <div class="label">
        @for (error of loginForm.password().errors(); track error) {
          <span class="label-text-alt text-error">{{ error.message }}</span>
        }
      </div>
    }
  </div>

  <button type="submit" class="btn btn-primary mt-4">Log In</button>
</form>
```

## Tips y Mejores Prácticas

1. **Usa `debounce()`** para validaciones que no necesitan ser instantáneas (como email)
2. **Muestra errores solo después de `touched()`** para mejor UX
3. **Personaliza mensajes de error** para que sean claros y útiles
4. **Usa `ChangeDetectionStrategy.OnPush`** con Signal Forms para mejor performance
5. **El schema path es para validación**, usa el field tree para acceder a valores
6. **Multiple select no está soportado** actualmente por `[field]` directive
7. **Usa `form-control` y `label` de DaisyUI** para estructurar correctamente los inputs y sus etiquetas.

## Referencias

- [Angular Signal Forms API](https://angular.dev/api/forms/signals)
- [Validadores disponibles](https://angular.dev/api/forms/signals#validators)
- [DaisyUI Input](https://daisyui.com/components/input/)
