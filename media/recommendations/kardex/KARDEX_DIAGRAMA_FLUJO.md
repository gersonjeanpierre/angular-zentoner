# Kardex - Diagrama de Flujo del Sistema

## 🔄 Flujo Principal del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                     SISTEMA KARDEX - FLUJO                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  1. COMPRA   │ ──► Proveedor entrega rollo
└──────────────┘
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│ kardex-create (Registro de Rollo)                            │
│ ─────────────────────────────────────────────────────────── │
│ • item_id           [Select: Items disponibles]             │
│ • roll_code         [Input: ROLL-2026-001]                  │
│ • initial_quantity  [Input: 100.000]                        │
│ • received_date     [Date: 2026-01-15]                      │
│ • notes             [Textarea: Opcional]                    │
│                                                              │
│ ┌──────────────────────────────────────────────┐            │
│ │ registerPurchase(payload)                    │            │
│ │ ├─► INSERT INTO roll_tracking                │            │
│ │ └─► INSERT INTO kardex (ENTRADA/COMPRA)      │            │
│ └──────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│ kardex-list (Listado de Rollos)                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ STATS CARDS                                            │  │
│ │ ┌──────────┬──────────┬──────────┬──────────┐        │  │
│ │ │ Total    │ FULL     │ PARTIAL  │ EMPTY    │        │  │
│ │ │ 150      │ 80       │ 45       │ 25       │        │  │
│ │ └──────────┴──────────┴──────────┴──────────┘        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ TABLA DE ROLLOS:                                             │
│ ┌────────────┬─────────┬─────────┬─────────┬──────────┐    │
│ │ Código     │ Item    │ Inicial │ Actual  │ Estado   │    │
│ ├────────────┼─────────┼─────────┼─────────┼──────────┤    │
│ │ ROLL-001   │ Papel   │ 100.000 │ 85.500  │ 🟢 FULL  │    │
│ │ ────────── Progress Bar ────────────────── [85%]    │    │
│ │                     [Historial] [Usar]               │    │
│ └────────────┴─────────┴─────────┴─────────┴──────────┘    │
│                                                              │
│ Acciones por rollo:                                          │
│ • [Historial] ──► item-kardex-history                       │
│ • [Usar]      ──► production-form                           │
└──────────────────────────────────────────────────────────────┘
      │
      ▼
┌──────────────┐
│ 2. PRODUCCIÓN│ ──► Cliente solicita trabajo
└──────────────┘
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│ production-form (Registro de Producción)                     │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ PASO 1: Selección de Material                               │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ • item_id    [Select: Papel Fotográfico]              │  │
│ │ • roll_id    [Select: ROLL-001 - Disponible: 85.500]  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ PASO 2: Información del Rollo                               │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Código:  ROLL-001                                      │  │
│ │ Inicial: 100.000    Actual: 85.500                     │  │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 85%          │  │
│ │          [Progress Bar - Verde]                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ PASO 3: Detalles de Producción                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ • machine_id       [Select: Plotter HP]               │  │
│ │ • job_name         [Input: Volante publicitario]      │  │
│ │ • order_detail_id  [Input: ORD-12345]                 │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ PASO 4: Cantidades de Consumo                               │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 🟢 customer_quantity    [Input: 50.000]               │  │
│ │    Material entregado al cliente                       │  │
│ │                                                         │  │
│ │ 🟡 calibration_waste    [Input: 2.500]                │  │
│ │    Desperdicio por calibración/setup                   │  │
│ │                                                         │  │
│ │ 🔴 error_waste          [Input: 1.000]                │  │
│ │    Daño por error humano/máquina                       │  │
│ │                                                         │  │
│ │ ╔══════════════════════════════════════════════════╗  │  │
│ │ ║ Total a Consumir: 53.500                         ║  │  │
│ │ ║ ✅ Stock suficiente. Quedará: 32.000            ║  │  │
│ │ ╚══════════════════════════════════════════════════╝  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ PASO 5: Dimensiones (Opcional)                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ • width_used_mm   [Input: 1200]                       │  │
│ │ • length_used_mm  [Input: 5000]                       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ PASO 6: Notas                                                │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ • notes  [Textarea: Trabajo urgente del cliente X]    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌──────────────────────────────────────────────┐            │
│ │ registerProduction(productionData)           │            │
│ │ ├─► INSERT INTO consumption_logs             │            │
│ │ ├─► INSERT INTO kardex (SALIDA/PRODUCCION)   │            │
│ │ ├─► INSERT INTO kardex_consumption           │            │
│ │ └─► UPDATE roll_tracking.current_quantity    │            │
│ └──────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
      │
      ▼
