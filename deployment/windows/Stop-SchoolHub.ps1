param([string]$RuntimeDirectory)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'SchoolHub.Common.ps1')
$root=Get-SchoolHubRoot;if(-not $RuntimeDirectory){$RuntimeDirectory=Join-Path $root 'logs'}
function Stop-VerifiedComponent([string]$Name,[string]$Kind){
 $pidPath=Join-Path $RuntimeDirectory ("schoolhub-$Name.pid")
 if(-not (Test-Path -LiteralPath $pidPath)){Write-Host "${Name}: no PID file.";return}
 $savedPid=0;if(-not [int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(),[ref]$savedPid)){throw "PID_INVALID: $pidPath does not contain a valid PID."}
 if(-not (Get-Process -Id $savedPid -ErrorAction SilentlyContinue)){Remove-Item -LiteralPath $pidPath -Force;Write-Host "${Name}: already stopped.";return}
 if(-not (Test-SchoolHubProcess $savedPid $Kind)){throw "PID_MISMATCH: PID $savedPid is not the SchoolHub $Name process and was not stopped."}
 Stop-Process -Id $savedPid
 for($attempt=0;$attempt -lt 20 -and (Get-Process -Id $savedPid -ErrorAction SilentlyContinue);$attempt++){Start-Sleep -Milliseconds 100}
 if(Get-Process -Id $savedPid -ErrorAction SilentlyContinue){throw "STOP_TIMEOUT: SchoolHub $Name PID $savedPid did not stop; its PID file was retained."};Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue;Write-Host "$Name stopped (PID $savedPid)."
}
Stop-VerifiedComponent 'static' 'static';Stop-VerifiedComponent 'api' 'api'
