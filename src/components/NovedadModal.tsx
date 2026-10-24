import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { NuevaNovedadInput } from '../hooks/useInventoryStore';
import {
  CategoriaElemento,
  Elemento,
  Novedad,
  TipoNovedad,
  UsuarioApp,
  VinculoSolicitante,
} from '../types/inventory';
import { calcularUnidadesDisponibles } from '../utils/inventoryRules';

interface NovedadModalProps {
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (input: NuevaNovedadInput) => boolean;
  elementos: Elemento[];
  novedades: Novedad[];
  usuarioActivo: UsuarioApp;
  elementoPreseleccionado?: string;
  cantidadPreseleccionada?: number;
}

export const NovedadModal: React.FC<NovedadModalProps> = ({
  abierto,
  onCerrar,
  onGuardar,
  elementos,
  novedades,
  usuarioActivo,
  elementoPreseleccionado,
  cantidadPreseleccionada,
}) => {
  const elementosElegibles = useMemo(() => {
    return elementos
      .filter((e) => e.activo)
      .map((el) => ({
        elemento: el,
        disponibles: calcularUnidadesDisponibles(el, novedades),
      }));
  }, [elementos, novedades]);

  const primerDisponible = useMemo(() => {
    if (elementoPreseleccionado) return elementoPreseleccionado;
    const libre = elementosElegibles.find((x) => x.disponibles > 0);
    return libre?.elemento.codigo ?? elementosElegibles[0]?.elemento.codigo ?? '';
  }, [elementoPreseleccionado, elementosElegibles]);

  const [elementoCodigo, setElementoCodigo] = useState(primerDisponible);
  const [tipo, setTipo] = useState<TipoNovedad>(TipoNovedad.Prestamo);
  const [cantidad, setCantidad] = useState<number>(cantidadPreseleccionada ?? 1);
  const [solicitanteNombre, setSolicitanteNombre] = useState('');
  const [solicitanteDocumento, setSolicitanteDocumento] = useState('');
  const [solicitanteDependencia, setSolicitanteDependencia] = useState('');
  const [solicitanteVinculo, setSolicitanteVinculo] = useState<VinculoSolicitante>('Docente');
  const [horaEvento, setHoraEvento] = useState('16:30');
  const [eventoOrdenSalida, setEventoOrdenSalida] = useState('');
  const [referenciaAutorizacionExterna, setReferenciaAutorizacionExterna] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [errorLocal, setErrorLocal] = useState('');

  useEffect(() => {
    if (abierto) {
      setElementoCodigo(primerDisponible);
      setCantidad(cantidadPreseleccionada && cantidadPreseleccionada > 0 ? cantidadPreseleccionada : 1);
      setTipo(TipoNovedad.Prestamo);
      setSolicitanteNombre('');
      setSolicitanteDocumento('');
      setSolicitanteDependencia('');
      setSolicitanteVinculo('Docente');
      const ahora = new Date();
      setHoraEvento(
        `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
      );
      setEventoOrdenSalida('');
      setReferenciaAutorizacionExterna('');
      setObservaciones('');
      setErrorLocal('');
    }
  }, [abierto, primerDisponible, cantidadPreseleccionada]);

  if (!abierto) return null;

  const infoActual = elementosElegibles.find((x) => x.elemento.codigo === elementoCodigo);
  const esDeportivo = infoActual?.elemento.categoria === CategoriaElemento.Deportivo;
  const maxDisponibles = infoActual?.disponibles ?? 0;

  const manejarEnvio = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal('');

    if (!elementoCodigo) {
      setErrorLocal('Seleccione un elemento del catálogo.');
      return;
    }
    if (maxDisponibles <= 0) {
      setErrorLocal(
        'Este elemento no tiene unidades disponibles en oficina (ya cuenta con novedad abierta).'
      );
      return;
    }
    if (!solicitanteNombre.trim() || !solicitanteDependencia.trim()) {
      setErrorLocal('Complete el nombre del solicitante y su programa o dependencia.');
      return;
    }
    if (tipo === TipoNovedad.OrdenSalida && !eventoOrdenSalida.trim()) {
      setErrorLocal('En una orden de salida es obligatorio registrar el evento o destino.');
      return;
    }

    const ok = onGuardar({
      elementoCodigo,
      tipo,
      cantidad: esDeportivo ? cantidad : 1,
      solicitanteNombre,
      solicitanteDocumento: solicitanteDocumento || 'Sin documento',
      solicitanteDependencia,
      solicitanteVinculo,
      horaEvento,
      eventoOrdenSalida,
      referenciaAutorizacionExterna,
      observaciones:
        observaciones.trim() ||
        (tipo === TipoNovedad.Prestamo
          ? 'Préstamo registrado en ventanilla de Medios Educativos.'
          : tipo === TipoNovedad.Perdida
            ? 'Pérdida reportada para gestión de reposición.'
            : 'Salida registrada con autorización externa.'),
    });

    if (ok) {
      onCerrar();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-novedad-titulo"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="modal-novedad-titulo" className="text-lg font-semibold text-slate-900">
              Registrar novedad de inventario
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Auxiliar que reporta: {usuarioActivo.nombre} ({usuarioActivo.correo})
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={manejarEnvio} className="p-6 space-y-5">
          {elementoPreseleccionado && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
              Justificando ausencia detectada en el cierre diario para el código{' '}
              <span className="font-mono font-semibold">{elementoPreseleccionado}</span>. Al guardar,
              quedará vinculada automáticamente al renglón del cierre.
            </div>
          )}

          {errorLocal && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
              {errorLocal}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Tipo de novedad
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { valor: TipoNovedad.Prestamo, etiqueta: 'Préstamo' },
                  { valor: TipoNovedad.OrdenSalida, etiqueta: 'Orden de salida' },
                  { valor: TipoNovedad.Perdida, etiqueta: 'Pérdida' },
                ] as const
              ).map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => setTipo(op.valor)}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    tipo === op.valor
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="select-elemento"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Elemento del catálogo
              </label>
              <select
                id="select-elemento"
                value={elementoCodigo}
                onChange={(e) => {
                  setElementoCodigo(e.target.value);
                  setCantidad(1);
                }}
                disabled={Boolean(elementoPreseleccionado)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none disabled:bg-slate-100"
              >
                {elementosElegibles.map(({ elemento, disponibles }) => (
                  <option
                    key={elemento.codigo}
                    value={elemento.codigo}
                    disabled={disponibles === 0 && elemento.codigo !== elementoPreseleccionado}
                  >
                    {elemento.codigo} — {elemento.nombre} (
                    {elemento.categoria === CategoriaElemento.Audiovisual
                      ? disponibles > 0
                        ? 'En oficina'
                        : 'Con novedad abierta'
                      : `Disp: ${disponibles}/${elemento.cantidadTotal}`}
                    )
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="input-cantidad"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Cantidad {esDeportivo ? `(máx. ${maxDisponibles})` : '(individual)'}
              </label>
              <input
                id="input-cantidad"
                type="number"
                min={1}
                max={Math.max(1, maxDisponibles)}
                value={esDeportivo ? cantidad : 1}
                disabled={!esDeportivo}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-700 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="input-solicitante"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Nombre completo del solicitante
                </label>
                <input
                  id="input-solicitante"
                  type="text"
                  required
                  placeholder="Ej. Prof. Camilo Andrés Rojas"
                  value={solicitanteNombre}
                  onChange={(e) => setSolicitanteNombre(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="select-vinculo"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Vínculo institucional
                </label>
                <select
                  id="select-vinculo"
                  value={solicitanteVinculo}
                  onChange={(e) => setSolicitanteVinculo(e.target.value as VinculoSolicitante)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="Docente">Docente</option>
                  <option value="Estudiante">Estudiante</option>
                  <option value="Administrativo">Administrativo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="input-documento"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Código / Documento
                </label>
                <input
                  id="input-documento"
                  type="text"
                  placeholder="Ej. 1020458912"
                  value={solicitanteDocumento}
                  onChange={(e) => setSolicitanteDocumento(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="input-dependencia"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Programa o dependencia
                </label>
                <input
                  id="input-dependencia"
                  type="text"
                  required
                  placeholder="Ej. Facultad de Educación"
                  value={solicitanteDependencia}
                  onChange={(e) => setSolicitanteDependencia(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="input-hora"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Hora del evento
                </label>
                <input
                  id="input-hora"
                  type="time"
                  required
                  value={horaEvento}
                  onChange={(e) => setHoraEvento(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {tipo === TipoNovedad.OrdenSalida && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs text-slate-600">
                La autorización de la orden de salida se gestiona fuera de la aplicación; aquí se
                deja constancia trazable del evento y soporte.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="input-evento-salida"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Evento o actividad externa
                  </label>
                  <input
                    id="input-evento-salida"
                    type="text"
                    required
                    placeholder="Ej. Jornada Académica Sede Norte"
                    value={eventoOrdenSalida}
                    onChange={(e) => setEventoOrdenSalida(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-ref-salida"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Soporte / Oficio externo (opcional)
                  </label>
                  <input
                    id="input-ref-salida"
                    type="text"
                    placeholder="Ej. Oficio Decanatura #118"
                    value={referenciaAutorizacionExterna}
                    onChange={(e) => setReferenciaAutorizacionExterna(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="textarea-obs"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Observaciones / accesorios entregados
            </label>
            <textarea
              id="textarea-obs"
              rows={2}
              placeholder="Ej. Se entrega con cargador original, cable HDMI y maletín."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              Guardar novedad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
