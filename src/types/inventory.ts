export enum RolUsuario {
  Auxiliar = 'auxiliar',
  ResponsableTurno = 'responsable_turno',
  JefeOficina = 'jefe_oficina',
}

export interface UsuarioApp {
  id: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
  cargoEtiqueta: string;
  turno: 'Mañana' | 'Tarde';
}

export enum CategoriaElemento {
  Audiovisual = 'audiovisual',
  Deportivo = 'deportivo',
}

export type EstadoFisico = 'Óptimo' | 'Buen estado' | 'Desgaste leve' | 'En revisión';

export interface Elemento {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaElemento;
  tipo: string;
  estadoFisico: EstadoFisico;
  activo: boolean;
  cantidadTotal: number;
  ubicacion: string;
}

export enum TipoNovedad {
  Prestamo = 'prestamo',
  Perdida = 'perdida',
  OrdenSalida = 'orden_salida',
}

export type VinculoSolicitante = 'Docente' | 'Estudiante' | 'Administrativo';

export enum EstadoNovedad {
  Abierta = 'abierta',
  Cerrada = 'cerrada',
}

export interface Novedad {
  id: string;
  elementoCodigo: string;
  tipo: TipoNovedad;
  cantidad: number;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  solicitanteDependencia: string;
  solicitanteVinculo: VinculoSolicitante;
  fechaEvento: string;
  horaEvento: string;
  auxiliarRegistroNombre: string;
  auxiliarRegistroCorreo: string;
  estado: EstadoNovedad;
  eventoOrdenSalida?: string;
  referenciaAutorizacionExterna?: string;
  fechaCierre?: string;
  horaCierre?: string;
  auxiliarCierreNombre?: string;
  auxiliarCierreCorreo?: string;
  observaciones: string;
  notaResolucion?: string;
}

export type ResultadoAudiovisual = 'pendiente' | 'en_oficina' | 'no_esta';

export interface DetalleInventarioItem {
  elementoCodigo: string;
  categoria: CategoriaElemento;
  resultado: ResultadoAudiovisual;
  verificadoDeportivo: boolean;
  cantidadTotal: number;
  unidadesEnOficina: number;
  unidadesAfuera: number;
  novedadIds: string[];
  observacionFila?: string;
}

export interface CorreccionCierre {
  id: string;
  fechaHora: string;
  autorNombre: string;
  autorCorreo: string;
  motivo: string;
  detalle: string;
}

export interface InventarioCierre {
  id: string;
  fecha: string;
  estado: 'en_progreso' | 'firmado';
  responsableNombre?: string;
  responsableCorreo?: string;
  horaCierre?: string;
  selloConfirmacion?: string;
  observaciones: string;
  detalles: DetalleInventarioItem[];
  correcciones: CorreccionCierre[];
  pdfGeneradoEnDrive?: boolean;
}

export interface VerificacionApertura {
  id: string;
  fecha: string;
  hora: string;
  auxiliarNombre: string;
  auxiliarCorreo: string;
  conformeConCierreAnterior: boolean;
  elementosVerificados: number;
  diferenciasReportadas: number;
  observaciones: string;
}

export interface RegistroAuditoria {
  id: string;
  fechaHora: string;
  usuarioNombre: string;
  usuarioCorreo: string;
  rol: RolUsuario;
  modulo: 'Catálogo' | 'Novedades' | 'Cierre Diario' | 'Apertura' | 'Corrección';
  accion: string;
  detalle: string;
}

export type VistaNavegacion =
  | 'cierre'
  | 'novedades'
  | 'apertura'
  | 'catalogo'
  | 'historial';
