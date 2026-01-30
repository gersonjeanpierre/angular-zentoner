# ✅ Checklist de Validación - Sistema de Caja Multi-Tienda

## 📋 Pre-Deployment

### Base de Datos

- [ ] Revisar el script de migración `08_CASH_EXPENSES_AND_IMPROVEMENTS.sql`
- [ ] Hacer backup de la base de datos antes de aplicar cambios
- [ ] Aplicar migración en entorno de desarrollo
- [ ] Verificar que todas las tablas se crearon correctamente
- [ ] Verificar que todas las funciones RPC se crearon sin errores
- [ ] Ejecutar queries de prueba para cada función RPC
- [ ] Verificar índices creados
- [ ] Verificar vista `active_sessions_by_shop`

### Frontend

- [ ] Compilar aplicación sin errores: `npm run build`
- [ ] Verificar que no hay errores de TypeScript
- [ ] Verificar que todos los imports están correctos
- [ ] Revisar que las rutas están configuradas
- [ ] Verificar que los componentes se cargan lazy

---

## 🧪 Testing Funcional

### 1. Apertura de Sesión

#### Caso Feliz

- [ ] Abrir sesión con balance inicial válido (ej: S/. 100)
- [ ] Verificar que la sesión se crea en BD
- [ ] Verificar que el dashboard muestra la información correcta
- [ ] Verificar que el balance inicial es correcto

#### Casos de Error

- [ ] Intentar abrir sesión sin shop válido (debe fallar)
- [ ] Intentar abrir sesión con balance negativo (debe fallar)
- [ ] Intentar abrir segunda sesión en mismo shop (debe fallar)
- [ ] Verificar mensajes de error son claros

### 2. Dashboard

#### Visualización Inicial

- [ ] Balance inicial se muestra correctamente
- [ ] Tiempo transcurrido se calcula bien
- [ ] Todas las métricas están en 0 (excepto balance inicial)
- [ ] No se muestra sección de gastos si no hay gastos

#### Después de Transacciones

- [ ] Registrar pago en efectivo y verificar actualización
- [ ] Registrar pago con Yape y verificar actualización
- [ ] Registrar pago con tarjeta y verificar actualización
- [ ] Hacer clic en botón "Actualizar" y verificar refresh
- [ ] Verificar que las sumatorias por método son correctas
- [ ] Verificar que el flujo de efectivo se calcula bien

### 3. Registro de Gastos

#### Caso Feliz

- [ ] Navegar a módulo de gastos desde dashboard
- [ ] Llenar formulario con datos válidos
- [ ] Registrar gasto de S/. 20 (Operativo)
- [ ] Verificar que se guarda en BD
- [ ] Verificar que aparece en historial
- [ ] Verificar que el efectivo disponible se actualiza
- [ ] Volver al dashboard y verificar actualización

#### Validaciones

- [ ] Intentar registrar gasto con monto 0 (debe fallar)
- [ ] Intentar registrar gasto con monto negativo (debe fallar)
- [ ] Intentar registrar gasto sin descripción (debe fallar)
- [ ] Intentar registrar gasto con descripción < 5 caracteres (debe fallar)
- [ ] Intentar registrar gasto mayor al efectivo disponible (debe fallar)
- [ ] Verificar mensajes de error son claros

#### Historial

- [ ] Registrar varios gastos de diferentes categorías
- [ ] Verificar que todos aparecen en el historial
- [ ] Verificar que el total se calcula correctamente
- [ ] Verificar información del autorizador

### 4. Ventas del Día

- [ ] Crear varias órdenes desde módulo de ventas
- [ ] Navegar a "Ventas del Día"
- [ ] Verificar que se muestran todas las órdenes del día
- [ ] Filtrar por estado: Pendientes
- [ ] Filtrar por estado: Parciales
- [ ] Filtrar por estado: Pagadas
- [ ] Verificar contadores de cada filtro

### 5. Cierre de Sesión

#### Caso Feliz

- [ ] Contar efectivo físico
- [ ] Ingresar balance de cierre correcto
- [ ] Verificar cálculo de balance esperado
- [ ] Verificar que diferencia es 0
- [ ] Agregar notas de cierre
- [ ] Confirmar cierre
- [ ] Verificar que la sesión se cierra en BD
- [ ] Verificar resumen generado

