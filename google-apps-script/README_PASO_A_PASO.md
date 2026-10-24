# Guía Completa Paso a Paso: Cómo Crear y Montar el Sistema en Google Apps Script y Google Sheets

Esta guía documenta de principio a fin cómo montar el **Sistema de Inventario Diario de la Oficina de Medios Educativos** en tu cuenta de **Google Drive**, utilizando **Google Sheets** como base de datos y **Google Apps Script** como servidor e interfaz web (sin servidores externos ni costos de licencias).

---

## Resumen de Archivos que Necesitas

Aunque el repositorio completo contiene carpetas de desarrollo local (`src/`, `package.json`, etc.), **para montar la aplicación en Google Apps Script únicamente necesitas los 2 archivos ubicados dentro de la carpeta `/google-apps-script/`**:

1. **`google-apps-script/Code.gs`**: Contiene toda la lógica del servidor, creación automática de las 6 pestañas en Google Sheets, bloqueo de concurrencia (`LockService`), control de acceso por correo y rol (`Usuarios_Autorizados`), firma digital y bitácora de auditoría.
2. **`google-apps-script/Index.html`**: Contiene toda la interfaz visual y la lógica interactiva en un solo archivo HTML (pestañas de *Cierre Diario*, *Novedades*, *Apertura*, *Catálogo* e *Historial*, sub-pestañas de filtro, buscadores en tiempo real y exportación CSV/PDF).

> **Importante:** No uses el archivo `index.html` que está en la raíz del proyecto (ese archivo es exclusivo para el entorno local de React/Vite y se verá en blanco en Apps Script). Usa siempre **`google-apps-script/Index.html`** o cópialo directamente desde el botón **"Importar a Drive (Apps Script)"** en la barra superior de la aplicación.

---

## Paso 1: Crear la Hoja de Cálculo en Google Drive

