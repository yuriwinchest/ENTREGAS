$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") + ";C:\Program Files\Go\bin;" + (Join-Path $env:USERPROFILE "go\bin")

$csproj = Join-Path $root "src\EntregaDeKits.App\EntregaDeKits.App.csproj"
$version = ([regex]::Match((Get-Content $csproj -Raw), "<Version>([^<]+)</Version>")).Groups[1].Value
if (-not $version) { throw "Versão não encontrada no csproj." }

Get-Process -Name EntregaDeKits -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

Set-Location $root
dotnet test -c Release --nologo
if ($LASTEXITCODE -ne 0) { throw "Testes falharam." }

$tag = "v$version-homologacao"
$publish = Join-Path $root "dist\Entrega-de-Kits-CHIPOWER-$tag-win-x64"
if (Test-Path $publish) { Remove-Item -Recurse -Force $publish }
dotnet publish (Join-Path $root "src\EntregaDeKits.App\EntregaDeKits.App.csproj") -c Release -r win-x64 --self-contained true -p:DebugType=None -p:DebugSymbols=false -o $publish --nologo
if ($LASTEXITCODE -ne 0) { throw "Publish falhou." }

Copy-Item (Join-Path $root "LEIA-ME-ALINE.txt") (Join-Path $publish "LEIA-ME-ALINE.txt") -Force
$ico = Join-Path $root "src\EntregaDeKits.App\Resources\chipower.ico"
$rcedit = Join-Path $root "tools\rcedit-x64.exe"
$appExe = Join-Path $publish "EntregaDeKits.exe"
Copy-Item $ico (Join-Path $publish "chipower.ico") -Force
if (Test-Path $rcedit) { & $rcedit $appExe --set-icon $ico }

$payload = Join-Path $root "installer\EntregaDeKits.Installer\payload.zip"
python -c @"
from pathlib import Path
import zipfile
src = Path(r'$publish')
dst = Path(r'$payload')
with zipfile.ZipFile(dst, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for path in src.rglob('*'):
        if path.is_file():
            zf.write(path, path.relative_to(src).as_posix())
print(dst.stat().st_size)
"@

$gvi = Join-Path $env:USERPROFILE "go\bin\goversioninfo.exe"
Set-Location (Join-Path $root "installer\EntregaDeKits.Installer")
& $gvi -64 -icon $ico -o rsrc_windows_amd64.syso
if ($LASTEXITCODE -ne 0) { throw "goversioninfo falhou." }
& go test
if ($LASTEXITCODE -ne 0) { throw "Testes do instalador falharam." }

$out = Join-Path $root "dist\INSTALAR-Entrega-de-Kits-CHIPOWER-$tag.exe"
$env:CGO_ENABLED = "0"
& go build -ldflags="-s -w -H windowsgui" -o $out
if ($LASTEXITCODE -ne 0) { throw "Build do instalador falhou." }

if (Test-Path $rcedit) { & $rcedit $out --set-icon $ico }
$item = Get-Item $out
Write-Output "INSTALLER=$($item.FullName)"
Write-Output "VERSION=$version"
Write-Output "MB=$([math]::Round($item.Length/1MB,1))"
