---
description: Refactoriza el código siguiendo las mejores prácticas de Angular y TypeScript del proyecto.
---

Sigue estos pasos para refactorizar el código actual y asegurar que cumpla con los estándares del proyecto:

1.  **TypeScript:**
    *   Asegura el tipado estricto.
    *   Reemplaza `any` por `unknown` o tipos específicos.
    *   Usa inferencia de tipos donde sea obvio.

2.  **Angular Core:**
    *   Verifica que los componentes sean `standalone` (sin `standalone: true` explícito si es v19+ default, pero el documento dice v20+, asumiré la regla del documento).
    *   Usa `signals` para el manejo de estado.
    *   Reemplaza `@HostBinding` y `@HostListener` con la propiedad `host` en el decorador `@Component`.
    *   Usa `NgOptimizedImage` para imágenes estáticas.

3.  **Componentes:**
    *   Usa `input()` y `output()` (funciones) en lugar de decoradores `@Input`/`@Output`.
    *   Usa `computed()` para estado derivado.
    *   Configura `changeDetection: ChangeDetectionStrategy.OnPush`.
    *   Usa formularios reactivos (`ReactiveFormsModule`).
    *   Reemplaza `ngClass` y `ngStyle` con bindings nativos `[class.x]` o `[style.x]`.

4.  **Templates:**
    *   Usa la sintaxis de control de flujo moderna (`@if`, `@for`, `@switch`).
    *   Evita lógica compleja en el template.
    *   No uses funciones flecha ni RegExp en el template.

5.  **Servicios e Inyección:**
    *   Usa `inject()` en lugar de inyección por constructor.
    *   Asegura `providedIn: 'root'` para servicios singleton.

6.  **Accesibilidad:**
    *   Verifica contrastes de color y atributos ARIA.
    *   Asegura que pase chequeos básicos de AXE/WCAG AA.

7.  **Estilos y UI (Tailwind CSS + DaisyUI):**
    *   **Prioriza clases de utilidad:** Usa Tailwind CSS para layout, espaciado, tipografía y colores. Evita escribir CSS personalizado en archivos `.css` o `.scss` a menos que sea estrictamente necesario.
    *   **Usa componentes de DaisyUI:** Aprovecha las clases de componentes de DaisyUI (ej. `btn`, `input`, `card`, `modal`) para mantener una UI consistente y reducir la cantidad de clases de utilidad.
    *   **Diseño Responsivo:** Usa los prefijos de breakpoints de Tailwind (ej. `md:`, `lg:`) para asegurar que la interfaz se adapte a diferentes tamaños de pantalla.
    *   **Temas:** Utiliza las variables CSS de DaisyUI (ej. `bg-base-100`, `text-primary`) para asegurar compatibilidad con temas (light/dark mode).
