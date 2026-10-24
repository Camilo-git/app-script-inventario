import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Elemento, Novedad, TipoNovedad, UsuarioApp } from '../types/inventory';
import { etiquetaTipoNovedad } from '../utils/inventoryRules';

interface CerrarNovedadModalProps {
  novedad: Novedad | null;
  elemento?: Elemento;
  usuarioActivo: UsuarioApp;
  onCerrar: () => void;
  onConfirmarCierre: (novedadId: string, notaResolucion: string, horaCierre: string) => boolean;
}

export const CerrarNovedadModal: React.FC<CerrarNovedadModalProps> = ({
  novedad,
  elemento,
  usuarioActivo,
  onCerrar,
  onConfirmarCierre,
}) => {
  const [notaResolucion, setNotaResolucion] = useState('');
  const [horaCierre, setHoraCierre] = useState('17:15');

  useEffect(() => {
    if (novedad) {
      const ahora = new Date();
      setHoraCierre(
        `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
      );
      setNotaResolucion(
        novedad.tipo === TipoNovedad.Perdida
          ? 'Elemento repuesto y verificado por almacén e ingresado a estantería.'
          : 'Elemento recibido completo en ventanilla y verificado su funcionamiento.'
      );
    }
  }, [novedad]);

  if (!novedad) return null;

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onConfirmarCierre(novedad.id, notaResolucion, horaCierre);
    if (ok) {
      onCerrar();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cerrar-novedad-titulo"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="modal-cerrar-novedad-titulo" className="text-lg font-semibold text-slate-900">
              Cerrar novedad · {novedad.id}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registra devolución o resolución: {usuarioActivo.nombre}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={manejarSubmit} className="p-6 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-xs text-slate-700">
            <div className="font-medium text-slate-900 text-sm">
              <span className="font-mono">{novedad.elementoCodigo}</span> —{' '}
              {elemento?.nombre ?? 'Elemento'}
            </div>
            <div className="text-slate-600">
              {etiquetaTipoNovedad(novedad.tipo)} · Cantidad:{' '}
              <span className="font-mono font-medium tabular-nums">{novedad.cantidad}</span> ·
              Abierta el <span className="font-mono tabular-nums">{novedad.fechaEvento}</span> a las{' '}
              <span className="font-mono tabular-nums">{novedad.horaEvento}</span>
            </div>
            <div className="text-slate-600">
              Solicitante: <span className="font-medium text-slate-800">{novedad.solicitanteNombre}</span>{' '}
              · {novedad.solicitanteVinculo} · {novedad.solicitanteDependencia}
            </div>
          </div>

          <div>
            <label
              htmlFor="hora-devolucion"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Hora de devolución / resolución
            </label>
            <input
              id="hora-devolucion"
              type="time"
              required
              value={horaCierre}
              onChange={(e) => setHoraCierre(e.target.value)}
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="nota-resolucion"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Constancia de recepción o cierre
            </label>
            <textarea
              id="nota-resolucion"
              rows={3}
              required
              value={notaResolucion}
              onChange={(e) => setNotaResolucion(e.target.value)}
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
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              Confirmar devolución y cerrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
