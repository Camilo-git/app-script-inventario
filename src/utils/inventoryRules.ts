import {
  CategoriaElemento,
  DetalleInventarioItem,
  Elemento,
  EstadoNovedad,
  InventarioCierre,
  Novedad,
  TipoNovedad,
} from '../types/inventory';

export function obtenerNovedadesAbiertas(novedades: Novedad[]): Novedad[] {
  return novedades.filter((n) => n.estado === EstadoNovedad.Abierta);
}

export function obtenerNovedadesAbiertasPorElemento(
  elementoCodigo: string,
  novedades: Novedad[]
): Novedad[] {
  return novedades.filter(
    (n) => n.elementoCodigo === elementoCodigo && n.estado === EstadoNovedad.Abierta
  );
}

export function calcularUnidadesAfueraPorNovedad(
  elementoCodigo: string,
  novedades: Novedad[]
): number {
  return obtenerNovedadesAbiertasPorElemento(elementoCodigo, novedades).reduce(
    (acc, n) => acc + n.cantidad,
    0
  );
}

export function calcularUnidadesDisponibles(
  elemento: Elemento,
  novedades: Novedad[]
): number {
  const afuera = calcularUnidadesAfueraPorNovedad(elemento.codigo, novedades);
  return Math.max(0, elemento.cantidadTotal - afuera);
}

