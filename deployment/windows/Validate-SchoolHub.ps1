param([string]$ConfigPath,[switch]$SkipPrerequisites,[switch]$SkipDatabase,[switch]$Json)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'SchoolHub.Common.ps1')
$root=Get-SchoolHubRoot;if(-not $ConfigPath){$ConfigPath=Join-Path $root 'schoolhub.config.env'}
$result=[ordered]@{valid=$false;configuration=$false;prerequisites=$false;database=$false;message=''}
try{
 $config=Read-SchoolHubConfig $ConfigPath;$result.configuration=$true
 if(-not $SkipPrerequisites){foreach($commandName in @('node','npm.cmd','python')){if(-not (Get-Command $commandName -ErrorAction SilentlyContinue)){throw "PREREQUISITE_MISSING: $commandName was not found."}};if(-not (Enable-SchoolHubPostgresTools ([int]$config.POSTGRES_PORT))){throw 'PREREQUISITE_MISSING: PostgreSQL client tools psql, pg_dump, and pg_restore were not found in PATH or the installed PostgreSQL service directory.'};$major=[int]((& node --version).TrimStart('v').Split('.')[0]);if($major -lt 22){throw 'NODE_VERSION: Node.js 22 or newer is required.'}}
 $result.prerequisites=$true
 if(-not $SkipDatabase){$oldPassword=$env:PGPASSWORD;try{$env:PGPASSWORD=$config.POSTGRES_PASSWORD;& psql -h $config.POSTGRES_HOST -p $config.POSTGRES_PORT -U $config.POSTGRES_USER -d $config.POSTGRES_DATABASE -v ON_ERROR_STOP=1 -tAc 'SELECT 1'|Out-Null;if($LASTEXITCODE -ne 0){throw 'DATABASE_CONNECTION: PostgreSQL connection failed.'}}finally{$env:PGPASSWORD=$oldPassword}}
 $result.database=$true;$result.valid=$true;$result.message='SchoolHub configuration is valid.'
}catch{$result.message=($_.Exception.Message -replace 'postgresql://[^\s]+','[REDACTED_DATABASE_URL]' -replace '(?i)(password\s*[=:]\s*)[^;\s]+','$1[REDACTED]')}
if($Json){$result|ConvertTo-Json -Compress}else{if($result.valid){Write-Host $result.message -ForegroundColor Green}else{Write-Host $result.message -ForegroundColor Red}}
if(-not $result.valid){exit 1}
