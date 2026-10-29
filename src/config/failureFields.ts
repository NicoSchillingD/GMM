/**
 * Campos adicionales del formulario de falla (se guardan en `failures.extra`).
 * La planilla actual no los usa; se deja el mecanismo por si se necesitan más adelante.
 */
export interface ExtraField { key: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[]; required?: boolean }
export const failureExtraFields: ExtraField[] = [];
