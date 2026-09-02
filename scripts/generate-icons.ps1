Add-Type -AssemblyName System.Drawing

$iconDirectory = Join-Path $PSScriptRoot "..\icons"
$sizes = @(180, 192, 512, 1024)

foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $bitmap.SetResolution(96, 96)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $scale = $size / 512.0
    $green = [System.Drawing.ColorTranslator]::FromHtml("#315f51")
    $paper = [System.Drawing.ColorTranslator]::FromHtml("#fffdf9")
    $greenLight = [System.Drawing.ColorTranslator]::FromHtml("#dfece6")
    $orangeLight = [System.Drawing.ColorTranslator]::FromHtml("#f2dfd2")
    $orange = [System.Drawing.ColorTranslator]::FromHtml("#b6673c")

    $graphics.Clear($green)

    $card = New-Object System.Drawing.RectangleF((110 * $scale), (111 * $scale), (292 * $scale), (290 * $scale))
    $cardPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = 32 * $scale
    $diameter = $radius * 2
    $cardPath.AddArc($card.X, $card.Y, $diameter, $diameter, 180, 90)
    $cardPath.AddArc($card.Right - $diameter, $card.Y, $diameter, $diameter, 270, 90)
    $cardPath.AddArc($card.Right - $diameter, $card.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $cardPath.AddArc($card.X, $card.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $cardPath.CloseFigure()
    $paperBrush = New-Object System.Drawing.SolidBrush($paper)
    $graphics.FillPath($paperBrush, $cardPath)

    $headerBrush = New-Object System.Drawing.SolidBrush($greenLight)
    $graphics.FillRectangle($headerBrush, (110 * $scale), (183 * $scale), (292 * $scale), (54 * $scale))

    $circleBrush = New-Object System.Drawing.SolidBrush($orangeLight)
    $graphics.FillEllipse($circleBrush, (139 * $scale), (284 * $scale), (70 * $scale), (70 * $scale))

    $plusPen = New-Object System.Drawing.Pen($orange, (13 * $scale))
    $plusPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $plusPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($plusPen, (174 * $scale), (298 * $scale), (174 * $scale), (340 * $scale))
    $graphics.DrawLine($plusPen, (153 * $scale), (319 * $scale), (195 * $scale), (319 * $scale))

    $linePen = New-Object System.Drawing.Pen($green, (17 * $scale))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($linePen, (242 * $scale), (294 * $scale), (347 * $scale), (294 * $scale))
    $graphics.DrawLine($linePen, (242 * $scale), (328 * $scale), (319 * $scale), (328 * $scale))

    $outputPath = Join-Path $iconDirectory "icon-$size.png"
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $linePen.Dispose()
    $plusPen.Dispose()
    $circleBrush.Dispose()
    $headerBrush.Dispose()
    $paperBrush.Dispose()
    $cardPath.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Host "Generated PNG icons: $($sizes -join ', ')"

$assetDirectory = Join-Path $PSScriptRoot "..\assets"
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $iconDirectory "icon-1024.png") -Destination (Join-Path $assetDirectory "icon.png") -Force
Write-Host "Prepared native app icon: assets\icon.png"

$androidIconDirectory = Join-Path $assetDirectory "android-icons"
New-Item -ItemType Directory -Path $androidIconDirectory -Force | Out-Null
$androidSizes = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}
$sourceIcon = [System.Drawing.Image]::FromFile((Join-Path $assetDirectory "icon.png"))

foreach ($density in $androidSizes.Keys) {
    $androidSize = $androidSizes[$density]
    $androidBitmap = New-Object System.Drawing.Bitmap($androidSize, $androidSize)
    $androidGraphics = [System.Drawing.Graphics]::FromImage($androidBitmap)
    $androidGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $androidGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $androidGraphics.DrawImage($sourceIcon, 0, 0, $androidSize, $androidSize)
    $androidBitmap.Save((Join-Path $androidIconDirectory "icon-$density.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $androidGraphics.Dispose()
    $androidBitmap.Dispose()
}

$sourceIcon.Dispose()
Write-Host "Prepared Android launcher icons"
