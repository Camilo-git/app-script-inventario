import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Plus } from 'lucide-react';
import { FECHA_HOY } from '../data/seedData';
import {
  CategoriaElemento,
  Elemento,
  InventarioCierre,
  Novedad,
  VerificacionApertura,
} from '../types/inventory';
import { calcularUnidadesDisponibles } from '../utils/inventoryRules';

interface AperturaTurnoViewProps {
  elementos: Elemento[];
  novedades: Novedad[];
  cierres: InventarioCierre[];
  aperturas: VerificacionApertura[];
  soloConsulta: boolean;
  onRegistrarApertura: (
    conforme: boolean,
    revisados: number,
    diferencias: number,
    observaciones: string
  ) => boolean;
  onReportarDiferenciaComoNovedad: (elementoCodigo: string) => void;
}

export const AperturaTurnoView: React.FC<AperturaTurnoViewProps> = ({
  elementos,
  novedades,
  cierres,
  aperturas,
  soloConsulta,
  onRegistrarApertura,
  onReportarDiferenciaComoNovedad,
}) => {
  const activos = useMemo(() => elementos.filter((e) => e.activo), [elementos]);
  const [marcados, setMarcados] = useState<Record<string, 'conforme' | 'diferencia'>>(() => {
    const inicial: Record<string, 'conforme' | 'diferencia'> = {};
    for (const el of activos) {
      inicial[el.codigo] = 'conforme';
    }
    return inicial;
  });
  const [observaciones, setObservaciones] = useState('');

  const ultimoCierreFirmado = useMemo(() => {
    const firmados = cierres
      .filter((c) => c.estado === 'firmado')
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    return firmados[0];
  }, [cierres]);

  const diferenciasConteo = useMemo(
    () => Object.values(marcados).filter((v) => v === 'diferencia').length,
    [marcados]
  );

  const manejarGuardarApertura = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onRegistrarApertura(
      diferenciasConteo === 0,
      activos.length,
      diferenciasConteo,
      observaciones
    );
    if (ok) {
      setObservaciones('');
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">
              Control preventivo matutino · Recomendable pero no bloqueante (RF-09)
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Verificación opcional de apertura de turno
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Permite al auxiliar de la mañana contrastar rápidamente las existencias físicas frente
              al último cierre firmado. Si por atención al público no se alcanza a realizar, el
              cierre diario de la tarde sigue siendo obligatorio.
            </p>
          </div>
          {ultimoCierreFirmado && (
            <div className="text-xs text-slate-600 shrink-0">
              <div>Último cierre firmado de referencia:</div>
              <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                {ultimoCierreFirmado.fecha} · {ultimoCierreFirmado.horaCierre} (
                {ultimoCierreFirmado.responsableNombre})
              </div>
            </div>
          )}
        </div>

        <form onSubmit={manejarGuardarApertura} className="pt-5 space-y-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">Código</th>
                  <th className="py-2.5 px-4">Elemento</th>
                  <th className="py-2.5 px-4">Ubicación</th>
                  <th className="py-2.5 px-4 text-right">Esperado hoy en sala</th>
                  <th className="py-2.5 px-4 text-right">Chequeo rápido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {activos.map((el) => {
                  const esperadoEnSala = calcularUnidadesDisponibles(el, novedades);
                  const estadoFila = marcados[el.codigo] ?? 'conforme';

                  return (
                    <tr key={el.codigo} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">
                        {el.codigo}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{el.nombre}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-500">{el.ubicacion}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-800">
                        {el.categoria === CategoriaElemento.Audiovisual
                          ? esperadoEnSala === 1
                            ? 'En oficina (1)'
                            : 'Afuera con novedad (0)'
                          : `${esperadoEnSala} de ${el.cantidadTotal} unid.`}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                            <button
                              type="button"
                              disabled={soloConsulta}
                              onClick={() =>
                                setMarcados((prev) => ({ ...prev, [el.codigo]: 'conforme' }))
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                estadoFila === 'conforme'
                                  ? 'bg-white text-emerald-800 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Conforme
                            </button>
                            <button
                              type="button"
                              disabled={soloConsulta}
                              onClick={() =>
                                setMarcados((prev) => ({ ...prev, [el.codigo]: 'diferencia' }))
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                estadoFila === 'diferencia'
                                  ? 'bg-red-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Diferencia
                            </button>
                          </div>

                          {estadoFila === 'diferencia' && !soloConsulta && (
                            <button
                              type="button"
                              onClick={() => onReportarDiferenciaComoNovedad(el.codigo)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 whitespace-nowrap shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Abrir novedad</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!soloConsulta && (
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-t border-slate-200 pt-4">
              <div className="flex-1">
                <label
                  htmlFor="obs-apertura"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Observaciones de apertura ({FECHA_HOY})
                </label>
                <input
                  id="obs-apertura"
                  type="text"
                  placeholder="Ej. Estanterías revisadas al iniciar atención 7:30 a. m."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Guardar constancia de apertura</span>
              </button>
            </div>
          )}
        </form>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Registro reciente de verificaciones de apertura
          </h2>
        </div>
        <div className="divide-y divide-slate-200">
          {aperturas.map((ap) => (
            <div
              key={ap.id}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
            >
              <div>
                <div className="font-medium text-slate-900">
                  <span className="font-mono tabular-nums text-xs">{ap.fecha}</span> ·{' '}
                  <span className="font-mono tabular-nums text-xs">{ap.hora}</span> ·{' '}
                  {ap.auxiliarNombre}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{ap.observaciones}</p>
              </div>
              <div className="shrink-0">
                {ap.conformeConCierreAnterior ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Conforme ({ap.elementosVerificados} códigos)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{ap.diferenciasReportadas} diferencia(s) detectada(s)</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
