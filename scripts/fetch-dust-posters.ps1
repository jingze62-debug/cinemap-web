# Fetch dust-in-heart film posters from TMDB via PowerShell
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT

# load key
$key = $null
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*TMDB_API_KEY\s*=\s*(.+)\s*$') {
    $key = $Matches[1].Trim().Trim('"').Trim("'")
  }
}
if (-not $key) { throw "Missing TMDB_API_KEY" }

$outDir = "public\posters\films"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$dataPath = "public\data\dust_in_heart_2026_films.json"
$ds = Get-Content $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json

$queries = @{
  "film_dust_mabuse" = @(
    @{ q = "The 1000 Eyes of Dr. Mabuse"; y = 1960 },
    @{ q = "Die 1000 Augen des Dr. Mabuse"; y = 1960 }
  )
  "film_dust_bleiche_mutter" = @(
    @{ q = "Germany Pale Mother"; y = 1980 },
    @{ q = "Deutschland bleiche Mutter"; y = 1980 }
  )
  "film_dust_double_godard_farocki" = @(
    @{ q = "Germany Year 90 Nine Zero"; y = 1991 },
    @{ q = "Allemagne annee 90 neuf zero"; y = 1991 }
  )
  "film_dust_antigone" = @(
    @{ q = "Die Antigone des Sophokles"; y = 1992 },
    @{ q = "Antigone"; y = 1992 }
  )
  "film_dust_othon" = @(
    @{ q = "Othon"; y = 1970 }
  )
  "film_dust_nordkalotte" = @(
    @{ q = "Die Nordkalotte"; y = 1991 }
  )
  "film_dust_redupers" = @(
    @{ q = "The All-Around Reduced Personality"; y = 1978 },
    @{ q = "Redupers"; y = 1978 }
  )
  "film_dust_wald" = @(
    @{ q = "The Forest for the Trees"; y = 2003 },
    @{ q = "Der Wald vor lauter Baumen"; y = 2003 }
  )
}

function Search-Movie($q, $y) {
  $enc = [uri]::EscapeDataString($q)
  $url = "https://api.themoviedb.org/3/search/movie?api_key=$key&query=$enc&include_adult=false&language=en-US&year=$y"
  $resp = Invoke-RestMethod -Uri $url -TimeoutSec 30
  return $resp.results
}

function Pick-Best($results, $y) {
  $best = $null
  $bestScore = -1
  foreach ($r in $results) {
    if (-not $r.poster_path) { continue }
    $s = 10
    if ($r.release_date) {
      $ry = [int]$r.release_date.Substring(0, 4)
      if ($ry -eq $y) { $s += 30 }
      elseif ([Math]::Abs($ry - $y) -le 1) { $s += 10 }
    }
    if ($s -gt $bestScore) { $bestScore = $s; $best = $r }
  }
  return $best
}

foreach ($film in $ds.films) {
  $tries = $queries[$film.id]
  if (-not $tries) { Write-Host "SKIP $($film.id)"; continue }
  $hit = $null
  foreach ($t in $tries) {
    try {
      $results = Search-Movie $t.q $t.y
      $hit = Pick-Best $results $t.y
      if ($hit) {
        Write-Host "OK $($film.id) <- $($hit.original_title) $($hit.release_date)"
        break
      }
    } catch {
      Write-Host "ERR $($film.id) $($t.q): $_"
    }
    Start-Sleep -Milliseconds 300
  }
  if (-not $hit) {
    Write-Host "FAIL $($film.id)"
    continue
  }
  $file = ($film.id -replace '^film_', '') + ".jpg"
  $dest = Join-Path $outDir $file
  $imgUrl = "https://image.tmdb.org/t/p/w500$($hit.poster_path)"
  Invoke-WebRequest -Uri $imgUrl -OutFile $dest -TimeoutSec 60
  $film | Add-Member -NotePropertyName poster -NotePropertyValue "/posters/films/$file" -Force
  Start-Sleep -Milliseconds 300
}

# ConvertFrom-Json may make PSCustomObject; rewrite carefully via node for UTF8 JSON
$tmp = [System.IO.Path]::GetTempFileName()
$ds | ConvertTo-Json -Depth 20 | Set-Content -Path $tmp -Encoding UTF8
# Prefer node to pretty-print with correct structure
node -e "const fs=require('fs'); const p=process.argv[1]; const raw=fs.readFileSync(p,'utf8'); const j=JSON.parse(raw); fs.writeFileSync('public/data/dust_in_heart_2026_films.json', JSON.stringify(j,null,2)+'\n');" $tmp
Remove-Item $tmp
Write-Host "done"
