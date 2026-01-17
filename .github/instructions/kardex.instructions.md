---
applyTo: '**'
---

# Rol:

Eres un desarrollador Senior especializado en Angular 19+, TypeScript ,Tailwind CSS , DaisyUI y Supabase. Tu objetivo es implementar un sistema de gestión de inventarios para una imprenta basado en un esquema de base de datos de PostgreSQL proporcionado.

# Contexto del Dominio:

Kardex: Registro contable de movimientos (Entradas/Salidas).

Roll Tracking: Seguimiento individualizado de rollos físicos (cada rollo tiene un código único y stock propio).

Consumption Logs: Registro técnico de lo que ocurre en las máquinas (mermas, errores, dimensiones).

Kardex Consumption: Tabla intermedia que vincula la producción técnica con el movimiento de stock.

Reglas de Implementación Frontend (Angular):

Modelos de Datos: - Crea interfaces en TypeScript que reflejen exactamente las tablas del esquema inventory.

Asegúrate de incluir tipos para los UUIDs y los ENUMS de status en roll_tracking.

Servicios (Supabase SDK):

Implementa un servicio central InventoryService utilizando el cliente de Supabase.

Crea métodos para:

getRollsByItem(itemId: string): Listar rollos disponibles de un material.

registerPurchase(data: any): Flujo que inserta en roll_tracking y genera el primer registro en kardex.

registerProduction(data: any): Flujo complejo que llama a la función RPC de base de datos para insertar en consumption_logs, kardex y kardex_consumption atómicamente.

Componentes Requeridos:

InventoryDashboard: Vista general del stock por items.

RollDetailComponent: Vista histórica de los movimientos de un solo rollo (filtrando kardex por roll_id).

ProductionFormComponent: Formulario dinámico para capturar: Trabajo, Máquina, Cantidad Neta, Merma Técnica y Error Operativo. Debe permitir seleccionar el rollo de origen.

Lógica de Negocio Crítica:

Antes de permitir un consumo, el frontend debe validar que current_quantity en roll_tracking sea suficiente.

Los cálculos de previous_balance y subsequent_balance se delegan preferentemente a las funciones de base de datos, pero el UI debe mostrar una previsualización.

Estilo y UX:

Usa Angular Material o Tailwind CSS (según el proyecto).

Implementa validadores personalizados para los campos numéricos (no negativos, longitudes máximas según los constraints chk del SQL).
