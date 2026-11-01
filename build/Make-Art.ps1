$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function New-WizardArt([int]$width,[int]$height,[string]$destination,[bool]$sidebar) {
  $bmp = [Drawing.Bitmap]::new($width,$height,[Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([Drawing.Color]::FromArgb(17,26,38))
  if ($sidebar) {
    $image = [Drawing.Image]::FromFile((Join-Path $root 'src\assets\bg\northstar.jpg'))
    $scale = [Math]::Max($width/$image.Width,$height/$image.Height)
    $w = [int]($image.Width*$scale)
    $h = [int]($image.Height*$scale)
    $g.DrawImage($image,[int](($width-$w)/2),0,$w,$h)
    $image.Dispose()
    $overlay = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Point]::new(0,0),[Drawing.Point]::new(0,$height),[Drawing.Color]::FromArgb(100,9,17,29),[Drawing.Color]::FromArgb(250,9,17,29))
    $g.FillRectangle($overlay,0,0,$width,$height)
    $overlay.Dispose()
  }
  $gold = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(239,179,91))
  $white = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(242,245,248))
  $muted = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(166,186,206))
  if ($sidebar) {
    $g.FillRectangle($gold,19,23,25,3)
    $big = [Drawing.Font]::new('Segoe UI',30,[Drawing.FontStyle]::Bold,[Drawing.GraphicsUnit]::Pixel)
    $small = [Drawing.Font]::new('Segoe UI',9,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
    $medium = [Drawing.Font]::new('Segoe UI Semibold',13,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
    $g.DrawString('TFX',$big,$white,16,172)
    $g.DrawString('LAUNCHER',$medium,$white,19,213)
    $g.DrawString('YOUR NEXT DROP.',$small,$muted,20,241)
    $g.DrawString('VERSION 1.1.0',$small,$gold,20,285)
    $big.Dispose(); $small.Dispose(); $medium.Dispose()
  } else {
    $g.FillRectangle($gold,12,14,3,28)
    $font = [Drawing.Font]::new('Segoe UI',22,[Drawing.FontStyle]::Bold,[Drawing.GraphicsUnit]::Pixel)
    $small = [Drawing.Font]::new('Segoe UI',8,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
    $g.DrawString('TFX',$font,$white,24,5)
    $g.DrawString('LAUNCHER  /  1.1.0',$small,$muted,26,33)
    $font.Dispose(); $small.Dispose()
  }
  $gold.Dispose(); $white.Dispose(); $muted.Dispose(); $g.Dispose()
  $bmp.Save($destination,[Drawing.Imaging.ImageFormat]::Bmp)
  $bmp.Dispose()
}
New-WizardArt 164 314 (Join-Path $PSScriptRoot 'wizard.bmp') $true
New-WizardArt 150 57 (Join-Path $PSScriptRoot 'header.bmp') $false
