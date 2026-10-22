param(
  [Parameter(Mandatory = $true)][string]$EnvironmentFile,
  [string]$BackupDirectory = './backups',
  [string]$PgDump = 'pg_dump'
)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $selectedEnvironment = (Resolve-Path -LiteralPath $EnvironmentFile).Path
  New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
  $backupRoot = (Resolve-Path -LiteralPath $BackupDirectory).Path
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
  & npm --prefix api run build
  if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
  & node "--env-file=$selectedEnvironment" api/dist/scripts/backup-database.js "--output=$(Join-Path $backupRoot "application-$stamp.dump")" "--pg-dump=$PgDump"
  if ($LASTEXITCODE -ne 0) { throw 'Database backup failed; do not use an incomplete dump.' }
  Write-Output 'Database backup complete. Export the Supabase product bucket separately and test restoration before relying on this backup.'
} finally { Pop-Location }
