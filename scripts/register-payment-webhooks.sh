#!/bin/bash

# Register Payment Webhook URLs (Square + PayPal)
#
# Use during local development after starting a new ngrok tunnel.
# Both Square and PayPal webhook URLs must be updated manually in their
# developer dashboards — this script does NOT automate the API calls
# (no webhook management credentials are stored here).
#
# Prerequisites:
#   1. Start dev server:  npm run dev
#   2. Start ngrok:       ngrok http 3000
#   3. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
#   4. Run this script:   ./scripts/register-payment-webhooks.sh https://abc123.ngrok-free.app
#
# Re-run after each ngrok restart (URL changes each session).

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <ngrok-https-url>"
  echo "Example: $0 https://abc123.ngrok-free.app"
  exit 1
fi

NGROK_URL="$1"
WEBHOOK_URL="${NGROK_URL}/api/payments/webhook"

echo ""
echo "=========================================================="
echo "  Payment Webhook Registration Reminder"
echo "=========================================================="
echo ""
echo "New webhook URL:"
echo "  ${WEBHOOK_URL}"
echo ""
echo "----------------------------------------------------------"
echo "  SQUARE"
echo "----------------------------------------------------------"
echo "1. Go to: https://developer.squareup.com"
echo "2. Open your app → Webhooks tab → find your dev endpoint"
echo "3. Click Edit → update URL to:"
echo "   ${WEBHOOK_URL}"
echo "4. Save. The Signature Key does NOT change between sessions."
echo "   (SQUARE_WEBHOOK_SIGNATURE_KEY stays the same in .env.local)"
echo ""
echo "   Subscribed events required:"
echo "     payment.created"
echo "     payment.updated"
echo "     refund.created"
echo "     refund.updated"
echo ""
echo "----------------------------------------------------------"
echo "  PAYPAL"
echo "----------------------------------------------------------"
echo "1. Go to: https://developer.paypal.com"
echo "2. My Apps & Credentials → your sandbox app → Webhooks"
echo "3. Find your existing webhook → Edit → update URL to:"
echo "   ${WEBHOOK_URL}"
echo "4. Save. The Webhook ID does NOT change between sessions."
echo "   (PAYPAL_WEBHOOK_ID stays the same in .env.local)"
echo ""
echo "   Subscribed events required:"
echo "     PAYMENT.CAPTURE.COMPLETED"
echo "     PAYMENT.CAPTURE.REFUNDED"
echo ""
echo "=========================================================="
echo "  Done. Verify both dashboards show the new URL."
echo "=========================================================="
echo ""
