param([string]$EnvironmentFile = 'api/.env')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $selectedEnvironment = (Resolve-Path -LiteralPath $EnvironmentFile).Path
  & node "--env-file=$selectedEnvironment" -e "try { const u=new URL(process.env.NODE_ENV==='production'?process.env.DIRECT_URL:process.env.DATABASE_URL); console.log('Selected database: '+u.hostname+u.pathname) } catch { console.error('Invalid selected database settings'); process.exitCode=1 }"
  if ($LASTEXITCODE -ne 0) { throw 'Select an environment file with the intended database connection.' }
  $adminEmail = Read-Host 'Administrator email'
  if ($adminEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Enter a valid email address.' }
  & npm --prefix api run build
  if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
  $adminPassword = Read-Host 'Unique password (14-256 characters)' -AsSecureString
  try {
    [System.Net.NetworkCredential]::new('', $adminPassword).Password | & node "--env-file=$selectedEnvironment" api/dist/scripts/create-admin.js $adminEmail
    if ($LASTEXITCODE -ne 0) { throw 'Administrator creation failed; verify configuration and account uniqueness.' }
  } finally { $adminPassword.Dispose(); Remove-Variable adminPassword }
} finally { Pop-Location }
