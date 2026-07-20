param(
  [string]$OutputDirectory = "dist"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$outputRoot = Join-Path $projectRoot $OutputDirectory
$zipPath = Join-Path $outputRoot ("ai-usage-limit-alerts-v{0}.zip" -f $manifest.version)

$packageItems = @(
  "manifest.json",
  "background.js",
  "i18n.js",
  "providers",
  "content",
  "popup",
  "icons",
  "_locales"
) | ForEach-Object { Join-Path $projectRoot $_ }

$missingItems = $packageItems | Where-Object { -not (Test-Path -LiteralPath $_) }
if ($missingItems) {
  throw "Package input is missing: $($missingItems -join ', ')"
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageFiles = foreach ($item in $packageItems) {
  if ((Get-Item -LiteralPath $item).PSIsContainer) {
    Get-ChildItem -LiteralPath $item -Recurse -File
  }
  else {
    Get-Item -LiteralPath $item
  }
}

# Write portable ZIP entry names. Compress-Archive records Windows backslashes,
# while browser stores expect the ZIP-standard forward-slash path separator.
$archive = [System.IO.Compression.ZipFile]::Open(
  $zipPath,
  [System.IO.Compression.ZipArchiveMode]::Create
)
try {
  foreach ($file in ($packageFiles | Sort-Object FullName)) {
    $relativePath = $file.FullName.Substring($projectRoot.Length)
    $relativePath = $relativePath.TrimStart([char[]]@([char]92, [char]47)).Replace("\", "/")
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $file.FullName,
      $relativePath,
      [System.IO.Compression.CompressionLevel]::Optimal
    )
  }
}
finally {
  $archive.Dispose()
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
  if ($entries -notcontains "manifest.json") {
    throw "Invalid package: manifest.json is not at the ZIP root."
  }
  if ($entries | Where-Object { $_ -match "^(tests|store-assets|scripts|dist|\.omx|\.claude)/" }) {
    throw "Invalid package: development-only files were included."
  }
}
finally {
  $archive.Dispose()
}

Write-Output $zipPath
