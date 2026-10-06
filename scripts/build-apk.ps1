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
    & npx expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Android generation failed.' }
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
    $apk = Join-Path $artifactDir 'closing-bell-0.1.0.apk'
    Copy-Item -LiteralPath (Join-Path $projectRoot 'android/app/build/outputs/apk/release/app-release.apk') -Destination $apk
    Write-Output $apk
} finally {
    Pop-Location
    if ($mappedDrive) { & subst.exe $mappedDrive /D }
}
