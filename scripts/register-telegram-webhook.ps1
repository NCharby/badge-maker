# Register Telegram Bot Webhook (Windows PowerShell)
#
# Use during local development to register an ngrok tunnel as the webhook.
# Run AFTER starting ngrok.
#
# Prerequisites:
#   1. Start dev server:  npm run dev
#   2. Start ngrok:       ngrok http 3000
#   3. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
#   4. Run this script:   .\scripts\register-telegram-webhook.ps1 https://abc123.ngrok-free.app
#
# Re-run after each ngrok restart (URL changes each session).
# Never commit your ngrok URL.

param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokUrl
)

# Load bot token from .env.local
$envFile = Join-Path (Join-Path $PSScriptRoot "..") ".env.local"
$token = $null

if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^TELEGRAM_BOT_TOKEN=' }
    if ($line) {
        $token = $line -replace '^TELEGRAM_BOT_TOKEN=', '' -replace '"', '' -replace "'", ''
    }
}

if (-not $token) {
    Write-Error "TELEGRAM_BOT_TOKEN is not set in .env.local"
    exit 1
}

$webhookUrl = "$NgrokUrl/api/telegram/webhook"
Write-Host "Registering webhook: $webhookUrl"

$body = @{ url = $webhookUrl } | ConvertTo-Json
$response = Invoke-RestMethod `
    -Uri "https://api.telegram.org/bot$token/setWebhook" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

if ($response.ok) {
    Write-Host "SUCCESS: Webhook registered." -ForegroundColor Green
    Write-Host "Note: Re-run this script after each ngrok restart."
} else {
    Write-Error "Registration failed: $($response | ConvertTo-Json)"
    exit 1
}