┌──────────────┐
│ 3. HISTORIAL │ ──► Auditoría y seguimiento
└──────────────┘
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│ item-kardex-history (Movimientos)                            │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ FILTROS: Por Item o Por Rollo                               │
│                                                              │
│ TABLA CRONOLÓGICA:                                           │
│ ┌──────┬────────┬──────────┬────────┬──────┬──────┬──────┐ │
│ │ Fecha│ Tipo   │ Razón    │ Rollo  │ Cant │ Prev │ Post │ │
│ ├──────┼────────┼──────────┼────────┼──────┼──────┼──────┤ │
│ │ 15/01│ ENTRADA│ COMPRA   │ R-001  │100.0 │  0.0 │100.0 │ │
│ │ 16/01│ SALIDA │ PRODUCCIÖN│ R-001  │ 53.5 │100.0 │ 46.5 │ │
│ │ 17/01│ SALIDA │ PRODUCCIÖN│ R-001  │ 14.5 │ 46.5 │ 32.0 │ │
│ └──────┴────────┴──────────┴────────┴──────┴──────┴──────┘ │
│                                                              │
│ Cada entrada muestra:                                        │
│ • Timestamp completo                                         │
│ • Badge de tipo (ENTRADA/SALIDA/AJUSTE)                     │
│ • Razón del movimiento                                       │
│ • Balance anterior y posterior                               │
│ • Notas si las hay                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Estructura de Base de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    ESQUEMA INVENTORY                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ movement_type    │ ──► Tipos de movimiento
├──────────────────┤
│ id (SMALLINT PK) │
│ name (TEXT)      │ ──► ENTRADA, SALIDA, AJUSTE
│ description      │
└──────────────────┘

┌──────────────────┐
│ movement_reason  │ ──► Razones específicas
├──────────────────┤
│ id (SMALLINT PK) │
│ name (TEXT)      │ ──► COMPRA, VENTA, PRODUCCION,
│ description      │     MERMA_TECNICA, DAÑO_OPERATIVO, etc.
└──────────────────┘

┌──────────────────┐
│ items            │ ──► Catálogo de materiales
├──────────────────┤
│ id (UUID PK)     │
│ name             │
│ sku              │
│ unit_type        │ ──► ml, m, kg, etc.
└──────────────────┘
        │
        │ 1:N
        ▼
┌──────────────────────┐
│ roll_tracking        │ ──► Rollos físicos individuales
├──────────────────────┤
│ id (UUID PK)         │
│ item_id (UUID FK)    │ ──┐
│ roll_code (TEXT UQ)  │   │
│ initial_quantity     │   │ Estado del rollo
│ current_quantity     │   │
│ status (TEXT)        │ ──┘ FULL, PARTIAL, EMPTY, SCRAPPED
│ received_date (DATE) │
│ notes (TEXT)         │
└──────────────────────┘
        │
        │ 1:N
        ▼
┌──────────────────────────────┐
│ kardex                       │ ──► Registro contable
├──────────────────────────────┤
│ id (UUID PK)                 │
│ movement_type_id (FK)        │
│ movement_reason_id (FK)      │
│ item_id (UUID FK)            │
│ roll_id (UUID FK)            │
│ quantity (DECIMAL)           │
│ previous_balance (DECIMAL)   │ ──┐ Contabilidad
│ subsequent_balance (DECIMAL) │ ──┘ de doble entrada
│ unit_cost_at_moment          │
│ notes (TEXT)                 │
│ created_by (UUID)            │
└──────────────────────────────┘
        │
        │ 1:N (si es PRODUCCION)
        ▼
┌────────────────────┐
│ consumption_logs   │ ──► Detalles técnicos de producción
├────────────────────┤
│ id (UUID PK)       │
│ machine_id (FK)    │
│ operator_id (FK)   │
│ job_name (TEXT)    │
│ customer_quantity  │ ──┐
│ calibration_waste  │   │ Cantidades
│ error_waste        │ ──┘ desglosadas
│ width_used_mm      │
│ length_used_mm     │
└────────────────────┘
        │
        │ N:N
        ▼
