param([string]$EnvironmentFile = '.env.deployment', [string]$BackupDirectory = './backups')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) { throw 'Deployment environment file is missing.' }
  New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
  $backupRoot = (Resolve-Path -LiteralPath $BackupDirectory).Path
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
  # Copy files directly: binary pg_dump output never passes through PowerShell text pipelines.
  & docker compose --env-file $EnvironmentFile exec -T db pg_dump -U petcorner -d petcorner -Fc -f /tmp/petcorner-backup.dump
  if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
  & docker compose --env-file $EnvironmentFile cp db:/tmp/petcorner-backup.dump (Join-Path $backupRoot "database-$stamp.dump")
  if ($LASTEXITCODE -ne 0) { throw 'Database backup copy failed.' }
  & docker compose --env-file $EnvironmentFile exec -T api tar -czf /tmp/petcorner-uploads.tar.gz -C /app/uploads .
  if ($LASTEXITCODE -ne 0) { throw 'Upload backup failed.' }
  & docker compose --env-file $EnvironmentFile cp api:/tmp/petcorner-uploads.tar.gz (Join-Path $backupRoot "uploads-$stamp.tar.gz")
  if ($LASTEXITCODE -ne 0) { throw 'Upload backup copy failed.' }
  Write-Output "Backup saved to $backupRoot. Store an encrypted off-host copy and test restore in a separate database."
} finally { Pop-Location }
