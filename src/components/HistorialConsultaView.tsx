import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  Search,
} from 'lucide-react';
import { FECHA_HOY } from '../data/seedData';
import {
  CategoriaElemento,
  Elemento,
  EstadoNovedad,
  InventarioCierre,
  Novedad,
  RegistroAuditoria,
  TipoNovedad,
  VerificacionApertura,
} from '../types/inventory';
import {
  calcularDiasAntiguedad,
  etiquetaTipoNovedad,
  exportarCsvDescarga,
} from '../utils/inventoryRules';
import { descargarActaOficialHtml, invocarAppsScript } from '../utils/gasBridge';

interface HistorialConsultaViewProps {
  elementos: Elemento[];
  novedades: Novedad[];
  cierres: InventarioCierre[];
  aperturas: VerificacionApertura[];
  auditoria: RegistroAuditoria[];
  umbralEscalamientoDias: number;
  soloConsulta: boolean;
  onCambiarUmbralEscalamiento: (dias: number) => void;
  onRegistrarCorreccionCierre: (cierreId: string, motivo: string, detalle: string) => boolean;
  onEnviarAvisoJefatura: (cantidadEscaladas: number, maxAntiguedad: number) => void;
}

type SubVista = 'cierres' | 'consulta_novedades' | 'hojas_sheets' | 'auditoria';