┌────────────────────────┐
│ kardex_consumption     │ ──► Relación kardex ↔ consumo
├────────────────────────┤
│ id (UUID PK)           │
│ kardex_id (UUID FK)    │
│ consumption_log_id (FK)│
│ used_quantity          │
│ notes (TEXT)           │
└────────────────────────┘
```

---

## 🔄 Flujo de Datos - Registro de Producción

```
┌────────────────────────────────────────────────────────────┐
│     FRONTEND (Angular)                                     │
└────────────────────────────────────────────────────────────┘
                    │
                    │ productionForm.submit()
                    ▼
┌────────────────────────────────────────────────────────────┐
│     KardexService.registerProduction()                     │
│     ─────────────────────────────────────────────────────  │
│     await supabaseClient.rpc('register_production', {      │
│       p_roll_id,                                           │
│       p_machine_id,                                        │
│       p_job_name,                                          │
│       p_customer_quantity,                                 │
│       p_calibration_waste,                                 │
│       p_error_waste,                                       │
│       p_width_used_mm,                                     │
│       p_length_used_mm,                                    │
│       p_notes                                              │
│     })                                                     │
└────────────────────────────────────────────────────────────┘
                    │
                    │ HTTP POST
                    ▼
┌────────────────────────────────────────────────────────────┐
│     SUPABASE (PostgreSQL)                                  │
│     ─────────────────────────────────────────────────────  │
│     FUNCTION register_production(...)                      │
│     BEGIN TRANSACTION                                      │
│                                                            │
│     1. INSERT INTO consumption_logs                        │
│        ├─► id = gen_random_uuid()                         │
│        ├─► machine_id, operator_id, job_name             │
│        └─► customer_quantity, wastes, dimensions          │
│                                                            │
│     2. INSERT INTO kardex                                  │
│        ├─► movement_type_id = 2 (SALIDA)                 │
│        ├─► movement_reason_id = 3 (PRODUCCION)           │
│        ├─► quantity = SUM(todas las cantidades)          │
│        ├─► previous_balance = roll.current_quantity      │
│        └─► subsequent_balance = prev - quantity           │
│                                                            │
│     3. INSERT INTO kardex_consumption                      │
│        ├─► kardex_id = (from step 2)                     │
│        ├─► consumption_log_id = (from step 1)            │
│        └─► used_quantity = total quantity                 │
│                                                            │
│     4. UPDATE roll_tracking                                │
│        ├─► current_quantity -= total                      │
│        └─► status = CASE                                   │
│              WHEN current_quantity = 0 THEN 'EMPTY'       │
│              WHEN current_quantity < initial THEN 'PARTIAL'│
│              ELSE 'FULL'                                   │
│            END                                             │
│                                                            │
│     COMMIT                                                 │
│     RETURN { consumptionLogId, kardexId }                 │
└────────────────────────────────────────────────────────────┘
                    │
                    │ RESPONSE
                    ▼
┌────────────────────────────────────────────────────────────┐
│     FRONTEND (Angular)                                     │
│     ─────────────────────────────────────────────────────  │
│     success.set(true)                                      │
│     setTimeout(() => router.navigate(['/kardex']), 1500)   │
└────────────────────────────────────────────────────────────┘
```

---

## 📊 Ejemplo de Caso Real

```
CASO: Impresión de Volantes Publicitarios
──────────────────────────────────────────

CONTEXTO:
• Cliente: Restaurante "El Buen Sabor"
• Trabajo: 1000 volantes formato A5
• Material: Papel couché 150g
• Rollo: ROLL-2026-045

PROCESO:

1. COMPRA DEL ROLLO (kardex-create)
   ┌────────────────────────────────────┐
   │ Item: Papel couché 150g            │
   │ Roll Code: ROLL-2026-045           │
   │ Initial Quantity: 100.000 kg       │
   │ Received Date: 2026-01-15          │
   │ Notes: Proveedor Papelería XYZ     │
   └────────────────────────────────────┘

   RESULTADO BD:
   ├─► roll_tracking.current_quantity = 100.000
   ├─► roll_tracking.status = 'FULL'
   └─► kardex: ENTRADA/COMPRA +100.000
       (previous: 0.000 → subsequent: 100.000)