#### Con Diferencia

- [ ] Ingresar balance de cierre con faltante (ej: S/. 5 menos)
- [ ] Verificar que muestra diferencia negativa
- [ ] Cerrar sesión
- [ ] Verificar que se guarda la diferencia

#### Con Sobrante

- [ ] Ingresar balance de cierre con sobrante (ej: S/. 3 más)
- [ ] Verificar que muestra diferencia positiva
- [ ] Cerrar sesión
- [ ] Verificar que se guarda la diferencia

### 6. Multi-Tienda

#### Aislamiento de Datos

- [ ] Abrir sesión en Tienda A
- [ ] Crear órdenes en Tienda A
- [ ] Registrar pagos en Tienda A
- [ ] Cerrar sesión de Usuario A
- [ ] Abrir sesión en Tienda B (con otro usuario/shop)
- [ ] Verificar que dashboard de B está vacío
- [ ] Verificar que no se ven órdenes de Tienda A
- [ ] Crear órdenes en Tienda B
- [ ] Verificar que no se mezclan con Tienda A

#### Validaciones Multi-Tienda

- [ ] Verificar que no se puede abrir sesión sin shop válido
- [ ] Verificar que cada shop puede tener solo una sesión activa
- [ ] Verificar que las órdenes están asociadas al shop correcto

---

## 🔍 Validación de Datos

### Queries de Verificación

```sql
-- Verificar sesiones activas
SELECT * FROM sales.active_sessions_by_shop;

-- Verificar gastos de una sesión
SELECT * FROM sales.get_session_expenses('session-uuid-here');

-- Verificar dashboard completo
SELECT * FROM sales.get_session_dashboard('session-uuid-here');

-- Verificar integridad de datos
SELECT
  s.id,
  s.shop_id,
  s.opening_balance,
  s.cash_total,
  COALESCE((SELECT SUM(amount) FROM sales.cash_expenses WHERE cash_register_session_id = s.id), 0) as total_expenses,
  s.expected_balance,
  s.closing_balance,
  s.difference
FROM sales.cash_register_sessions s
WHERE s.status = 'CERRADO'
ORDER BY s.closed_at DESC
LIMIT 10;
```

### Validar Correlativo de Órdenes

```sql
-- Verificar que order_number es secuencial
SELECT
  id,
  order_number,
  shop_id,
  created_at
FROM sales.orders
WHERE shop_id = 'shop-uuid-here'
ORDER BY created_at DESC
LIMIT 20;
```

### Validar Sumatorias de Pagos

```sql
-- Verificar que las sumatorias cuadran
SELECT
  s.id as session_id,
  s.cash_total as stored_cash_total,
  COALESCE(SUM(CASE WHEN p.payment_method = 'EFECTIVO' THEN p.amount ELSE 0 END), 0) as calculated_cash_total,
  s.cash_total = COALESCE(SUM(CASE WHEN p.payment_method = 'EFECTIVO' THEN p.amount ELSE 0 END), 0) as cash_matches
FROM sales.cash_register_sessions s
LEFT JOIN sales.payments p ON p.cash_register_session_id = s.id AND p.deleted_at IS NULL
WHERE s.status = 'CERRADO'
GROUP BY s.id
HAVING s.cash_total != COALESCE(SUM(CASE WHEN p.payment_method = 'EFECTIVO' THEN p.amount ELSE 0 END), 0);
```

---

## 🎨 Validación de UI/UX

### Responsive Design

- [ ] Probar en desktop (1920x1080)
- [ ] Probar en laptop (1366x768)
- [ ] Probar en tablet (768x1024)
- [ ] Probar en mobile (375x667)
- [ ] Verificar que todos los elementos son visibles
- [ ] Verificar que no hay scroll horizontal

### Accesibilidad

- [ ] Verificar contraste de colores
- [ ] Verificar tamaños de fuente legibles
- [ ] Verificar que los botones tienen tamaño táctil adecuado
- [ ] Verificar navegación por teclado

### Feedback Visual

