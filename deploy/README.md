# Despliegue

Scripts e instrucciones para publicar sin guardar tokens en archivos, remotos ni
commits.

## GitHub Pages

El token nuevo debe tener permisos de escritura para:

- Contents
- Workflows
- Pages
- Administration

Define el token solo en la sesion actual de PowerShell:

```powershell
$env:GITHUB_TOKEN = "token_nuevo"
```

Luego ejecuta desde la raiz del proyecto:

```powershell
.\deploy\publish-github-pages.ps1
```

El script hace push usando el token como credencial temporal, activa GitHub Pages
en modo `workflow` y muestra la URL final.

## Cloudflare Sync

El backend de sincronizacion cifrada esta en `cloudflare-sync`. Usa Cloudflare
Workers + KV y esta configurado para:

```text
https://plan-financiero-sync.uriel-plan-financiero.workers.dev
```

Requiere una cuenta gratuita de Cloudflare y Wrangler autenticado para futuros
despliegues.
