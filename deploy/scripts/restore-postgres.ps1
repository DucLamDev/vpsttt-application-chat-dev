param(
  [Parameter(Mandatory = $true)]
  [string]$RestoreDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$RestoreDumpFile,

  [string]$PgRestoreBin = "pg_restore"
)

if (-not (Test-Path -LiteralPath $RestoreDumpFile)) {
  Write-Error "File backup không tồn tại: $RestoreDumpFile"
  exit 1
}

Write-Host "Bắt đầu restore PostgreSQL vào database đích."
& $PgRestoreBin `
  --clean `
  --if-exists `
  --no-owner `
  --no-privileges `
  --dbname $RestoreDatabaseUrl `
  $RestoreDumpFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "Restore PostgreSQL thất bại."
  exit $LASTEXITCODE
}

Write-Host "Restore PostgreSQL hoàn tất."
