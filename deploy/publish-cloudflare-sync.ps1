param(
  [string]$DatabaseName = "plan-financiero-sync-db",
  [string]$WorkerDir = "cloudflare-sync"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WorkerPath = Join-Path $RepoRoot $WorkerDir
$WranglerToml = Join-Path $WorkerPath "wrangler.toml"

if (!(Test-Path $WranglerToml)) {
  throw "No encontre $WranglerToml."
}

if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Necesito npm/npx para ejecutar Wrangler."
}

function Get-NodeMajor {
  param([string]$NodeCommand = "node")

  $version = & $NodeCommand -p "process.versions.node"
  if ($LASTEXITCODE -ne 0) {
    throw "No pude ejecutar $NodeCommand."
  }

  return [int]($version.Split(".")[0])
}

function Invoke-Wrangler {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

  $nodeMajor = Get-NodeMajor
  if ($nodeMajor -ge 22) {
    npx --yes wrangler @Args
    return
  }

  $codexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  $npxCli = "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js"
  if ((Test-Path $codexNode) -and (Test-Path $npxCli)) {
    $nodeDir = Split-Path $codexNode
    $env:PATH = "$nodeDir;$env:PATH"
    & $codexNode $npxCli --yes wrangler @Args
    return
  }

  throw "Wrangler requiere Node 22+. Instala Node 22+ o ejecuta este script desde un entorno que lo tenga."
}

Set-Location $WorkerPath

Write-Host "Validando Worker..."
node --check worker.js
node ..\tools\verify-sync-worker.mjs

$toml = Get-Content -Raw $WranglerToml
$hasPlaceholder = $toml -match 'database_id = "REPLACE_WITH_D1_DATABASE_ID"'

if ($hasPlaceholder) {
  Write-Host "Creando D1 y actualizando wrangler.toml..."
  Invoke-Wrangler d1 create $DatabaseName --binding DB --update-config
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo crear la base D1. Revisa tu login/token de Cloudflare."
  }
} else {
  Write-Host "wrangler.toml ya contiene database_id; no creo otra D1."
}

Write-Host "Aplicando schema remoto..."
Invoke-Wrangler d1 execute $DatabaseName --remote --file=./schema.sql --yes
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo aplicar schema.sql en D1."
}

Write-Host "Desplegando Worker..."
Invoke-Wrangler deploy
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo desplegar el Worker."
}

Write-Host "Backend desplegado. Copia la URL *.workers.dev en Ajustes > Sincronizacion cifrada de la PWA."
