# NovaPress AI v2 - Pipeline Runner (PowerShell)
# Runs the full AI pipeline with all 38 sources

param(
    [switch]$Fast,  # Use only 2 sources for testing
    [int]$MaxArticles = 20
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  🤖 NovaPress AI v2 - Pipeline Runner" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Activate virtual environment
Write-Host "🐍 Activating Python environment..." -ForegroundColor Blue
.\venv\Scripts\Activate.ps1

# Determine which script to run
if ($Fast) {
    Write-Host "⚡ Running FAST pipeline (2 sources)..." -ForegroundColor Yellow
    Write-Host "   Sources: CNN + Le Monde" -ForegroundColor Gray
    $script = "scripts/run_fast_pipeline.py"
} else {
    Write-Host "🌍 Running FULL pipeline (38 sources)..." -ForegroundColor Yellow
    Write-Host "   ⚠️  This may take 5-10 minutes" -ForegroundColor Gray
    $script = "scripts/run_pipeline.py"
}

Write-Host ""
Write-Host "Pipeline Steps:" -ForegroundColor Cyan
Write-Host "  1. 📡 Scraping sources" -ForegroundColor Gray
Write-Host "  2. 🧮 Generating embeddings (BGE-M3)" -ForegroundColor Gray
Write-Host "  3. 🔍 Deduplication" -ForegroundColor Gray
Write-Host "  4. 🔗 Clustering (HDBSCAN)" -ForegroundColor Gray
Write-Host "  5. 🕸️  Knowledge Graph (spaCy)" -ForegroundColor Gray
Write-Host "  6. ✍️  Synthesis (GPT-5.1)" -ForegroundColor Gray
Write-Host "  7. 💾 Storage (Qdrant + PostgreSQL)" -ForegroundColor Gray
Write-Host ""

# Run the pipeline
$startTime = Get-Date
try {
    python $script
    $exitCode = $LASTEXITCODE
} catch {
    Write-Host ""
    Write-Host "❌ Pipeline failed with error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

$duration = (Get-Date) - $startTime
$minutes = [math]::Floor($duration.TotalMinutes)
$seconds = $duration.Seconds

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "  ✅ Pipeline completed successfully!" -ForegroundColor Green
    Write-Host "  ⏱️  Duration: ${minutes}m ${seconds}s" -ForegroundColor Cyan
} else {
    Write-Host "  ❌ Pipeline failed" -ForegroundColor Red
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

exit $exitCode
