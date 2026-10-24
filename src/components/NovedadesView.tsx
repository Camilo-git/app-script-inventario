import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { FECHA_HOY } from '../data/seedData';
import {
  Elemento,
  EstadoNovedad,
  Novedad,
  TipoNovedad,
} from '../types/inventory';
import {
  calcularDiasAntiguedad,
  etiquetaTipoNovedad,
} from '../utils/inventoryRules';

interface NovedadesViewProps {
  novedades: Novedad[];
  elementos: Elemento[];
  soloConsulta: boolean;
  umbralEscalamientoDias: number;
  onAbrirNuevaNovedad: () => void;
  onAbrirCerrarNovedad: (nov: Novedad) => void;
}

export const NovedadesView: React.FC<NovedadesViewProps> = ({
  novedades,
  elementos,
  soloConsulta,
  umbralEscalamientoDias,
  onAbrirNuevaNovedad,
  onAbrirCerrarNovedad,
}) => {
  const [filtroEstado, setFiltroEstado] = useState<'abiertas' | 'cerradas' | 'todas'>('abiertas');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoNovedad>('todos');
  const [busqueda, setBusqueda] = useState('');

  const mapaElementos = useMemo(
    () => new Map(elementos.map((e) => [e.codigo, e])),
    [elementos]
  );

  const resumen = useMemo(() => {
    const abiertas = novedades.filter((n) => n.estado === EstadoNovedad.Abierta);
    const prestamosAbiertos = abiertas.filter((n) => n.tipo === TipoNovedad.Prestamo).length;
    const salidasAbiertas = abiertas.filter((n) => n.tipo === TipoNovedad.OrdenSalida).length;
    const perdidasAbiertas = abiertas.filter((n) => n.tipo === TipoNovedad.Perdida).length;
    const antiguas = abiertas.filter(
      (n) => calcularDiasAntiguedad(n.fechaEvento, FECHA_HOY) >= umbralEscalamientoDias
    ).length;

    return {
      totalAbiertas: abiertas.length,
      prestamosAbiertos,
      salidasAbiertas,
      perdidasAbiertas,
      antiguas,
    };
  }, [novedades, umbralEscalamientoDias]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return novedades.filter((n) => {
      if (filtroEstado === 'abiertas' && n.estado !== EstadoNovedad.Abierta) return false;
      if (filtroEstado === 'cerradas' && n.estado !== EstadoNovedad.Cerrada) return false;
      if (filtroTipo !== 'todos' && n.tipo !== filtroTipo) return false;

      if (q) {
        const el = mapaElementos.get(n.elementoCodigo);
        const texto = [
          n.id,
          n.elementoCodigo,
          el?.nombre ?? '',
          n.solicitanteNombre,
          n.solicitanteDependencia,
          n.eventoOrdenSalida ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [novedades, filtroEstado, filtroTipo, busqueda, mapaElementos]);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">
              Operación durante el día · Préstamos, órdenes de salida y pérdidas
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Registro y control de novedades
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Toda novedad abierta persiste automáticamente entre turnos hasta que se registre la
              devolución o resolución del elemento.
            </p>
          </div>
          {!soloConsulta && (
            <button
              type="button"
              onClick={onAbrirNuevaNovedad}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva novedad</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <p className="text-xs text-slate-500">Novedades abiertas hoy</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {resumen.totalAbiertas}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {resumen.prestamosAbiertos} préstamos · {resumen.salidasAbiertas} salidas
            </p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Pérdidas sin resolver</p>
            <p
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                resumen.perdidasAbiertas > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {resumen.perdidasAbiertas}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Pendientes de reposición o baja</p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">
              Antigüedad &ge; {umbralEscalamientoDias} días (RF-13)
            </p>
            <p
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                resumen.antiguas > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {resumen.antiguas}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Visibles en alerta para jefatura</p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Órdenes de salida vigentes</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {resumen.salidasAbiertas}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Con soporte de autorización externa</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                { id: 'abiertas', label: 'Abiertas' },
                { id: 'cerradas', label: 'Cerradas' },
                { id: 'todas', label: 'Todas' },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setFiltroEstado(op.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filtroEstado === op.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                { id: 'todos', label: 'Todos los tipos' },
                { id: TipoNovedad.Prestamo, label: 'Préstamos' },
                { id: TipoNovedad.OrdenSalida, label: 'Órdenes de salida' },
                { id: TipoNovedad.Perdida, label: 'Pérdidas' },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setFiltroTipo(op.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filtroTipo === op.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código, solicitante o evento..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
          />
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtradas.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">
              No se encontraron novedades para los criterios seleccionados
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Cuando se registren préstamos, pérdidas u órdenes de salida aparecerán aquí con su
              solicitante, hora y auxiliar responsable.
            </p>
            {!soloConsulta && (
              <button
                type="button"
                onClick={onAbrirNuevaNovedad}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar novedad</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">ID / Fecha</th>
                  <th className="py-3 px-4">Elemento y cantidad</th>
                  <th className="py-3 px-4">Tipo y detalle</th>
                  <th className="py-3 px-4">Solicitante</th>
                  <th className="py-3 px-4">Trazabilidad auxiliar</th>
                  <th className="py-3 px-4 text-right">Estado / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtradas.map((nov) => {
                  const el = mapaElementos.get(nov.elementoCodigo);
                  const dias = calcularDiasAntiguedad(nov.fechaEvento, FECHA_HOY);
                  const abierta = nov.estado === EstadoNovedad.Abierta;
                  const escalada = abierta && dias >= umbralEscalamientoDias;

                  return (
                    <tr key={nov.id} className="hover:bg-slate-50/70 transition-colors align-top">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {nov.id}
                        </div>
                        <div className="font-mono tabular-nums text-xs text-slate-500 mt-0.5">
                          {nov.fechaEvento} · {nov.horaEvento}
                        </div>
                        {abierta && (
                          <div
                            className={`text-xs mt-0.5 font-medium ${
                              escalada ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            {dias === 0 ? 'Abierta hoy' : `${dias} día(s) abierta`}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          <span className="font-mono text-xs font-semibold">
                            {nov.elementoCodigo}
                          </span>{' '}
                          · {el?.nombre ?? 'Elemento'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                          Cantidad: {nov.cantidad} unidad(es)
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div
                          className={`text-xs font-semibold ${
                            nov.tipo === TipoNovedad.Perdida
                              ? 'text-red-700'
                              : nov.tipo === TipoNovedad.OrdenSalida
                                ? 'text-blue-900'
                                : 'text-slate-900'
                          }`}
                        >
                          {etiquetaTipoNovedad(nov.tipo)}
                        </div>
                        {nov.eventoOrdenSalida && (
                          <div className="text-xs text-slate-700 mt-0.5 font-medium">
                            Evento: {nov.eventoOrdenSalida}
                          </div>
                        )}
                        {nov.referenciaAutorizacionExterna && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Soporte: {nov.referenciaAutorizacionExterna}
                          </div>
                        )}
                        <p className="text-xs text-slate-600 mt-1">{nov.observaciones}</p>
                        {nov.notaResolucion && (
                          <p className="text-xs text-emerald-800 mt-1">
                            Resolución: {nov.notaResolucion}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{nov.solicitanteNombre}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {nov.solicitanteVinculo} · {nov.solicitanteDependencia}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
                          Doc: {nov.solicitanteDocumento}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div>
                          Abrió: <span className="text-slate-900">{nov.auxiliarRegistroNombre}</span>
                        </div>
                        {nov.auxiliarCierreNombre && (
                          <div className="mt-1 text-emerald-800">
                            Cerró: {nov.auxiliarCierreNombre} ({nov.fechaCierre} {nov.horaCierre})
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {abierta ? (
                          <div className="inline-flex flex-col items-end gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                escalada ? 'text-amber-700' : 'text-slate-700'
                              }`}
                            >
                              {escalada ? (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>{escalada ? 'Abierta · Escalar' : 'Abierta'}</span>
                            </span>
                            {!soloConsulta && (
                              <button
                                type="button"
                                onClick={() => onAbrirCerrarNovedad(nov)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Cerrar / Recibir</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Cerrada</span>
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
    </div>
  );
};
