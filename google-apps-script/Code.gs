/**
 * =========================================================================================
 * OFICINA DE MEDIOS EDUCATIVOS - SISTEMA DE INVENTARIO DIARIO
 * Archivo principal de backend para Google Apps Script (Code.gs)
 * Base de datos: Google Sheets (Elementos, Novedades, Inventarios, Detalle_Inventario, Aperturas, Auditoria, Usuarios_Autorizados)
 * Concurrencia: LockService · Control de Acceso por Correo y Rol · Alertas: MailApp
 * =========================================================================================
 */

const NOMBRES_HOJAS = {
  ELEMENTOS: 'Elementos',
  NOVEDADES: 'Novedades',
  INVENTARIOS: 'Inventarios',
  DETALLE: 'Detalle_Inventario',
  APERTURAS: 'Aperturas',
  AUDITORIA: 'Auditoria',
  USUARIOS: 'Usuarios_Autorizados'
};

/**
 * Sirve la aplicación web HTML verificando primero si el correo está autorizado (RNF-01)
 */
function doGet() {
  inicializarEstructuraHojas();
  const acceso = obtenerUsuarioActual();

  if (!acceso.autorizado) {
    const htmlDenegado = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Acceso Restringido</title>' +
      '<script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 font-sans">' +
      '<div class="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 text-center">' +
      '<div class="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mx-auto font-bold text-lg">!</div>' +
      '<h1 class="text-lg font-bold text-slate-900">Acceso restringido a personal autorizado</h1>' +
      '<p class="text-xs text-slate-600 leading-relaxed">El correo con el que intentas ingresar (<strong class="font-mono text-slate-900">' + (acceso.email || 'Sesión anónima') + '</strong>) no figura como activo en la pestaña <code class="bg-slate-100 px-1.5 py-0.5 rounded">Usuarios_Autorizados</code> de la Oficina de Medios Educativos.</p>' +
      '<p class="text-xs text-slate-500">Solicita al administrador de la hoja de cálculo que agregue tu correo institucional en la pestaña <strong>Usuarios_Autorizados</strong>.</p>' +
      '</div></body></html>';

    return HtmlService.createHtmlOutput(htmlDenegado)
      .setTitle('Acceso Restringido · Medios Educativos')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Inventario Diario · Oficina de Medios Educativos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Crea las pestañas (incluyendo Usuarios_Autorizados) si aún no existen en el Google Sheet
 */
function inicializarEstructuraHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 0. Pestaña Usuarios_Autorizados (Lista blanca de correos de auxiliares, responsables y jefatura)
  let hojaUsuarios = ss.getSheetByName(NOMBRES_HOJAS.USUARIOS);
  if (!hojaUsuarios) {
    hojaUsuarios = ss.insertSheet(NOMBRES_HOJAS.USUARIOS);
    hojaUsuarios.appendRow(['correo', 'nombre', 'rol', 'turno', 'activo']);
    hojaUsuarios.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#dbeafe');

    let correoPropietario = '';
    try {
      correoPropietario = Session.getEffectiveUser().getEmail();
    } catch (e) {
      correoPropietario = '';
    }

    if (correoPropietario) {
      hojaUsuarios.appendRow([correoPropietario.toLowerCase(), 'Administrador / Responsable', 'responsable_turno', 'Tarde', 'SI']);
    }
    hojaUsuarios.appendRow(['camilobernal696@gmail.com', 'Germán Camilo Bernal Muñoz', 'responsable_turno', 'Tarde', 'SI']);
    hojaUsuarios.appendRow(['auxiliar1@institucion.edu.co', 'Laura Sofía Méndez (Ejemplo)', 'auxiliar', 'Mañana', 'SI']);
    hojaUsuarios.appendRow(['jefatura@institucion.edu.co', 'Dra. Marcela Patiño (Ejemplo)', 'jefe_oficina', 'Mañana', 'SI']);
  }

  // 1. Pestaña Elementos
  let hojaElementos = ss.getSheetByName(NOMBRES_HOJAS.ELEMENTOS);
  if (!hojaElementos) {
    hojaElementos = ss.insertSheet(NOMBRES_HOJAS.ELEMENTOS);
    hojaElementos.appendRow(['codigo', 'nombre', 'categoria', 'tipo', 'estado_fisico', 'activo', 'cantidad_total', 'ubicacion']);
    hojaElementos.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f1f5f9');

    const semillas = [
      ['AV-POR-001', 'Portátil Lenovo ThinkPad E14 Gen 5', 'audiovisual', 'Portátil', 'Óptimo', 'SI', 1, 'Estante A1'],
      ['AV-POR-002', 'Portátil Lenovo ThinkPad E14 Gen 5', 'audiovisual', 'Portátil', 'Óptimo', 'SI', 1, 'Estante A1'],
      ['AV-POR-003', 'Portátil Dell Latitude 5440', 'audiovisual', 'Portátil', 'Buen estado', 'SI', 1, 'Estante A2'],
      ['AV-PRY-001', 'VideoBeam Epson PowerLite E20', 'audiovisual', 'Proyector', 'Óptimo', 'SI', 1, 'Estante B1'],
      ['AV-PRY-002', 'VideoBeam Epson PowerLite W49', 'audiovisual', 'Proyector', 'Buen estado', 'SI', 1, 'Estante B1'],
      ['AV-PAR-001', 'Cabina Activa JBL EON710 con Trípode', 'audiovisual', 'Parlante', 'Óptimo', 'SI', 1, 'Zona Audio C1'],
      ['AV-MIC-001', 'Micrófono Inalámbrico Shure BLX24', 'audiovisual', 'Micrófono', 'Óptimo', 'SI', 1, 'Gaveta C2'],
      ['AV-PRE-001', 'Presentador de Diapositivas Logitech R400', 'audiovisual', 'Presentador', 'Desgaste leve', 'SI', 1, 'Gaveta D1'],
      ['AV-PRE-002', 'Presentador Inalámbrico Logitech Spotlight', 'audiovisual', 'Presentador', 'Óptimo', 'SI', 1, 'Gaveta D1'],
      ['AV-CTL-001', 'Control Remoto Epson Aulas Bloque B', 'audiovisual', 'Control', 'Buen estado', 'SI', 1, 'Tablero Llaves E1'],
      ['DEP-FUT-01', 'Balones de Fútbol Golty Profesional #5', 'deportivo', 'Balón', 'Buen estado', 'SI', 10, 'Rack Deportivo R1'],
      ['DEP-VOL-01', 'Balones de Voleibol Mikasa V200W', 'deportivo', 'Balón', 'Óptimo', 'SI', 8, 'Rack Deportivo R2'],
      ['DEP-BAL-01', 'Balones de Baloncesto Spalding TF-500', 'deportivo', 'Balón', 'Buen estado', 'SI', 8, 'Rack Deportivo R3'],
      ['DEP-MES-01', 'Kits de Tenis de Mesa (2 raquetas + 3 bolas)', 'deportivo', 'Implemento', 'Buen estado', 'SI', 12, 'Cajón Deportivo D2'],
      ['DEP-AJE-01', 'Juegos de Ajedrez Reglamentarios con Estuche', 'deportivo', 'Implemento', 'Óptimo', 'SI', 6, 'Estante Deportivo D3']
    ];
    semillas.forEach(function(f) { hojaElementos.appendRow(f); });
  }

  // 2. Pestaña Novedades
  let hojaNovedades = ss.getSheetByName(NOMBRES_HOJAS.NOVEDADES);
  if (!hojaNovedades) {
    hojaNovedades = ss.insertSheet(NOMBRES_HOJAS.NOVEDADES);
    hojaNovedades.appendRow([
      'id_novedad', 'elemento_codigo', 'tipo', 'cantidad', 'solicitante_nombre',
      'solicitante_documento', 'solicitante_dependencia', 'solicitante_vinculo',
      'fecha_evento', 'hora_evento', 'auxiliar_registro', 'estado',
      'evento_orden_salida', 'referencia_autorizacion', 'fecha_cierre', 'hora_cierre',
      'auxiliar_cierre', 'observaciones', 'nota_resolucion'
    ]);
    hojaNovedades.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#f1f5f9');
  }

  // 3. Pestaña Inventarios
  let hojaInventarios = ss.getSheetByName(NOMBRES_HOJAS.INVENTARIOS);
  if (!hojaInventarios) {
    hojaInventarios = ss.insertSheet(NOMBRES_HOJAS.INVENTARIOS);
    hojaInventarios.appendRow(['id_cierre', 'fecha', 'estado', 'responsable_nombre', 'responsable_correo', 'hora_cierre', 'sello_firma', 'observaciones']);
    hojaInventarios.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f1f5f9');
  }

  // 4. Pestaña Detalle_Inventario
  let hojaDetalle = ss.getSheetByName(NOMBRES_HOJAS.DETALLE);
  if (!hojaDetalle) {
    hojaDetalle = ss.insertSheet(NOMBRES_HOJAS.DETALLE);
    hojaDetalle.appendRow(['id_cierre', 'fecha', 'elemento_codigo', 'resultado', 'unidades_oficina', 'unidades_afuera', 'novedades_asociadas']);
    hojaDetalle.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f1f5f9');
  }

  // 5. Pestaña Aperturas
  let hojaAperturas = ss.getSheetByName(NOMBRES_HOJAS.APERTURAS);
  if (!hojaAperturas) {
    hojaAperturas = ss.insertSheet(NOMBRES_HOJAS.APERTURAS);
    hojaAperturas.appendRow(['id_apertura', 'fecha', 'hora', 'auxiliar_nombre', 'auxiliar_correo', 'conforme', 'revisados', 'diferencias', 'observaciones']);
    hojaAperturas.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#f1f5f9');
  }

  // 6. Pestaña Auditoria
  let hojaAuditoria = ss.getSheetByName(NOMBRES_HOJAS.AUDITORIA);
  if (!hojaAuditoria) {
    hojaAuditoria = ss.insertSheet(NOMBRES_HOJAS.AUDITORIA);
    hojaAuditoria.appendRow(['id_auditoria', 'fecha_hora', 'usuario_correo', 'modulo', 'accion', 'detalle']);
    hojaAuditoria.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f1f5f9');
  }

  return { exito: true, mensaje: 'Pestañas verificadas en Google Sheets.' };
}

/**
 * Valida si el correo activo de Google está en la pestaña Usuarios_Autorizados
 */
function obtenerUsuarioActual() {
  let emailActivo = '';
  let emailPropietario = '';
  try {
    emailActivo = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    emailActivo = '';
  }
  try {
    emailPropietario = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    emailPropietario = '';
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName(NOMBRES_HOJAS.USUARIOS);

  if (hojaUsuarios && emailActivo) {
    const filas = hojaUsuarios.getDataRange().getDisplayValues().slice(1);
    for (let i = 0; i < filas.length; i++) {
      const correoFila = String(filas[i][0] || '').trim().toLowerCase();
      const nombreFila = String(filas[i][1] || '').trim();
      const rolFila = String(filas[i][2] || 'auxiliar').trim().toLowerCase();
      const turnoFila = String(filas[i][3] || 'Tarde').trim();
      const activoFila = String(filas[i][4] || 'SI').trim().toUpperCase();

      if (correoFila === emailActivo) {
        if (activoFila === 'NO') {
          return { email: emailActivo, nombre: nombreFila, rol: rolFila, autorizado: false };
        }
        return {
          email: emailActivo,
          nombre: nombreFila || emailActivo.split('@')[0],
          rol: rolFila,
          turno: turnoFila,
          autorizado: true
        };
      }
    }
  }

  // El propietario de la hoja siempre tiene acceso de rescate para no quedar bloqueado
  if (emailActivo && emailActivo === emailPropietario) {
    return {
      email: emailActivo,
      nombre: emailActivo.split('@')[0],
      rol: 'responsable_turno',
      turno: 'Tarde',
      autorizado: true
    };
  }

  // Si la hoja Usuarios_Autorizados tiene correos registrados y el usuario no está ahí, se deniega
  if (hojaUsuarios && hojaUsuarios.getLastRow() > 1) {
    return {
      email: emailActivo,
      nombre: emailActivo ? emailActivo.split('@')[0] : 'No identificado',
      rol: 'sin_acceso',
      autorizado: false
    };
  }

  return {
    email: emailActivo || 'auxiliar@institucion.edu.co',
    nombre: (emailActivo || 'auxiliar').split('@')[0],
    rol: 'responsable_turno',
    autorizado: true
  };
}

function exigirUsuarioAutorizado(permitirJefeConsulta) {
  const u = obtenerUsuarioActual();
  if (!u.autorizado) {
    throw new Error('Acceso denegado para la cuenta ' + (u.email || 'desconocida') + '.');
  }
  if (!permitirJefeConsulta && u.rol === 'jefe_oficina') {
    throw new Error('El rol de Jefe de oficina es únicamente de consulta.');
  }
  return u;
}

/**
 * Lee todas las pestañas de Google Sheets usando getDisplayValues()
 */
function obtenerEstadoCompleto() {
  inicializarEstructuraHojas();
  const usuario = exigirUsuarioAutorizado(true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const filasEl = ss.getSheetByName(NOMBRES_HOJAS.ELEMENTOS).getDataRange().getDisplayValues().slice(1);
  const elementos = filasEl.filter(function(r) { return r[0]; }).map(function(r, idx) {
    return {
      id: 'el-' + (idx + 1),
      codigo: String(r[0]).trim(),
      nombre: String(r[1]).trim(),
      categoria: String(r[2]).trim().toLowerCase() === 'deportivo' ? 'deportivo' : 'audiovisual',
      tipo: String(r[3] || 'Equipo').trim(),
      estadoFisico: String(r[4] || 'Óptimo').trim(),
      activo: String(r[5] || 'SI').toUpperCase() !== 'NO',
      cantidadTotal: Number(r[6]) || 1,
      ubicacion: String(r[7] || 'Estante General').trim()
    };
  });

  const filasNov = ss.getSheetByName(NOMBRES_HOJAS.NOVEDADES).getDataRange().getDisplayValues().slice(1);
  const novedades = filasNov.filter(function(r) { return r[0]; }).map(function(r) {
    return {
      id: String(r[0]),
      elementoCodigo: String(r[1]),
      tipo: String(r[2] || 'prestamo'),
      cantidad: Number(r[3]) || 1,
      solicitanteNombre: String(r[4] || ''),
      solicitanteDocumento: String(r[5] || ''),
      solicitanteDependencia: String(r[6] || ''),
      solicitanteVinculo: String(r[7] || 'Docente'),
      fechaEvento: String(r[8] || ''),
      horaEvento: String(r[9] || ''),
      auxiliarRegistroCorreo: String(r[10] || ''),
      auxiliarRegistroNombre: String(r[10] || '').split('@')[0],
      estado: String(r[11] || 'abierta').toLowerCase() === 'cerrada' ? 'cerrada' : 'abierta',
      eventoOrdenSalida: String(r[12] || ''),
      referenciaAutorizacionExterna: String(r[13] || ''),
      fechaCierre: String(r[14] || ''),
      horaCierre: String(r[15] || ''),
      auxiliarCierreCorreo: String(r[16] || ''),
      auxiliarCierreNombre: String(r[16] || '').split('@')[0],
      observaciones: String(r[17] || ''),
      notaResolucion: String(r[18] || '')
    };
  }).reverse();

  const filasDet = ss.getSheetByName(NOMBRES_HOJAS.DETALLE).getDataRange().getDisplayValues().slice(1);
  const detallesPorCierre = {};
  filasDet.filter(function(r) { return r[0]; }).forEach(function(r) {
    const idC = String(r[0]);
    if (!detallesPorCierre[idC]) detallesPorCierre[idC] = [];
    detallesPorCierre[idC].push({
      elementoCodigo: String(r[2]),
      resultado: String(r[3] || 'en_oficina'),
      unidadesEnOficina: Number(r[4]) || 0,
      unidadesAfuera: Number(r[5]) || 0,
      novedadIds: String(r[6] || '').split(';').filter(Boolean)
    });
  });

  const filasInv = ss.getSheetByName(NOMBRES_HOJAS.INVENTARIOS).getDataRange().getDisplayValues().slice(1);
  const cierres = filasInv.filter(function(r) { return r[0]; }).map(function(r) {
    const idC = String(r[0]);
    return {
      id: idC,
      fecha: String(r[1]),
      estado: String(r[2] || 'firmado'),
      responsableNombre: String(r[3] || ''),
      responsableCorreo: String(r[4] || ''),
      horaCierre: String(r[5] || ''),
      selloConfirmacion: String(r[6] || ''),
      observaciones: String(r[7] || ''),
      detalles: detallesPorCierre[idC] || []
    };
  }).reverse();

  const hojaApe = ss.getSheetByName(NOMBRES_HOJAS.APERTURAS);
  const filasApe = hojaApe ? hojaApe.getDataRange().getDisplayValues().slice(1) : [];
  const aperturas = filasApe.filter(function(r) { return r[0]; }).map(function(r) {
    return {
      id: String(r[0]),
      fecha: String(r[1]),
      hora: String(r[2]),
      auxiliarNombre: String(r[3]),
      auxiliarCorreo: String(r[4]),
      conformeConCierreAnterior: String(r[5]).toUpperCase() === 'SI',
      elementosVerificados: Number(r[6]) || 15,
      diferenciasReportadas: Number(r[7]) || 0,
      observaciones: String(r[8] || '')
    };
  }).reverse();

  const hojaAud = ss.getSheetByName(NOMBRES_HOJAS.AUDITORIA);
  const filasAud = hojaAud ? hojaAud.getDataRange().getDisplayValues().slice(1) : [];
  const auditoria = filasAud.filter(function(r) { return r[0]; }).map(function(r) {
    return {
      id: String(r[0]),
      fechaHora: String(r[1]),
      usuarioCorreo: String(r[2]),
      modulo: String(r[3]),
      accion: String(r[4]),
      detalle: String(r[5])
    };
  }).reverse();

  return {
    usuario: usuario,
    elementos: elementos,
    novedades: novedades,
    cierres: cierres,
    aperturas: aperturas,
    auditoria: auditoria
  };
}

/**
 * Registra una novedad (préstamo, pérdida u orden de salida) con LockService (RNF-05)
 */
function registrarNovedad(datos) {
  const usuario = exigirUsuarioAutorizado(false);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaNovedades = ss.getSheetByName(NOMBRES_HOJAS.NOVEDADES);

    const consecutivo = hojaNovedades.getLastRow();
    const anio = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy');
    const idNovedad = 'NOV-' + anio + '-' + ('000' + consecutivo).slice(-3);
    const fechaHoy = datos.fechaEvento || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const horaHoy = datos.horaEvento || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');

    hojaNovedades.appendRow([
      idNovedad,
      datos.elementoCodigo,
      datos.tipo,
      Number(datos.cantidad) || 1,
      datos.solicitanteNombre,
      datos.solicitanteDocumento || 'Sin documento',
      datos.solicitanteDependencia || 'General',
      datos.solicitanteVinculo || 'Docente',
      "'" + fechaHoy,
      "'" + horaHoy,
      usuario.email,
      'abierta',
      datos.eventoOrdenSalida || '',
      datos.referenciaAutorizacionExterna || '',
      '', '', '',
      datos.observaciones || '',
      ''
    ]);

    registrarAuditoria('Novedades', 'Registro de novedad', idNovedad + ' · ' + datos.elementoCodigo + ' · ' + datos.solicitanteNombre);
    return { exito: true, idNovedad: idNovedad };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cierra una novedad abierta por devolución o resolución (RF-04)
 */
function cerrarNovedad(novedadId, notaResolucion) {
  const usuario = exigirUsuarioAutorizado(false);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(NOMBRES_HOJAS.NOVEDADES);
    const datos = hoja.getDataRange().getDisplayValues();
    const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const hora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');

    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][0]) === String(novedadId)) {
        hoja.getRange(i + 1, 12).setValue('cerrada');
        hoja.getRange(i + 1, 15).setValue("'" + hoy);
        hoja.getRange(i + 1, 16).setValue("'" + hora);
        hoja.getRange(i + 1, 17).setValue(usuario.email);
        hoja.getRange(i + 1, 19).setValue(notaResolucion || 'Elemento recibido en oficina');

        registrarAuditoria('Novedades', 'Cierre de novedad', novedadId + ' cerrada por ' + usuario.email);
        return { exito: true };
      }
    }
    return { exito: false, mensaje: 'No se encontró la novedad ' + novedadId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra verificación opcional de apertura de turno (RF-09)
 */
function registrarAperturaTurno(datos) {
  const usuario = exigirUsuarioAutorizado(false);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(NOMBRES_HOJAS.APERTURAS);
    const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const hora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
    const idApe = 'APE-' + hoy + '-' + hora.replace(':', '');

    hoja.appendRow([
      idApe,
      "'" + hoy,
      "'" + hora,
      usuario.nombre,
      usuario.email,
      datos.conforme ? 'SI' : 'NO',
      Number(datos.revisados) || 15,
      Number(datos.diferencias) || 0,
      datos.observaciones || 'Conteo matutino verificado.'
    ]);

    registrarAuditoria('Apertura', 'Verificación de apertura', idApe + ' · Diferencias: ' + (datos.diferencias || 0));
    return { exito: true, idApertura: idApe };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Agrega o actualiza un elemento en la pestaña Elementos (RF-01 / RF-02)
 */
function guardarElemento(el) {
  exigirUsuarioAutorizado(false);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(NOMBRES_HOJAS.ELEMENTOS);
    const datos = hoja.getDataRange().getDisplayValues();
    const codigoNorm = String(el.codigo || '').trim().toUpperCase();

    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][0]).trim().toUpperCase() === codigoNorm) {
        hoja.getRange(i + 1, 2, 1, 7).setValues([[
          el.nombre,
          el.categoria,
          el.tipo || 'Equipo',
          el.estadoFisico || 'Óptimo',
          el.activo === false ? 'NO' : 'SI',
          el.categoria === 'audiovisual' ? 1 : (Number(el.cantidadTotal) || 1),
          el.ubicacion || 'Estante General'
        ]]);
        registrarAuditoria('Catálogo', 'Actualización de elemento', codigoNorm + ' · ' + el.nombre);
        return { exito: true };
      }
    }

    hoja.appendRow([
      codigoNorm,
      el.nombre,
      el.categoria,
      el.tipo || 'Equipo',
      el.estadoFisico || 'Óptimo',
      el.activo === false ? 'NO' : 'SI',
      el.categoria === 'audiovisual' ? 1 : (Number(el.cantidadTotal) || 1),
      el.ubicacion || 'Estante General'
    ]);
    registrarAuditoria('Catálogo', 'Alta de elemento', codigoNorm + ' · ' + el.nombre);
    return { exito: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Firma y bloquea el inventario de cierre diario en Google Sheets (RF-08)
 */
function firmarCierreDiario(datosCierre) {
  const usuario = exigirUsuarioAutorizado(false);
  if (usuario.rol !== 'responsable_turno') {
    throw new Error('Solo un usuario con rol responsable_turno en la pestaña Usuarios_Autorizados puede firmar el cierre diario.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaInventarios = ss.getSheetByName(NOMBRES_HOJAS.INVENTARIOS);
    const hojaDetalle = ss.getSheetByName(NOMBRES_HOJAS.DETALLE);

    const fecha = datosCierre.fecha || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const hora = datosCierre.horaCierre || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
    const idCierre = 'CIE-' + fecha;
    const prefijo = usuario.email.split('@')[0].toUpperCase().slice(0, 4);
    const sello = 'FIRMA-' + prefijo + '-' + fecha.replace(/-/g, '') + '-' + hora.replace(':', '');

    hojaInventarios.appendRow([
      idCierre,
      "'" + fecha,
      'firmado',
      datosCierre.responsableNombre || usuario.nombre,
      usuario.email,
      "'" + hora,
      sello,
      datosCierre.observaciones || 'Inventario verificado y firmado sin inconsistencias.'
    ]);

    if (datosCierre.detalles && datosCierre.detalles.length > 0) {
      datosCierre.detalles.forEach(function(d) {
        hojaDetalle.appendRow([
          idCierre,
          "'" + fecha,
          d.elementoCodigo,
          d.resultado,
          d.unidadesEnOficina,
          d.unidadesAfuera,
          (d.novedadIds || []).join(';')
        ]);
      });
    }

    registrarAuditoria('Cierre Diario', 'Firma de cierre diario', idCierre + ' · Sello ' + sello);
    return { exito: true, idCierre: idCierre, sello: sello };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Envía aviso por correo al Jefe de la oficina sobre novedades antiguas (RF-13)
 */
function enviarAlertaJefatura(correoJefe, umbralDias) {
  try {
    registrarAuditoria('Historial', 'Aviso enviado a jefatura (RF-13)', 'Destinatario: ' + (correoJefe || 'jefatura') + ' · Umbral: ' + (umbralDias || 3) + ' días');
    if (correoJefe && String(correoJefe).indexOf('@') > 0) {
      MailApp.sendEmail({
        to: correoJefe,
        subject: '[Medios Educativos] Alerta de novedades abiertas por escalar',
        body: 'Se han detectado novedades abiertas que superan el umbral de ' + (umbralDias || 3) + ' días en el Sistema de Inventario Diario.'
      });
    }
    return { exito: true };
  } catch (e) {
    return { exito: false, mensaje: String(e) };
  }
}

function registrarAuditoria(modulo, accion, detalle) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(NOMBRES_HOJAS.AUDITORIA);
    if (!hoja) return;
    const ahora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const usuario = obtenerUsuarioActual();
    const id = 'AUD-' + Utilities.getUuid().slice(0, 6).toUpperCase();
    hoja.appendRow([id, "'" + ahora, usuario.email, modulo, accion, detalle]);
  } catch (e) {
    Logger.log('Error en auditoria: ' + e);
  }
}
