import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileSpreadsheet,
  Globe,
  Layers,
  X,
} from 'lucide-react';
import codigoGsRaw from '../../google-apps-script/Code.gs?raw';
import indexHtmlRaw from '../../google-apps-script/Index.html?raw';
import appsscriptJsonRaw from '../../google-apps-script/appsscript.json?raw';
import guiaPasoAPasoRaw from '../../google-apps-script/README_PASO_A_PASO.md?raw';
import readmeGithubRaw from '../../README.md?raw';

interface GuiaAppsScriptModalProps {
  abierto: boolean;
  onCerrar: () => void;
}

type ArchivoSeleccionado =
  | 'code_gs'
  | 'index_html'
  | 'paso_a_paso_md'
  | 'readme_github_md'
  | 'appsscript_json';

export const GuiaAppsScriptModal: React.FC<GuiaAppsScriptModalProps> = ({
  abierto,
  onCerrar,
}) => {
  const [copiado, setCopiado] = useState<ArchivoSeleccionado | null>(null);
  const [pasoActivo, setPasoActivo] = useState<number>(1);
  const [archivoActivo, setArchivoActivo] = useState<ArchivoSeleccionado>('code_gs');

  if (!abierto) return null;

  const obtenerContenidoActual = (tipo: ArchivoSeleccionado) => {
    if (tipo === 'code_gs') {
      return {
        nombre: 'Code.gs',
        contenido: codigoGsRaw,
        mime: 'text/javascript;charset=utf-8;',
        descripcion:
          'Backend completo en Google Apps Script con LockService, creación automática de las pestañas en Google Sheets (incluida Usuarios_Autorizados), firma digital e integración de alertas a Jefatura.',
      };
    }
    if (tipo === 'index_html') {
      return {
        nombre: 'Index.html',
        contenido: indexHtmlRaw,
        mime: 'text/html;charset=utf-8;',
        descripcion:
          'Interfaz web completa con todas las pestañas, sub-pestañas de filtro y buscadores en tiempo real conectada mediante google.script.run a Code.gs.',
      };
    }
    if (tipo === 'paso_a_paso_md') {
      return {
        nombre: 'README_PASO_A_PASO.md',
        contenido: guiaPasoAPasoRaw,
        mime: 'text/markdown;charset=utf-8;',
        descripcion:
          'Documentación paso a paso detallada para crear el Google Sheet, montar Code.gs e Index.html, configurar Usuarios_Autorizados y publicar la aplicación web.',
      };
    }
    if (tipo === 'readme_github_md') {
      return {
        nombre: 'README.md',
        contenido: readmeGithubRaw,
        mime: 'text/markdown;charset=utf-8;',
        descripcion:
          'Documentación oficial README.md lista para la raíz de tu repositorio en GitHub (arquitectura, requisitos RF/RNF, modelo de datos e instalación).',
      };
    }
    return {
      nombre: 'appsscript.json',
      contenido: appsscriptJsonRaw,
      mime: 'application/json;charset=utf-8;',
      descripcion:
        'Manifiesto opcional con zona horaria America/Bogota y permisos de ejecución dentro del dominio institucional.',
    };
  };

  const infoArchivo = obtenerContenidoActual(archivoActivo);

  const copiarArchivo = async (tipo: ArchivoSeleccionado) => {
    const { contenido } = obtenerContenidoActual(tipo);
    try {
      await navigator.clipboard.writeText(contenido);
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      // Ignorar si el navegador bloquea portapapeles
    }
  };

  const descargarArchivo = (tipo: ArchivoSeleccionado) => {
    const { nombre, contenido, mime } = obtenerContenidoActual(tipo);
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nombre);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-apps-script-titulo"
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-blue-900">
              <Layers className="w-4 h-4" />
              <span>Paquete Oficial Google Drive · Google Apps Script + Google Sheets</span>
            </div>
            <h2 id="modal-apps-script-titulo" className="text-lg font-bold text-slate-900 mt-0.5">
              Cómo importar y publicar el sistema en tu Google Drive
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg focus-visible:outline-none"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            Esta solución incluye los dos archivos necesarios para desplegarse directamente en tu{' '}
            <strong>Google Drive institucional</strong> sin servidores externos: el backend{' '}
            <code className="font-mono font-semibold text-slate-800">Code.gs</code> (que crea y
            administra automáticamente las pestañas en Google Sheets) y la interfaz{' '}
            <code className="font-mono font-semibold text-slate-800">Index.html</code> (servida por{' '}
            <code className="font-mono text-slate-800">HtmlService</code>).
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { num: 1, titulo: '1. Crear Google Sheet', icon: FileSpreadsheet },
              { num: 2, titulo: '2. Pegar Code.gs', icon: FileCode2 },
              { num: 3, titulo: '3. Crear Index.html', icon: Copy },
              { num: 4, titulo: '4. Publicar Web App', icon: Globe },
            ].map((p) => (
              <button
                key={p.num}
                type="button"
                onClick={() => {
                  setPasoActivo(p.num);
                  if (p.num === 2) setArchivoActivo('code_gs');
                  if (p.num === 3) setArchivoActivo('index_html');
                }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  pasoActivo === p.num
                    ? 'border-blue-900 bg-blue-50/70 text-blue-950 font-semibold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <p.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{p.titulo}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            {pasoActivo === 1 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Paso 1: Crear la hoja de cálculo en Google Drive y abrir Apps Script
                </h3>
                <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 leading-relaxed">
                  <li>
                    En tu Google Drive crea una <strong>Hoja de cálculo de Google</strong> en blanco y
                    nómbrala{' '}
                    <code className="px-1.5 py-0.5 bg-slate-200 rounded font-mono font-medium">
                      Inventario Diario - Oficina de Medios Educativos
                    </code>
                    .
                  </li>
                  <li>
                    En el menú superior haz clic en <strong>Extensiones &gt; Apps Script</strong>.
                  </li>
                  <li>
                    No necesitas crear columnas manualmente: la función{' '}
                    <code className="font-mono font-semibold">inicializarEstructuraHojas()</code>{' '}
                    creará las pestañas <code>Elementos</code>, <code>Novedades</code>,{' '}
                    <code>Inventarios</code>, <code>Detalle_Inventario</code> y{' '}
                    <code>Auditoria</code> con el catálogo semilla oficial.
                  </li>
                </ol>
              </div>
            )}

            {pasoActivo === 2 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Paso 2: Pegar el archivo Code.gs e inicializar las pestañas
                </h3>
                <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 leading-relaxed">
                  <li>
                    Borra el contenido de <code>Código.gs</code> en el editor de Apps Script y pega
                    el código de <strong>Code.gs</strong> de abajo.
                  </li>
                  <li>
                    Guarda el proyecto (icono de disquete o <kbd className="font-mono">Ctrl+S</kbd>).
                  </li>
                  <li>
                    En la barra superior del editor selecciona la función{' '}
                    <code className="font-mono font-semibold">inicializarEstructuraHojas</code> y
                    haz clic en <strong>Ejecutar</strong> para que cree las 5 pestañas en tu Google
                    Sheet.
                  </li>
                </ol>
              </div>
            )}

            {pasoActivo === 3 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Paso 3: Agregar el archivo HTML (Index.html)
                </h3>
                <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 leading-relaxed">
                  <li>
                    En la barra lateral izquierda de Apps Script, junto a <strong>Archivos</strong>,
                    haz clic en el botón <strong>+</strong> y elige <strong>HTML</strong>.
                  </li>
                  <li>
                    Escribe exactamente el nombre <code className="font-mono font-bold">Index</code>{' '}
                    (con I mayúscula; Apps Script le añadirá <code>.html</code> automáticamente).
                  </li>
                  <li>
                    Reemplaza todo su contenido con el código de la pestaña{' '}
                    <strong>Index.html</strong> que encuentras aquí abajo y guarda.
                  </li>
                </ol>
              </div>
            )}

            {pasoActivo === 4 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Paso 4: Implementar como Aplicación Web institucional
                </h3>
                <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 leading-relaxed">
                  <li>
                    Haz clic arriba a la derecha en{' '}
                    <strong>Implementar &gt; Nueva implementación</strong>.
                  </li>
                  <li>
                    Selecciona el tipo <strong>Aplicación web</strong>.
                  </li>
                  <li>
                    En <strong>Ejecutar como</strong> elige <em>Yo (propietario de la hoja)</em> y en{' '}
                    <strong>Quién tiene acceso</strong> selecciona{' '}
                    <em>Cualquier usuario de tu institución</em>.
                  </li>
                  <li>
                    Haz clic en <strong>Implementar</strong> y comparte el enlace web con los
                    auxiliares y el responsable de turno.
                  </li>
                </ol>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
                {(
                  [
                    { id: 'code_gs', label: '1. Code.gs' },
                    { id: 'index_html', label: '2. Index.html' },
                    { id: 'paso_a_paso_md', label: '3. Manual Paso a Paso (.md)' },
                    { id: 'readme_github_md', label: '4. README GitHub (.md)' },
                    { id: 'appsscript_json', label: '5. appsscript.json' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setArchivoActivo(tab.id)}
                    className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap ${
                      archivoActivo === tab.id
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copiarArchivo(archivoActivo)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  {copiado === archivoActivo ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiado === archivoActivo
                      ? `¡${infoArchivo.nombre} copiado!`
                      : `Copiar ${infoArchivo.nombre}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => descargarArchivo(archivoActivo)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar {infoArchivo.nombre}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">{infoArchivo.descripcion}</p>

            <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-60 leading-relaxed select-all">
              {infoArchivo.contenido}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
          <span className="text-xs text-slate-500">
            Archivos también incluidos en la carpeta /google-apps-script del proyecto.
          </span>
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
          >
            Cerrar guía
          </button>
        </div>
      </div>
    </div>
  );
};
