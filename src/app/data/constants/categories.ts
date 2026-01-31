// Definimos la estructura (Interface) para mantener el orden
interface PrintingCategory {
  id: number;
  name: string; // Nombre legible (ej: Impresión Digital)
  itemTypes: string[]; // Qué materiales/servicios pertenecen aquí
  allowedSizes: string[]; // Qué tamaños son válidos
  compatibleMachines: string[]; // Qué máquinas lo producen
}

export const PRINTING_CATEGORIES: PrintingCategory[] = [
  {
    id: 1,
    name: 'IMPRESIÓN DIGITAL LÁSER',
    itemTypes: [
      'ADHESIVO P3',
      'ADHESIVO P4',
      'VOLANTE 115g',
      'VOLANTE 150g',
      'BOND 90 GR',
      'CANSON',
      'COUCHE BRILLANTE 150g',
      'COUCHE BRILLANTE 200g',
      'COUCHE BRILLANTE 300g',
      'COUCHE MATE 150g',
      'COUCHE MATE 200g',
      'COUCHE MATE 300g',
      'FOLKOTE C14',
      'HILO 250g',
      'OPALINA 250g',
      'TARJETA MATE',
      'TARJETA BRILLO',
    ],
    allowedSizes: ['A0', 'A1', 'A2', 'A3', 'SA3', 'A4', 'A5', 'A6', '90mmx55mm'],
    compatibleMachines: [
      'VP 14',
      'VP 15',
      'VP 23',
      'VP 26',
      'VP 32',
      'VP 33',
      'IPF - 710',
      'IPF - 750',
    ],
  },
  {
    id: 2,
    name: 'GIGANTOGRAFÍA Y GRAN FORMATO',
    itemTypes: [
      'BANNER',
      'VINIL TRANSPARENTE BRILLO',
      'VINIL TRANSPARENTE MATE',
      'VINIL ARCLAD BRILLO',
      'VINIL ARCLAD MATE',
      'PAPEL SOLVENTE',
      'LINNER',
      'ROLL SCREEN',
    ],
    allowedSizes: [], // Custom sizes via modal
    compatibleMachines: ['FUTURA 01'],
  },
  {
    id: 3,
    name: 'IMPRESIÓN DTF (TEXTIL Y MERCH)',

    itemTypes: [
      'POLO',
      'POLERA',
      'GORRA VISERA BLANCA',
      'GORRA VISERA COLOR',
      'BOLSA NOTEX',
      'BOLSA TOCUYO', // Usualmente se usa DTF para estampar esto
    ],
    allowedSizes: [
      '27x21 DTF MERCHANDISING',
      '27x0.5 DTF MERCHANDISING',
      '55x1 DTF TEXTIL',
      '55x10 DTF TEXTIL',
    ],
    compatibleMachines: ['DTF MERCHANDISING', 'DTF TEXTIL'],
  },
  {
    id: 4,
    name: 'ARTÍCULOS PUBLICITARIOS / SUBLIMACIÓN',
    itemTypes: [
      'TAZA',
      'TAZA MAGICA',
      'TAZA CORAZON',
      'TAZA ASA DE COLOR',
      'LLAVERO ACRILICO',
      'LLAVERO ENMIC',
      'PORTA RETRATO',
      'LAPICERO',
      'MOUSEPAD',
      'ROMPECABEZAS',
      'TOMATODO',
      'TERMO',
    ],
    allowedSizes: [
      'UND', // Aquí deberías agregar un tamaño "UNIDAD" o "ESTÁNDAR" a tu lista ITEM_SIZE
    ],
    compatibleMachines: ['SUBLIMADORA', 'UV', 'DTF MERCHANDISING'],
  },
  {
    id: 5,
    name: 'ACABADOS Y SERVICIOS POST-IMPRESIÓN',
    itemTypes: [
      'CORTE',
      'EMPASTADO',
      'ANILLADO',
      'ESPIRALADO',
      'PERFORADO',
      'PLASTIFICADO MATE',
      'PLASTIFICADO BRILLO',
      'ENMICADO A4',
      'ENMICADO A3',
      'LAMINADO MATE',
      'LAMINADO BRILLO',
      'TROQUELADO',
      'OJALES',
    ],
    allowedSizes: ['A0', 'A1', 'A2', 'A3', 'SA3', 'A4', 'PERSONALIZADO', 'N/A'],
    compatibleMachines: [
      'PLASTIFICADORA',
      'ENMICADORA',
      'LAMINADORA',
      'TROQUELADORA',
      'GUILLOTINA',
      'MANUAL',
    ],
  },
  {
    id: 6,
    name: 'SERVICIOS Y ADMINISTRATIVOS',
    itemTypes: [
      'DISEÑO',
      'ESCANEO A4',
      'ESCANEO A3',
      'TRANSPORTE',
      'SALDOS - DEUDAS',
      'ENLISTADO DE NOMBRES',
    ],
    allowedSizes: ['N/A'],
    compatibleMachines: ['SERV. INTERNO', 'SERV. EXTERNO'],
  },
];
