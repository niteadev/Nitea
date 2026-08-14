Add-Type -AssemblyName System.Drawing

function Convert-PngToIcon {
    param(
        [string]$InputPng,
        [string]$OutputIco
    )
    $src = [System.Drawing.Bitmap]::FromFile($InputPng)
    $resized = New-Object System.Drawing.Bitmap(256, 256)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, 256, 256)
    
    $hIcon = $resized.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    
    $fs = [System.IO.File]::Create($OutputIco)
    $icon.Save($fs)
    $fs.Close()
    
    $src.Dispose()
    $resized.Dispose()
    $g.Dispose()
}

function Create-ResizedPng {
    param(
        [string]$InputPng,
        [string]$OutputPng,
        [int]$Size
    )
    $src = [System.Drawing.Bitmap]::FromFile($InputPng)
    $resized = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $Size, $Size)
    
    $resized.Save($OutputPng, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $src.Dispose()
    $resized.Dispose()
    $g.Dispose()
}

New-Item -ItemType Directory -Force -Path "build" | Out-Null
New-Item -ItemType Directory -Force -Path "resources" | Out-Null

$lightPng = (Get-Item "src/renderer/src/assets/icn_light.png").FullName
$darkPng = (Get-Item "src/renderer/src/assets/icn_dark.png").FullName

# 1. App Icon -> Light Icon
Create-ResizedPng -InputPng $lightPng -OutputPng (Join-Path (Get-Location) "build/icon.png") -Size 512
Create-ResizedPng -InputPng $lightPng -OutputPng (Join-Path (Get-Location) "resources/icon.png") -Size 512
Convert-PngToIcon -InputPng $lightPng -OutputIco (Join-Path (Get-Location) "build/icon.ico")

# 2. Installer Icon -> Dark Icon
Convert-PngToIcon -InputPng $darkPng -OutputIco (Join-Path (Get-Location) "build/installerIcon.ico")
Convert-PngToIcon -InputPng $darkPng -OutputIco (Join-Path (Get-Location) "build/uninstallerIcon.ico")
Convert-PngToIcon -InputPng $darkPng -OutputIco (Join-Path (Get-Location) "build/installerHeaderIcon.ico")

Write-Host "Icons generated successfully: Light Icon for App, Dark Icon for Installer."