1. Ingresa a tu cuenta de [Google Drive](https://drive.google.com).
2. Haz clic en el botón **+ Nuevo** (esquina superior izquierda) y selecciona **Hoja de cálculo de Google > Hoja de cálculo en blanco**.
3. Cambia el título en la parte superior izquierda por:
   ```text
   Inventario Diario - Oficina de Medios Educativos
   ```
4. No necesitas crear columnas ni hojas manualmente; el código las creará por ti en el Paso 3.

---

## Paso 2: Abrir el Editor de Google Apps Script

1. Dentro de la hoja de cálculo que acabas de crear, ve al menú superior y haz clic en:
   **Extensiones > Apps Script**.
2. Se abrirá una nueva pestaña del navegador con el editor de Google Apps Script vinculado a tu hoja de cálculo.
3. Ponle nombre al proyecto haciendo clic arriba donde dice *"Proyecto sin título"* y escribe:
   ```text
   Sistema Inventario Medios Educativos
   ```

---

## Paso 3: Cargar el Backend (`Code.gs`) e Inicializar las Pestañas

1. En el panel izquierdo de Apps Script, bajo la sección **Archivos**, verás un archivo abierto por defecto llamado **`Código.gs`** (o `Code.gs`).
2. Borra el código de ejemplo que trae por defecto (`function myFunction() {}`).
3. Abre el archivo **`google-apps-script/Code.gs`** de este proyecto, copia **todo su contenido** y pégalo dentro de `Código.gs`.
4. Presiona el ícono de **Guardar proyecto** (💾) o presiona **`Ctrl + S`** (en Mac: `Cmd + S`).

### Ejecutar la inicialización automática de la base de datos:
1. En la barra superior del editor de Apps Script (a la derecha del botón **Ejecutar**), abre el menú desplegable de funciones y selecciona:
   **`inicializarEstructuraHojas`**
2. Haz clic en **Ejecutar**.
3. Aparecerá una ventana emergente solicitando **Autorización necesaria**:
   * Haz clic en **Revisar permisos**.
   * Selecciona tu cuenta de Google.
   * Si aparece una pantalla de advertencia diciendo *"Google no verificó esta app"*, haz clic en **Configuración avanzada** (abajo a la izquierda) y luego en **Ir a Sistema Inventario Medios Educativos (no seguro)** > **Permitir**.
4. Regresa a la pestaña de tu **Google Sheets** y verifica que se hayan creado automáticamente las **6 pestañas** con sus encabezados y el catálogo semilla:
   * `Usuarios_Autorizados` *(lista blanca de correos y roles)*
   * `Elementos` *(catálogo de equipos audiovisuales e implementos deportivos)*
   * `Novedades` *(préstamos, órdenes de salida y pérdidas)*
   * `Inventarios` *(encabezados y sellos de firma de cada cierre diario)*
   * `Detalle_Inventario` *(conteo línea por línea de cada cierre firmado)*
   * `Aperturas` *(constancias opcionales de revisión matutina)*
   * `Auditoria` *(bitácora inmutable de acciones)*

---

## Paso 4: Crear la Interfaz Web (`Index.html`)

1. Vuelve a la pestaña del editor de **Apps Script**.
2. En el menú lateral izquierdo, al lado de **Archivos**, haz clic en el botón **`+`** y selecciona **HTML**.
3. Escribe como nombre del archivo exactamente:
   ```text
   Index
   ```
   *(Asegúrate de que la primera **`I`** sea mayúscula y no escribas `.html`, ya que Google agrega la extensión automáticamente).*
4. Presiona **`Enter`** y borra las líneas HTML básicas que aparecen por defecto.
5. Abre el archivo **`google-apps-script/Index.html`** de este proyecto, copia **todo su contenido** y pégalo en el editor.
6. Presiona **Guardar proyecto** (`Ctrl + S`).

---

## Paso 5: Configurar los Correos Autorizados de tu Dependencia

1. Ve a tu archivo de **Google Sheets** y abre la primera pestaña llamada **`Usuarios_Autorizados`**.
2. Registra en las filas los correos electrónicos de los integrantes de tu oficina siguiendo estas columnas:

| `correo` | `nombre` | `rol` | `turno` | `activo` |
| :--- | :--- | :--- | :--- | :--- |
| `tu.correo@institucion.edu.co` | Tu Nombre Completo | `responsable_turno` | Tarde | `SI` |
| `auxiliar1@institucion.edu.co` | Nombre del Auxiliar 1 | `auxiliar` | Mañana | `SI` |
| `auxiliar2@institucion.edu.co` | Nombre del Auxiliar 2 | `auxiliar` | Tarde | `SI` |
| `jefe.medios@institucion.edu.co` | Nombre del Jefe de Oficina | `jefe_oficina` | Mañana | `SI` |

### Roles admitidos en la columna `rol`:
* **`responsable_turno`**: Acceso completo. Es el único rol autorizado para **firmar y bloquear el cierre diario**.
* **`auxiliar`**: Puede registrar novedades (préstamos, órdenes de salida, pérdidas), cerrar devoluciones, verificar apertura y marcar conteos físicos del cierre diario.
* **`jefe_oficina`**: Acceso exclusivo en **modo solo consulta** (puede revisar indicadores, historial y bitácora sin modificar registros).

> Si una persona cuyo correo no esté en esta tabla (o tenga `NO` en la columna `activo`) intenta abrir el enlace web, el sistema bloqueará su ingreso mostrando una pantalla de **Acceso restringido**.

---

## Paso 6: Publicar como Aplicación Web (Web App)

1. En la esquina superior derecha del editor de **Apps Script**, haz clic en el botón azul **Implementar > Nueva implementación**.
2. Junto a *"Seleccionar tipo"*, haz clic en el ícono de **engranaje ⚙️** y marca **Aplicación web**.
3. Configura los parámetros según el tipo de cuentas de correo que utilicen en tu dependencia:

### Opción A: Cuentas institucionales del mismo dominio (Google Workspace, ej. `@universidad.edu.co`)
* **Descripción:** `Versión 1.0 - Inventario Diario Medios Educativos`
* **Ejecutar como:** `Yo (tu correo institucional)`
* **Quién tiene acceso:** `Cualquier usuario de [Nombre de tu Institución]`

### Opción B: Cuentas personales `@gmail.com`
*(En cuentas `@gmail.com` gratuitas, Google solo comparte el correo del visitante con la aplicación si se ejecuta como el usuario que accede)*:
1. En Apps Script configura:
   * **Descripción:** `Versión 1.0 - Inventario Diario Medios Educativos`
   * **Ejecutar como:** `Usuario que accede a la aplicación web`
   * **Quién tiene acceso:** `Cualquier usuario con una cuenta de Google`
2. Además, en tu archivo de **Google Sheets** (botón **Compartir** arriba a la derecha), comparte la hoja de cálculo como **Editor** únicamente con los correos `@gmail.com` de tus auxiliares autorizados.

4. Haz clic en **Implementar**.
5. Copia la **URL de la aplicación web** generada (termina en `/exec`) y compártela con tu equipo.

---

## Paso 7: Cómo Actualizar la Aplicación cuando Hagas Cambios en el Código

Cada vez que modifiques `Code.gs` o `Index.html` en Apps Script, **debes actualizar la versión publicada** para que los cambios se reflejen en el enlace `/exec`:

1. Guarda tus cambios en el editor (`Ctrl + S`).
2. Haz clic arriba a la derecha en **Implementar > Administrar implementaciones**.
3. Haz clic en el ícono del **lápiz ✏️ (Editar)** en la esquina superior derecha de tu implementación activa.
4. En el desplegable **Versión**, selecciona **"Nueva versión"**.
5. Haz clic en **Implementar**. *(La URL de tu aplicación web seguirá siendo exactamente la misma).*

---

## Solución Rápida de Problemas Frecuentes

* **La página abre completamente en blanco:**
  Verifica que hayas copiado el archivo `google-apps-script/Index.html` (de más de 700 líneas con `<script>` incluido) y **no** el archivo `index.html` de la raíz del proyecto.
* **No aparecen las pestañas en el Google Sheet:**
  En el editor de Apps Script, selecciona la función `inicializarEstructuraHojas` en la barra superior y presiona **Ejecutar**.
* **Hice un cambio en `Index.html` o `Code.gs` pero no lo veo en la página web:**
  Recuerda ir a **Implementar > Administrar implementaciones > Editar (✏️) > Versión: Nueva versión > Implementar** y recargar la pestaña del navegador.
