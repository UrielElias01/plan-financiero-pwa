# Plan Financiero PWA

Aplicacion web progresiva para llevar un plan financiero quincenal con ahorros, renta apartada, compras con tarjeta de credito, pagos de debito/efectivo, MSI, reportes mensuales y sincronizacion cifrada opcional.

La app publica no debe contener datos personales. Los importes reales viven en respaldos JSON privados, IndexedDB local del navegador o en el backend cifrado si decides usar sync.

## Estructura del repo

```text
.
├── pwa-finanzas/          React + Vite + TypeScript + Tailwind
├── cloudflare-sync/       Worker + D1/KV para respaldo cifrado opcional
├── deploy/                Scripts de publicacion manual
├── tools/                 Verificadores y utilidades locales
├── docs/                  Documentacion tecnica y del modelo financiero
├── .graphify/             Grafo local del codigo para asistencia con Codex
└── AGENTS.md              Reglas locales para usar Graphify con Codex
```

## Funcionalidad principal

- Plan por quincenas, respetando que cada sueldo financia la quincena siguiente.
- Ahorro actual y renta apartada por separado.
- Cierre de quincena para aplicar sueldo, separar renta y agregar la siguiente quincena estimada.
- Movimientos de tarjeta de credito, efectivo o debito.
- Pagos con tarjeta a una exhibicion, 3 MSI o 6 MSI.
- Saldo utilizado de tarjeta, adicional al pago al corte.
- Pagos de efectivo/debito descontados del ahorro cuando aplican a la quincena base.
- Compras compartidas con pareja para separar total cargado vs carga personal.
- Reportes mensuales con graficas y exportacion CSV/JSON.
- Manual interno, ayuda contextual y tours guiados por modulo.
- Consejos financieros accionables calculados desde el estado actual.
- Actualizacion PWA desde la app, sin desinstalar ni perder IndexedDB.
- PWA offline-first con IndexedDB.
- Sync cifrado opcional con Cloudflare Worker.

## Modelo financiero

La explicacion completa esta en [docs/FINANCIAL_MODEL.md](docs/FINANCIAL_MODEL.md).

Resumen corto:

- `settings.currentSavings` es el ahorro real de arranque.
- La primera quincena representa el estado actual; por eso no se recalcula completa como una quincena futura.
- Un movimiento de efectivo/debito en la primera quincena baja `currentSavings` directamente.
- Una compra de tarjeta no baja el ahorro al capturarla; genera pagos futuros de TDC.
- Al cerrar una quincena, el sueldo se aplica al ahorro y la renta pasa al apartado; al pagar renta, se restablece ese apartado desde Ajustes.
- El saldo utilizado de TDC se captura como el numero real que muestra el banco; si esta en cero, la app usa los campos legacy como respaldo.

## Desarrollo local

Requiere Node compatible con Vite 7. Se recomienda Node `20.19+` o `22.12+`.

```powershell
cd pwa-finanzas
npm ci
npm run dev
```

La app queda en:

```text
http://127.0.0.1:4173/plan-financiero-pwa/
```

## Verificacion

```powershell
cd pwa-finanzas
npm run build
npm run check:rollover
npm run check:sync
```

En Codex local usa el Node empaquetado si el Node del sistema es viejo:

```powershell
C:\Users\uriel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\typescript\bin\tsc -b
C:\Users\uriel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\vite\bin\vite.js build --configLoader native
```

Si tienes el respaldo privado local requerido por el verificador:

```powershell
npm run check:private
```

## Deploy

GitHub Pages publica `pwa-finanzas/dist` con `.github/workflows/deploy-pwa.yml`.

El sync cifrado se despliega aparte desde `cloudflare-sync/`. Revisa [cloudflare-sync/README.md](cloudflare-sync/README.md).

## Graphify

Este repo incluye un grafo local generado con Graphify:

- [.graphify/graph.json](.graphify/graph.json)
- [.graphify/GRAPH_REPORT.md](.graphify/GRAPH_REPORT.md)

Cuando el MCP de Graphify este cargado en Codex, puede consultar ese grafo para responder preguntas de arquitectura sin leer todo el repo cada vez.

Despues de tocar codigo corre:

```powershell
graphify update . --scope auto --no-description --no-label --force
graphify portable-check .graphify
```

## Privacidad

No subas:

- respaldos personales JSON;
- tokens;
- exports con importes reales;
- archivos bajo `private-data/`, `work/` u `outputs/`;
- cache local de Graphify.
- tokens pegados en chat o terminal compartida.

Si un token fue pegado accidentalmente en una conversacion o archivo, hay que revocarlo y generar uno nuevo.
