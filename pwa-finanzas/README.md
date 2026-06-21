# Plan Financiero PWA

PWA offline-first para llevar el plan quincenal que venia en el Excel:

- Plan quincenal editable.
- Gastos y movimientos nuevos.
- Gastos recurrentes modificables.
- Calendario de tarjeta de credito.
- Reporte mensual.
- Exportacion/importacion JSON para respaldos.
- Exportacion CSV para reportes.
- Instalacion como PWA en celular.

## Como correr localmente

Desde esta carpeta:

```powershell
python -m http.server 4173
```

Abre:

```text
http://localhost:4173
```

> La PWA necesita servirse por HTTP/HTTPS para registrar el service worker. Abrir `index.html` directo como archivo no basta para modo offline/instalable.

## Verificacion local

Desde la carpeta `pwa-finanzas`:

```powershell
npm run check
```

Ese comando valida sintaxis de la PWA publica.

Desde la raiz del proyecto tambien puedes correr:

```powershell
node tools/verify-sync-worker.mjs
```

La verificacion privada de calculos existe solo en local y no se publica porque
contiene importes reales.

## Como alojarla gratis

La app no necesita backend para funcionar: guarda la base de datos en IndexedDB dentro del navegador del usuario. Eso permite hosting estatico gratuito.

Opciones gratis:

- GitHub Pages: subir este workspace a un repositorio. Ya incluye `.github/workflows/deploy-pwa.yml` para publicar la carpeta `pwa-finanzas`.
- Netlify Drop: arrastrar la carpeta `pwa-finanzas` en Netlify Drop.
- Cloudflare Pages: conectar un repositorio y publicar esta carpeta.

Despues de abrir la URL en el celular:

1. En Android/Chrome: menu `Agregar a pantalla principal` o boton `Instalar app`.
2. En iPhone/Safari: compartir > `Agregar a pantalla de inicio`.

## Sobre front, back y base de datos

La app funciona sin costos y sin servidor local usando:

- Front: HTML/CSS/JS.
- Back local: service worker para cache/offline.
- Base de datos: IndexedDB del navegador.

Tambien existe backend opcional para sincronizacion cifrada:

- Worker: `cloudflare-sync/worker.js`
- Base de datos: Cloudflare KV
- Endpoint desplegado: `https://plan-financiero-sync.uriel-plan-financiero.workers.dev`
- Guia: `cloudflare-sync/README.md`

Eso permite respaldar/sincronizar sin correr servidor en la computadora. Requiere una cuenta gratuita de Cloudflare.

## Publicacion con GitHub Pages

El repo incluye un script seguro:

```powershell
$env:GITHUB_TOKEN = "token_nuevo_con_permisos_correctos"
.\deploy\publish-github-pages.ps1
```

La guia completa esta en `deploy/README.md`.

## Sincronizacion multi-dispositivo

La app ya trae cliente de sincronizacion cifrada en `Ajustes`. Para activarlo,
despliega el backend opcional de `cloudflare-sync`.

## Datos privados

Por privacidad, la app publica no trae tus numeros personales hardcodeados en `app.js`.

El respaldo real generado desde `plan_financiero_actualizado_junio_2026_v13.xlsx` esta fuera de la carpeta publica:

```text
private-data/plan-financiero-v13.private.json
```

Esa carpeta esta ignorada por Git mediante `.gitignore`. Para cargar tus datos en la PWA:

1. Abre la app publicada.
2. Usa `Importar respaldo privado`.
3. Selecciona `plan-financiero-v13.private.json` desde tu dispositivo.
4. La app guarda esos datos en IndexedDB local.
