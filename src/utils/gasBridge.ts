import {
  CategoriaElemento,
  Elemento,
  InventarioCierre,
  Novedad,
} from '../types/inventory';
import { etiquetaTipoNovedad } from './inventoryRules';

declare global {
  interface Window {
    google?: {
      script?: {
        run?: {
          withSuccessHandler: (cb: (res: unknown) => void) => {
            withFailureHandler: (errCb: (err: unknown) => void) => Record<string, (...args: unknown[]) => void>;
          } & Record<string, (...args: unknown[]) => void>;
        };
      };
    };
  }
}

export function esEntornoAppsScript(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.google &&
      window.google.script &&
      window.google.script.run
  );
}

export function invocarAppsScript<T = unknown>(
  funcionBackend: string,
  ...argumentos: unknown[]
): Promise<T | null> {
  return new Promise((resolve) => {
    if (!esEntornoAppsScript()) {
      resolve(null);
      return;
    }
    try {
      const runner = window.google!.script!.run!;
      runner
        .withSuccessHandler((res: unknown) => resolve(res as T))
        .withFailureHandler(() => resolve(null))[funcionBackend](...argumentos);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Genera y descarga un documento de Acta Oficial de Cierre Diario (RF-12)
 * listo para archivar en Google Drive o imprimir como PDF firmado.
 */
export function descargarActaOficialHtml(
  cierre: InventarioCierre,
  elementos: Elemento[],
  novedades: Novedad[]
): void {
  const mapaElementos = new Map(elementos.map((e) => [e.codigo, e]));
  const mapaNovedades = new Map(novedades.map((n) => [n.id, n]));

  const filasHtml = cierre.detalles
    .map((d) => {
      const el = mapaElementos.get(d.elementoCodigo);
      const novs = d.novedadIds
        .map((id) => mapaNovedades.get(id))
        .filter((n): n is Novedad => Boolean(n));

      const detalleNov =
        novs.length > 0
          ? novs
              .map(
                (n) =>
                  `${n.id} (${etiquetaTipoNovedad(n.tipo)} · ${n.cantidad}x · ${n.solicitanteNombre} - ${n.solicitanteVinculo})`
              )
              .join('<br/>')
          : 'Sin novedad (En oficina)';

      return `
        <tr>
          <td style="font-family: monospace; font-weight: 600;">${d.elementoCodigo}</td>
          <td>${el?.nombre ?? d.elementoCodigo}</td>
          <td>${d.categoria === CategoriaElemento.Audiovisual ? 'Audiovisual (Individual)' : 'Deportivo (Cantidad)'}</td>
          <td style="text-align: right; font-family: monospace;">${d.cantidadTotal}</td>
          <td style="text-align: right; font-family: monospace; color: #15803d; font-weight: 600;">${d.unidadesEnOficina}</td>
          <td style="text-align: right; font-family: monospace; color: ${d.unidadesAfuera > 0 ? '#b45309' : '#475569'};">${d.unidadesAfuera}</td>
          <td style="font-size: 11px;">${detalleNov}</td>
        </tr>
      `;
    })
    .join('');

  const correccionesHtml =
    cierre.correcciones.length > 0
      ? `
      <div style="margin-top: 20px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
        <h3 style="margin: 0 0 8px 0; font-size: 13px;">Notas de corrección posteriores (RNF-03)</h3>
        ${cierre.correcciones
          .map(
            (c) =>
              `<p style="margin: 4px 0; font-size: 12px;"><strong>${c.motivo}</strong> (${c.fechaHora} · ${c.autorNombre} - ${c.autorCorreo}): ${c.detalle}</p>`
          )
          .join('')}
      </div>`
      : '';

  const documentoHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Acta Cierre Diario ${cierre.fecha} - Oficina de Medios Educativos</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 32px; line-height: 1.45; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    h1 { font-size: 20px; margin: 0 0 4px 0; }
    .meta { font-size: 12px; color: #475569; font-family: monospace; }
    .seal-box { border: 1px solid #cbd5e1; background: #f8fafc; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Oficina de Medios Educativos · Acta de Inventario de Cierre Diario</h1>
      <div class="meta">ID Acta: ${cierre.id} · Fecha Operativa: ${cierre.fecha}</div>
    </div>
    <div class="meta" style="text-align: right;">
      Estado: <strong>${cierre.estado === 'firmado' ? 'FIRMADO E INMUTABLE' : 'BORRADOR EN PROGRESO'}</strong><br/>
      Sello Digital: ${cierre.selloConfirmacion ?? 'PENDIENTE'}
    </div>
  </div>

  <div class="seal-box">
    <strong>Responsable de turno:</strong> ${cierre.responsableNombre ?? 'Sin firmar'} (${cierre.responsableCorreo ?? '—'}) ·
    <strong>Hora de cierre:</strong> ${cierre.horaCierre ?? '—'}<br/>
    <strong>Observaciones del turno:</strong> ${cierre.observaciones || 'Sin observaciones adicionales.'}
  </div>

  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Elemento</th>
        <th>Control</th>
        <th style="text-align: right;">Total</th>
        <th style="text-align: right;">En Oficina</th>
        <th style="text-align: right;">Afuera</th>
        <th>Justificación / Novedad Vigente</th>
      </tr>
    </thead>
    <tbody>
      ${filasHtml}
    </tbody>
  </table>

  ${correccionesHtml}

  <p style="margin-top: 24px; font-size: 11px; color: #64748b; font-family: monospace;">
    Generado por el Sistema de Inventario Diario – Oficina de Medios Educativos (Google Apps Script & Google Sheets).
  </p>
</body>
</html>`;

  const blob = new Blob([documentoHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Acta_Cierre_Medios_Educativos_${cierre.fecha}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
