# Plan Financiero PWA

PWA offline-first para administrar un plan financiero quincenal. El frontend esta migrado a React + Vite + TypeScript + Tailwind, con iconos de lucide-react, graficas de Recharts, IndexedDB local y sincronizacion cifrada opcional con Cloudflare Worker/KV.

## Funcionalidad

- Plan quincenal editable.
- Movimientos de efectivo y tarjeta.
- Gastos recurrentes.
- Calendario de pagos de tarjeta y MSI.
- Reportes mensuales con graficas.
- Importacion/exportacion JSON.
- Exportacion CSV.
- Persistencia local en IndexedDB.
- PWA instalable con service worker.
- Sync cifrado opcional contra `https://plan-financiero-sync.uriel-plan-financiero.workers.dev`.

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
