param(
 [string]$ConfigPath,
 [string]$RuntimeDirectory,
 [string]$RuntimeConfigPath,
 [switch]$NoBrowser
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'SchoolHub.Common.ps1')
$root=Get-SchoolHubRoot
if(-not $ConfigPath){$ConfigPath=Join-Path $root 'schoolhub.config.env'}
if(-not $RuntimeDirectory){$RuntimeDirectory=Join-Path $root 'logs'}
if(-not $RuntimeConfigPath){$RuntimeConfigPath=Join-Path $root 'schoolhub-runtime-config.json'}
$config=Read-SchoolHubConfig $ConfigPath
$app=Join-Path $root 'SchoolHub_School_Management_App_Complete.html';$staticServer=Join-Path $PSScriptRoot 'schoolhub_static_server.py';$serverRoot=Join-Path $root 'schoolhub-server';$serverEntry=Join-Path $serverRoot 'dist\src\server.js'
if(-not (Test-Path -LiteralPath $app)){throw "APP_NOT_FOUND: $app"};if(-not (Get-Command python -ErrorAction SilentlyContinue)){throw 'PYTHON_NOT_FOUND: Install Python 3 and add it to PATH.'}
if($config.START_API -eq 'true'){if(-not (Get-Command node -ErrorAction SilentlyContinue)){throw 'NODE_NOT_FOUND: Install Node.js 22 or newer.'};if(-not (Test-Path -LiteralPath $serverEntry)){throw 'API_NOT_BUILT: Run Setup-SchoolHub.bat first.'}}
New-Item -ItemType Directory -Path $RuntimeDirectory -Force|Out-Null
Write-SchoolHubRuntimeConfig $config $RuntimeConfigPath
Set-SchoolHubEnvironment $config $root
$frontendUrl="http://$($config.FRONTEND_HOST):$($config.FRONTEND_PORT)/SchoolHub_School_Management_App_Complete.html";$apiUrl="http://$($config.API_HOST):$($config.API_PORT)/health"
$started=@()
try{
 if($config.START_API -eq 'true'){
  $apiOwner=Get-SchoolHubPortOwner ([int]$config.API_PORT)
  if($apiOwner){if(-not (Test-SchoolHubProcess $apiOwner.OwningProcess 'api')){throw "API_PORT_IN_USE: Port $($config.API_PORT) belongs to process $($apiOwner.OwningProcess)."};[IO.File]::WriteAllText((Join-Path $RuntimeDirectory 'schoolhub-api.pid'),[string]$apiOwner.OwningProcess)}
  else{$apiOut=Join-Path $RuntimeDirectory 'schoolhub-api.stdout.log';$apiErr=Join-Path $RuntimeDirectory 'schoolhub-api.stderr.log';$apiProcess=Start-Process -FilePath 'node' -ArgumentList @(('"'+$serverEntry+'"')) -WorkingDirectory $serverRoot -WindowStyle Hidden -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr -PassThru;[IO.File]::WriteAllText((Join-Path $RuntimeDirectory 'schoolhub-api.pid'),[string]$apiProcess.Id);$started+=,[pscustomobject]@{Kind='api';ProcessId=$apiProcess.Id}}
  if(-not (Wait-SchoolHubHttp $apiUrl)){throw "API_HEALTH_FAILED: $apiUrl did not become healthy. Check $(Join-Path $RuntimeDirectory 'schoolhub-api.stderr.log')."}
 }
 $frontOwner=Get-SchoolHubPortOwner ([int]$config.FRONTEND_PORT)
 if($frontOwner){if(-not (Test-SchoolHubProcess $frontOwner.OwningProcess 'static')){throw "FRONTEND_PORT_IN_USE: Port $($config.FRONTEND_PORT) belongs to process $($frontOwner.OwningProcess)."};[IO.File]::WriteAllText((Join-Path $RuntimeDirectory 'schoolhub-static.pid'),[string]$frontOwner.OwningProcess)}
 else{$staticArgs=@(('"'+$staticServer+'"'),'--root',('"'+$root+'"'),'--host',$config.FRONTEND_HOST,'--port',$config.FRONTEND_PORT,'--log-directory',('"'+$RuntimeDirectory+'"'),'--pid-file',('"'+(Join-Path $RuntimeDirectory 'schoolhub-static.pid')+'"'),'--runtime-config',('"'+$RuntimeConfigPath+'"'));$staticOut=Join-Path $RuntimeDirectory 'schoolhub-static.stdout.log';$staticErr=Join-Path $RuntimeDirectory 'schoolhub-static.stderr.log';$staticProcess=Start-Process -FilePath 'python' -ArgumentList $staticArgs -WindowStyle Hidden -RedirectStandardOutput $staticOut -RedirectStandardError $staticErr -PassThru;$started+=,[pscustomobject]@{Kind='static';ProcessId=$staticProcess.Id}}
 if(-not (Wait-SchoolHubHttp $frontendUrl)){throw "FRONTEND_HEALTH_FAILED: $frontendUrl did not become healthy. Check $(Join-Path $RuntimeDirectory 'schoolhub-static.log')."}
 Write-Host "SchoolHub is healthy."
 Write-Host "Application: $frontendUrl";if($config.START_API -eq 'true'){Write-Host "API health: $apiUrl"};Write-Host "Logs: $RuntimeDirectory"
 if(-not $NoBrowser){Start-Process $frontendUrl}
}catch{
 foreach($entry in $started){if(Test-SchoolHubProcess ([int]$entry.ProcessId) $entry.Kind){Stop-Process -Id ([int]$entry.ProcessId) -ErrorAction SilentlyContinue}}
 throw
}
