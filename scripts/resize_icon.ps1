Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path "build" | Out-Null
New-Item -ItemType Directory -Force -Path "resources" | Out-Null
$srcPath = (Get-Item "src/renderer/src/assets/icn_light.png").FullName
$destPath = Join-Path (Get-Location) "build/icon.png"
$resPath = Join-Path (Get-Location) "resources/icon.png"
$src = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap(512, 512)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, 0, 0, 512, 512)
$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save($resPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$g.Dispose()
$bmp.Dispose()
Write-Host "Successfully generated 512x512 icon at $destPath and $resPath"
