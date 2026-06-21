param(
  [string]$Owner = "UrielElias01",
  [string]$Repo = "plan-financiero-pwa",
  [string]$Branch = "main",
  [string]$Remote = "origin"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$Token = $env:GITHUB_TOKEN
if ([string]::IsNullOrWhiteSpace($Token)) {
  throw "Define `$env:GITHUB_TOKEN con un token de GitHub valido."
}

$trackedPrivate = & git -c "safe.directory=$RepoRoot" ls-files private-data work outputs 2>$null
if ($trackedPrivate) {
  throw "Hay archivos privados versionados: $($trackedPrivate -join ', ')"
}

$dirty = & git -c "safe.directory=$RepoRoot" status --short
if ($dirty) {
  Write-Host "Hay cambios locales sin commit:"
  $dirty | ForEach-Object { Write-Host $_ }
  throw "Haz commit antes de publicar."
}

$Headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "codex-plan-financiero"
}

function Invoke-GitHub {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null,
    [int[]]$AllowedStatus = @()
  )

  try {
    if ($null -eq $Body) {
      return @{
        Status = 200
        Body = Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
      }
    }

    return @{
      Status = 200
      Body = Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 20) -ContentType "application/json"
    }
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) { throw }
    $status = [int]$response.StatusCode
    if ($AllowedStatus -contains $status) {
      return @{ Status = $status; Body = $null }
    }
    throw
  }
}

$User = (Invoke-GitHub -Method Get -Uri "https://api.github.com/user").Body
Write-Host "Autenticado como $($User.login)."

$repoCheck = Invoke-GitHub -Method Get -Uri "https://api.github.com/repos/$Owner/$Repo" -AllowedStatus @(404)
if ($repoCheck.Status -eq 404) {
  Write-Host "Creando repo publico $Owner/$Repo..."
  Invoke-GitHub -Method Post -Uri "https://api.github.com/user/repos" -Body @{
    name = $Repo
    description = "PWA offline-first para plan financiero quincenal, sin datos privados versionados."
    private = $false
    auto_init = $false
    has_issues = $false
    has_projects = $false
    has_wiki = $false
  } | Out-Null
}

$remoteUrl = "https://github.com/$Owner/$Repo.git"
$existingRemote = & git -c "safe.directory=$RepoRoot" remote get-url $Remote 2>$null
if ($LASTEXITCODE -ne 0) {
  & git -c "safe.directory=$RepoRoot" remote add $Remote $remoteUrl
} elseif ($existingRemote -ne $remoteUrl) {
  & git -c "safe.directory=$RepoRoot" remote set-url $Remote $remoteUrl
}

$credential = "$($User.login):$Token"
$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($credential))
& git -c "safe.directory=$RepoRoot" -c "http.https://github.com/.extraheader=Authorization: Basic $basic" push -u $Remote $Branch
if ($LASTEXITCODE -ne 0) {
  throw "git push fallo. Revisa que el token tenga Contents y Workflows en escritura."
}

$pages = Invoke-GitHub -Method Post -Uri "https://api.github.com/repos/$Owner/$Repo/pages" -Body @{ build_type = "workflow" } -AllowedStatus @(409, 422)
if ($pages.Status -eq 200) {
  Write-Host "GitHub Pages activado."
} else {
  Write-Host "GitHub Pages ya estaba activado o devolvio estado $($pages.Status)."
}

Write-Host "Repo: https://github.com/$Owner/$Repo"
Write-Host "PWA:  https://$($Owner.ToLower()).github.io/$Repo/"

