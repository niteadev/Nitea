Add-Type -AssemblyName System.Drawing
$pngPath = Resolve-Path "build/icon.png"
$icoPath = Join-Path (Get-Location) "build/icon.ico"

$src = [System.Drawing.Bitmap]::FromFile($pngPath)
$hIcon = $src.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($hIcon)

$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$ico.Save($fs)
$fs.Close()
$src.Dispose()

Write-Host "Created build/icon.ico successfully"
