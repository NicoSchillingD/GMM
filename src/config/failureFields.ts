/**
 * Campos adicionales del formulario de falla (se guardan en `failures.extra`).
 * PENDIENTE: reemplazar por los encabezados exactos de la planilla de
 * "Inspección maquinaria nivel usuario" cuando estén disponibles.
 */
export interface ExtraField { key: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[]; required?: boolean }
export const failureExtraFields: ExtraField[] = [
  { key: 'obra', label: 'Obra / Nota de venta (si aplica)', type: 'text' },
  { key: 'lote', label: 'Lote (si aplica)', type: 'text' },
  { key: 'turno', label: 'Turno', type: 'select', options: ['Mañana', 'Tarde', 'Noche'] },
];
