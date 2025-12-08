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
      'BOND 90 GR', 'COUCHE BRILLANTE 150 GR', 'COUCHE BRILLANTE 200 GR',
      'COUCHE BRILLANTE 300GR', 'FOLKOTE 14', 'OPALINA 250GR', 'HILO 250GR',
      'ADHESIVO', 'A6 VOLANTE 115GR', 'A6 VOLANTE 150GR', 'TARJETA MATE',
      'TARJETA BRILLO', 'COPIA B/N', 'COPIA COLOR', 'BLANCO Y NEGRO'
    ],
    allowedSizes: [
      'A4', 'A3', 'OFICIO', '13"x19"', 'IMPRENTA', 'A5', 'A6'
    ],
    compatibleMachines: [
      'MINOLTA', 'C750', 'B/N1135', 'VP 32', 'VP 33'
    ]
  },
  {
    id: 2,
    name: 'GIGANTOGRAFÍA Y GRAN FORMATO',
    itemTypes: [
      'BANNER', 'VINIL TRANSPARENTE BRILLO', 'VINIL TRANSPARENTE MATE',
      'VINIL ARCLAD BRILLO', 'VINIL ARCLAD MATE', 'CANSON', 'PAPEL SOLVENTE',
      'LINNER', 'ROLL SCREEN'
    ],
    allowedSizes: [], // Custom sizes via modal
    compatibleMachines: [
      'GIGANTOGRAFÍA', 'IPF - 710', 'IPF - 750', 'FUTURA 01'
    ]
  },
  {
    id: 3,
    name: 'IMPRESIÓN DTF (TEXTIL Y MERCH)',

    itemTypes: [
      'POLO', 'POLERA', 'GORRA VISERA BLANCA', 'GORRA VISERA COLOR',
      'BOLSA NOTEX', 'BOLSA TOCUYO' // Usualmente se usa DTF para estampar esto
    ],
    allowedSizes: [
      '27x21 DTF MERCHANDISING', '27x0.5 DTF MERCHANDISING',
      '55x1 DTF TEXTIL', '55x10 DTF TEXTIL'
    ],
    compatibleMachines: [
      'DTF MERCHANDISING', 'DTF TEXTIL'
    ]
  },
  {
    id: 4,
    name: 'ARTÍCULOS PUBLICITARIOS / SUBLIMACIÓN',
    itemTypes: [
      'TAZA', 'TAZA MAGICA', 'TAZA CORAZON', 'TAZA ASA DE COLOR',
      'LLAVERO ACRILICO', 'LLAVERO ENMIC', 'PORTA RETRATO', 'LAPICERO',
      'MOUSEPAD', 'ROMPECABEZAS', 'TOMATODO', 'TERMO'
    ],
    allowedSizes: [
      'Unitario' // Aquí deberías agregar un tamaño "UNIDAD" o "ESTÁNDAR" a tu lista ITEM_SIZE
    ],
    compatibleMachines: [
      'SUBLIMADORA', 'UV', '3D', 'HORNO'
    ]
  },
  {
    id: 5,
    name: 'ACABADOS Y SERVICIOS POST-IMPRESIÓN',
    itemTypes: [
      'CORTE', 'EMPASTADO', 'ANILLADO', 'ESPIRALADO', 'PERFORADO',
      'PLASTIFICADO MATE', 'PLASTIFICADO BRILLO', 'ENMICADO A4',
      'ENMICADO A3', 'LAMINADO MATE', 'LAMINADO BRILLO', 'TROQUELADO',
      'OJALES'
    ],
    allowedSizes: [
      'A4', 'A3', 'A2', 'A1', 'A0' // Los acabados suelen depender del tamaño del pliego
    ],
    compatibleMachines: [
      'PLASTIFICADORA', 'ENMICADORA', 'LAMINADORA', 'TROQUELADORA', 'GUILLOTINA'
    ]
  },
  {
    id: 6,
    name: 'SERVICIOS Y ADMINISTRATIVOS',
    itemTypes: [
      'DISEÑO', 'ESCANEO A4', 'ESCANEO A3', 'TRANSPORTE',
      'SALDOS - DEUDAS', 'ENLISTADO DE NOMBRES'
    ],
    allowedSizes: ['N/A'],
    compatibleMachines: ['SERV. INTERNO', 'SERV. EXTERNO']
  }
];