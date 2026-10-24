import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APERTURAS_INICIALES,
  AUDITORIA_INICIAL,
  CIERRES_INICIALES,
  ELEMENTOS_INICIALES,
  FECHA_HOY,
  NOVEDADES_INICIALES,
  USUARIOS_AUTORIZADOS,
} from '../data/seedData';
import {
  CategoriaElemento,
  CorreccionCierre,
  Elemento,
  EstadoFisico,
  EstadoNovedad,
  InventarioCierre,
  Novedad,
  RegistroAuditoria,
  ResultadoAudiovisual,
  RolUsuario,
  TipoNovedad,
  UsuarioApp,
  VerificacionApertura,
  VinculoSolicitante,
} from '../types/inventory';
import {
  calcularUnidadesDisponibles,
  obtenerNovedadesAbiertasPorElemento,
  sincronizarBorradorCierre,
  validarCierreParaFirma,
} from '../utils/inventoryRules';

const STORAGE_KEY = 'ome_inventario_diario_v1';

interface EstadoPersistente {
  elementos: Elemento[];
  novedades: Novedad[];
  cierres: InventarioCierre[];
  aperturas: VerificacionApertura[];
  auditoria: RegistroAuditoria[];
  umbralEscalamientoDias: number;
}

function obtenerHoraActual(): string {
  const ahora = new Date();
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mm = String(ahora.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function construirEstadoInicial(): EstadoPersistente {
  const borradorHoy = sincronizarBorradorCierre(
    FECHA_HOY,
    ELEMENTOS_INICIALES,
    NOVEDADES_INICIALES
  );
  const codigosYaRevisados = new Set([
    'AV-POR-001',
    'AV-PRY-001',
    'AV-PAR-001',
    'AV-MIC-001',
    'DEP-BAL-01',
    'DEP-AJE-01',
  ]);
  borradorHoy.detalles = borradorHoy.detalles.map((d) => {
    if (codigosYaRevisados.has(d.elementoCodigo)) {
      if (d.categoria === CategoriaElemento.Audiovisual && d.novedadIds.length === 0) {
        return { ...d, resultado: 'en_oficina', unidadesEnOficina: 1, unidadesAfuera: 0 };
      }
      if (d.categoria === CategoriaElemento.Deportivo) {
        return { ...d, verificadoDeportivo: true };
      }
    }
    return d;
  });

  return {
    elementos: ELEMENTOS_INICIALES,
    novedades: NOVEDADES_INICIALES,
    cierres: [...CIERRES_INICIALES, borradorHoy],
    aperturas: APERTURAS_INICIALES,
    auditoria: AUDITORIA_INICIAL,
    umbralEscalamientoDias: 3,
  };
}

function cargarEstado(): EstadoPersistente {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (!guardado) {
      return construirEstadoInicial();
    }
    const parsed = JSON.parse(guardado) as EstadoPersistente;
    if (!parsed.elementos || !parsed.novedades || !parsed.cierres) {
      return construirEstadoInicial();
    }
    return parsed;
  } catch {
    return construirEstadoInicial();
  }
}

export interface NuevaNovedadInput {
  elementoCodigo: string;
  tipo: TipoNovedad;
  cantidad: number;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  solicitanteDependencia: string;
  solicitanteVinculo: VinculoSolicitante;
  horaEvento: string;
  eventoOrdenSalida?: string;
  referenciaAutorizacionExterna?: string;
  observaciones: string;
}

export interface GuardarElementoInput {
  id?: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaElemento;
  tipo: string;
  estadoFisico: EstadoFisico;
  cantidadTotal: number;
  ubicacion: string;
  activo: boolean;
}

export function useInventoryStore() {
  const [estado, setEstado] = useState<EstadoPersistente>(() => cargarEstado());
  const [usuarioActivo, setUsuarioActivo] = useState<UsuarioApp>(USUARIOS_AUTORIZADOS[0]);
  const [bloqueoEscritura, setBloqueoEscritura] = useState(false);
  const [avisoSistema, setAvisoSistema] = useState<{
    tipo: 'exito' | 'error' | 'info';
    texto: string;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Ignorar
    }
  }, [estado]);

  useEffect(() => {
    const alCambiarStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY && ev.newValue) {
        try {
          setEstado(JSON.parse(ev.newValue) as EstadoPersistente);
        } catch {
          // Ignorar
        }
      }
    };
    window.addEventListener('storage', alCambiarStorage);
    return () => window.removeEventListener('storage', alCambiarStorage);
  }, []);

  const notificar = useCallback((tipo: 'exito' | 'error' | 'info', texto: string) => {
    setAvisoSistema({ tipo, texto });
  }, []);

  const limpiarAviso = useCallback(() => {
    setAvisoSistema(null);
  }, []);

  const cierreHoy = useMemo(() => {
    const existente = estado.cierres.find((c) => c.fecha === FECHA_HOY);
    return sincronizarBorradorCierre(
      FECHA_HOY,
      estado.elementos,
      estado.novedades,
      existente
    );
  }, [estado.cierres, estado.elementos, estado.novedades]);

  const soloConsulta = usuarioActivo.rol === RolUsuario.JefeOficina;

  const ejecutarConLock = useCallback(
    (operacion: (prev: EstadoPersistente) => { ok: boolean; error?: string; nuevo?: EstadoPersistente; mensajeExito?: string }) => {
      if (bloqueoEscritura) {
        notificar(
          'error',
          'Otra escritura está en curso (control de concurrencia activo). Intente nuevamente.'
        );
        return false;
      }
      setBloqueoEscritura(true);
      let exito = false;
      setEstado((prev) => {
        const res = operacion(prev);
        if (!res.ok || !res.nuevo) {
          if (res.error) notificar('error', res.error);
          return prev;
        }
        exito = true;
        if (res.mensajeExito) notificar('exito', res.mensajeExito);
        return res.nuevo;
      });
      setBloqueoEscritura(false);
      return exito;
    },
    [bloqueoEscritura, notificar]
  );

  const crearEntradaAuditoria = useCallback(
    (
      modulo: RegistroAuditoria['modulo'],
      accion: string,
      detalle: string
    ): RegistroAuditoria => ({
      id: `AUD-${Date.now().toString().slice(-6)}`,
      fechaHora: `${FECHA_HOY} ${obtenerHoraActual()}`,
      usuarioNombre: usuarioActivo.nombre,
      usuarioCorreo: usuarioActivo.correo,
      rol: usuarioActivo.rol,
      modulo,
      accion,
      detalle,
    }),
    [usuarioActivo]
  );

  const registrarNovedad = useCallback(
    (input: NuevaNovedadInput): boolean => {
      if (soloConsulta) {
        notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
        return false;
      }
      return ejecutarConLock((prev) => {
        const elemento = prev.elementos.find((e) => e.codigo === input.elementoCodigo);
        if (!elemento || !elemento.activo) {
          return { ok: false, error: 'El elemento seleccionado no existe o está inactivo.' };
        }

        const abiertasElemento = obtenerNovedadesAbiertasPorElemento(
          elemento.codigo,
          prev.novedades
        );

        if (elemento.categoria === CategoriaElemento.Audiovisual && abiertasElemento.length > 0) {
          return {
            ok: false,
            error: `El equipo individual ${elemento.codigo} ya tiene una novedad abierta (${abiertasElemento[0].id}). No se permiten dos novedades abiertas para el mismo código.`,
          };
        }

        const disponibles = calcularUnidadesDisponibles(elemento, prev.novedades);
        const cantidadFinal =
          elemento.categoria === CategoriaElemento.Audiovisual ? 1 : input.cantidad;

        if (cantidadFinal < 1 || cantidadFinal > disponibles) {
          return {
            ok: false,
            error: `Cantidad inválida. Unidades disponibles actualmente en oficina para ${elemento.codigo}: ${disponibles}.`,
          };
        }

        const consecutivo = String(prev.novedades.length + 1).padStart(3, '0');
        const nueva: Novedad = {
          id: `NOV-2026-${consecutivo}`,
          elementoCodigo: elemento.codigo,
          tipo: input.tipo,
          cantidad: cantidadFinal,
          solicitanteNombre: input.solicitanteNombre.trim(),
          solicitanteDocumento: input.solicitanteDocumento.trim(),
          solicitanteDependencia: input.solicitanteDependencia.trim(),
          solicitanteVinculo: input.solicitanteVinculo,
          fechaEvento: FECHA_HOY,
          horaEvento: input.horaEvento || obtenerHoraActual(),
          auxiliarRegistroNombre: usuarioActivo.nombre,
          auxiliarRegistroCorreo: usuarioActivo.correo,
          estado: EstadoNovedad.Abierta,
          eventoOrdenSalida:
            input.tipo === TipoNovedad.OrdenSalida ? input.eventoOrdenSalida?.trim() : undefined,
          referenciaAutorizacionExterna:
            input.tipo === TipoNovedad.OrdenSalida
              ? input.referenciaAutorizacionExterna?.trim()
              : undefined,
          observaciones: input.observaciones.trim(),
        };

        const nuevasNovedades = [nueva, ...prev.novedades];
        const nuevosCierres = prev.cierres.map((c) =>
          c.fecha === FECHA_HOY && c.estado === 'en_progreso'
            ? sincronizarBorradorCierre(FECHA_HOY, prev.elementos, nuevasNovedades, c)
            : c
        );

        const log = crearEntradaAuditoria(
          'Novedades',
          `Registro de ${
            input.tipo === TipoNovedad.Prestamo
              ? 'préstamo'
              : input.tipo === TipoNovedad.Perdida
                ? 'pérdida'
                : 'orden de salida'
          }`,
          `${nueva.id} · ${elemento.codigo} (${cantidadFinal} unid.) · Solicitante: ${nueva.solicitanteNombre}`
        );

        return {
          ok: true,
          mensajeExito: `Novedad ${nueva.id} registrada y vinculada al control diario.`,
          nuevo: {
            ...prev,
            novedades: nuevasNovedades,
            cierres: nuevosCierres,
            auditoria: [log, ...prev.auditoria],
          },
        };
      });
    },
    [soloConsulta, ejecutarConLock, usuarioActivo, crearEntradaAuditoria, notificar]
  );

  const cerrarNovedad = useCallback(
    (novedadId: string, notaResolucion: string, horaCierreManual?: string): boolean => {
      if (soloConsulta) {
        notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
        return false;
      }
      return ejecutarConLock((prev) => {
        const objetivo = prev.novedades.find((n) => n.id === novedadId);
        if (!objetivo || objetivo.estado === EstadoNovedad.Cerrada) {
          return { ok: false, error: 'La novedad ya se encuentra cerrada.' };
        }

        const horaFinal = horaCierreManual || obtenerHoraActual();
        const nuevasNovedades = prev.novedades.map((n) =>
          n.id === novedadId
            ? {
                ...n,
                estado: EstadoNovedad.Cerrada,
                fechaCierre: FECHA_HOY,
                horaCierre: horaFinal,
                auxiliarCierreNombre: usuarioActivo.nombre,
                auxiliarCierreCorreo: usuarioActivo.correo,
                notaResolucion: notaResolucion.trim() || 'Elemento devuelto y verificado en oficina.',
              }
            : n
        );

        const nuevosCierres = prev.cierres.map((c) =>
          c.fecha === FECHA_HOY && c.estado === 'en_progreso'
            ? sincronizarBorradorCierre(FECHA_HOY, prev.elementos, nuevasNovedades, c)
            : c
        );

        const log = crearEntradaAuditoria(
          'Novedades',
          'Cierre de novedad (devolución / resolución)',
          `${objetivo.id} · ${objetivo.elementoCodigo} (${objetivo.cantidad} unid.) resuelta a las ${horaFinal}`
        );

        return {
          ok: true,
          mensajeExito: `Novedad ${objetivo.id} cerrada correctamente. El elemento vuelve a figurar disponible.`,
          nuevo: {
            ...prev,
            novedades: nuevasNovedades,
            cierres: nuevosCierres,
            auditoria: [log, ...prev.auditoria],
          },
        };
      });
    },
    [soloConsulta, ejecutarConLock, usuarioActivo, crearEntradaAuditoria, notificar]
  );

  const marcarResultadoAudiovisualCierre = useCallback(
    (elementoCodigo: string, resultado: ResultadoAudiovisual) => {
      if (soloConsulta) {
        notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
        return;
      }
      ejecutarConLock((prev) => {
        const actual = prev.cierres.find((c) => c.fecha === FECHA_HOY);
        const sincronizado = sincronizarBorradorCierre(
          FECHA_HOY,
          prev.elementos,
          prev.novedades,
          actual
        );
        if (sincronizado.estado === 'firmado') {
          return {
            ok: false,
            error: 'El cierre diario ya fue firmado y bloqueado. No admite modificaciones.',
          };
        }

        const actualizados = sincronizado.detalles.map((d) =>
          d.elementoCodigo === elementoCodigo
            ? {
                ...d,
                resultado,
                unidadesEnOficina: resultado === 'en_oficina' ? 1 : 0,
                unidadesAfuera: resultado === 'no_esta' ? 1 : 0,
              }
            : d
        );

        const nuevoCierre: InventarioCierre = { ...sincronizado, detalles: actualizados };
        const existeEnLista = prev.cierres.some((c) => c.fecha === FECHA_HOY);
        const nuevosCierres = existeEnLista
          ? prev.cierres.map((c) => (c.fecha === FECHA_HOY ? nuevoCierre : c))
          : [...prev.cierres, nuevoCierre];

        return {
          ok: true,
          nuevo: { ...prev, cierres: nuevosCierres },
        };
      });
    },
    [soloConsulta, ejecutarConLock, notificar]
  );

  const actualizarConteoDeportivoCierre = useCallback(
    (elementoCodigo: string, unidadesEnOficina: number, verificado = true) => {
      if (soloConsulta) {
        notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
        return;
      }
      ejecutarConLock((prev) => {
        const actual = prev.cierres.find((c) => c.fecha === FECHA_HOY);
        const sincronizado = sincronizarBorradorCierre(
          FECHA_HOY,
          prev.elementos,
          prev.novedades,
          actual
        );
        if (sincronizado.estado === 'firmado') {
          return {
            ok: false,
            error: 'El cierre diario ya fue firmado y bloqueado.',
          };
        }

        const actualizados = sincronizado.detalles.map((d) => {
          if (d.elementoCodigo !== elementoCodigo) return d;
          const ajustado = Math.max(0, Math.min(d.cantidadTotal, unidadesEnOficina));
          const afuera = d.cantidadTotal - ajustado;
          return {
            ...d,
            unidadesEnOficina: ajustado,
            unidadesAfuera: afuera,
            resultado: (afuera === 0 ? 'en_oficina' : 'no_esta') as ResultadoAudiovisual,
            verificadoDeportivo: verificado,
          };
        });

        const nuevoCierre: InventarioCierre = { ...sincronizado, detalles: actualizados };
        const nuevosCierres = prev.cierres.some((c) => c.fecha === FECHA_HOY)
          ? prev.cierres.map((c) => (c.fecha === FECHA_HOY ? nuevoCierre : c))
          : [...prev.cierres, nuevoCierre];

        return {
          ok: true,
          nuevo: { ...prev, cierres: nuevosCierres },
        };
      });
    },
    [soloConsulta, ejecutarConLock, notificar]
  );

  const marcarRestantesEnOficina = useCallback(() => {
    if (soloConsulta) {
      notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
      return;
    }
    ejecutarConLock((prev) => {
      const actual = prev.cierres.find((c) => c.fecha === FECHA_HOY);
      const sincronizado = sincronizarBorradorCierre(
        FECHA_HOY,
        prev.elementos,
        prev.novedades,
        actual
      );
      if (sincronizado.estado === 'firmado') {
        return { ok: false, error: 'El cierre diario ya está firmado.' };
      }

      const actualizados = sincronizado.detalles.map((d) => {
        if (d.categoria === CategoriaElemento.Audiovisual) {
          if (d.resultado === 'pendiente' && d.novedadIds.length === 0) {
            return {
              ...d,
              resultado: 'en_oficina' as ResultadoAudiovisual,
              unidadesEnOficina: 1,
              unidadesAfuera: 0,
            };
          }
          return d;
        }
        return {
          ...d,
          verificadoDeportivo: true,
        };
      });

      const nuevoCierre: InventarioCierre = { ...sincronizado, detalles: actualizados };
      const nuevosCierres = prev.cierres.some((c) => c.fecha === FECHA_HOY)
        ? prev.cierres.map((c) => (c.fecha === FECHA_HOY ? nuevoCierre : c))
        : [...prev.cierres, nuevoCierre];

      return {
        ok: true,
        mensajeExito:
          'Se marcaron como En oficina todos los elementos sin novedad abierta pendiente.',
        nuevo: { ...prev, cierres: nuevosCierres },
      };
    });
  }, [soloConsulta, ejecutarConLock, notificar]);

  const actualizarObservacionesCierre = useCallback(
    (observaciones: string) => {
      if (soloConsulta) return;
      setEstado((prev) => {
        const actual = prev.cierres.find((c) => c.fecha === FECHA_HOY);
        const sincronizado = sincronizarBorradorCierre(
          FECHA_HOY,
          prev.elementos,
          prev.novedades,
          actual
        );
        if (sincronizado.estado === 'firmado') return prev;
        const nuevoCierre = { ...sincronizado, observaciones };
        const nuevosCierres = prev.cierres.some((c) => c.fecha === FECHA_HOY)
          ? prev.cierres.map((c) => (c.fecha === FECHA_HOY ? nuevoCierre : c))
          : [...prev.cierres, nuevoCierre];
        return { ...prev, cierres: nuevosCierres };
      });
    },
    [soloConsulta]
  );

  const firmarYBloquearCierre = useCallback(
    (observacionFinal: string): boolean => {
      if (usuarioActivo.rol !== RolUsuario.ResponsableTurno) {
        notificar(
          'error',
          'Solo el Responsable de turno autorizado puede confirmar y firmar el inventario de cierre.'
        );
        return false;
      }

      return ejecutarConLock((prev) => {
        const actual = prev.cierres.find((c) => c.fecha === FECHA_HOY);
        const sincronizado = sincronizarBorradorCierre(
          FECHA_HOY,
          prev.elementos,
          prev.novedades,
          actual
        );
        if (sincronizado.estado === 'firmado') {
          return { ok: false, error: 'El cierre de hoy ya se encuentra firmado.' };
        }

        const problemas = validarCierreParaFirma(sincronizado, prev.elementos, prev.novedades);
        if (problemas.length > 0) {
          return {
            ok: false,
            error: `No se puede firmar el cierre: hay ${problemas.length} elemento(s) pendientes o sin novedad que los justifique.`,
          };
        }

        const horaFirma = obtenerHoraActual();
        const iniciales = usuarioActivo.nombre
          .split(' ')
          .map((p) => p[0])
          .join('')
          .toUpperCase()
          .slice(0, 4);
        const sello = `FIRMA-${iniciales}-${FECHA_HOY.replace(/-/g, '')}-${horaFirma.replace(':', '')}`;

        const cierreFirmado: InventarioCierre = {
          ...sincronizado,
          estado: 'firmado',
          responsableNombre: usuarioActivo.nombre,
          responsableCorreo: usuarioActivo.correo,
          horaCierre: horaFirma,
          selloConfirmacion: sello,
          observaciones:
            observacionFinal.trim() ||
            sincronizado.observaciones.trim() ||
            'Inventario de cierre diario verificado físicamente y firmado sin inconsistencias.',
          pdfGeneradoEnDrive: true,
        };

        const nuevosCierres = prev.cierres.some((c) => c.fecha === FECHA_HOY)
          ? prev.cierres.map((c) => (c.fecha === FECHA_HOY ? cierreFirmado : c))
          : [...prev.cierres, cierreFirmado];

        const log = crearEntradaAuditoria(
          'Cierre Diario',
          'Firma y bloqueo de cierre diario',
          `${cierreFirmado.id} firmado por ${usuarioActivo.correo} · Sello ${sello}`
        );

        return {
          ok: true,
          mensajeExito: `Cierre diario ${cierreFirmado.id} firmado digitalmente (${sello}) y bloqueado contra edición.`,
          nuevo: {
            ...prev,
            cierres: nuevosCierres,
            auditoria: [log, ...prev.auditoria],
          },
        };
      });
    },
    [usuarioActivo, ejecutarConLock, crearEntradaAuditoria, notificar]
  );

  const registrarCorreccionCierreFirmado = useCallback(
    (cierreId: string, motivo: string, detalle: string): boolean => {
      if (soloConsulta) {
        notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
        return false;
      }
      return ejecutarConLock((prev) => {
        const cierre = prev.cierres.find((c) => c.id === cierreId);
        if (!cierre || cierre.estado !== 'firmado') {
          return { ok: false, error: 'Solo se agregan notas de corrección a cierres ya firmados.' };
        }

        const nuevaCorreccion: CorreccionCierre = {
          id: `COR-${Date.now().toString().slice(-5)}`,
          fechaHora: `${FECHA_HOY} ${obtenerHoraActual()}`,
          autorNombre: usuarioActivo.nombre,
          autorCorreo: usuarioActivo.correo,
          motivo: motivo.trim(),
          detalle: detalle.trim(),
        };

        const nuevosCierres = prev.cierres.map((c) =>
          c.id === cierreId
            ? { ...c, correcciones: [...c.correcciones, nuevaCorreccion] }
            : c
        );

        const log = crearEntradaAuditoria(
          'Corrección',
          'Registro de aclaración en cierre firmado',
          `${cierreId} · ${nuevaCorreccion.motivo}`
        );

        return {
          ok: true,
          mensajeExito:
            'Nota de corrección añadida con autor y fecha sin modificar los datos originales del cierre.',
          nuevo: {
            ...prev,
            cierres: nuevosCierres,
            auditoria: [log, ...prev.auditoria],
          },
        };
      });
    },
    [soloConsulta, ejecutarConLock, usuarioActivo, crearEntradaAuditoria, notificar]
  );

  const guardarElementoCatalogo = useCallback(
    (input: GuardarElementoInput): boolean => {
      if (soloConsulta) {
        notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
        return false;
      }
      return ejecutarConLock((prev) => {
        const codigoNormalizado = input.codigo.trim().toUpperCase();
        const duplicado = prev.elementos.find(
          (e) => e.codigo.toUpperCase() === codigoNormalizado && e.id !== input.id
        );
        if (duplicado) {
          return {
            ok: false,
            error: `El código ${codigoNormalizado} ya pertenece al elemento "${duplicado.nombre}".`,
          };
        }

        const cantidadValidada =
          input.categoria === CategoriaElemento.Audiovisual
            ? 1
            : Math.max(1, Math.round(input.cantidadTotal));

        if (input.id) {
          const abiertas = obtenerNovedadesAbiertasPorElemento(
            codigoNormalizado,
            prev.novedades
          );
          const unidadesAfuera = abiertas.reduce((acc, n) => acc + n.cantidad, 0);
          if (cantidadValidada < unidadesAfuera) {
            return {
              ok: false,
              error: `No puede fijar ${cantidadValidada} unidad(es) totales porque hay ${unidadesAfuera} unidad(es) en novedades abiertas.`,
            };
          }
          if (!input.activo && unidadesAfuera > 0) {
            return {
              ok: false,
              error: 'No se puede desactivar un elemento que tiene novedades abiertas vigentes.',
            };
          }

          const nuevosElementos = prev.elementos.map((e) =>
            e.id === input.id
              ? {
                  ...e,
                  codigo: codigoNormalizado,
                  nombre: input.nombre.trim(),
                  categoria: input.categoria,
                  tipo: input.tipo.trim(),
                  estadoFisico: input.estadoFisico,
                  cantidadTotal: cantidadValidada,
                  ubicacion: input.ubicacion.trim(),
                  activo: input.activo,
                }
              : e
          );

          const nuevosCierres = prev.cierres.map((c) =>
            c.fecha === FECHA_HOY && c.estado === 'en_progreso'
              ? sincronizarBorradorCierre(FECHA_HOY, nuevosElementos, prev.novedades, c)
              : c
          );

          const log = crearEntradaAuditoria(
            'Catálogo',
            'Actualización de elemento',
            `${codigoNormalizado} · ${input.nombre.trim()} (${cantidadValidada} unid.)`
          );

          return {
            ok: true,
            mensajeExito: `Elemento ${codigoNormalizado} actualizado en el catálogo.`,
            nuevo: {
              ...prev,
              elementos: nuevosElementos,
              cierres: nuevosCierres,
              auditoria: [log, ...prev.auditoria],
            },
          };
        }

        const nuevoElemento: Elemento = {
          id: `el-${Date.now().toString().slice(-5)}`,
          codigo: codigoNormalizado,
          nombre: input.nombre.trim(),
          categoria: input.categoria,
          tipo: input.tipo.trim(),
          estadoFisico: input.estadoFisico,
          activo: input.activo,
          cantidadTotal: cantidadValidada,
          ubicacion: input.ubicacion.trim() || 'Estante General',
        };

        const nuevosElementos = [...prev.elementos, nuevoElemento];
        const nuevosCierres = prev.cierres.map((c) =>
          c.fecha === FECHA_HOY && c.estado === 'en_progreso'
            ? sincronizarBorradorCierre(FECHA_HOY, nuevosElementos, prev.novedades, c)
            : c
        );

        const log = crearEntradaAuditoria(
          'Catálogo',
          'Alta de elemento en catálogo',
          `${nuevoElemento.codigo} · ${nuevoElemento.nombre} (${
            nuevoElemento.categoria === CategoriaElemento.Audiovisual
              ? 'Individual'
              : `Cantidad: ${nuevoElemento.cantidadTotal}`
          })`
        );

        return {
          ok: true,
          mensajeExito: `Elemento ${nuevoElemento.codigo} agregado al catálogo.`,
          nuevo: {
            ...prev,
            elementos: nuevosElementos,
            cierres: nuevosCierres,
            auditoria: [log, ...prev.auditoria],
          },
        };
      });
    },
    [soloConsulta, ejecutarConLock, crearEntradaAuditoria, notificar]
  );

  const registrarVerificacionApertura = useCallback(
    (
      conformeConCierreAnterior: boolean,
      elementosVerificados: number,
      diferenciasReportadas: number,
      observaciones: string
    ): boolean => {
      if (soloConsulta) {
        notificar('error', 'El rol de Jefe de oficina es únicamente de consulta.');
        return false;
      }
      return ejecutarConLock((prev) => {
        const hora = obtenerHoraActual();
        const nuevaApertura: VerificacionApertura = {
          id: `APE-${FECHA_HOY}-${hora.replace(':', '')}`,
          fecha: FECHA_HOY,
          hora,
          auxiliarNombre: usuarioActivo.nombre,
          auxiliarCorreo: usuarioActivo.correo,
          conformeConCierreAnterior,
          elementosVerificados,
          diferenciasReportadas,
          observaciones:
            observaciones.trim() ||
            (conformeConCierreAnterior
              ? 'Conteo matutino verificado conforme al cierre anterior.'
              : 'Se reportaron diferencias al inicio del turno para seguimiento inmediato.'),
        };

        const log = crearEntradaAuditoria(
          'Apertura',
          'Verificación opcional de apertura',
          `${nuevaApertura.id} · ${elementosVerificados} elementos revisados · Diferencias: ${diferenciasReportadas}`
        );

        return {
          ok: true,
          mensajeExito: 'Verificación de apertura registrada en la bitácora del día.',
          nuevo: {
            ...prev,
            aperturas: [nuevaApertura, ...prev.aperturas],
            auditoria: [log, ...prev.auditoria],
          },
        };
      });
    },
    [soloConsulta, ejecutarConLock, usuarioActivo, crearEntradaAuditoria, notificar]
  );

  const actualizarUmbralEscalamiento = useCallback((dias: number) => {
    setEstado((prev) => ({
      ...prev,
      umbralEscalamientoDias: Math.max(1, Math.min(30, dias)),
    }));
  }, []);

  const enviarAvisoJefatura = useCallback(
    (cantidadEscaladas: number, maxAntiguedad: number) => {
      ejecutarConLock((prev) => {
        const log = crearEntradaAuditoria(
          'Cierre Diario',
          'Notificación de escalamiento a Jefatura (RF-13)',
          `Reporte enviado a jefatura.medios@institucion.edu.co · ${cantidadEscaladas} novedad(es) superan el umbral (${prev.umbralEscalamientoDias}d, máx. ${maxAntiguedad}d)`
        );
        return {
          ok: true,
          mensajeExito: `Aviso RF-13 registrado y remitido a Jefatura de Oficina (${cantidadEscaladas} novedad(es) con ${ prev.umbralEscalamientoDias }+ días abiertas).`,
          nuevo: {
            ...prev,
            auditoria: [log, ...prev.auditoria],
          },
        };
      });
    },
    [ejecutarConLock, crearEntradaAuditoria]
  );

  const restablecerDatosDemo = useCallback(() => {
    const inicial = construirEstadoInicial();
    setEstado(inicial);
    notificar('info', 'Se restablecieron los datos iniciales de demostración del 23 de octubre de 2026.');
  }, [notificar]);

  return {
    elementos: estado.elementos,
    novedades: estado.novedades,
    cierres: estado.cierres,
    cierreHoy,
    aperturas: estado.aperturas,
    auditoria: estado.auditoria,
    umbralEscalamientoDias: estado.umbralEscalamientoDias,
    usuarioActivo,
    usuariosAutorizados: USUARIOS_AUTORIZADOS,
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
  };
}
