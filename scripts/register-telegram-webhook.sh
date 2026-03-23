#!/bin/bash

# Register Telegram Bot Webhook
#
# Use during local development to register an ngrok tunnel as the webhook.
# Run AFTER starting ngrok.
#
# Prerequisites:
#   1. Start dev server:  npm run dev
#   2. Start ngrok:       ngrok http 3000
#   3. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
#   4. Run this script:   ./scripts/register-telegram-webhook.sh https://abc123.ngrok-free.app
#
# Re-run after each ngrok restart (URL changes each session).
# The grammY library requires no code changes between dev and prod — only the webhook URL changes.
# Never commit your ngrok URL.

set -e

# Load bot token from .env.local if available
if [ -f ".env.local" ]; then
  TELEGRAM_BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN is not set."
  echo "Set it in .env.local or export it in your shell."
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: $0 <ngrok-https-url>"
  echo "Example: $0 https://abc123.ngrok-free.app"
  exit 1
fi

WEBHOOK_URL="${1}/api/telegram/webhook"

echo "Registering webhook: ${WEBHOOK_URL}"

RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "SUCCESS: Webhook registered."
  echo "Note: Re-run this script after each ngrok restart."
else
  echo "ERROR: Registration failed. See response above."
  exit 1
fi
