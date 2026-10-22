$ErrorActionPreference = 'Stop'
Push-Location (Join-Path (Split-Path $PSScriptRoot -Parent) 'api')
try {
  $adminEmail = Read-Host 'Administrator email'
  if ($adminEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Enter a valid email address.' }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
  $adminPassword = Read-Host 'Unique password (14-256 characters)' -AsSecureString
  try {
    [System.Net.NetworkCredential]::new('', $adminPassword).Password | & node dist/scripts/create-admin.js $adminEmail
    if ($LASTEXITCODE -ne 0) { throw 'Administrator creation failed; verify configuration and account uniqueness.' }
  } finally { $adminPassword.Dispose(); Remove-Variable adminPassword }
} finally { Pop-Location }
