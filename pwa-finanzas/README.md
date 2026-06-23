# Plan Financiero PWA

PWA offline-first para administrar un plan financiero quincenal. El frontend esta migrado a React + Vite + TypeScript + Tailwind, con iconos de lucide-react, graficas de Recharts, IndexedDB local y sincronizacion cifrada opcional con Cloudflare Worker/KV.

## Funcionalidad

- Plan quincenal editable.
- Movimientos de efectivo y tarjeta.
- Gastos recurrentes.
- Calendario de pagos de tarjeta y MSI.
- Saldo utilizado de tarjeta, separado del pago al corte.
- Pagos en efectivo/debito descontados del ahorro cuando se registran en la quincena base.
- Reportes mensuales con graficas.
- Manual dinamico con ayuda contextual por pantalla.
- Tours guiados por modulo con foco visual, oscurecimiento, flechas y pasos detallados.
- Importacion/exportacion JSON.
- Exportacion CSV.
- Persistencia local en IndexedDB.
- PWA instalable con service worker.
- Sync cifrado opcional contra `https://plan-financiero-sync.uriel-plan-financiero.workers.dev`.

## Manual dentro de la app

La seccion `Manual` explica para que sirve cada pantalla, que campos puedes modificar y un paso a paso recomendado. Ademas, el boton `Ayuda` del encabezado abre una guia rapida contextual segun la pantalla actual.

El boton `Tour` inicia una guia flotante que cambia de pantalla conforme avanzas, oscurece lo demas y resalta la seccion exacta con circulo y flecha. Desde `Manual` tambien puedes iniciar tours especificos por modulo para revisar botones, graficas, tablas y formularios sin recorrer toda la app.

## Reglas financieras importantes

- La primera quincena parte de `Ahorro actual`; no se recalcula completa para evitar doble conteo.
- Si agregas un movimiento de `Efectivo / debito` en esa primera quincena, la app baja `Ahorro actual` porque ese dinero sale de ahorro/debito.
- Si el debito fue compartido, el ajuste directo al ahorro usa solo tu mitad.
- Una compra con `Tarjeta de credito` no baja el ahorro al capturarla; se agenda como pago futuro de TDC.
- La pantalla `Tarjeta` muestra `Pago al corte` y `Saldo utilizado TDC`. Ese saldo representa el siguiente corte mas lo que queda a meses.
- Los campos avanzados de `Ajustes > Base de tarjeta` permiten corregir saldo previo, pagos aplicados, puntos y saldos no recurrentes.

La documentacion completa del modelo esta en `../docs/FINANCIAL_MODEL.md`.

## Desarrollo local

Requiere Node `^20.19.0` o `>=22.12.0`. El workflow de GitHub Pages usa Node 24.

```powershell
npm ci
npm run dev
```

Abre:

```text
http://127.0.0.1:4173
```

## Build y verificacion

```powershell
npm run build
npm run check
npm run check:sync
```

El build genera `dist/`, que es lo que publica GitHub Pages.

La verificacion privada de calculos usa un respaldo local ignorado por Git:

```powershell
npm run check:private
```

Ese archivo no debe subirse al repo porque contiene importes reales.

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
