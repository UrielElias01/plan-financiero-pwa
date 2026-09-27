# Plan Financiero PWA

Aplicación web progresiva para planear por quincenas y llevar ingresos, gastos, suscripciones, pagos de tarjeta y compras a meses. Interfaz oscura adaptable con panel de saldos, tablas de estimaciones y desglose de cuotas.

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

- Plan vacío desde la fecha actual, con doce meses iniciales de proyección.
- Ingresos y gastos reales con alta, edición y eliminación que recalculan saldos.
- Sueldo estimado por quincena sustituido por la nómina registrada, sin duplicarlo.
- Ahorro comprobado con fecha de saldo y próxima nómina pendiente, sin repetir sueldos ya gastados.
- Ahorro libre y apartados de renta y comida separados, con elección del origen de cada pago.
- Movimientos planeados que requieren confirmación aunque su fecha ya haya pasado.
- MSI de hasta 120 cuotas, mensualidad bancaria, cuotas iniciales pagadas y próximo mes de pago.
- Calendario por mes y año con pagos realizados, pendientes y detalle por compra.
- Pagos parciales, asignación a una quincena y saldo a favor de tarjeta.
- Reparto explícito por compra; la parte personal no reduce la deuda completa ante el banco.
- Suscripciones proyectadas y confirmadas por el usuario, con historial protegido al editarlas.
- Tablas y reportes que separan movimientos reales de estimaciones.
- Proyección por fecha de ingresos y vencimientos para detectar faltantes antes del cierre quincenal.
- Importación JSON validada y migración de respaldos antiguos con avisos de revisión.
- Importación local de estados BBVA con revisión del corte, pago requerido, deuda y cuotas MSI antes de confirmar.
- Exportación JSON/CSV, manual interno, ayuda contextual y tours.
- Persistencia local en IndexedDB, PWA sin conexión y sync cifrado opcional.

## Modelo financiero

La explicacion completa esta en [docs/FINANCIAL_MODEL.md](docs/FINANCIAL_MODEL.md).

Resumen corto:

- Los saldos se recalculan desde las bases de conciliación y los movimientos; el calendario no es otra fuente de deuda.
- La conciliación conserva una medición de dinero disponible. Editar el historial anterior no altera esa medición; los movimientos nuevos se pueden corregir o eliminar con recálculo de su efecto.
- Cada cuota pendiente existe en un solo mes. Los pagos reales cancelan obligaciones una sola vez.
- El sueldo y las suscripciones previstos no se convierten en dinero real al abrir la app.
- El cierre estimado conserva únicamente el ahorro libre después de apartar renta, comida y obligaciones pendientes.
- El último estado de cuenta concilia la tarjeta al corte; sus cargos no se suman otra vez como compras independientes.
- La deuda inicial incluye solamente importes ausentes de las compras registradas.
- Cerrar una quincena no modifica dinero ni marca pagos como realizados.
- Las estimaciones usan centavos enteros y dependen de lo capturado; los cambios externos deben registrarse.

La importación BBVA admite PDF, JSON, TXT, una plantilla CSV y captura manual para una tarjeta. Lee archivos en el dispositivo y requiere revisar los datos detectados. Los PDF deben tener texto seleccionable; un escaneo necesita transcripción. El lector propone campos del resumen y permite completar las compras MSI. Importar un estado no marca su pago como realizado. No hay conexión con el banco ni descarga automática. Los estados posteriores, pagos reales y cambios de precio deben registrarse para mantener vigente la proyección.

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
npm run check:engine
npm run check:rollover
npm run check:backups
npm run check:sync
```

En Codex local usa el Node empaquetado si el Node del sistema es viejo:

```powershell
C:\Users\uriel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\typescript\bin\tsc -b
C:\Users\uriel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\vite\bin\vite.js build --configLoader native
```

Las pruebas públicas usan importes ficticios y fechas fijas. Los casos de verificación con datos personales y sus respaldos se mantienen fuera del repositorio.

## Deploy

GitHub Pages publica `pwa-finanzas/dist` con `.github/workflows/deploy-pwa.yml`.

El sync cifrado se despliega aparte desde `cloudflare-sync/`. Revisa [cloudflare-sync/README.md](cloudflare-sync/README.md).

## Graphify

Este repo incluye un grafo local generado con Graphify:

- [.graphify/graph.json](.graphify/graph.json)
- [.graphify/GRAPH_REPORT.md](.graphify/GRAPH_REPORT.md)

Cuando el MCP de Graphify este cargado en Codex, puede consultar ese grafo para responder preguntas de arquitectura sin leer todo el repo cada vez.

La revisión de este cambio no pudo regenerar el grafo: el CLI `graphify` no está instalado en el entorno. El paquete npm de igual nombre no proporciona el CLI requerido por `AGENTS.md`. El grafo existente puede estar desactualizado; verifica el código antes de usar sus relaciones.

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
