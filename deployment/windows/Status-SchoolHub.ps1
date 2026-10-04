param([string]$ConfigPath,[string]$RuntimeDirectory,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'SchoolHub.Common.ps1')
$root=Get-SchoolHubRoot;if(-not $ConfigPath){$ConfigPath=Join-Path $root 'schoolhub.config.env'};if(-not $RuntimeDirectory){$RuntimeDirectory=Join-Path $root 'logs'}
$config=Read-SchoolHubConfig $ConfigPath
function ComponentStatus([string]$Name,[string]$Kind,[int]$Port,[string]$Url,[bool]$Required){
 if(-not $Required){return [ordered]@{name=$Name;state='Disabled';pid=$null;port=$Port;healthy=$true}}
 $pidPath=Join-Path $RuntimeDirectory ("schoolhub-$Name.pid");$savedPid=0;$valid=$false
 if(Test-Path -LiteralPath $pidPath){[void][int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(),[ref]$savedPid);if($savedPid){$valid=Test-SchoolHubProcess $savedPid $Kind}}
 $healthy=$false;if($valid){try{$response=Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2;$healthy=$response.StatusCode -eq 200}catch{}}
 return [ordered]@{name=$Name;state=$(if($valid){if($healthy){'Healthy'}else{'Unhealthy'}}else{'Stopped'});pid=$(if($valid){$savedPid}else{$null});port=$Port;healthy=$healthy}
}
$frontUrl="http://$($config.FRONTEND_HOST):$($config.FRONTEND_PORT)/SchoolHub_School_Management_App_Complete.html";$apiUrl="http://$($config.API_HOST):$($config.API_PORT)/health"
$items=@(ComponentStatus 'static' 'static' ([int]$config.FRONTEND_PORT) $frontUrl $true;ComponentStatus 'api' 'api' ([int]$config.API_PORT) $apiUrl ($config.START_API -eq 'true'))
if($Json){$items|ConvertTo-Json -Compress}else{$items|Format-Table name,state,pid,port -AutoSize}
if($items.Where({-not $_.healthy}).Count -gt 0){exit 1}
