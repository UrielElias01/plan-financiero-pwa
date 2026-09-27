# Plan Financiero PWA

PWA offline-first para administrar un plan financiero quincenal. El frontend esta migrado a React + Vite + TypeScript + Tailwind, con iconos de lucide-react, graficas de Recharts, IndexedDB local y sincronizacion cifrada opcional con Cloudflare Worker/KV.

## Funcionalidad

- Plan vacío con doce meses iniciales y una interfaz oscura adaptable.
- Movimientos reales con alta, edición y eliminación; saldos recalculados en centavos.
- Sueldo estimado quincenal sustituido por la nómina real.
- Saldo comprobado a una fecha y próxima nómina pendiente para evitar reutilizar ingresos ya gastados.
- Apartados de renta y comida y selección del origen de cada salida de dinero.
- Movimientos planeados con confirmación explícita, sin activarlos al llegar su fecha.
- Suscripciones proyectadas con confirmación explícita de cargos.
- MSI de hasta 120 meses: mensualidad, cuotas pagadas antes del registro y próximo pago.
- Calendario por mes y año con cuota, pagos aplicados y deuda restante.
- Pagos TDC parciales, asignación por quincena y saldo a favor.
- Reparto personal explícito; el pago bancario conserva el cargo completo.
- Reportes que separan flujo real y estimaciones.
- Proyección por fecha para detectar falta de ahorro disponible antes de cada vencimiento.
- Manual dinamico con ayuda contextual por pantalla.
- Tours guiados por modulo con foco visual, oscurecimiento, flechas y pasos detallados.
- Consejos financieros accionables en `Inicio`, derivados de ahorro, TDC, recurrentes y flujo.
- Busqueda/aplicacion de actualizaciones PWA desde `Ajustes`.
- Importación JSON validada, exportación y migración de respaldos v1/v2/v3 a v4.
- Importación local de estados BBVA con revisión de deuda, pago requerido y detalle MSI.
- Exportacion CSV.
- Persistencia local en IndexedDB.
- PWA instalable con service worker.
- Sync cifrado opcional contra `https://plan-financiero-sync.uriel-plan-financiero.workers.dev`.

## Manual dentro de la app

La seccion `Manual` explica para que sirve cada pantalla, que campos puedes modificar y un paso a paso recomendado. Ademas, el boton `Ayuda` del encabezado abre una guia rapida contextual segun la pantalla actual.

El boton `Tour` inicia una guia flotante que cambia de pantalla conforme avanzas, oscurece lo demas y resalta la seccion exacta con circulo y flecha. Desde `Manual` tambien puedes iniciar tours especificos por modulo para revisar botones, graficas, tablas y formularios sin recorrer toda la app.

## Reglas financieras importantes

- El dinero disponible se deriva de saldos iniciales y movimientos reales. Guardar de nuevo no vuelve a aplicar un gasto.
- El saldo comprobado ya incluye ingresos y gastos anteriores a su fecha. La próxima nómina pendiente evita sumar de nuevo el sueldo de una quincena consumida.
- Editar o borrar historial ya conciliado conserva ese saldo comprobado; las correcciones de movimientos posteriores recalculan su efecto sobre el dinero actual.
- La nómina aparta renta y comida y sustituye la estimación de su quincena. Un ingreso extra se suma sin sustituirla.
- Una compra con tarjeta no resta efectivo; cada cuota genera una obligación y el Pago TDC la cancela una sola vez.
- Las cuotas pagadas antes de registrar una compra son el punto de partida. Los pagos posteriores se capturan como movimientos y no se vuelven a sumar a ese contador inicial.
- La deuda inicial de Ajustes incluye solamente importes que no estén ya en compras registradas.
- La parte personal de una compra compartida es informativa. Un reembolso se registra al recibirlo; no se descuenta automáticamente de la deuda bancaria.
- Confirmar un cargo de suscripción lo convierte en movimiento real. Cambiar la suscripción conserva lo ya confirmado.
- Cerrar una quincena no cambia dinero ni confirma pagos.
- Una salida desde el apartado de renta o comida utiliza ese dinero primero y descuenta del ahorro libre únicamente lo que falte.
- El último estado BBVA sustituye la base de deuda al corte. Los movimientos posteriores actualizan esa base; los estados anteriores permanecen como historial.
- El estado importado conserva el pago requerido como obligación; para reducirla hay que confirmar un pago realizado.
- La secuencia diaria considera ingresos antes de salidas del mismo día. Una nómina posterior al vencimiento no lo cubre anticipadamente, aunque ambos estén en la misma quincena.
- Las proyecciones dependen de tus datos; no incluyen cambios, comisiones o intereses que no hayas registrado.

La importación BBVA admite PDF, JSON, TXT, una plantilla CSV y captura manual para una tarjeta. Necesita revisión antes de aplicar el estado. Los PDF requieren texto seleccionable; los escaneos necesitan transcripción. El lector propone campos del resumen y permite completar las compras MSI. El análisis ocurre localmente y no conecta con el banco. Un resumen sin desglose suficiente no permite deducir todos los comercios ni las suscripciones futuras con certeza.

La documentación completa está en [Modelo financiero](../docs/FINANCIAL_MODEL.md).

## Desarrollo local

Requiere Node `^20.19.0` o `>=22.12.0`. El workflow de GitHub Pages usa Node 24.

```powershell
npm ci
npm run dev
```

Abre:

```text
http://127.0.0.1:4173/plan-financiero-pwa/
```

## Build y verificacion

```powershell
npm run build
npm run check
npm run check:engine
npm run check:rollover
npm run check:backups
npm run check:sync
```

El build genera `dist/`, que es lo que publica GitHub Pages.

Si estas en Codex y `npm` usa un Node viejo, corre el build directo con el Node empaquetado:

```powershell
C:\Users\uriel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\typescript\bin\tsc -b
C:\Users\uriel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\vite\bin\vite.js build --configLoader native
```

## Actualizaciones PWA

La app registra `public/sw.js`, busca nuevas versiones desde `Ajustes` y aplica el service worker en espera con `SKIP_WAITING`. Al actualizar no se borra IndexedDB; los datos se pierden solo si se desinstala la PWA o se borran los datos del sitio. Aun asi, exporta JSON o usa sync antes de cambios grandes.

Las pruebas públicas usan importes ficticios y fechas fijas. Los casos de verificación con datos personales y sus respaldos se mantienen fuera del repositorio.

## Deploy

El deploy gratis usa GitHub Pages con `.github/workflows/deploy-pwa.yml`:

1. Instala dependencias con `npm ci`.
2. Compila `pwa-finanzas/dist`.
3. Publica el artefacto en Pages.

URL publica:

```text
https://urielelias01.github.io/plan-financiero-pwa/
```

## Privacidad

El repo publico no debe incluir respaldos privados, tokens, importes reales ni exports del usuario. Los datos personales se cargan desde la app con importacion JSON y se guardan solo en IndexedDB o en el sync cifrado, segun lo configures en Ajustes.
