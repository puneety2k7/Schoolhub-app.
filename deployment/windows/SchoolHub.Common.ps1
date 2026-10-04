Set-StrictMode -Version Latest

function Get-SchoolHubRoot { return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }

function Read-SchoolHubConfig {
  param([Parameter(Mandatory=$true)][string]$ConfigPath)
  if(-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)){throw "CONFIG_NOT_FOUND: Configuration file was not found: $ConfigPath"}
  $allowed=@('FRONTEND_HOST','FRONTEND_PORT','API_HOST','API_PORT','START_API','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DATABASE','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSLMODE','SCHOOL_SLUG','NODE_ENV','SESSION_COOKIE_NAME','SESSION_TTL_MINUTES','ALLOWED_ORIGINS','TRUST_PROXY','LOG_LEVEL','LOG_TO_FILE','LOG_MAX_SIZE_MB','LOG_RETENTION_DAYS','PORTAL_ROLLOUT_MODE','UNIVERSAL_RUNTIME_WORKSPACES')
  $values=@{};$lineNumber=0
  foreach($raw in Get-Content -LiteralPath $ConfigPath -Encoding UTF8){
    $lineNumber++;$line=$raw.Trim();if(-not $line -or $line.StartsWith('#')){continue}
    if($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$'){throw "CONFIG_INVALID: Invalid entry on line $lineNumber. Use NAME=value."}
    $key=$Matches[1];$value=$Matches[2].Trim()
    if($allowed -notcontains $key){throw "CONFIG_UNKNOWN_KEY: Unsupported setting '$key' on line $lineNumber."}
    if($values.ContainsKey($key)){throw "CONFIG_DUPLICATE_KEY: Setting '$key' occurs more than once."}
    if(($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))){$value=$value.Substring(1,$value.Length-2)}
    $values[$key]=$value
  }
  $defaults=@{FRONTEND_HOST='127.0.0.1';FRONTEND_PORT='8080';API_HOST='127.0.0.1';API_PORT='4010';START_API='true';POSTGRES_PORT='5432';POSTGRES_SSLMODE='disable';SCHOOL_SLUG='';NODE_ENV='development';SESSION_COOKIE_NAME='schoolhub_sid';SESSION_TTL_MINUTES='480';TRUST_PROXY='false';LOG_LEVEL='info';LOG_TO_FILE='true';LOG_MAX_SIZE_MB='20';LOG_RETENTION_DAYS='30';PORTAL_ROLLOUT_MODE='ReadOnly';UNIVERSAL_RUNTIME_WORKSPACES='students,uniform'}
  foreach($entry in $defaults.GetEnumerator()){if(-not $values.ContainsKey($entry.Key)){$values[$entry.Key]=$entry.Value}}
  foreach($required in @('POSTGRES_HOST','POSTGRES_DATABASE','POSTGRES_USER','POSTGRES_PASSWORD')){if(-not $values.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($values[$required])){throw "CONFIG_REQUIRED: $required is required."}}
  if($values.POSTGRES_PASSWORD -match '^(CHANGE_ME|replace_me)$'){throw 'CONFIG_PLACEHOLDER: Replace POSTGRES_PASSWORD before setup.'}
  foreach($portKey in @('FRONTEND_PORT','API_PORT','POSTGRES_PORT')){$parsedPort=0;if(-not [int]::TryParse($values[$portKey],[ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535){throw "CONFIG_PORT_INVALID: $portKey must be between 1 and 65535."};$values[$portKey]=[string]$parsedPort}
  if($values.FRONTEND_PORT -eq $values.API_PORT){throw 'CONFIG_PORT_CONFLICT: FRONTEND_PORT and API_PORT must be different.'}
  if(@('127.0.0.1','localhost','::1') -notcontains $values.FRONTEND_HOST){throw 'CONFIG_FRONTEND_HOST: FRONTEND_HOST must be a loopback address.'}
  if(@('127.0.0.1','localhost','::1') -notcontains $values.API_HOST){throw 'CONFIG_API_HOST: API_HOST must be a loopback address.'}
  foreach($boolKey in @('START_API','TRUST_PROXY','LOG_TO_FILE')){if(@('true','false') -notcontains $values[$boolKey].ToLowerInvariant()){throw "CONFIG_BOOLEAN_INVALID: $boolKey must be true or false."};$values[$boolKey]=$values[$boolKey].ToLowerInvariant()}
  if(@('development','test','production') -notcontains $values.NODE_ENV){throw 'CONFIG_NODE_ENV: NODE_ENV must be development, test, or production.'}
  if(@('disable','prefer','require','verify-ca','verify-full') -notcontains $values.POSTGRES_SSLMODE){throw 'CONFIG_SSLMODE: POSTGRES_SSLMODE is invalid.'}
  if(@('Off','ReadOnly','Pilot') -notcontains $values.PORTAL_ROLLOUT_MODE){throw 'CONFIG_PORTAL_MODE: PORTAL_ROLLOUT_MODE must be Off, ReadOnly, or Pilot.'}
  if($values.UNIVERSAL_RUNTIME_WORKSPACES -notmatch '^(\*|[a-z0-9-]+(\s*,\s*[a-z0-9-]+)*)?$'){throw 'CONFIG_UNIVERSAL_RUNTIME: UNIVERSAL_RUNTIME_WORKSPACES must be empty, *, or a comma-separated list of workspace keys.'}
  if($values.SESSION_COOKIE_NAME -notmatch '^[A-Za-z0-9_-]+$'){throw 'CONFIG_COOKIE_NAME: SESSION_COOKIE_NAME contains unsupported characters.'}
  if(-not $values.ContainsKey('ALLOWED_ORIGINS') -or [string]::IsNullOrWhiteSpace($values.ALLOWED_ORIGINS) -or $values.ALLOWED_ORIGINS -eq 'AUTO'){$values.ALLOWED_ORIGINS="http://$($values.FRONTEND_HOST):$($values.FRONTEND_PORT),http://localhost:$($values.FRONTEND_PORT)"}
  return $values
}

function Get-SchoolHubDatabaseUrl {
  param([Parameter(Mandatory=$true)][hashtable]$Config)
  $dbUser=[Uri]::EscapeDataString($Config.POSTGRES_USER);$dbPassword=[Uri]::EscapeDataString($Config.POSTGRES_PASSWORD);$dbName=[Uri]::EscapeDataString($Config.POSTGRES_DATABASE)
  return "postgresql://${dbUser}:${dbPassword}@$($Config.POSTGRES_HOST):$($Config.POSTGRES_PORT)/${dbName}?sslmode=$($Config.POSTGRES_SSLMODE)"
}

function Set-SchoolHubEnvironment {
  param([Parameter(Mandatory=$true)][hashtable]$Config,[Parameter(Mandatory=$true)][string]$Root)
  $env:NODE_ENV=$Config.NODE_ENV;$env:HOST=$Config.API_HOST;$env:PORT=$Config.API_PORT;$env:DATABASE_URL=Get-SchoolHubDatabaseUrl $Config
  $env:SESSION_COOKIE_NAME=$Config.SESSION_COOKIE_NAME;$env:SESSION_TTL_MINUTES=$Config.SESSION_TTL_MINUTES;$env:ALLOWED_ORIGINS=$Config.ALLOWED_ORIGINS;$env:TRUST_PROXY=$Config.TRUST_PROXY
  $env:LOG_LEVEL=$Config.LOG_LEVEL;$env:LOG_DIRECTORY=(Join-Path $Root 'logs');$env:LOG_TO_FILE=$Config.LOG_TO_FILE;$env:LOG_MAX_SIZE_MB=$Config.LOG_MAX_SIZE_MB;$env:LOG_RETENTION_DAYS=$Config.LOG_RETENTION_DAYS;$env:PORTAL_ROLLOUT_MODE=$Config.PORTAL_ROLLOUT_MODE;$env:UNIVERSAL_RUNTIME_WORKSPACES=$Config.UNIVERSAL_RUNTIME_WORKSPACES
}

function Write-SchoolHubRuntimeConfig {
  param([Parameter(Mandatory=$true)][hashtable]$Config,[Parameter(Mandatory=$true)][string]$Path)
  $runtime=[ordered]@{managed=$true;apiBaseUrl="http://$($Config.API_HOST):$($Config.API_PORT)";schoolSlug=$Config.SCHOOL_SLUG;applicationVersion='14.0.0-wm2'};$json=$runtime|ConvertTo-Json -Compress
  if($json -match 'POSTGRES|PASSWORD|DATABASE_URL'){throw 'RUNTIME_CONFIG_SECRET: A protected setting reached the public runtime configuration.'}
  $temporary=$Path+'.tmp';[IO.File]::WriteAllText($temporary,$json,[Text.UTF8Encoding]::new($false));Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Enable-SchoolHubPostgresTools {
  param([int]$Port=5432)
  if((Get-Command psql -ErrorAction SilentlyContinue) -and (Get-Command pg_dump -ErrorAction SilentlyContinue) -and (Get-Command pg_restore -ErrorAction SilentlyContinue)){return $true}
  $candidateBins=@((Join-Path (Split-Path -Parent (Get-SchoolHubRoot)) 'Postgresql\bin'))
  $listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1;if($listener){$postgresProcess=Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue;if($postgresProcess -and $postgresProcess.Path){$candidateBins+=Split-Path -Parent $postgresProcess.Path}}
  if($env:ProgramFiles){$candidateBins+=Get-ChildItem -Path (Join-Path $env:ProgramFiles 'PostgreSQL\*\bin') -Directory -ErrorAction SilentlyContinue|Select-Object -ExpandProperty FullName}
  foreach($service in Get-CimInstance Win32_Service -ErrorAction SilentlyContinue|Where-Object{$_.PathName -match '(?i)postgres\.exe'}){
    $match=[regex]::Match($service.PathName,'(?i)"([^"]*postgres\.exe)"|^(.+?postgres\.exe)')
    $executable=if($match.Groups[1].Success){$match.Groups[1].Value}else{$match.Groups[2].Value};if($executable){$candidateBins+=Split-Path -Parent $executable}
  }
  foreach($bin in $candidateBins|Select-Object -Unique){if((Test-Path (Join-Path $bin 'psql.exe')) -and (Test-Path (Join-Path $bin 'pg_dump.exe')) -and (Test-Path (Join-Path $bin 'pg_restore.exe'))){$env:PATH=$bin+';'+$env:PATH;return $true}}
  return $false
}

function Get-SchoolHubPortOwner { param([int]$Port);return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 }
function Test-SchoolHubProcess {
  param([int]$ProcessId,[ValidateSet('api','static')][string]$Kind)
  $process=Get-Process -Id $ProcessId -ErrorAction SilentlyContinue;if(-not $process){return $false};$info=Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue;if(-not $info){return $false}
  $root=Get-SchoolHubRoot;$expected=if($Kind -eq 'api'){Join-Path $root 'schoolhub-server\dist\src\server.js'}else{Join-Path $root 'deployment\windows\schoolhub_static_server.py'}
  if([string]::IsNullOrWhiteSpace([string]$info.CommandLine)){return $false}
  return ([string]$info.CommandLine).IndexOf($expected,[StringComparison]::OrdinalIgnoreCase) -ge 0
}
function Wait-SchoolHubHttp { param([Parameter(Mandatory=$true)][string]$Url,[int]$Attempts=30);for($attempt=0;$attempt -lt $Attempts;$attempt++){try{$response=Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2;if($response.StatusCode -eq 200){return $true}}catch{};Start-Sleep -Milliseconds 250};return $false }
function Protect-SchoolHubConfig { param([Parameter(Mandatory=$true)][string]$Path);if(-not (Get-Command icacls.exe -ErrorAction SilentlyContinue)){return $false};& icacls.exe $Path /inheritance:r /grant:r "$env:USERNAME`:(R,W)" 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null;return $LASTEXITCODE -eq 0 }
function Write-SchoolHubSafeFailure { param([string]$Step,[System.Management.Automation.ErrorRecord]$Failure,[string]$LogPath);$message=($Failure.Exception.Message -replace 'postgresql://[^\s]+','[REDACTED_DATABASE_URL]' -replace '(?i)(password\s*[=:]\s*)[^;\s]+','$1[REDACTED]');Write-Host "FAILED STEP: $Step" -ForegroundColor Red;Write-Host "ERROR: $message" -ForegroundColor Red;Write-Host "LOG: $LogPath";Write-Host 'ACTION: Correct the reported configuration or prerequisite, then rerun Setup-SchoolHub.bat.' }

