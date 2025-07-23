# MongoDB Installation Script for Windows
Write-Host "🚀 Installing MongoDB Community Server..." -ForegroundColor Green

# Create MongoDB directories
$mongoPath = "C:\Program Files\MongoDB"
$dataPath = "C:\data\db"
$logPath = "C:\data\log"

Write-Host "📁 Creating MongoDB directories..." -ForegroundColor Yellow

if (!(Test-Path $dataPath)) {
    New-Item -ItemType Directory -Path $dataPath -Force
    Write-Host "✅ Created data directory: $dataPath" -ForegroundColor Green
}

if (!(Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force
    Write-Host "✅ Created log directory: $logPath" -ForegroundColor Green
}

Write-Host "📥 Please download MongoDB Community Server from:" -ForegroundColor Cyan
Write-Host "https://www.mongodb.com/try/download/community" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Select 'Windows x64' platform" -ForegroundColor White
Write-Host "2. Download the MSI installer" -ForegroundColor White
Write-Host "3. Run the installer with default settings" -ForegroundColor White
Write-Host "4. Make sure to install MongoDB as a Service" -ForegroundColor White
Write-Host ""
Write-Host "After installation, run this script again to verify:" -ForegroundColor Yellow
Write-Host "mongod --version" -ForegroundColor Gray