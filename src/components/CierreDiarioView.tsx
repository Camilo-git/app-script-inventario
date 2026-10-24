import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  Lock,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import { FECHA_HOY } from '../data/seedData';
import {
  CategoriaElemento,
  Elemento,
  InventarioCierre,
  Novedad,
  ResultadoAudiovisual,
  RolUsuario,
  UsuarioApp,
} from '../types/inventory';
import {
  calcularDiasAntiguedad,
  etiquetaTipoNovedad,
  exportarCsvDescarga,
  obtenerNovedadesAbiertasPorElemento,
  validarCierreParaFirma,
} from '../utils/inventoryRules';
import { descargarActaOficialHtml } from '../utils/gasBridge';

interface CierreDiarioViewProps {
  cierre: InventarioCierre;
  elementos: Elemento[];
  novedades: Novedad[];
  usuarioActivo: UsuarioApp;
  usuariosAutorizados: UsuarioApp[];
  soloConsulta: boolean;
  onCambiarUsuario: (u: UsuarioApp) => void;
  onMarcarAudiovisual: (codigo: string, resultado: ResultadoAudiovisual) => void;
  onActualizarDeportivo: (codigo: string, unidadesEnOficina: number, verificado?: boolean) => void;
  onMarcarRestantesEnOficina: () => void;
  onActualizarObservaciones: (texto: string) => void;
  onFirmarCierre: (observacionFinal: string) => boolean;
  onAbrirModalNovedad: (elementoCodigo?: string, cantidadFaltante?: number) => void;
  onAbrirModalCerrarNovedad: (novedad: Novedad) => void;
  onRegistrarCorreccion: (cierreId: string, motivo: string, detalle: string) => boolean;
}

type FiltroCierre = 'todos' | 'pendientes' | 'excepciones' | 'audiovisuales' | 'deportivos';