export function calcularDiasAntiguedad(fechaEvento: string, fechaReferencia: string): number {
  const inicio = new Date(`${fechaEvento}T00:00:00`);
  const fin = new Date(`${fechaReferencia}T00:00:00`);
  const diffMs = fin.getTime() - inicio.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

export function etiquetaTipoNovedad(tipo: TipoNovedad): string {
  switch (tipo) {
    case TipoNovedad.Prestamo:
      return 'Préstamo';
    case TipoNovedad.Perdida:
      return 'Pérdida';
    case TipoNovedad.OrdenSalida:
      return 'Orden de salida';
  }
}

export function sincronizarBorradorCierre(
  fecha: string,
  elementos: Elemento[],
  novedades: Novedad[],
  borradorExistente?: InventarioCierre
): InventarioCierre {
  if (borradorExistente && borradorExistente.estado === 'firmado') {
    return borradorExistente;
  }

  const activos = elementos.filter((e) => e.activo);
  const mapaExistente = new Map<string, DetalleInventarioItem>();
  if (borradorExistente) {
    for (const item of borradorExistente.detalles) {
      mapaExistente.set(item.elementoCodigo, item);
    }
  }

  const detalles: DetalleInventarioItem[] = activos.map((el) => {
    const abiertas = obtenerNovedadesAbiertasPorElemento(el.codigo, novedades);
    const novedadIds = abiertas.map((n) => n.id);
    const unidadesJustificadas = abiertas.reduce((sum, n) => sum + n.cantidad, 0);
    const previo = mapaExistente.get(el.codigo);

    if (el.categoria === CategoriaElemento.Audiovisual) {
      if (abiertas.length > 0) {
        return {
          elementoCodigo: el.codigo,
          categoria: CategoriaElemento.Audiovisual,
          resultado: 'no_esta',
          verificadoDeportivo: true,
          cantidadTotal: 1,
          unidadesEnOficina: 0,
          unidadesAfuera: 1,
          novedadIds,
          observacionFila: previo?.observacionFila ?? '',
        };
      }

      const teniaNovedadCerrada =
        previo && previo.resultado === 'no_esta' && previo.novedadIds.length > 0;

      const resultadoConservado = teniaNovedadCerrada
        ? 'en_oficina'
        : previo?.resultado ?? 'pendiente';

      return {
        elementoCodigo: el.codigo,
        categoria: CategoriaElemento.Audiovisual,
        resultado: resultadoConservado,
        verificadoDeportivo: true,
        cantidadTotal: 1,
        unidadesEnOficina: resultadoConservado === 'en_oficina' ? 1 : 0,
        unidadesAfuera: resultadoConservado === 'no_esta' ? 1 : 0,
        novedadIds: [],
        observacionFila: previo?.observacionFila ?? '',
      };
    }

    const esperadoEnOficina = Math.max(0, el.cantidadTotal - unidadesJustificadas);
    const unidadesEnOficina =
      previo !== undefined
        ? Math.min(el.cantidadTotal, Math.max(0, previo.unidadesEnOficina))
        : esperadoEnOficina;

    const previoEsperado =
      previo !== undefined ? el.cantidadTotal - previo.unidadesAfuera : esperadoEnOficina;
    const conteoSincronizado =
      previo === undefined || previo.novedadIds.join(',') !== novedadIds.join(',')
        ? esperadoEnOficina
        : previoEsperado === previo.unidadesEnOficina
          ? unidadesEnOficina
          : unidadesEnOficina;

    const afueraFinal = Math.max(0, el.cantidadTotal - conteoSincronizado);

    return {
      elementoCodigo: el.codigo,
      categoria: CategoriaElemento.Deportivo,
      resultado: afueraFinal === 0 ? 'en_oficina' : 'no_esta',
      verificadoDeportivo: previo?.verificadoDeportivo ?? (unidadesJustificadas > 0),
      cantidadTotal: el.cantidadTotal,
      unidadesEnOficina: conteoSincronizado,
      unidadesAfuera: afueraFinal,
      novedadIds,
      observacionFila: previo?.observacionFila ?? '',
    };
  });

  return {
    id: borradorExistente?.id ?? `CIE-${fecha}`,
    fecha,
    estado: 'en_progreso',
    observaciones: borradorExistente?.observaciones ?? '',
    detalles,
    correcciones: borradorExistente?.correcciones ?? [],
  };
}

export interface ProblemaValidacionCierre {
  elementoCodigo: string;
  elementoNombre: string;
  tipoProblema: 'sin_resultado' | 'ausencia_sin_novedad' | 'exceso_en_oficina';
  mensaje: string;
  unidadesSinJustificar: number;
}

export function validarCierreParaFirma(
  cierre: InventarioCierre,
  elementos: Elemento[],
  novedades: Novedad[]
): ProblemaValidacionCierre[] {
  const problemas: ProblemaValidacionCierre[] = [];
  const mapaElementos = new Map(elementos.map((e) => [e.codigo, e]));

  for (const item of cierre.detalles) {
    const el = mapaElementos.get(item.elementoCodigo);
    const nombre = el?.nombre ?? item.elementoCodigo;
    const abiertas = obtenerNovedadesAbiertasPorElemento(item.elementoCodigo, novedades);
    const unidadesJustificadas = abiertas.reduce((acc, n) => acc + n.cantidad, 0);

    if (item.categoria === CategoriaElemento.Audiovisual) {
      if (item.resultado === 'pendiente') {
        problemas.push({
          elementoCodigo: item.elementoCodigo,
          elementoNombre: nombre,
          tipoProblema: 'sin_resultado',
          mensaje: 'Falta marcar si está En oficina o No está.',
          unidadesSinJustificar: 0,
        });
      } else if (item.resultado === 'no_esta' && abiertas.length === 0) {
        problemas.push({
          elementoCodigo: item.elementoCodigo,
          elementoNombre: nombre,
          tipoProblema: 'ausencia_sin_novedad',
          mensaje: 'Marcado como No está sin novedad abierta que lo justifique.',
          unidadesSinJustificar: 1,
        });
      } else if (item.resultado === 'en_oficina' && abiertas.length > 0) {
        problemas.push({
          elementoCodigo: item.elementoCodigo,
          elementoNombre: nombre,
          tipoProblema: 'exceso_en_oficina',
          mensaje: 'Marcado En oficina, pero aún figura con una novedad abierta sin cerrar.',
          unidadesSinJustificar: 0,
        });
      }
    } else {
      if (!item.verificadoDeportivo) {
        problemas.push({
          elementoCodigo: item.elementoCodigo,
          elementoNombre: nombre,
          tipoProblema: 'sin_resultado',
          mensaje: 'Falta confirmar el conteo de unidades en oficina.',
          unidadesSinJustificar: 0,
        });
      } else {
        const faltantesFisicos = item.cantidadTotal - item.unidadesEnOficina;
        if (faltantesFisicos > unidadesJustificadas) {
          const diferencia = faltantesFisicos - unidadesJustificadas;
          problemas.push({
            elementoCodigo: item.elementoCodigo,
            elementoNombre: nombre,
            tipoProblema: 'ausencia_sin_novedad',
            mensaje: `Faltan ${diferencia} unidad(es) en oficina sin novedad registrada (${faltantesFisicos} afuera vs ${unidadesJustificadas} con novedad).`,
            unidadesSinJustificar: diferencia,
          });
        } else if (faltantesFisicos < unidadesJustificadas) {
          problemas.push({
            elementoCodigo: item.elementoCodigo,
            elementoNombre: nombre,
            tipoProblema: 'exceso_en_oficina',
            mensaje: `Hay más unidades contadas en oficina (${item.unidadesEnOficina}) de las posibles con ${unidadesJustificadas} afuera por novedad. Cierre primero la devolución.`,
            unidadesSinJustificar: 0,
          });
        }
      }
    }
  }

  return problemas;
}

export function exportarCsvDescarga(nombreArchivo: string, cabeceras: string[], filas: string[][]): void {
  const escapar = (valor: string) => {
    const limpio = String(valor ?? '').replace(/"/g, '""');
    return `"${limpio}"`;
  };
  const contenido = [
    cabeceras.map(escapar).join(','),
    ...filas.map((f) => f.map(escapar).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
