param([switch]$ReuseNative, [switch]$Release)
$ErrorActionPreference = 'Stop'
$env:NODE_ENV = 'production'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildRoot = $projectRoot
$mappedDrive = $null
if ($projectRoot.Length -gt 40) {
    foreach ($letter in @('Z', 'Y', 'X', 'W', 'V', 'U', 'T', 'S')) {
        $candidate = "${letter}:"
        if (-not (Test-Path "${candidate}\")) {
            & subst.exe $candidate (Split-Path -Parent $projectRoot)
            if ($LASTEXITCODE -ne 0) { throw 'Could not create a short build path.' }
            $mappedDrive = $candidate
            $buildRoot = Join-Path "${candidate}\" (Split-Path -Leaf $projectRoot)
            break
        }
    }
    if (-not $mappedDrive) { throw 'No free drive letter is available for the native build.' }
}
Push-Location $buildRoot
try {
    if ($ReuseNative) {
        if (-not (Test-Path -LiteralPath (Join-Path $buildRoot 'android/gradlew.bat'))) {
            throw 'No generated Android project exists. Build once without -ReuseNative.'
        }
    } else {
        & npx expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { throw 'Android generation failed.' }
    }
    if ($Release) {
        $signingDir = if ($env:CLOSING_BELL_SIGNING_DIR) { $env:CLOSING_BELL_SIGNING_DIR } else { Join-Path $projectRoot '.build-cache/release-signing' }
        $keystore = Join-Path $signingDir 'closing-bell-release.jks'
        $passwordFile = Join-Path $signingDir 'password.dpapi'
        if (-not (Test-Path -LiteralPath $keystore) -or -not (Test-Path -LiteralPath $passwordFile)) {
            throw "Release keystore or encrypted password is missing from $signingDir"
        }
        $secure = Get-Content -LiteralPath $passwordFile -Raw | ConvertTo-SecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        $env:CLOSING_BELL_KEYSTORE = $keystore
        $env:CLOSING_BELL_STORE_PASSWORD = $password
        $env:CLOSING_BELL_KEY_PASSWORD = $password
        $env:CLOSING_BELL_KEY_ALIAS = 'closingbell'
        $gradlePath = Join-Path $buildRoot 'android/app/build.gradle'
        $gradle = Get-Content -LiteralPath $gradlePath -Raw
        if (-not $gradle.Contains('CLOSING_BELL_KEYSTORE')) {
            $marker = '    signingConfigs {'
            if (-not $gradle.Contains($marker)) { throw 'Android signing block was not found.' }
            $releaseConfig = @'
    signingConfigs {
        release {
            storeFile file(System.getenv('CLOSING_BELL_KEYSTORE'))
            storePassword System.getenv('CLOSING_BELL_STORE_PASSWORD')
            keyAlias System.getenv('CLOSING_BELL_KEY_ALIAS')
            keyPassword System.getenv('CLOSING_BELL_KEY_PASSWORD')
        }
'@
            $gradle = $gradle.Replace($marker, $releaseConfig)
            $debugSigning = 'signingConfig signingConfigs.debug'
            $last = $gradle.LastIndexOf($debugSigning)
            if ($last -lt 0) { throw 'Android release signing assignment was not found.' }
            $gradle = $gradle.Remove($last, $debugSigning.Length).Insert($last, 'signingConfig signingConfigs.release')
            Set-Content -LiteralPath $gradlePath -Value $gradle -NoNewline
        }
    }
    Push-Location (Join-Path $buildRoot 'android')
    try {
        $gradleArgs = @(
            'assembleRelease', '--no-daemon', '--max-workers=4',
            '--init-script', (Join-Path $buildRoot 'scripts/windows-paths.gradle'),
            '-Pkotlin.incremental=false',
            '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE -Djava.net.preferIPv4Stack=true -Dorg.gradle.internal.http.connectionTimeout=30000 -Dorg.gradle.internal.http.socketTimeout=30000'
        )
        $localRuntime = Join-Path $projectRoot '.build-cache/local-runtime.gradle'
        if (Test-Path -LiteralPath $localRuntime) {
            $gradleArgs += @('--init-script', $localRuntime)
        }
        & .\gradlew.bat @gradleArgs
        if ($LASTEXITCODE -ne 0) { throw 'Android compilation failed.' }
    } finally { Pop-Location }
    $artifactDir = Join-Path $projectRoot 'artifacts'
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    $apk = Join-Path $artifactDir $(if ($Release) { 'closing-bell-0.1.0-release.apk' } else { 'closing-bell-0.1.0.apk' })
    Copy-Item -LiteralPath (Join-Path $projectRoot 'android/app/build/outputs/apk/release/app-release.apk') -Destination $apk
    Write-Output $apk
} finally {
    if ($Release) {
        Remove-Item Env:CLOSING_BELL_KEYSTORE,Env:CLOSING_BELL_STORE_PASSWORD,Env:CLOSING_BELL_KEY_PASSWORD,Env:CLOSING_BELL_KEY_ALIAS -ErrorAction SilentlyContinue
    }
    Pop-Location
    if ($mappedDrive) { & subst.exe $mappedDrive /D }
}
