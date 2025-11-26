---
applyTo: '**'
---

Sigue este checklist para asegurar que tu código cumpla con los estándares de Angular y las mejores prácticas del proyecto.

## 1. Naming & Archivos

- [ ] **Archivos:** Usa `kebab-case` (ej: `user-profile.ts`).
- [ ] **Tests:** Usa `.spec.ts` (ej: `user-profile.spec.ts`).
- [ ] **Coherencia:** El nombre del archivo debe coincidir con la clase (`UserProfile` -> `user-profile.ts`).
- [ ] **Agrupación:** Componente (`.ts`), template (`.html`) y estilos (`.css`) en la misma carpeta.
- [ ] **Sufijos:** Si hay múltiples archivos de estilo, usa sufijos descriptivos (`user-profile-settings.css`).

## 2. Estructura del Proyecto

- [ ] **src:** Todo el código UI debe estar dentro de `src/`.
- [ ] **main.ts:** El bootstrap debe estar en `src/main.ts`.
- [ ] **Features:** Organiza por funcionalidad (ej: `movie-reel/show-times`), NO por tipo (`components/`, `services/`).
- [ ] **Un concepto por archivo:** Un componente/servicio por archivo (salvo excepciones pequeñas).

## 3. Inyección de Dependencias

- [ ] **Usa `inject()`:** Prefiere `inject()` sobre la inyección por constructor.
  ```typescript
  private service = inject(MyService);
  ```
- [ ] **Tipado:** Aprovecha la inferencia de tipos de `inject()`.

## 4. Componentes y Directivas

- [ ] **Selectores:** Usa prefijos consistentes (`app-`, `ui-`).
- [ ] **Orden:** Propiedades Angular (inputs, outputs, injects) -> Propiedades públicas -> Métodos.
- [ ] **Presentación:** Mantén los componentes enfocados en la UI. Mueve lógica compleja a servicios/utils.
- [ ] **Protected:** Usa `protected` para miembros que SOLO se usan en el template.
  ```typescript
  protected fullName = computed(() => ...);
  ```
- [ ] **Readonly:** Usa `readonly` para Inputs, Outputs y Models.
  ```typescript
  readonly userId = input<string>();
  readonly onSave = output<void>();
  ```

## 5. Templates

- [ ] **Simplicidad:** Evita lógica compleja en el HTML. Usa `computed` signals.
- [ ] **Bindings:** Prefiere `[class.x]` y `[style.x]` sobre `ngClass` y `ngStyle`.
  ```html
  <!-- Prefer -->
  <div [class.active]="isActive"></div>
  ```
- [ ] **Event Handlers:** Nómbralos por lo que _hacen_ (`saveData()`), no por el evento (`handleClick()`).

## 6. Ciclo de Vida

- [ ] **Interfaces:** Implementa siempre la interfaz (ej: `implements OnInit`).
- [ ] **Simplicidad:** No pongas lógica en `ngOnInit`. Llama a métodos descriptivos (`this.loadData()`).

## 7. Modern Angular (Core)

- [ ] **Standalone:** Verifica que los componentes sean `standalone: true`.
- [ ] **Signals:** Usa Signals para el manejo de estado y reactividad.
- [ ] **Control Flow:** Usa `@if`, `@for`, `@switch` en lugar de `*ngIf`, `*ngFor`.
- [ ] **Imágenes:** Usa `NgOptimizedImage` para imágenes estáticas.

### Extra

- standalone: true, ya esta por default para las versiones 20+
