# NovaPress AI v2 - Setup Validation Script (PowerShell)
# Validates all prerequisites for running the backend

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  🔍 NovaPress AI v2 - Setup Validation" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$allChecksPass = $true

# 1. Check Python
Write-Host "1️⃣  Checking Python..." -ForegroundColor Blue
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.([8-9]|1[0-9])") {
        Write-Host "   ✅ $pythonVersion" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Python 3.8+ required, found: $pythonVersion" -ForegroundColor Yellow
        $allChecksPass = $false
    }
} catch {
    Write-Host "   ❌ Python not found" -ForegroundColor Red
    $allChecksPass = $false
}

# 2. Check Virtual Environment
Write-Host ""
Write-Host "2️⃣  Checking Virtual Environment..." -ForegroundColor Blue
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "   ✅ Virtual environment exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ Virtual environment not found" -ForegroundColor Red
    Write-Host "      Run: python -m venv venv" -ForegroundColor Yellow
    $allChecksPass = $false
}

# 3. Check Docker Services
Write-Host ""
Write-Host "3️⃣  Checking Docker Services..." -ForegroundColor Blue

# PostgreSQL
try {
    $pgTest = docker exec tradingbot_v2-postgres-1 pg_isready 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PostgreSQL (port 5432)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PostgreSQL not healthy" -ForegroundColor Red
        $allChecksPass = $false
    }
} catch {
    Write-Host "   ❌ PostgreSQL container not found" -ForegroundColor Red
    $allChecksPass = $false
}

# Redis
try {
    $redisTest = docker exec tradingbot_v2-redis-1 redis-cli ping 2>&1
    if ($redisTest -eq "PONG") {
        Write-Host "   ✅ Redis (port 6380)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Redis not responding" -ForegroundColor Red
        $allChecksPass = $false
    }
} catch {
    Write-Host "   ❌ Redis container not found" -ForegroundColor Red
    $allChecksPass = $false
}

# Qdrant
try {
    $qdrantTest = Invoke-WebRequest -Uri "http://localhost:6333/collections" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($qdrantTest.StatusCode -eq 200) {
        Write-Host "   ✅ Qdrant (port 6333)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Qdrant not responding" -ForegroundColor Red
        $allChecksPass = $false
    }
} catch {
    Write-Host "   ❌ Qdrant not accessible" -ForegroundColor Red
    $allChecksPass = $false
}

# 4. Check Environment Variables
Write-Host ""
Write-Host "4️⃣  Checking Environment Variables..." -ForegroundColor Blue
if (Test-Path ".env") {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green

    # Check critical variables
    $envContent = Get-Content ".env" -Raw
    $criticalVars = @("DATABASE_URL", "REDIS_URL", "QDRANT_URL", "OPENROUTER_API_KEY")

    foreach ($var in $criticalVars) {
        if ($envContent -match "$var=") {
            Write-Host "      ✅ $var" -ForegroundColor Green
        } else {
            Write-Host "      ⚠️  $var missing" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   ❌ .env file not found" -ForegroundColor Red
    Write-Host "      Copy .env.example to .env and configure" -ForegroundColor Yellow
    $allChecksPass = $false
}

# 5. Check Python Dependencies (within venv)
Write-Host ""
Write-Host "5️⃣  Checking Python Dependencies..." -ForegroundColor Blue
Write-Host "   ⏳ Activating venv and checking packages..." -ForegroundColor Yellow

$checkScript = @"
.\venv\Scripts\Activate.ps1
`$packages = @('fastapi', 'uvicorn', 'qdrant-client', 'spacy', 'torch', 'sentence-transformers')
`$allInstalled = `$true
foreach (`$pkg in `$packages) {
    try {
        python -c "import `$pkg" 2>`$null
        if (`$LASTEXITCODE -eq 0) {
            Write-Host "      ✅ `$pkg" -ForegroundColor Green
        } else {
            Write-Host "      ❌ `$pkg not installed" -ForegroundColor Red
            `$allInstalled = `$false
        }
    } catch {
        Write-Host "      ❌ `$pkg not installed" -ForegroundColor Red
        `$allInstalled = `$false
    }
}
if (-not `$allInstalled) {
    exit 1
}
"@

try {
    Invoke-Expression $checkScript
    if ($LASTEXITCODE -ne 0) {
        $allChecksPass = $false
    }
} catch {
    Write-Host "   ⚠️  Could not check all dependencies" -ForegroundColor Yellow
}

# 6. Check spaCy Model
Write-Host ""
Write-Host "6️⃣  Checking spaCy French Model..." -ForegroundColor Blue
$spacyCheck = @"
.\venv\Scripts\Activate.ps1
python -c "import spacy; spacy.load('fr_core_news_lg'); print('OK')" 2>`$null
"@

try {
    $result = Invoke-Expression $spacyCheck
    if ($result -eq "OK") {
        Write-Host "   ✅ fr_core_news_lg installed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ fr_core_news_lg not found" -ForegroundColor Red
        Write-Host "      Run: python -m spacy download fr_core_news_lg" -ForegroundColor Yellow
        $allChecksPass = $false
    }
} catch {
    Write-Host "   ❌ fr_core_news_lg not found" -ForegroundColor Red
    Write-Host "      Run: python -m spacy download fr_core_news_lg" -ForegroundColor Yellow
    $allChecksPass = $false
}

# Final Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($allChecksPass) {
    Write-Host "  ✅ All checks passed!" -ForegroundColor Green
    Write-Host "  🚀 Ready to run: .\start_all.ps1" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️  Some checks failed" -ForegroundColor Yellow
    Write-Host "  📖 Review the output above and fix issues" -ForegroundColor Yellow
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
