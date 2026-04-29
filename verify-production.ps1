#!/usr/bin/env pwsh
<# 
  TeachPro Production Deployment Verification Script
  This script validates that all systems are ready for production deployment
#>

Write-Host "🚀 TeachPro Production Deployment Verification" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$checks = @()

# Check 1: Environment Files
Write-Host "✓ Checking environment files..." -ForegroundColor Yellow
if (Test-Path ".env.production") {
    $checks += @{ Name = "Production .env file"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Production .env file"; Status = "❌ MISSING" }
}

if (Test-Path ".env") {
    $checks += @{ Name = "Development .env file"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Development .env file"; Status = "❌ MISSING" }
}

# Check 2: Build Output
Write-Host "✓ Checking build output..." -ForegroundColor Yellow
if (Test-Path "dist/index.html") {
    $checks += @{ Name = "Frontend build (dist/)"; Status = "✅ OK" }
    $htmlSize = (Get-Item "dist/index.html").Length
    Write-Host "  - index.html: $htmlSize bytes"
} else {
    $checks += @{ Name = "Frontend build (dist/)"; Status = "❌ MISSING" }
}

if (Test-Path "functions/lib") {
    $checks += @{ Name = "Cloud Functions build"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Cloud Functions build"; Status = "❌ MISSING" }
}

# Check 3: Firebase Configuration
Write-Host "✓ Checking Firebase configuration..." -ForegroundColor Yellow
if (Test-Path "firebase.json") {
    $checks += @{ Name = "Firebase configuration"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Firebase configuration"; Status = "❌ MISSING" }
}

if (Test-Path "firestore.rules") {
    $checks += @{ Name = "Firestore security rules"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Firestore security rules"; Status = "❌ MISSING" }
}

if (Test-Path "firestore.indexes.json") {
    $checks += @{ Name = "Firestore indexes"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Firestore indexes"; Status = "❌ MISSING" }
}

# Check 4: Documentation
Write-Host "✓ Checking documentation..." -ForegroundColor Yellow
if (Test-Path "PRODUCTION_DEPLOYMENT.md") {
    $checks += @{ Name = "Deployment guide"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Deployment guide"; Status = "❌ MISSING" }
}

if (Test-Path "PRODUCTION_READY.md") {
    $checks += @{ Name = "Production ready summary"; Status = "✅ OK" }
} else {
    $checks += @{ Name = "Production ready summary"; Status = "❌ MISSING" }
}

# Check 5: Source Code Validation
Write-Host "✓ Checking source code..." -ForegroundColor Yellow
$tsFiles = @(Get-ChildItem -Path "src" -Filter "*.ts*" -Recurse).Count
$checks += @{ Name = "TypeScript files"; Status = "✅ $tsFiles files" }

# Display Results
Write-Host ""
Write-Host "📋 Verification Results:" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan
foreach ($check in $checks) {
    $statusColor = if ($check.Status.StartsWith("✅")) { "Green" } else { "Red" }
    Write-Host "$($check.Name)".PadRight(40) -NoNewline
    Write-Host " $($check.Status)" -ForegroundColor $statusColor
}

# Summary
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
$passCount = ($checks | Where-Object { $_.Status.StartsWith("✅") }).Count
$totalCount = $checks.Count
$percentage = [math]::Round(($passCount / $totalCount) * 100)

Write-Host "Checks Passed: $passCount/$totalCount ($percentage%)" -ForegroundColor Green
Write-Host ""

if ($percentage -eq 100) {
    Write-Host "✅ All systems ready for production!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. npm run firebase:deploy          # Deploy all"
    Write-Host "2. Or npm run firebase:deploy:functions  # Deploy functions only"
    Write-Host "3. Or npm run firebase:deploy:firestore  # Deploy rules only"
} else {
    Write-Host "⚠️  Some checks failed. Please review above." -ForegroundColor Red
    exit 1
}
