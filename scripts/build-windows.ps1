$ErrorActionPreference = 'Stop'

$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$target = 'x86_64-pc-windows-msvc'
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$targetDir = Join-Path $tempRoot ('baltic-roads-build-' + [guid]::NewGuid().ToString('N'))

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js with npm is required. See README.md.'
}

# Use the project machine's portable toolchain when Visual Studio is unavailable.
$portableEnvironment = Join-Path $env:LOCALAPPDATA 'RawdexToolchain\build-environment.ps1'
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if ((Test-Path -LiteralPath $portableEnvironment -PathType Leaf) -and
    (-not $env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER) -and
    (-not (Get-Command cl.exe -ErrorAction SilentlyContinue))) {
    $visualStudio = if (Test-Path -LiteralPath $vswhere -PathType Leaf) {
        & $vswhere -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    }
    if (-not $visualStudio) { . $portableEnvironment }
}

if (-not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
    $cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    $env:Path = "$cargoBin;$env:Path"
}
if (-not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
    throw 'Rust and Cargo are required. See README.md.'
}

$originalTargetDir = $env:CARGO_TARGET_DIR
Push-Location -LiteralPath $project
try {
    $config = Get-Content -LiteralPath 'src-tauri\tauri.conf.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    $artifactName = 'Baltic-Roads-Tauri-' + $config.version + '-x64'

    Write-Host '[1/3] Installing Node dependencies from package-lock.json'
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }

    Write-Host '[2/3] Compiling a clean Tauri release for Windows x64'
    New-Item -ItemType Directory -Path $targetDir | Out-Null
    $env:CARGO_TARGET_DIR = $targetDir
    & npm.cmd run build -- --ci --target $target -- --locked
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE." }

    $release = Join-Path $targetDir "$target\release"
    $portable = Join-Path $release 'baltic-roads.exe'
    $installer = Join-Path $release ('bundle\nsis\' + $config.productName + '_' + $config.version + '_x64-setup.exe')
    foreach ($file in $portable, $installer) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing artifact: $file" }
    }

    Write-Host '[3/3] Copying the game and installer to builds'
    $output = Join-Path $project 'builds'
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    Copy-Item -LiteralPath $portable -Destination (Join-Path $output "$artifactName.exe") -Force
    Copy-Item -LiteralPath $installer -Destination (Join-Path $output "$artifactName-Setup.exe") -Force
    Write-Host "Ready: $output"
} finally {
    $env:CARGO_TARGET_DIR = $originalTargetDir
    Pop-Location
    if (Test-Path -LiteralPath $targetDir -PathType Container) {
        $resolvedTarget = (Resolve-Path -LiteralPath $targetDir).ProviderPath
        if ($resolvedTarget -eq $targetDir -and (Split-Path -Parent $resolvedTarget) -eq $tempRoot) {
            Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
        }
    }
}
