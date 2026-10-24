import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Menu,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';
import { AperturaTurnoView } from './components/AperturaTurnoView';
import { CatalogoView } from './components/CatalogoView';
import { CerrarNovedadModal } from './components/CerrarNovedadModal';
import { CierreDiarioView } from './components/CierreDiarioView';
import { GuiaAppsScriptModal } from './components/GuiaAppsScriptModal';
import { HistorialConsultaView } from './components/HistorialConsultaView';
import { NovedadesView } from './components/NovedadesView';
import { NovedadModal } from './components/NovedadModal';
import { useInventoryStore } from './hooks/useInventoryStore';
import { EstadoNovedad, Novedad, VistaNavegacion } from './types/inventory';

const ENLACES_NAV: { id: VistaNavegacion; etiqueta: string }[] = [
  { id: 'cierre', etiqueta: 'Cierre diario' },
  { id: 'novedades', etiqueta: 'Novedades' },
  { id: 'apertura', etiqueta: 'Apertura' },
  { id: 'catalogo', etiqueta: 'Catálogo' },
  { id: 'historial', etiqueta: 'Historial' },
];

export default function App() {
  const {
    elementos,
    novedades,
    cierres,
    cierreHoy,
    aperturas,
    auditoria,
    umbralEscalamientoDias,
    usuarioActivo,
    usuariosAutorizados,
    soloConsulta,
    avisoSistema,
    setUsuarioActivo,
    limpiarAviso,
    registrarNovedad,
    cerrarNovedad,
    marcarResultadoAudiovisualCierre,
    actualizarConteoDeportivoCierre,
    marcarRestantesEnOficina,
    actualizarObservacionesCierre,
    firmarYBloquearCierre,
    registrarCorreccionCierreFirmado,
    guardarElementoCatalogo,
    registrarVerificacionApertura,
    actualizarUmbralEscalamiento,
    enviarAvisoJefatura,
    restablecerDatosDemo,
  } = useInventoryStore();

  const [vistaActiva, setVistaActiva] = useState<VistaNavegacion>('cierre');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  const [modalNuevaAbierto, setModalNuevaAbierto] = useState(false);
  const [modalGuiaAppsScriptAbierto, setModalGuiaAppsScriptAbierto] = useState(false);
  const [elementoPreseleccionado, setElementoPreseleccionado] = useState<string | undefined>(
    undefined
  );
  const [cantidadPreseleccionada, setCantidadPreseleccionada] = useState<number | undefined>(
    undefined
  );
  const [novedadPorCerrar, setNovedadPorCerrar] = useState<Novedad | null>(null);

  const conteoAbiertas = useMemo(
    () => novedades.filter((n) => n.estado === EstadoNovedad.Abierta).length,
    [novedades]
  );

  const abrirModalNovedad = (codigoElemento?: string, cantidadFaltante?: number) => {
    setElementoPreseleccionado(codigoElemento);
    setCantidadPreseleccionada(cantidadFaltante);
    setModalNuevaAbierto(true);
  };

  const elementoDeNovedadPorCerrar = useMemo(
    () =>
      novedadPorCerrar
        ? elementos.find((e) => e.codigo === novedadPorCerrar.elementoCodigo)
        : undefined,
    [novedadPorCerrar, elementos]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center justify-between gap-8 no-print">
        <a
          href="#cierre"
          onClick={(e) => {
            e.preventDefault();
            setVistaActiva('cierre');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-[var(--font-display)]"
        >
          Medios Educativos
        </a>

        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {ENLACES_NAV.map((item) => {
            const activo = vistaActiva === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setVistaActiva(item.id);
                }}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activo
                    ? 'border-blue-900 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:underline underline-offset-4'
                }`}
              >
                {item.etiqueta}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={soloConsulta}
            onClick={() => abrirModalNovedad()}
            title={
              soloConsulta
                ? 'Modo solo consulta (Jefe de oficina)'
                : 'Registrar préstamo, pérdida u orden de salida'
            }
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            Registrar novedad
          </button>

          <button
            type="button"
            onClick={() => setMenuMovilAbierto((v) => !v)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Abrir navegación"
          >
            {menuMovilAbierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {menuMovilAbierto && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 no-print">
          {ENLACES_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setVistaActiva(item.id);
                setMenuMovilAbierto(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                vistaActiva === item.id
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200 no-print">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-800">Oficina de Medios Educativos</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Viernes, 23 oct 2026</span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-mono tabular-nums font-medium text-slate-800">
                {conteoAbiertas}
              </span>{' '}
              novedades abiertas vigentes
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Cierre hoy:{' '}
              <span className="font-medium text-slate-800">
                {cierreHoy.estado === 'firmado' ? 'Firmado' : 'En curso'}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <label htmlFor="selector-rol-usuario" className="text-xs text-slate-500 whitespace-nowrap">
                Cuenta activa:
              </label>
              <select
                id="selector-rol-usuario"
                value={usuarioActivo.id}
                onChange={(e) => {
                  const encontrado = usuariosAutorizados.find((u) => u.id === e.target.value);
                  if (encontrado) setUsuarioActivo(encontrado);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
              >
                {usuariosAutorizados.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} — {u.cargoEtiqueta}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setModalGuiaAppsScriptAbierto(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
              title="Ver guía y código Code.gs para importar en Google Drive y Google Sheets"
            >
              <Layers className="w-3.5 h-3.5 text-blue-800" />
              <span>Importar a Drive (Apps Script)</span>
            </button>

            <button
              type="button"
              onClick={restablecerDatosDemo}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-200/60 transition-colors whitespace-nowrap shrink-0"
              title="Restablecer al estado inicial del 23 de octubre de 2026"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer demo</span>
            </button>
          </div>
        </div>

        {avisoSistema && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium no-print ${
              avisoSistema.tipo === 'exito'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : avisoSistema.tipo === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-slate-300 bg-white text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {avisoSistema.tipo === 'exito' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : avisoSistema.tipo === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-slate-600 shrink-0" />
              )}
              <span>{avisoSistema.texto}</span>
            </div>
            <button
              type="button"
              onClick={limpiarAviso}
              className="p-1 text-current opacity-70 hover:opacity-100"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {vistaActiva === 'cierre' && (
          <CierreDiarioView
            cierre={cierreHoy}
            elementos={elementos}
            novedades={novedades}
            usuarioActivo={usuarioActivo}
            usuariosAutorizados={usuariosAutorizados}
            soloConsulta={soloConsulta}
            onCambiarUsuario={setUsuarioActivo}
            onMarcarAudiovisual={marcarResultadoAudiovisualCierre}
            onActualizarDeportivo={actualizarConteoDeportivoCierre}
            onMarcarRestantesEnOficina={marcarRestantesEnOficina}
            onActualizarObservaciones={actualizarObservacionesCierre}
            onFirmarCierre={firmarYBloquearCierre}
            onAbrirModalNovedad={abrirModalNovedad}
            onAbrirModalCerrarNovedad={(nov) => setNovedadPorCerrar(nov)}
            onRegistrarCorreccion={registrarCorreccionCierreFirmado}
          />
        )}

        {vistaActiva === 'novedades' && (
          <NovedadesView
            novedades={novedades}
            elementos={elementos}
            soloConsulta={soloConsulta}
            umbralEscalamientoDias={umbralEscalamientoDias}
            onAbrirNuevaNovedad={() => abrirModalNovedad()}
            onAbrirCerrarNovedad={(nov) => setNovedadPorCerrar(nov)}
          />
        )}

        {vistaActiva === 'apertura' && (
          <AperturaTurnoView
            elementos={elementos}
            novedades={novedades}
            cierres={cierres}
            aperturas={aperturas}
            soloConsulta={soloConsulta}
            onRegistrarApertura={registrarVerificacionApertura}
            onReportarDiferenciaComoNovedad={(cod) => abrirModalNovedad(cod, 1)}
          />
        )}

        {vistaActiva === 'catalogo' && (
          <CatalogoView
            elementos={elementos}
            novedades={novedades}
            soloConsulta={soloConsulta}
            onGuardarElemento={guardarElementoCatalogo}
          />
        )}

        {vistaActiva === 'historial' && (
          <HistorialConsultaView
            elementos={elementos}
            novedades={novedades}
            cierres={cierres}
            aperturas={aperturas}
            auditoria={auditoria}
            umbralEscalamientoDias={umbralEscalamientoDias}
            soloConsulta={soloConsulta}
            onCambiarUmbralEscalamiento={actualizarUmbralEscalamiento}
            onRegistrarCorreccionCierre={registrarCorreccionCierreFirmado}
            onEnviarAvisoJefatura={enviarAvisoJefatura}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12 py-5 px-4 sm:px-8 no-print">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Sistema de Inventario Diario · Oficina de Medios Educativos · Control trazable de
            préstamos, pérdidas y órdenes de salida
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setVistaActiva('historial')}
              className="hover:text-slate-900 underline-offset-4 hover:underline"
            >
              Exportar pestañas CSV (Sheets)
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="hover:text-slate-900 underline-offset-4 hover:underline"
            >
              Imprimir acta actual
            </button>
          </div>
        </div>
      </footer>

      <NovedadModal
        abierto={modalNuevaAbierto}
        onCerrar={() => setModalNuevaAbierto(false)}
        onGuardar={registrarNovedad}
        elementos={elementos}
        novedades={novedades}
        usuarioActivo={usuarioActivo}
        elementoPreseleccionado={elementoPreseleccionado}
        cantidadPreseleccionada={cantidadPreseleccionada}
      />

      <CerrarNovedadModal
        novedad={novedadPorCerrar}
        elemento={elementoDeNovedadPorCerrar}
        usuarioActivo={usuarioActivo}
        onCerrar={() => setNovedadPorCerrar(null)}
        onConfirmarCierre={cerrarNovedad}
      />

      <GuiaAppsScriptModal
        abierto={modalGuiaAppsScriptAbierto}
        onCerrar={() => setModalGuiaAppsScriptAbierto(false)}
      />
    </div>
  );
}
