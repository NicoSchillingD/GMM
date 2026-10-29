export type Role = 'admin' | 'mantenimiento' | 'supervisor' | 'consulta';
export type AssetStatus = 'operativo' | 'fuera_servicio' | 'en_mantencion' | 'standby' | 'desincorporado';
export type Severity = 'urgente' | 'informativo';
export type FailureStatus = 'abierto' | 'en_revision' | 'en_curso' | 'resuelto' | 'cerrado';
export type WOType = 'correctivo' | 'preventivo';
export type WOStatus = 'pendiente' | 'en_curso' | 'completada';

export interface Profile { id: string; nombre: string; email: string; rol: Role }
export interface Area { id: string; nombre: string }
export interface Asset {
  id: string; parent_id: string | null; area_id: string | null; tag: string; tipo: string;
  marca: string; modelo: string; serie: string; anio_fab: number | null;
  estado: AssetStatus; criticidad: string; diagnostico: string; es_componente: boolean;
}
export interface Assignment { id: string; profile_id: string; asset_id: string | null; area_id: string | null }
export interface Failure {
  id: string; numero: number; asset_id: string; reportado_por: string; severidad: Severity;
  detiene_produccion: boolean; inicio_detencion: string | null; liberacion: string | null;
  descripcion: string; causa_inmediata: string; extra: Record<string, string>;
  estado: FailureStatus; fotos: string[]; creado: string;
  fecha_inicio_solucion: string | null; nota_status: string; nota_solucion: string; encargado_id: string | null;
}
export interface Feedback { id: string; failure_id: string; autor: string; comentario: string; estado: FailureStatus | null; creado: string }
export interface Plan {
  id: string; asset_id: string; nombre: string; tareas: string[]; frecuencia_dias: number;
  proxima_fecha: string; responsable: string | null;
}
export interface WorkOrder {
  id: string; failure_id: string | null; plan_id: string | null; asset_id: string; tipo: WOType;
  asignado_a: string | null; estado: WOStatus; descripcion: string; creado: string; inicio: string | null; fin: string | null;
}
export interface CostDoc {
  id: string; tipo: 'compra' | 'gasto' | 'factura'; numero: string; proveedor: string; monto: number;
  fecha: string; failure_id: string | null; work_order_id: string | null; archivo: string | null;
}

export interface Tables {
  profiles: Profile; areas: Area; assets: Asset; assignments: Assignment; failures: Failure;
  feedback: Feedback; plans: Plan; work_orders: WorkOrder; cost_docs: CostDoc;
}
export type TableName = keyof Tables;
