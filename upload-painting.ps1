param([string]$ImagePath)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$metadataPath = Join-Path $repo '_data\artworks.json'
$assetsPath = Join-Path $repo 'assets'

function Run-Git {
    param([string[]]$GitArgs)
    & git -C $repo @GitArgs
    if ($LASTEXITCODE -ne 0) { throw "Git-kommandot misslyckades: git $($GitArgs -join ' ')" }
}

function Ask-Value {
    param([string]$Label, [string]$Default)
    $answer = Read-Host "$Label [$Default]"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer.Trim()
}

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw 'Git saknas. Installera Git for Windows och starta sedan om uppladdaren.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $repo '.git'))) {
        throw 'Skriptet måste ligga i den klonade webbplatsens projektmapp.'
    }
    $branch = (& git -C $repo branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
        throw 'Byt till grenen main innan du laddar upp en målning.'
    }
    $changes = @(& git -C $repo status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0 -or $changes.Count -gt 0) {
        throw 'Det finns redan ändrade projektfiler. Spara eller ångra dem innan du laddar upp.'
    }

    if ([string]::IsNullOrWhiteSpace($ImagePath)) {
        Add-Type -AssemblyName System.Windows.Forms
        $picker = New-Object System.Windows.Forms.OpenFileDialog
        $picker.Title = 'Välj målning'
        $picker.Filter = 'Bilder|*.jpg;*.jpeg;*.png;*.webp;*.svg;*.gif'
        if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return }
        $ImagePath = $picker.FileName
    }
    $image = Get-Item -LiteralPath $ImagePath -ErrorAction Stop
    if ($image.PSIsContainer) { throw 'Välj en bildfil, inte en mapp.' }
    if (@('.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif') -notcontains $image.Extension.ToLowerInvariant()) {
        throw 'Bildformatet stöds inte. Välj JPG, PNG, WebP, SVG eller GIF.'
    }
    if ($image.Name.StartsWith('_') -or $image.Name.StartsWith('.')) {
        throw 'Filnamnet får inte börja med _ eller punkt.'
    }
    $destination = Join-Path $assetsPath $image.Name
    if (Test-Path -LiteralPath $destination) {
        throw "Det finns redan en bild med namnet $($image.Name) i galleriet. Byt namn på den nya filen."
    }

    Write-Host 'Hämtar senaste ändringar...'
    Run-Git -GitArgs @('fetch', 'origin', 'main')
    $ahead = (& git -C $repo rev-list --count origin/main..HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $ahead -ne '0') {
        throw 'Lokala commits har ännu inte laddats upp. Ladda upp dem separat innan du fortsätter.'
    }
    Run-Git -GitArgs @('pull', '--ff-only', 'origin', 'main')
    if (Test-Path -LiteralPath $destination) {
        throw "Filnamnet $($image.Name) finns redan efter uppdateringen. Byt namn på den nya filen."
    }

    $json = [System.IO.File]::ReadAllText($metadataPath, [System.Text.Encoding]::UTF8)
    $data = $json | ConvertFrom-Json
    if ($data.PSObject.Properties.Name -contains $image.Name) {
        throw "Det finns redan metadata för $($image.Name). Byt namn på den nya filen."
    }
    $default = $data._defaults
    $title = Ask-Value 'Titel' $image.BaseName
    $year = Ask-Value 'År' $default.year
    $number = Ask-Value 'Målningsnummer' $default.painting_number
    $price = Ask-Value 'Pris (t.ex. 4 500 kr)' $default.price
    $medium = Ask-Value 'Medium' $default.medium
    $dimensions = Ask-Value 'Dimensioner (t.ex. 50 × 70 cm)' $default.dimensions
    $copyright = Ask-Value 'Upphovsrätt' $default.copyright

    $entry = [ordered]@{
        title = $title
        year = $year
        copyright = $copyright
        painting_number = $number
        price = $price
        medium = $medium
        dimensions = $dimensions
    }
    $data | Add-Member -NotePropertyName $image.Name -NotePropertyValue $entry
    $updatedJson = $data | ConvertTo-Json -Depth 10
    # UTF-8 without BOM keeps the JSON readable by Jekyll and GitHub Pages.
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    Copy-Item -LiteralPath $image.FullName -Destination $destination
    try {
        [System.IO.File]::WriteAllText($metadataPath, $updatedJson + [Environment]::NewLine, $utf8)
    } catch {
        Remove-Item -LiteralPath $destination -Force
        throw
    }

    Run-Git -GitArgs @('add', '--', '_data/artworks.json', "assets/$($image.Name)")
    Run-Git -GitArgs @('commit', '-m', "Lägg till målning: $title", '--', '_data/artworks.json', "assets/$($image.Name)")
    Run-Git -GitArgs @('push', 'origin', 'main')
    Write-Host ''
    Write-Host "Klart! $title publiceras snart på https://segeljakt-art.github.io/#museum"
} catch {
    Write-Host ''
    Write-Host "Uppladdningen avbröts: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Om en commit skapades men uppladdningen misslyckades finns den kvar lokalt. Kör git push origin main efter att felet lösts.'
    exit 1
}
