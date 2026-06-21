# Backend de sincronizacion cifrada

Backend opcional para la PWA usando Cloudflare Workers + KV.

La PWA cifra el estado completo en el navegador con AES-GCM antes de subirlo.
El Worker solo guarda:

- `sync_id`
- hash de la contrasena de sincronizacion
- payload cifrado
- fecha de actualizacion

No guarda tus datos financieros en claro.

## Requisitos

- Cuenta gratuita de Cloudflare.
- Wrangler autenticado con `npx wrangler login`, o un token en
  `CLOUDFLARE_API_TOKEN`.
- Permisos de Cloudflare para editar Workers y KV.

## Despliegue local rapido

Desde la raiz del proyecto:

```powershell
.\deploy\publish-cloudflare-sync.ps1
```

El script valida el Worker y lo despliega con el namespace KV configurado en
`wrangler.toml`.

## Namespace KV

El namespace usado como base de datos cifrada se llama:

```text
plan-financiero-sync-store
```

Esta enlazado en `wrangler.toml` como:

```text
binding = "STORE"
```

## Desplegar Worker manualmente

```powershell
cd cloudflare-sync
npx wrangler deploy
```

Wrangler devolvera una URL parecida a:

```text
https://plan-financiero-sync.<tu-subdominio>.workers.dev
```

## Conectar desde la PWA

En la app:

1. Entra a `Ajustes`.
2. En `Sincronizacion cifrada`, pega el endpoint del Worker.
3. Usa un ID de sincronizacion, por ejemplo `uriel-plan`.
4. Escribe una contrasena local fuerte.
5. Presiona `Probar conexion`.
6. Presiona `Subir cifrado`.

Para otro dispositivo:

1. Instala la PWA.
2. Entra a `Ajustes`.
3. Usa el mismo endpoint, ID y contrasena.
4. Presiona `Bajar cifrado`.

## Seguridad

- No subas la contrasena a ningun repositorio.
- No pegues tokens de Cloudflare en archivos; usa variables de entorno o secretos
  de GitHub.
- Si pierdes la contrasena, el backend no puede descifrar el respaldo.
- Si alguien conoce el endpoint, ID y contrasena, puede leer o sobrescribir ese
  respaldo.

## GitHub Actions

El workflow `.github/workflows/deploy-cloudflare-sync.yml` permite desplegar el
backend manualmente desde GitHub. Antes agrega estos secretos al repo:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

