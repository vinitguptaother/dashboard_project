# Upstox Token Refresh Script
# This script opens the Upstox authorization URL in your browser

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Upstox Token Refresh" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Read API Key from .env file
$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: .env file not found at $envPath" -ForegroundColor Red
    exit 1
}

$apiKey = ""
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^UPSTOX_API_KEY=(.+)$') {
        $apiKey = $matches[1].Trim()
    }
}

if ([string]::IsNullOrEmpty($apiKey)) {
    Write-Host "ERROR: UPSTOX_API_KEY not found in .env file" -ForegroundColor Red
    exit 1
}

$redirectUri = "http://localhost:3001/callback"
$authUrl = "https://api.upstox.com/v2/login/authorization/dialog?client_id=$apiKey&redirect_uri=$redirectUri&response_type=code"

Write-Host "Step 1: Opening Upstox authorization page in your browser..." -ForegroundColor Yellow
Write-Host ""
Write-Host "If the browser doesn't open automatically, copy and paste this URL:" -ForegroundColor Gray
Write-Host $authUrl -ForegroundColor Blue
Write-Host ""

# Open the URL in the default browser
Start-Process $authUrl

Write-Host "Step 2: Complete the authorization in your browser" -ForegroundColor Yellow
Write-Host "  - Login to your Upstox account" -ForegroundColor Gray
Write-Host "  - Grant permissions to the app" -ForegroundColor Gray
Write-Host "  - You will be redirected to the callback page" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 3: The callback page will automatically:" -ForegroundColor Yellow
Write-Host "  - Exchange the authorization code for an access token" -ForegroundColor Gray
Write-Host "  - Update your .env files with the new token" -ForegroundColor Gray
Write-Host "  - Show a success message" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 4: After seeing the success message:" -ForegroundColor Yellow
Write-Host "  - Restart your Next.js application" -ForegroundColor Gray
Write-Host "  - Restart your backend server (if separate)" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Waiting for authorization..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Make sure your application is running on http://localhost:3001" -ForegroundColor Magenta
Write-Host ""
