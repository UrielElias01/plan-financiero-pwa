# Backend de sincronizacion cifrada

Backend opcional para la PWA usando Cloudflare Workers + D1.

La PWA cifra el estado completo en el navegador con AES-GCM antes de subirlo. El Worker solo guarda:

- `sync_id`
- hash de la contraseña de sincronizacion
- payload cifrado
- fecha de actualizacion

No guarda tus datos financieros en claro.

## Requisitos

- Cuenta gratuita de Cloudflare.
- Wrangler autenticado.

## Crear base D1

```powershell
cd cloudflare-sync
npx wrangler d1 create plan-financiero-sync-db
```

Copia el `database_id` que te devuelva Cloudflare y reemplazalo en `wrangler.toml`.

## Crear tabla

```powershell
npx wrangler d1 execute plan-financiero-sync-db --file=./schema.sql
```

## Desplegar Worker

```powershell
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
4. Escribe una contraseña local fuerte.
5. Presiona `Probar conexion`.
6. Presiona `Subir cifrado`.

Para otro dispositivo:

1. Instala la PWA.
2. Entra a `Ajustes`.
3. Usa el mismo endpoint, ID y contraseña.
4. Presiona `Bajar cifrado`.

## Seguridad

- No subas la contraseña a ningun repositorio.
- Si pierdes la contraseña, el backend no puede descifrar el respaldo.
- Si alguien conoce el endpoint, ID y contraseña, puede leer o sobrescribir ese respaldo.
