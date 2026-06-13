# PowerShell Sync Script for Dragon Gym PWA & Android app
$ErrorActionPreference = "Stop"

Write-Host "Syncing index.html to output locations..." -ForegroundColor Cyan

# Ensure target directories exist
if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" -Force | Out-Null
}
$androidWwwPath = "android/app/src/main/assets/www"
if (-not (Test-Path $androidWwwPath)) {
    New-Item -ItemType Directory -Path $androidWwwPath -Force | Out-Null
}

# 1. Sync index.html as FitNex_AI_Unified.html and index.html
Copy-Item -Path "frontend/index.html" -Destination "frontend/FitNex_AI_Unified.html" -Force
Copy-Item -Path "frontend/index.html" -Destination "dist/index.html" -Force
Copy-Item -Path "frontend/index.html" -Destination "$androidWwwPath/FitNex_AI_Unified.html" -Force

# 2. Sync branding.js
Copy-Item -Path "frontend/branding.js" -Destination "dist/branding.js" -Force
Copy-Item -Path "frontend/branding.js" -Destination "$androidWwwPath/branding.js" -Force

# 3. Sync sw.js and manifest.json to dist/
Copy-Item -Path "frontend/sw.js" -Destination "dist/sw.js" -Force
Copy-Item -Path "frontend/manifest.json" -Destination "dist/manifest.json" -Force

# 4. Sync images to dist and android assets
$images = @("dragon_gym_icon.png", "gym_login_bg.png", "gym_dashboard_bg.png")
foreach ($img in $images) {
    if (Test-Path "frontend/$img") {
        Copy-Item -Path "frontend/$img" -Destination "dist/$img" -Force
        Copy-Item -Path "frontend/$img" -Destination "$androidWwwPath/$img" -Force
    }
}

Write-Host "All assets synchronized successfully!" -ForegroundColor Green