export const CierreDiarioView: React.FC<CierreDiarioViewProps> = ({
  cierre,
  elementos,
  novedades,
  usuarioActivo,
  usuariosAutorizados,
  soloConsulta,
  onCambiarUsuario,
  onMarcarAudiovisual,
  onActualizarDeportivo,
  onMarcarRestantesEnOficina,
  onActualizarObservaciones,
  onFirmarCierre,
  onAbrirModalNovedad,
  onAbrirModalCerrarNovedad,
  onRegistrarCorreccion,
}) => {
  const [filtro, setFiltro] = useState<FiltroCierre>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [declaracionAceptada, setDeclaracionAceptada] = useState(false);
  const [mostrarFormCorreccion, setMostrarFormCorreccion] = useState(false);
  const [motivoCorreccion, setMotivoCorreccion] = useState('');
  const [detalleCorreccion, setDetalleCorreccion] = useState('');

  const mapaElementos = useMemo(
    () => new Map(elementos.map((e) => [e.codigo, e])),
    [elementos]
  );

  const problemas = useMemo(
    () => validarCierreParaFirma(cierre, elementos, novedades),
    [cierre, elementos, novedades]
  );

  const mapaProblemas = useMemo(
    () => new Map(problemas.map((p) => [p.elementoCodigo, p])),
    [problemas]
  );

  const bloqueadoPorFirma = cierre.estado === 'firmado';
  const bloqueadoEdicion = bloqueadoPorFirma || soloConsulta;

  const metricas = useMemo(() => {
    const totalCodigos = cierre.detalles.length;
    let verificados = 0;
    let conNovedadPrecargada = 0;
    let sinJustificar = 0;

    for (const d of cierre.detalles) {
      const prob = mapaProblemas.get(d.elementoCodigo);
      if (d.novedadIds.length > 0) conNovedadPrecargada += 1;
      if (prob?.tipoProblema === 'ausencia_sin_novedad' || prob?.tipoProblema === 'exceso_en_oficina') {
        sinJustificar += 1;
      }
      const estaListo =
        d.categoria === CategoriaElemento.Audiovisual
          ? d.resultado !== 'pendiente' && !prob
          : d.verificadoDeportivo && !prob;
      if (estaListo) verificados += 1;
    }

    return {
      totalCodigos,
      verificados,
      pendientes: totalCodigos - verificados,
      conNovedadPrecargada,
      sinJustificar,
    };
  }, [cierre.detalles, mapaProblemas]);

  const detallesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cierre.detalles.filter((d) => {
      const el = mapaElementos.get(d.elementoCodigo);
      if (!el) return false;

      if (q) {
        const coincide =
          el.codigo.toLowerCase().includes(q) ||
          el.nombre.toLowerCase().includes(q) ||
          el.tipo.toLowerCase().includes(q);
        if (!coincide) return false;
      }

      const prob = mapaProblemas.get(d.elementoCodigo);
      if (filtro === 'audiovisuales') return d.categoria === CategoriaElemento.Audiovisual;
      if (filtro === 'deportivos') return d.categoria === CategoriaElemento.Deportivo;
      if (filtro === 'pendientes') return Boolean(prob);
      if (filtro === 'excepciones') {
        return d.unidadesAfuera > 0 || d.resultado === 'no_esta' || Boolean(prob);
      }
      return true;
    });
  }, [cierre.detalles, mapaElementos, mapaProblemas, filtro, busqueda]);

  const filasAudiovisuales = detallesFiltrados.filter(
    (d) => d.categoria === CategoriaElemento.Audiovisual
  );
  const filasDeportivas = detallesFiltrados.filter(
    (d) => d.categoria === CategoriaElemento.Deportivo
  );

  const manejarExportarActaCsv = () => {
    const cabeceras = [
      'Fecha_Cierre',
      'Estado_Cierre',
      'Codigo_Elemento',
      'Nombre_Elemento',
      'Categoria',
      'Cantidad_Total',
      'Unidades_En_Oficina',
      'Unidades_Afuera',
      'Resultado',
      'Novedades_Asociadas',
      'Responsable_Firma',
      'Hora_Firma',
    ];
    const filas = cierre.detalles.map((d) => {
      const el = mapaElementos.get(d.elementoCodigo);
      return [
        cierre.fecha,
        cierre.estado === 'firmado' ? 'Firmado' : 'En progreso',
        d.elementoCodigo,
        el?.nombre ?? '',
        d.categoria === CategoriaElemento.Audiovisual ? 'Audiovisual' : 'Deportivo',
        String(d.cantidadTotal),
        String(d.unidadesEnOficina),
        String(d.unidadesAfuera),
        d.resultado === 'en_oficina'
          ? 'En oficina'
          : d.resultado === 'no_esta'
            ? 'No está'
            : 'Pendiente',
        d.novedadIds.join(' | ') || 'Ninguna',
        cierre.responsableCorreo ?? 'Sin firmar',
        cierre.horaCierre ?? '-',
      ];
    });
    exportarCsvDescarga(`Detalle_Inventario_${cierre.fecha}.csv`, cabeceras, filas);
  };

  const manejarFirmar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declaracionAceptada) return;
    onFirmarCierre(cierre.observaciones);
  };

  const manejarGuardarCorreccion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoCorreccion.trim() || !detalleCorreccion.trim()) return;
    const ok = onRegistrarCorreccion(cierre.id, motivoCorreccion, detalleCorreccion);
    if (ok) {
      setMotivoCorreccion('');
      setDetalleCorreccion('');
      setMostrarFormCorreccion(false);
    }
  };

  const usuarioResponsableDemo = usuariosAutorizados.find(
    (u) => u.rol === RolUsuario.ResponsableTurno
  );

  return (
    <div className="space-y-8">
      <div className="hidden print-only border-b border-slate-300 pb-4 mb-6">
        <h1 className="text-xl font-bold text-slate-900">
          Oficina de Medios Educativos · Acta de Inventario de Cierre Diario
        </h1>
        <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
          Fecha: {cierre.fecha} · ID Acta: {cierre.id} · Estado:{' '}
          {cierre.estado === 'firmado'
            ? `FIRMADO (${cierre.selloConfirmacion}) por ${cierre.responsableNombre} (${cierre.responsableCorreo}) a las ${cierre.horaCierre}`
            : 'BORRADOR SIN FIRMAR'}
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6 print-surface">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Flujo central obligatorio</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Fecha {cierre.fecha}</span>
              <span aria-hidden="true">·</span>
              {bloqueadoPorFirma ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Cierre firmado y bloqueado</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                  <Clock className="w-3.5 h-3.5" />
                  <span>En preparación para firma</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Inventario de cierre diario
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Las novedades abiertas se precargan automáticamente de días anteriores y del turno
              actual. Verifique las unidades presentes, justifique cualquier ausencia y confirme el
              cierre con el responsable de turno.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print shrink-0">
            {!bloqueadoEdicion && metricas.pendientes > 0 && (
              <button
                type="button"
                onClick={onMarcarRestantesEnOficina}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar pendientes sin novedad como En oficina</span>
              </button>
            )}
            <button
              type="button"
              onClick={manejarExportarActaCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar CSV</span>
            </button>
            <button
              type="button"
              onClick={() => descargarActaOficialHtml(cierre, elementos, novedades)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              title="Generar archivo HTML oficial del acta para archivar en Google Drive (RF-12)"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Acta Drive (RF-12)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <p className="text-xs text-slate-500">Progreso de verificación</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {metricas.verificados} / {metricas.totalCodigos}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {metricas.pendientes === 0
                ? 'Todos los códigos revisados'
                : `${metricas.pendientes} pendiente(s) por resolver`}
            </p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Novedades arrastradas / vigentes</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {metricas.conNovedadPrecargada}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Códigos con préstamo, pérdida o salida abierta
            </p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Ausencias sin justificar (RF-07)</p>
            <p
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                metricas.sinJustificar > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {metricas.sinJustificar}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {metricas.sinJustificar > 0
                ? 'Bloquea la firma hasta asociar novedad'
                : 'Ninguna ausencia sin soporte'}
            </p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Estado de firma responsable</p>
            <p className="text-base font-semibold text-slate-900 mt-1.5 truncate">
              {bloqueadoPorFirma
                ? `${cierre.responsableNombre}`
                : problemas.length === 0
                  ? 'Listo para confirmar'
                  : 'Pendiente de completar'}
            </p>
            <p className="text-xs font-mono tabular-nums text-slate-500 mt-0.5 truncate">
              {bloqueadoPorFirma
                ? `${cierre.horaCierre} · ${cierre.selloConfirmacion}`
                : 'Requiere 0 ítems pendientes'}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(
            [
              { id: 'todos', label: `Todos (${cierre.detalles.length})` },
              { id: 'pendientes', label: `Por resolver (${problemas.length})` },
              { id: 'excepciones', label: 'Con ausencia o novedad' },
              { id: 'audiovisuales', label: 'Audiovisuales' },
              { id: 'deportivos', label: 'Deportivos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltro(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filtro === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por código o nombre..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
          />
        </div>
      </div>

      {(filtro === 'todos' ||
        filtro === 'pendientes' ||
        filtro === 'excepciones' ||
        filtro === 'audiovisuales') && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-surface">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                1. Equipos audiovisuales · Control por código individual
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada equipo tiene código único. Si no está en la oficina, debe tener exactamente una
                novedad abierta asociada.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Mostrando {filasAudiovisuales.length} equipo(s)
            </span>
          </div>

          {filasAudiovisuales.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay equipos audiovisuales que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Equipo y ubicación</th>
                    <th className="py-3 px-4">Novedad abierta precargada (RF-06)</th>
                    <th className="py-3 px-4">Resultado físico (RF-05)</th>
                    <th className="py-3 px-4 text-right no-print">Validación / Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filasAudiovisuales.map((fila) => {
                    const el = mapaElementos.get(fila.elementoCodigo);
                    if (!el) return null;
                    const abiertas = obtenerNovedadesAbiertasPorElemento(el.codigo, novedades);
                    const novActiva = abiertas[0];
                    const problema = mapaProblemas.get(el.codigo);
                    const diasAfuera = novActiva
                      ? calcularDiasAntiguedad(novActiva.fechaEvento, FECHA_HOY)
                      : 0;

                    return (
                      <tr
                        key={el.codigo}
                        className={`transition-colors ${
                          problema?.tipoProblema === 'ausencia_sin_novedad' ||
                          problema?.tipoProblema === 'exceso_en_oficina'
                            ? 'bg-red-50/40'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {el.codigo}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{el.nombre}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {el.tipo} · {el.ubicacion} · Estado: {el.estadoFisico}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {novActiva ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-medium text-amber-800">
                                {etiquetaTipoNovedad(novActiva.tipo)} · {novActiva.solicitanteNombre}
                              </div>
                              <div className="text-xs text-slate-500 font-mono tabular-nums">
                                {novActiva.id} · {novActiva.fechaEvento} {novActiva.horaEvento}
                                {diasAfuera > 0 ? ` · ${diasAfuera}d abierta` : ' · Hoy'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Sin novedad abierta</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {bloqueadoEdicion ? (
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                fila.resultado === 'en_oficina'
                                  ? 'text-emerald-700'
                                  : fila.resultado === 'no_esta'
                                    ? 'text-amber-800'
                                    : 'text-slate-500'
                              }`}
                            >
                              {fila.resultado === 'en_oficina' ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>En oficina</span>
                                </>
                              ) : fila.resultado === 'no_esta' ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>No está</span>
                                </>
                              ) : (
                                <span>Sin marcar</span>
                              )}
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                              <button
                                type="button"
                                onClick={() => onMarcarAudiovisual(el.codigo, 'en_oficina')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                  fila.resultado === 'en_oficina'
                                    ? 'bg-emerald-700 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                En oficina
                              </button>
                              <button
                                type="button"
                                onClick={() => onMarcarAudiovisual(el.codigo, 'no_esta')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                  fila.resultado === 'no_esta'
                                    ? 'bg-amber-700 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                No está
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right no-print">
                          {problema?.tipoProblema === 'ausencia_sin_novedad' ? (
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Exige novedad (RF-07)</span>
                              </span>
                              {!bloqueadoEdicion && (
                                <button
                                  type="button"
                                  onClick={() => onAbrirModalNovedad(el.codigo, 1)}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
                                >
                                  Justificar ausencia
                                </button>
                              )}
                            </div>
                          ) : problema?.tipoProblema === 'exceso_en_oficina' && novActiva ? (
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="text-xs font-medium text-red-700">
                                Novedad sigue abierta
                              </span>
                              {!bloqueadoEdicion && (
                                <button
                                  type="button"
                                  onClick={() => onAbrirModalCerrarNovedad(novActiva)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Cerrar devolución</span>
                                </button>
                              )}
                            </div>
                          ) : problema?.tipoProblema === 'sin_resultado' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Pendiente marcar</span>
                            </span>
                          ) : novActiva && !bloqueadoEdicion ? (
                            <div className="inline-flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Justificado</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => onAbrirModalCerrarNovedad(novActiva)}
                                className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap shrink-0"
                              >
                                Recibir hoy
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Conforme</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {(filtro === 'todos' ||
        filtro === 'pendientes' ||
        filtro === 'excepciones' ||
        filtro === 'deportivos') && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-surface">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                2. Elementos deportivos · Control por código general y cantidad
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registre cuántas unidades están físicamente en la oficina; la diferencia frente al
                total debe coincidir con las unidades en novedades abiertas.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Mostrando {filasDeportivas.length} grupo(s)
            </span>
          </div>

          {filasDeportivas.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay elementos deportivos que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Elemento deportivo</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Unidades afuera con novedad</th>
                    <th className="py-3 px-4 text-right">Conteo en oficina</th>
                    <th className="py-3 px-4 text-right no-print">Validación / Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filasDeportivas.map((fila) => {
                    const el = mapaElementos.get(fila.elementoCodigo);
                    if (!el) return null;
                    const abiertas = obtenerNovedadesAbiertasPorElemento(el.codigo, novedades);
                    const unidadesJustificadas = abiertas.reduce((acc, n) => acc + n.cantidad, 0);
                    const problema = mapaProblemas.get(el.codigo);

                    return (
                      <tr
                        key={el.codigo}
                        className={`transition-colors ${
                          problema && problema.tipoProblema !== 'sin_resultado'
                            ? 'bg-red-50/40'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {el.codigo}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{el.nombre}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {el.tipo} · {el.ubicacion} · Estado: {el.estadoFisico}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {fila.cantidadTotal}
                        </td>
                        <td className="py-3 px-4">
                          {abiertas.length > 0 ? (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-amber-800 font-mono tabular-nums">
                                {unidadesJustificadas} unid. justificadas en {abiertas.length}{' '}
                                novedad(es)
                              </div>
                              {abiertas.map((nov) => (
                                <div
                                  key={nov.id}
                                  className="text-xs text-slate-600 flex items-center gap-2 flex-wrap"
                                >
                                  <span>
                                    <span className="font-mono">{nov.cantidad}x</span>{' '}
                                    {etiquetaTipoNovedad(nov.tipo)} · {nov.solicitanteNombre}
                                  </span>
                                  {!bloqueadoEdicion && (
                                    <button
                                      type="button"
                                      onClick={() => onAbrirModalCerrarNovedad(nov)}
                                      className="text-blue-800 hover:underline font-medium no-print whitespace-nowrap shrink-0"
                                    >
                                      Recibir
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">0 unidades con novedad</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {bloqueadoEdicion ? (
                            <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                              {fila.unidadesEnOficina} en sala · {fila.unidadesAfuera} afuera
                            </span>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onActualizarDeportivo(
                                    el.codigo,
                                    Math.max(0, fila.unidadesEnOficina - 1),
                                    true
                                  )
                                }
                                className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                aria-label={`Restar unidad en oficina a ${el.nombre}`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={fila.cantidadTotal}
                                value={fila.unidadesEnOficina}
                                onChange={(e) =>
                                  onActualizarDeportivo(
                                    el.codigo,
                                    Number(e.target.value),
                                    true
                                  )
                                }
                                aria-label={`Unidades en oficina de ${el.nombre}`}
                                className="w-16 text-center rounded-md border border-slate-300 py-1 px-2 text-sm font-mono tabular-nums font-semibold text-slate-900 focus:border-blue-700 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  onActualizarDeportivo(
                                    el.codigo,
                                    Math.min(fila.cantidadTotal, fila.unidadesEnOficina + 1),
                                    true
                                  )
                                }
                                className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                aria-label={`Sumar unidad en oficina a ${el.nombre}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right no-print">
                          {problema?.tipoProblema === 'sin_resultado' ? (
                            <button
                              type="button"
                              disabled={bloqueadoEdicion}
                              onClick={() =>
                                onActualizarDeportivo(el.codigo, fila.unidadesEnOficina, true)
                              }
                              className="px-2.5 py-1 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
                            >
                              Confirmar {fila.unidadesEnOficina} en sala
                            </button>
                          ) : problema?.tipoProblema === 'ausencia_sin_novedad' ? (
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {problema.unidadesSinJustificar} sin novedad (RF-07)
                                </span>
                              </span>
                              {!bloqueadoEdicion && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAbrirModalNovedad(
                                      el.codigo,
                                      problema.unidadesSinJustificar
                                    )
                                  }
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
                                >
                                  Justificar {problema.unidadesSinJustificar} faltante(s)
                                </button>
                              )}
                            </div>
                          ) : problema?.tipoProblema === 'exceso_en_oficina' ? (
                            <span className="text-xs font-medium text-red-700">
                              Cierre devolución primero
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Cuadre verificado</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-6 print-surface">
        {bloqueadoPorFirma ? (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span>Cierre diario confirmado, firmado digitalmente y bloqueado</span>
                </div>
                <p className="text-xs text-slate-600 font-mono tabular-nums">
                  Responsable: {cierre.responsableNombre} ({cierre.responsableCorreo}) · Hora:{' '}
                  {cierre.horaCierre} · Sello: {cierre.selloConfirmacion}
                </p>
              </div>
              {!soloConsulta && (
                <button
                  type="button"
                  onClick={() => setMostrarFormCorreccion((v) => !v)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors no-print whitespace-nowrap shrink-0"
                >
                  {mostrarFormCorreccion ? 'Cancelar aclaración' : 'Registrar nota de corrección'}
                </button>
              )}
            </div>

            <div>
              <h3 className="text-xs font-medium text-slate-500">Observaciones del acta</h3>
              <p className="text-sm text-slate-800 mt-1">{cierre.observaciones}</p>
            </div>

            {cierre.correcciones.length > 0 && (
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-700">
                  Notas de corrección posteriores (RNF-03 · Sin alterar conteo original)
                </h3>
                <div className="divide-y divide-slate-200">
                  {cierre.correcciones.map((cor) => (
                    <div key={cor.id} className="py-2.5 text-xs space-y-0.5">
                      <div className="font-medium text-slate-900">
                        {cor.motivo} ·{' '}
                        <span className="font-mono tabular-nums font-normal text-slate-500">
                          {cor.fechaHora} · {cor.autorNombre} ({cor.autorCorreo})
                        </span>
                      </div>
                      <p className="text-slate-600">{cor.detalle}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mostrarFormCorreccion && !soloConsulta && (
              <form
                onSubmit={manejarGuardarCorreccion}
                className="border-t border-slate-200 pt-4 space-y-3 no-print"
              >
                <p className="text-xs text-slate-600">
                  Conforme a la regla RNF-03, un cierre firmado no se modifica; la aclaración queda
                  anexada con su nombre, correo institucional y fecha/hora exacta.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Motivo de la aclaración
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Aclaración en número de oficio"
                      value={motivoCorreccion}
                      onChange={(e) => setMotivoCorreccion(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Detalle de la corrección registrada
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Describa la precisión documental sin editar las filas originales..."
                      value={detalleCorreccion}
                      onChange={(e) => setDetalleCorreccion(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    Guardar adenda firmada
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={manejarFirmar} className="space-y-5 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  3. Confirmación y firma digital del responsable de turno (RF-08)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Una vez firmado el cierre diario, el registro queda bloqueado y las novedades
                  abiertas se conservarán para mañana.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-600">
                Cuenta activa: {usuarioActivo.correo}
              </span>
            </div>

            {problemas.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Firma bloqueada: quedan {problemas.length} requisito(s) por resolver antes de
                    cerrar el día
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-amber-900 pl-6 list-disc">
                  {problemas.slice(0, 5).map((p) => (
                    <li key={p.elementoCodigo}>
                      <span className="font-mono font-semibold">{p.elementoCodigo}</span> (
                      {p.elementoNombre}): {p.mensaje}
                    </li>
                  ))}
                  {problemas.length > 5 && (
                    <li>Y {problemas.length - 5} elemento(s) adicional(es) por marcar.</li>
                  )}
                </ul>
              </div>
            )}

            <div>
              <label
                htmlFor="observaciones-cierre"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Observaciones generales del cierre de turno
              </label>
              <textarea
                id="observaciones-cierre"
                rows={2}
                disabled={soloConsulta}
                placeholder="Anote entregas relevantes del turno, equipos en revisión técnica o recomendaciones para la apertura..."
                value={cierre.observaciones}
                onChange={(e) => onActualizarObservaciones(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none disabled:bg-slate-100"
              />
            </div>

            {usuarioActivo.rol !== RolUsuario.ResponsableTurno ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-700">
                  Está conectado como <span className="font-semibold">{usuarioActivo.nombre}</span>{' '}
                  ({usuarioActivo.cargoEtiqueta}). El conteo queda guardado, pero la firma final del
                  acta corresponde al <span className="font-semibold">Responsable de turno</span>.
                </div>
                {usuarioResponsableDemo && (
                  <button
                    type="button"
                    onClick={() => onCambiarUsuario(usuarioResponsableDemo)}
                    className="px-3.5 py-2 text-xs font-medium text-blue-900 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    Cambiar a Responsable de turno
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none max-w-2xl">
                  <input
                    type="checkbox"
                    checked={declaracionAceptada}
                    onChange={(e) => setDeclaracionAceptada(e.target.checked)}
                    disabled={problemas.length > 0}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                  />
                  <span>
                    Confirmo como responsable de turno (
                    <span className="font-mono">{usuarioActivo.correo}</span>) que verifiqué
                    físicamente las existencias en sala y que cada ausencia cuenta con novedad
                    registrada.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={problemas.length > 0 || !declaracionAceptada}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Confirmar y firmar cierre diario</span>
                </button>
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  );
};
