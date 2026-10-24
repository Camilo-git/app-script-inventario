# Sistema de Inventario Diario · Oficina de Medios Educativos

Aplicación web para la verificación diaria de existencias, control de préstamos, órdenes de salida, reporte de pérdidas y firma digital inmutable del cierre de turno en la **Oficina de Medios Educativos**.

El proyecto cuenta con **arquitectura dual**:
1. **Entorno Web React + TypeScript + Vite (`/src`)**: Interfaz interactiva completa con simulación multi-rol, persistencia local instantánea y generación de actas imprimibles/CSV.
2. **Paquete Nativo para Google Apps Script + Google Sheets (`/google-apps-script`)**: Backend `Code.gs` y cliente autocontenido `Index.html` listos para ejecutarse **100% gratis dentro de Google Drive** usando una hoja de cálculo de Google Sheets como base de datos relacional.

---

## Tabla de Contenidos

- [Características Principales y Reglas de Negocio](#características-principales-y-reglas-de-negocio)
- [Flujo Operativo Diario](#flujo-operativo-diario)
- [Estructura de la Base de Datos en Google Sheets](#estructura-de-la-base-de-datos-en-google-sheets)
- [Estructura del Repositorio](#estructura-del-repositorio)
- [Instalación y Ejecución Local (React + Vite)](#instalación-y-ejecución-local-react--vite)
- [Guía Paso a Paso: Despliegue en Google Apps Script y Google Sheets](#guía-paso-a-paso-despliegue-en-google-apps-script-y-google-sheets)
- [Control de Acceso por Correo Electrónico y Roles](#control-de-acceso-por-correo-electrónico-y-roles)

---

## Características Principales y Reglas de Negocio

| Código | Requisito Implementado | Descripción |
| :--- | :--- | :--- |
| **RF-01** | **Control individual de audiovisuales** | Cada portátil, proyector, micrófono, cabina o presentador tiene código único (`AV-POR-001`, etc.) y cantidad fija `1`. |
| **RF-02** | **Control por cantidad en deportivos** | Los implementos deportivos (`DEP-FUT-01`, etc.) se controlan por código general y conteo de unidades en sala vs. unidades afuera. |
| **RF-03** | **Registro de novedades durante el día** | Soporte para **Préstamo**, **Orden de salida** (con evento y referencia de oficio externo) y **Pérdida**, validando disponibilidad real. |
| **RF-04** | **Cierre y devolución de novedades** | Registro de fecha, hora, auxiliar que recibe y nota de verificación al reingresar el elemento a la oficina. |
| **RF-05** | **Inventario de cierre diario obligatorio** | Hoja de control vespertina donde se confirma la presencia física de cada elemento o su justificación. |
| **RF-06** | **Arrastre automático de novedades abiertas** | Toda novedad que permanezca abierta (de hoy o de días anteriores) se precarga automáticamente en el cierre diario sin doble digitación. |
| **RF-07** | **Bloqueo ante ausencias sin justificar** | El sistema impide firmar el cierre diario si algún equipo figura como *"No está"* o faltan unidades deportivas sin novedad abierta asociada. |
| **RF-08** | **Firma digital y bloqueo del cierre** | Solo el **Responsable de turno** puede firmar el cierre, generando un sello único (`FIRMA-...`) que bloquea el acta contra ediciones. |
| **RF-09** | **Verificación opcional de apertura** | Chequeo rápido matutino no bloqueante para contrastar la estantería frente al cierre firmado la noche anterior. |
| **RF-10** | **Historial y consulta multicriterio** | Filtro histórico por código, nombre, solicitante, dependencia y rango de fechas. |
| **RF-12** | **Exportación de Actas PDF y CSV** | Generación de acta oficial lista para imprimir/guardar en PDF en Drive y descarga CSV de todas las tablas. |
| **RF-13** | **Alertas de escalamiento a Jefatura** | Identificación automática de novedades abiertas que superan el umbral configurable de días (ej. $\ge 3$ días) y notificación por correo (`MailApp`). |
| **RNF-01** | **Autenticación y bitácora inmutable** | Control de acceso por correo institucional (`Session.getActiveUser().getEmail()`) y registro en la pestaña `Auditoria`. |
| **RNF-03** | **Correcciones mediante adendas** | Los cierres firmados nunca se sobrescriben; cualquier aclaración posterior se anexa con autor, fecha, hora y motivo. |
| **RNF-05** | **Control de concurrencia (`LockService`)** | Uso de `LockService.getScriptLock()` en Apps Script para evitar colisiones cuando varios auxiliares registran datos simultáneamente. |

---

## Flujo Operativo Diario

1. **Inicio del turno (Mañana · Opcional):**
   El auxiliar revisa visualmente los estantes en la pestaña **Apertura** y guarda constancia de conformidad respecto al cierre anterior.
2. **Durante el día (Atención al público):**
   Cada vez que sale un equipo o implemento deportivo, se registra en **Novedades** (*Préstamo*, *Orden de salida* o *Pérdida*). Cuando el usuario lo devuelve, se hace clic en **Cerrar / Recibir**.
3. **Final de la tarde (Cierre Diario · Obligatorio):**
   * Las novedades que siguen abiertas ya aparecen precargadas y justificadas automáticamente.
   * El auxiliar verifica visualmente los estantes: si detecta que falta algo adicional, lo marca como *"No está"* y presiona **"Justificar ausencia"**.
   * Para el resto del inventario presente en estantería, presiona **"Marcar pendientes sin novedad como En oficina"**.
   * Con **0 requisitos pendientes**, el Responsable de turno marca la declaración de conformidad y presiona **"Firmar y bloquear cierre diario"**.

---

## Estructura de la Base de Datos en Google Sheets

Al ejecutar `inicializarEstructuraHojas` en Google Apps Script, el sistema crea y configura automáticamente **7 pestañas** en tu archivo de Google Sheets:

1. **`Usuarios_Autorizados`**: `correo`, `nombre`, `rol` (`responsable_turno` | `auxiliar` | `jefe_oficina`), `turno`, `activo` (`SI` | `NO`).
2. **`Elementos`**: `codigo`, `nombre`, `categoria` (`audiovisual` | `deportivo`), `tipo`, `estado_fisico`, `activo`, `cantidad_total`, `ubicacion`.
3. **`Novedades`**: `id_novedad`, `elemento_codigo`, `tipo`, `cantidad`, `solicitante_nombre`, `solicitante_documento`, `solicitante_dependencia`, `solicitante_vinculo`, `fecha_evento`, `hora_evento`, `auxiliar_registro`, `estado`, `evento_orden_salida`, `referencia_autorizacion`, `fecha_cierre`, `hora_cierre`, `auxiliar_cierre`, `observaciones`, `nota_resolucion`.
4. **`Inventarios`**: `id_cierre`, `fecha`, `estado`, `responsable_nombre`, `responsable_correo`, `hora_cierre`, `sello_firma`, `observaciones`.
5. **`Detalle_Inventario`**: `id_cierre`, `fecha`, `elemento_codigo`, `resultado`, `unidades_oficina`, `unidades_afuera`, `novedades_asociadas`.
6. **`Aperturas`**: `id_apertura`, `fecha`, `hora`, `auxiliar_nombre`, `auxiliar_correo`, `conforme`, `revisados`, `diferencias`, `observaciones`.
7. **`Auditoria`**: `id_auditoria`, `fecha_hora`, `usuario_correo`, `modulo`, `accion`, `detalle`.

---

## Estructura del Repositorio

```text
├── google-apps-script/             # Paquete listo para copiar a Google Apps Script
│   ├── Code.gs                     # Backend Apps Script (Sheets + LockService + Auth + MailApp)
│   ├── Index.html                  # Interfaz Web App autocontenida (HTML + Tailwind + JS)
│   ├── appsscript.json             # Manifiesto de configuración y zona horaria
│   └── README_PASO_A_PASO.md       # Manual detallado de instalación en Google Drive
├── src/                            # Aplicación React + TypeScript (Entorno de desarrollo / Demo)
│   ├── components/
│   │   ├── AperturaTurnoView.tsx   # Módulo de verificación matutina (RF-09)
│   │   ├── CatalogoView.tsx        # Administración del catálogo maestro (RF-01, RF-02)
│   │   ├── CerrarNovedadModal.tsx  # Modal de devolución y resolución (RF-04)
│   │   ├── CierreDiarioView.tsx    # Flujo central de cierre y firma (RF-05 a RF-08)
│   │   ├── GuiaAppsScriptModal.tsx # Asistente integrado para copiar Code.gs e Index.html
│   │   ├── HistorialConsultaView.tsx # Historial, adendas y alertas a jefatura (RF-10, RF-13)
│   │   ├── NovedadModal.tsx        # Modal de registro de préstamos/salidas/pérdidas (RF-03)
│   │   └── NovedadesView.tsx       # Panel y filtros de novedades activas e históricas
│   ├── data/
│   │   └── seedData.ts             # Datos semilla de demostración
│   ├── hooks/
│   │   └── useInventoryStore.ts    # Estado centralizado y validaciones transaccionales
│   ├── types/
│   │   └── inventory.ts            # Definiciones de tipos e interfaces TypeScript
│   ├── utils/
│   │   ├── gasBridge.ts            # Puente de comunicación con google.script.run y exportación
│   │   └── inventoryRules.ts       # Reglas puras de negocio y validación de cuadre
│   ├── App.tsx                     # Componente raíz y navegación
│   └── main.tsx                    # Punto de entrada React
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Instalación y Ejecución Local (React + Vite)

Si deseas ejecutar o modificar la versión de desarrollo local en tu computador:

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone <URL_DE_TU_REPOSITORIO>
   cd <NOMBRE_DE_LA_CARPETA>
   npm install
   ```

2. **Iniciar el servidor de desarrollo (puerto 3000):**
   ```bash
   npm run dev
   ```

3. **Compilar para producción:**
   ```bash
   npm run build
   ```

---

## Guía Paso a Paso: Despliegue en Google Apps Script y Google Sheets

Para montar el sistema directamente en tu cuenta de **Google Drive** usando **Google Sheets** como base de datos, solo necesitas los archivos **`google-apps-script/Code.gs`** y **`google-apps-script/Index.html`**:

### 1. Crear la Hoja de Cálculo en Google Drive
1. Abre [Google Drive](https://drive.google.com) y haz clic en **+ Nuevo > Hoja de cálculo de Google**.
2. Nómbrala: `Inventario Diario - Oficina de Medios Educativos`.
3. En el menú superior haz clic en **Extensiones > Apps Script**.

### 2. Pegar `Code.gs` e inicializar las pestañas
1. En el editor de Apps Script, borra el contenido inicial de `Código.gs`.
2. Copia todo el contenido de **`google-apps-script/Code.gs`** y pégalo en `Código.gs`.
3. Guarda el proyecto (`Ctrl + S`).
4. En la barra superior del editor, selecciona la función **`inicializarEstructuraHojas`** y haz clic en **Ejecutar**.
5. Autoriza los permisos cuando Google lo solicite (*Revisar permisos > Configuración avanzada > Ir al proyecto > Permitir*).
6. Verifica en tu hoja de cálculo que se hayan creado automáticamente las pestañas: `Usuarios_Autorizados`, `Elementos`, `Novedades`, `Inventarios`, `Detalle_Inventario`, `Aperturas` y `Auditoria`.

### 3. Crear el archivo `Index.html`
1. En el panel izquierdo de Apps Script, junto a **Archivos**, haz clic en **`+` > HTML**.
2. Nómbralo exactamente **`Index`** (con `I` mayúscula; Apps Script añadirá `.html`).
3. Borra el HTML predeterminado, pega todo el contenido de **`google-apps-script/Index.html`** y guarda (`Ctrl + S`).
   > **Nota:** Asegúrate de copiar `google-apps-script/Index.html` y **no** el `index.html` de la raíz del proyecto.

### 4. Publicar como Aplicación Web
1. Haz clic arriba a la derecha en **Implementar > Nueva implementación**.
2. Haz clic en el ícono de engranaje ⚙️ y selecciona **Aplicación web**.
3. Configura el acceso (ver sección siguiente según uses correo institucional o `@gmail.com`) y haz clic en **Implementar**.
4. Copia la **URL de la aplicación web** (`/exec`) y compártela con los auxiliares de tu dependencia.

> Para más detalles sobre actualizaciones de versión y solución de problemas, consulta el manual dedicado en [`google-apps-script/README_PASO_A_PASO.md`](./google-apps-script/README_PASO_A_PASO.md).

---

## Control de Acceso por Correo Electrónico y Roles

El sistema restringe el acceso utilizando la pestaña **`Usuarios_Autorizados`** de tu Google Sheets:

1. Abre la pestaña **`Usuarios_Autorizados`** en tu hoja de cálculo y agrega los correos electrónicos de tu equipo:
   * **`responsable_turno`**: Puede operar todos los módulos y es el único autorizado para **firmar y bloquear el cierre diario**.
   * **`auxiliar`**: Puede registrar préstamos, órdenes de salida, pérdidas, devoluciones y conteos físicos.
   * **`jefe_oficina`**: Ingresa en modo **solo consulta** (sin permisos de escritura).
2. Para dar de baja a un auxiliar al finalizar el semestre, basta con cambiar la columna `activo` de `SI` a `NO` en esa pestaña sin modificar el código ni perder su trazabilidad histórica.