export const HistorialConsultaView: React.FC<HistorialConsultaViewProps> = ({
  elementos,
  novedades,
  cierres,
  aperturas,
  auditoria,
  umbralEscalamientoDias,
  soloConsulta,
  onCambiarUmbralEscalamiento,
  onRegistrarCorreccionCierre,
  onEnviarAvisoJefatura,
}) => {
  const [subVista, setSubVista] = useState<SubVista>('cierres');

  const cierresOrdenados = useMemo(
    () => [...cierres].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [cierres]
  );
  const [cierreSeleccionadoId, setCierreSeleccionadoId] = useState<string>(
    () => cierresOrdenados.find((c) => c.estado === 'firmado')?.id ?? cierresOrdenados[0]?.id ?? ''
  );

  const [busquedaElementoSolicitante, setBusquedaElementoSolicitante] = useState('');
  const [fechaDesde, setFechaDesde] = useState('2026-10-15');
  const [fechaHasta, setFechaHasta] = useState(FECHA_HOY);

  const [motivoAdenda, setMotivoAdenda] = useState('');
  const [detalleAdenda, setDetalleAdenda] = useState('');
  const [abiertoFormAdenda, setAbiertoFormAdenda] = useState(false);

  const [hojaActiva, setHojaActiva] = useState<
    'Elementos' | 'Novedades' | 'Inventarios' | 'Detalle_Inventario'
  >('Inventarios');

  const mapaElementos = useMemo(
    () => new Map(elementos.map((e) => [e.codigo, e])),
    [elementos]
  );

  const indicadores = useMemo(() => {
    const firmados = cierres.filter((c) => c.estado === 'firmado').length;
    const abiertas = novedades.filter((n) => n.estado === EstadoNovedad.Abierta);
    const unidadesAfuera = abiertas.reduce((acc, n) => acc + n.cantidad, 0);
    const escaladas = abiertas.filter(
      (n) => calcularDiasAntiguedad(n.fechaEvento, FECHA_HOY) >= umbralEscalamientoDias
    );
    const maxAntiguedad = abiertas.reduce(
      (max, n) => Math.max(max, calcularDiasAntiguedad(n.fechaEvento, FECHA_HOY)),
      0
    );
    const perdidas = novedades.filter(
      (n) => n.tipo === TipoNovedad.Perdida && n.estado === EstadoNovedad.Abierta
    ).length;

    return {
      firmados,
      totalDiasRegistrados: cierres.length,
      abiertasCount: abiertas.length,
      unidadesAfuera,
      escaladas,
      maxAntiguedad,
      perdidas,
      aperturasCount: aperturas.length,
    };
  }, [cierres, novedades, aperturas, umbralEscalamientoDias]);

  const cierreDetalleActual = useMemo(
    () =>
      cierresOrdenados.find((c) => c.id === cierreSeleccionadoId) ?? cierresOrdenados[0],
    [cierresOrdenados, cierreSeleccionadoId]
  );

  const novedadesConsultadas = useMemo(() => {
    const q = busquedaElementoSolicitante.trim().toLowerCase();
    return novedades.filter((n) => {
      if (fechaDesde && n.fechaEvento < fechaDesde) return false;
      if (fechaHasta && n.fechaEvento > fechaHasta) return false;
      if (q) {
        const el = mapaElementos.get(n.elementoCodigo);
        const texto = `${n.elementoCodigo} ${el?.nombre ?? ''} ${n.solicitanteNombre} ${n.solicitanteDependencia} ${n.id}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [novedades, fechaDesde, fechaHasta, busquedaElementoSolicitante, mapaElementos]);

  const exportarHojaSeleccionada = () => {
    if (hojaActiva === 'Elementos') {
      exportarCsvDescarga(
        'Hoja_1_Elementos.csv',
        ['Codigo', 'Nombre', 'Categoria', 'Tipo', 'Estado_Fisico', 'Activo', 'Cantidad_Total'],
        elementos.map((e) => [
          e.codigo,
          e.nombre,
          e.categoria,
          e.tipo,
          e.estadoFisico,
          e.activo ? 'SI' : 'NO',
          String(e.cantidadTotal),
        ])
      );
    } else if (hojaActiva === 'Novedades') {
      exportarCsvDescarga(
        'Hoja_2_Novedades.csv',
        [
          'ID_Novedad',
          'Codigo_Elemento',
          'Tipo',
          'Cantidad',
          'Solicitante',
          'Vinculo',
          'Fecha_Evento',
          'Hora_Evento',
          'Auxiliar_Registro',
          'Estado',
          'Fecha_Cierre',
          'Hora_Cierre',
          'Observaciones',
        ],
        novedades.map((n) => [
          n.id,
          n.elementoCodigo,
          etiquetaTipoNovedad(n.tipo),
          String(n.cantidad),
          n.solicitanteNombre,
          n.solicitanteVinculo,
          n.fechaEvento,
          n.horaEvento,
          n.auxiliarRegistroCorreo,
          n.estado,
          n.fechaCierre ?? '',
          n.horaCierre ?? '',
          n.observaciones,
        ])
      );
    } else if (hojaActiva === 'Inventarios') {
      exportarCsvDescarga(
        'Hoja_3_Inventarios.csv',
        [
          'ID_Cierre',
          'Fecha',
          'Estado',
          'Responsable_Turno',
          'Correo_Responsable',
          'Hora_Cierre',
          'Confirmacion_Digital',
          'Observaciones',
        ],
        cierresOrdenados.map((c) => [
          c.id,
          c.fecha,
          c.estado,
          c.responsableNombre ?? '',
          c.responsableCorreo ?? '',
          c.horaCierre ?? '',
          c.selloConfirmacion ?? '',
          c.observaciones,
        ])
      );
    } else {
      const filasDetalle: string[][] = [];
      for (const c of cierresOrdenados) {
        for (const d of c.detalles) {
          filasDetalle.push([
            c.id,
            c.fecha,
            d.elementoCodigo,
            d.resultado,
            String(d.unidadesEnOficina),
            String(d.unidadesAfuera),
            d.novedadIds.join(';'),
          ]);
        }
      }
      exportarCsvDescarga(
        'Hoja_4_Detalle_Inventario.csv',
        [
          'ID_Cierre',
          'Fecha',
          'Codigo_Elemento',
          'Resultado',
          'Unidades_En_Oficina',
          'Unidades_Afuera',
          'Novedades_Asociadas',
        ],
        filasDetalle
      );
    }
  };

  const manejarEnviarAdenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cierreDetalleActual) return;
    const ok = onRegistrarCorreccionCierre(cierreDetalleActual.id, motivoAdenda, detalleAdenda);
    if (ok) {
      setMotivoAdenda('');
      setDetalleAdenda('');
      setAbiertoFormAdenda(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch border-b border-slate-200">
          <div className="lg:col-span-8 p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs text-slate-500">
                Consultas, trazabilidad e indicadores de gestión · RF-10 y RF-13
              </p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                Historial, cierres firmados y avisos a jefatura
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                Consulte las actas firmadas sin posibilidad de edición, filtre el historial por
                elemento, solicitante o fecha, y supervise las novedades que superan el umbral de
                permanencia fuera de la oficina.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-700">
                {indicadores.escaladas.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Aviso a jefatura: {indicadores.escaladas.length} novedad(es) llevan{' '}
                      {umbralEscalamientoDias} o más días sin regresar (máx.{' '}
                      {indicadores.maxAntiguedad} días).
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Ninguna novedad supera el umbral de escalamiento configurado.</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <label htmlFor="umbral-dias" className="text-xs text-slate-500 whitespace-nowrap">
                    Escalar tras (días):
                  </label>
                  <input
                    id="umbral-dias"
                    type="number"
                    min={1}
                    max={30}
                    value={umbralEscalamientoDias}
                    onChange={(e) => onCambiarUmbralEscalamiento(Number(e.target.value))}
                    className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs font-mono tabular-nums text-center text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                {indicadores.escaladas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onEnviarAvisoJefatura(indicadores.escaladas.length, indicadores.maxAntiguedad);
                      void invocarAppsScript(
                        'enviarAlertaJefatura',
                        'jefatura.medios@institucion.edu.co',
                        umbralEscalamientoDias
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-amber-950 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    Notificar a Jefatura (RF-13)
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-900 text-slate-100 p-6 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-blue-300 font-medium">
                <Archive className="w-4 h-4" />
                <span>Oficina de Medios Educativos</span>
              </div>
              <h2 className="text-base font-semibold text-white mt-2">
                Inventario diario certificado
              </h2>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Control estricto de préstamos para equipos audiovisuales (código individual) y
                material deportivo (código general y cantidad).
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 font-mono">
              Base de datos: 4 tablas relacionales en Google Sheets
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 p-6">
          <div>
            <p className="text-xs text-slate-500">Cierres firmados</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {indicadores.firmados} / {indicadores.totalDiasRegistrados}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Cumplimiento diario</p>
          </div>

          <div className="sm:border-l sm:border-slate-200 sm:pl-6">
            <p className="text-xs text-slate-500">Novedades abiertas</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {indicadores.abiertasCount}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {indicadores.unidadesAfuera} unidad(es) fuera de sala
            </p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Mayor antigüedad</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
              {indicadores.maxAntiguedad}d
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Días continuos sin regresar</p>
          </div>

          <div className="sm:border-l sm:border-slate-200 sm:pl-6">
            <p className="text-xs text-slate-500">Pérdidas activas</p>
            <p
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                indicadores.perdidas > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {indicadores.perdidas}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">En gestión de reposición</p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Aperturas verificadas</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {indicadores.aperturasCount}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Controles matutinos registrados</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {(
          [
            { id: 'cierres', label: 'Actas de cierre diario' },
            { id: 'consulta_novedades', label: 'Consulta histórica (RF-10)' },
            { id: 'hojas_sheets', label: 'Modelo Google Sheets (4 pestañas)' },
            { id: 'auditoria', label: `Auditoría de acciones (${auditoria.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubVista(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subVista === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subVista === 'cierres' && cierreDetalleActual && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {cierresOrdenados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCierreSeleccionadoId(c.id)}
                  className={`px-3 py-1.5 text-xs font-mono tabular-nums font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    cierreDetalleActual.id === c.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {c.fecha} · {c.estado === 'firmado' ? 'Firmado' : 'En curso'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => descargarActaOficialHtml(cierreDetalleActual, elementos, novedades)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Acta Drive (RF-12)</span>
              </button>
              {cierreDetalleActual.estado === 'firmado' && !soloConsulta && (
                <button
                  type="button"
                  onClick={() => setAbiertoFormAdenda((v) => !v)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  {abiertoFormAdenda ? 'Cancelar nota' : 'Añadir nota aclaratoria (RNF-03)'}
                </button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-900 text-sm">
                  Acta {cierreDetalleActual.id}
                </span>{' '}
                · Fecha <span className="font-mono">{cierreDetalleActual.fecha}</span>
              </div>
              {cierreDetalleActual.estado === 'firmado' ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-emerald-800 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    Firmado por {cierreDetalleActual.responsableCorreo} ·{' '}
                    {cierreDetalleActual.horaCierre} · {cierreDetalleActual.selloConfirmacion}
                  </span>
                </span>
              ) : (
                <span className="text-amber-700 font-medium">Cierre aún sin firmar hoy</span>
              )}
            </div>

            {cierreDetalleActual.observaciones && (
              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <span className="font-semibold text-slate-900">Observaciones del cierre:</span>{' '}
                {cierreDetalleActual.observaciones}
              </p>
            )}

            {abiertoFormAdenda && cierreDetalleActual.estado === 'firmado' && !soloConsulta && (
              <form
                onSubmit={manejarEnviarAdenda}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Motivo de la corrección"
                    value={motivoAdenda}
                    onChange={(e) => setMotivoAdenda(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Detalle verificable (el cierre firmado permanece intacto)"
                    value={detalleAdenda}
                    onChange={(e) => setDetalleAdenda(e.target.value)}
                    className="md:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
                  >
                    Registrar corrección con fecha y autor
                  </button>
                </div>
              </form>
            )}

            {cierreDetalleActual.correcciones.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700">
                  Correcciones / aclaraciones posteriores registradas (RNF-03)
                </h3>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg px-4">
                  {cierreDetalleActual.correcciones.map((c) => (
                    <div key={c.id} className="py-2.5 text-xs">
                      <span className="font-semibold text-slate-900">{c.motivo}</span> ·{' '}
                      <span className="font-mono text-slate-500">
                        {c.fechaHora} · {c.autorNombre} ({c.autorCorreo})
                      </span>
                      <p className="text-slate-600 mt-0.5">{c.detalle}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Elemento</th>
                    <th className="py-2.5 px-4">Categoría</th>
                    <th className="py-2.5 px-4 text-right">En oficina</th>
                    <th className="py-2.5 px-4 text-right">Afuera</th>
                    <th className="py-2.5 px-4">Novedades asociadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {cierreDetalleActual.detalles.map((d) => {
                    const el = mapaElementos.get(d.elementoCodigo);
                    return (
                      <tr key={d.elementoCodigo} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                          {d.elementoCodigo}
                        </td>
                        <td className="py-2.5 px-4 text-slate-800">{el?.nombre ?? '-'}</td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {d.categoria === CategoriaElemento.Audiovisual
                            ? 'Audiovisual'
                            : 'Deportivo'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-emerald-700">
                          {d.unidadesEnOficina}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-700">
                          {d.unidadesAfuera}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {d.novedadIds.length > 0 ? d.novedadIds.join(', ') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {subVista === 'consulta_novedades' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Elemento, código o solicitante
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={busquedaElementoSolicitante}
                  onChange={(e) => setBusquedaElementoSolicitante(e.target.value)}
                  placeholder="Ej. AV-POR-003, Adriana Salazar, Voleibol..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Novedad</th>
                  <th className="py-3 px-4">Elemento</th>
                  <th className="py-3 px-4">Solicitante</th>
                  <th className="py-3 px-4">Apertura</th>
                  <th className="py-3 px-4">Cierre / Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {novedadesConsultadas.map((n) => {
                  const el = mapaElementos.get(n.elementoCodigo);
                  return (
                    <tr key={n.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {n.id} · {etiquetaTipoNovedad(n.tipo)} ({n.cantidad})
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        <span className="font-mono font-medium">{n.elementoCodigo}</span> —{' '}
                        {el?.nombre ?? ''}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{n.solicitanteNombre}</div>
                        <div className="text-slate-500">
                          {n.solicitanteVinculo} · {n.solicitanteDependencia}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                        {n.fechaEvento} {n.horaEvento}
                        <div className="font-sans text-slate-400">{n.auxiliarRegistroNombre}</div>
                      </td>
                      <td className="py-3 px-4">
                        {n.estado === EstadoNovedad.Cerrada ? (
                          <div className="text-emerald-700 font-medium">
                            Cerrada ·{' '}
                            <span className="font-mono tabular-nums">
                              {n.fechaCierre} {n.horaCierre}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-700 font-medium">Sigue abierta</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {subVista === 'hojas_sheets' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                ['Elementos', 'Novedades', 'Inventarios', 'Detalle_Inventario'] as const
              ).map((nombreHoja) => (
                <button
                  key={nombreHoja}
                  type="button"
                  onClick={() => setHojaActiva(nombreHoja)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    hojaActiva === nombreHoja
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{nombreHoja}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={exportarHojaSeleccionada}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar pestaña {hojaActiva}.csv</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            {hojaActiva === 'Elementos' && (
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-4">codigo</th>
                    <th className="py-2.5 px-4">nombre</th>
                    <th className="py-2.5 px-4">categoria</th>
                    <th className="py-2.5 px-4">tipo</th>
                    <th className="py-2.5 px-4">estado_fisico</th>
                    <th className="py-2.5 px-4">activo</th>
                    <th className="py-2.5 px-4 text-right">cantidad_total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {elementos.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 px-4 font-semibold">{e.codigo}</td>
                      <td className="py-2 px-4 font-sans">{e.nombre}</td>
                      <td className="py-2 px-4">{e.categoria}</td>
                      <td className="py-2 px-4 font-sans">{e.tipo}</td>
                      <td className="py-2 px-4 font-sans">{e.estadoFisico}</td>
                      <td className="py-2 px-4">{e.activo ? 'SI' : 'NO'}</td>
                      <td className="py-2 px-4 text-right">{e.cantidadTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {hojaActiva === 'Novedades' && (
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-4">id_novedad</th>
                    <th className="py-2.5 px-4">elemento_codigo</th>
                    <th className="py-2.5 px-4">tipo</th>
                    <th className="py-2.5 px-4 text-right">cantidad</th>
                    <th className="py-2.5 px-4">solicitante</th>
                    <th className="py-2.5 px-4">fecha_hora</th>
                    <th className="py-2.5 px-4">auxiliar_registro</th>
                    <th className="py-2.5 px-4">estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {novedades.map((n) => (
                    <tr key={n.id}>
                      <td className="py-2 px-4 font-semibold">{n.id}</td>
                      <td className="py-2 px-4">{n.elementoCodigo}</td>
                      <td className="py-2 px-4">{n.tipo}</td>
                      <td className="py-2 px-4 text-right">{n.cantidad}</td>
                      <td className="py-2 px-4 font-sans">
                        {n.solicitanteNombre} ({n.solicitanteVinculo})
                      </td>
                      <td className="py-2 px-4">
                        {n.fechaEvento} {n.horaEvento}
                      </td>
                      <td className="py-2 px-4">{n.auxiliarRegistroCorreo}</td>
                      <td className="py-2 px-4">{n.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {hojaActiva === 'Inventarios' && (
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-4">id_cierre</th>
                    <th className="py-2.5 px-4">fecha</th>
                    <th className="py-2.5 px-4">estado</th>
                    <th className="py-2.5 px-4">responsable_turno</th>
                    <th className="py-2.5 px-4">hora_cierre</th>
                    <th className="py-2.5 px-4">confirmacion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cierresOrdenados.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 px-4 font-semibold">{c.id}</td>
                      <td className="py-2 px-4">{c.fecha}</td>
                      <td className="py-2 px-4">{c.estado}</td>
                      <td className="py-2 px-4">{c.responsableCorreo ?? '—'}</td>
                      <td className="py-2 px-4">{c.horaCierre ?? '—'}</td>
                      <td className="py-2 px-4">{c.selloConfirmacion ?? 'PENDIENTE'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {hojaActiva === 'Detalle_Inventario' && (
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-4">id_cierre</th>
                    <th className="py-2.5 px-4">elemento_codigo</th>
                    <th className="py-2.5 px-4">resultado</th>
                    <th className="py-2.5 px-4 text-right">en_oficina</th>
                    <th className="py-2.5 px-4 text-right">afuera</th>
                    <th className="py-2.5 px-4">novedad_asociada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cierresOrdenados[0]?.detalles.map((d) => (
                    <tr key={`${cierresOrdenados[0].id}-${d.elementoCodigo}`}>
                      <td className="py-2 px-4">{cierresOrdenados[0].id}</td>
                      <td className="py-2 px-4 font-semibold">{d.elementoCodigo}</td>
                      <td className="py-2 px-4">{d.resultado}</td>
                      <td className="py-2 px-4 text-right">{d.unidadesEnOficina}</td>
                      <td className="py-2 px-4 text-right">{d.unidadesAfuera}</td>
                      <td className="py-2 px-4">{d.novedadIds.join(' | ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {subVista === 'auditoria' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Registro inmutable de quién hizo cada acción y cuándo (RNF-01)
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {auditoria.map((item) => (
              <div
                key={item.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900">{item.accion}</span> ·{' '}
                  <span className="text-slate-600">{item.detalle}</span>
                </div>
                <div className="font-mono tabular-nums text-slate-500 shrink-0">
                  {item.fechaHora} · {item.usuarioCorreo}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
