$ErrorActionPreference = 'Stop'
$passwordFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.build-cache/release-signing/password.dpapi'
if (-not (Test-Path -LiteralPath $passwordFile)) { throw 'Encrypted release password not found on this Windows account.' }
$secure = Get-Content -LiteralPath $passwordFile -Raw | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { [Console]::WriteLine([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