2. PRIMERA PRODUCCIÓN (production-form)
   ┌────────────────────────────────────┐
   │ Rollo: ROLL-2026-045               │
   │ Máquina: Plotter HP DesignJet      │
   │ Job: Volantes El Buen Sabor        │
   │ Cliente: 45.500 kg                 │
   │ Merma Técnica: 2.000 kg            │
   │ Error Operativo: 0.500 kg          │
   │ Total: 48.000 kg                   │
   └────────────────────────────────────┘

   RESULTADO BD:
   ├─► consumption_logs: {job, quantities, dimensions}
   ├─► roll_tracking.current_quantity = 52.000
   ├─► roll_tracking.status = 'PARTIAL'
   └─► kardex: SALIDA/PRODUCCION -48.000
       (previous: 100.000 → subsequent: 52.000)

3. SEGUNDA PRODUCCIÓN (mismo rollo)
   ┌────────────────────────────────────┐
   │ Rollo: ROLL-2026-045 (52.000 kg)   │
   │ Máquina: Plotter HP DesignJet      │
   │ Job: Banners promocionales         │
   │ Cliente: 30.000 kg                 │
   │ Merma Técnica: 1.500 kg            │
   │ Error Operativo: 0.000 kg          │
   │ Total: 31.500 kg                   │
   └────────────────────────────────────┘

   RESULTADO BD:
   ├─► consumption_logs: {job, quantities}
   ├─► roll_tracking.current_quantity = 20.500
   ├─► roll_tracking.status = 'PARTIAL' (⚠️ 20% restante)
   └─► kardex: SALIDA/PRODUCCION -31.500
       (previous: 52.000 → subsequent: 20.500)

4. HISTORIAL (item-kardex-history)
   ┌───────────────────────────────────────────────────────┐
   │ Fecha     │ Tipo    │ Razón      │ Cant    │ Balance │
   ├───────────┼─────────┼────────────┼─────────┼─────────┤
   │ 15/01 10h │ ENTRADA │ COMPRA     │ +100.000│ 100.000 │
   │ 16/01 14h │ SALIDA  │ PRODUCCION │ - 48.000│  52.000 │
   │ 17/01 09h │ SALIDA  │ PRODUCCION │ - 31.500│  20.500 │
   └───────────┴─────────┴────────────┴─────────┴─────────┘

   ALERTAS:
   ⚠️ Rollo ROLL-2026-045 en 20.5% de capacidad
   📊 Total consumido: 79.5 kg de 100 kg
   🎯 Eficiencia: 75.5 kg cliente / 79.5 kg total = 95%

CONCLUSIONES:
✅ 95% de eficiencia (cliente / total)
⚠️ 3.5 kg de mermas (4.4% del total)
📈 Rollo casi agotado, considerar reabastecimiento
```

---

## 🎯 Key Performance Indicators (KPIs)

```
┌─────────────────────────────────────────────────────────┐
│             KPIs CALCULABLES CON KARDEX                 │
└─────────────────────────────────────────────────────────┘

1. EFICIENCIA DE PRODUCCIÓN
   ──────────────────────────
   customer_quantity / (customer + calibration + error) × 100%

   Ejemplo: 45.5 / (45.5 + 2.0 + 0.5) = 94.79%

2. RATIO DE MERMAS
   ───────────────
   (calibration_waste + error_waste) / total_consumed × 100%

   Ejemplo: (2.0 + 0.5) / 48.0 = 5.21%

3. ROTACIÓN DE INVENTARIO
   ────────────────────────
   Total salidas / Stock promedio

   Query: SELECT SUM(quantity) FROM kardex
          WHERE movement_type_id = 2

4. COSTO DE MERMAS
   ───────────────
   SUM(waste_quantity × unit_cost_at_moment)

   Query: SELECT SUM(k.quantity * k.unit_cost_at_moment)
          FROM kardex k
          WHERE movement_reason_id IN (4, 5)  -- Mermas

5. TIEMPO PROMEDIO DE AGOTAMIENTO
   ──────────────────────────────
   AVG(fecha_vacio - fecha_compra) por rollo

   Query: SELECT AVG(depleted_at - created_at)
          FROM roll_tracking
          WHERE status = 'EMPTY'

6. ITEMS CON MAYOR CONSUMO
   ────────────────────────
   Top 10 items por cantidad de salidas

   Query: SELECT item_id, SUM(quantity)
          FROM kardex
          WHERE movement_type_id = 2
          GROUP BY item_id
          ORDER BY 2 DESC
          LIMIT 10
```

---

**Generado por:** GitHub Copilot  
**Versión:** 1.0  
**Última actualización:** 2026-01-XX