- [ ] Verificar loading spinners durante operaciones
- [ ] Verificar mensajes de éxito (verdes)
- [ ] Verificar mensajes de error (rojos)
- [ ] Verificar badges de estado (ABIERTO, CERRADO)
- [ ] Verificar que los colores siguen la paleta definida

---

## 🔒 Seguridad

### Validaciones Backend

- [ ] Intentar registrar gasto sin sesión activa (debe fallar)
- [ ] Intentar cerrar sesión ya cerrada (debe fallar)
- [ ] Intentar abrir sesión sin permisos (debe fallar)
- [ ] Verificar que todas las funciones RPC validan inputs

### Validaciones Frontend

- [ ] Verificar que formularios validan en cliente
- [ ] Verificar que botones se deshabilitan durante submit
- [ ] Verificar que no se puede hacer doble submit
- [ ] Verificar que los guards protegen rutas

---

## 📊 Performance

### Carga de Datos

- [ ] Medir tiempo de carga del dashboard inicial (< 2s)
- [ ] Medir tiempo de actualización del dashboard (< 1s)
- [ ] Medir tiempo de carga de historial de gastos (< 1s)
- [ ] Medir tiempo de carga de ventas del día (< 2s)

### Optimizaciones

- [ ] Verificar que se usan signals para reactividad
- [ ] Verificar que componentes usan OnPush
- [ ] Verificar que no hay memory leaks
- [ ] Verificar que queries SQL usan índices

---

## 📝 Documentación

### Interna

- [ ] Revisar comentarios en código SQL
- [ ] Revisar JSDoc en TypeScript
- [ ] Revisar README actualizado
- [ ] Revisar guía de operación completa

### Usuario Final

- [ ] Manual de usuario para cajeros
- [ ] Guía rápida de operación
- [ ] FAQ de problemas comunes
- [ ] Videos tutoriales (opcional)

---

## 🚀 Deployment

### Pre-Deploy

- [ ] Crear branch de release
- [ ] Tag de versión (v2.0.0)
- [ ] Generar changelog
- [ ] Backup completo de producción

### Deploy a Staging

- [ ] Aplicar migración de BD
- [ ] Deploy de frontend
- [ ] Smoke test básico
- [ ] Pruebas de regresión

### Deploy a Producción

- [ ] Notificar a usuarios de mantenimiento
- [ ] Aplicar migración de BD
- [ ] Deploy de frontend
- [ ] Smoke test en producción
- [ ] Monitorear logs durante 1 hora
- [ ] Notificar a usuarios que sistema está disponible

---

## 🐛 Bug Tracking

### Issues Conocidos

- [ ] Documentar bugs encontrados durante testing
- [ ] Priorizar bugs (Crítico, Alto, Medio, Bajo)
- [ ] Crear tickets en sistema de tracking
- [ ] Asignar responsables

### Hotfixes

- [ ] Proceso de hotfix definido
- [ ] Branch de hotfix preparado
- [ ] Plan de rollback documentado

---

## 📞 Post-Deployment

### Día 1

- [ ] Monitorear logs de errores
- [ ] Verificar métricas de uso
- [ ] Recopilar feedback inicial de usuarios
- [ ] Responder preguntas de soporte

### Semana 1

- [ ] Análisis de uso del sistema
- [ ] Identificar patrones de uso
- [ ] Ajustes menores de UX
- [ ] Documentar mejoras sugeridas

### Mes 1

- [ ] Revisión completa de métricas
- [ ] Planificar siguiente iteración
- [ ] Evaluar éxito de la implementación

---

## ✅ Sign-Off

### Desarrolladores

- [ ] Desarrollador Backend: ********\_\_\_********
- [ ] Desarrollador Frontend: ********\_\_\_********
- [ ] Fecha: ********\_\_\_********

### QA

- [ ] QA Lead: ********\_\_\_********
- [ ] Tests Completados: **\_** / **\_**
- [ ] Fecha: ********\_\_\_********

### Product Owner

- [ ] Aprobación: ********\_\_\_********
- [ ] Comentarios: ********\_\_\_********
- [ ] Fecha: ********\_\_\_********

---

**Versión del Checklist**: 1.0  
**Fecha de Creación**: 30 de enero de 2026  
**Última Actualización**: 30 de enero de 2026
