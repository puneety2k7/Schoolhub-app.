param([string]$HostName='127.0.0.1',[int]$Port=5432,[string]$Database='schoolhub',[string]$User='schoolhub_app')
$ErrorActionPreference='Stop'
$secure=Read-Host "Password for PostgreSQL role $User" -AsSecureString
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{
  $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $encoded=[Uri]::EscapeDataString($plain)
  $env:DATABASE_URL="postgresql://${User}:${encoded}@${HostName}:${Port}/${Database}"
  npm run migrate
  if($LASTEXITCODE -ne 0){throw 'Migration command failed.'}
  Write-Host 'SchoolHub PostgreSQL migrations completed. Re-run is safe and idempotent.'
} finally {
  $env:DATABASE_URL=$null
  if($ptr-ne[IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
  $plain=$null
}
