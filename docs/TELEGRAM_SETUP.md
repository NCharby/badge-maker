# Telegram Setup

The platform uses Telegram for two distinct notification delivery models:

- **User DMs** — personal messages sent directly to individual users via the bot
- **Event Channel broadcasts** — messages posted to a Telegram channel/group configured per event by the EP

---

## Bot Token

All Telegram functionality requires a bot token set in the `TELEGRAM_BOT_TOKEN` environment variable.

---

## User DM Notifications

### How it works

User DMs use the Telegram Bot API `sendMessage` endpoint with the user's **numeric Telegram user ID** (`chat_id`). Sending to `@username` does **not** work for individual users — only for channels and supergroups.

The numeric `chat_id` is stored in `platform_users.telegram_chat_id` (BIGINT). It is captured automatically when the user completes the verification flow (see below).

### User verification flow

1. User saves a Telegram handle on their Profile page and clicks **"Get verification code"**
2. A 6-digit code is generated and displayed in the platform UI (valid for 15 minutes)
3. User opens **@ShinyDogEventsBot** on Telegram and sends: `/verify 123456`
4. The bot captures the user's numeric `chat_id` from `ctx.from.id`, stores it in `platform_users.telegram_chat_id`, sets `telegram_verified = true`, and enables `telegram_notifications_enabled`
5. User refreshes their Profile page — the badge updates to "✓ Verified"

Until verified, the user will not receive any Telegram notifications from the platform.

### Sending a DM from code

```typescript
import { sendTelegramDM } from '@/lib/telegram/send'

// Pass the platform user's UUID. sendTelegramDM handles all guards internally:
// - skips silently if telegram_chat_id is null
// - skips if telegram_verified is false
// - skips if telegram_notifications_enabled is false
void sendTelegramDM(userId, 'Your message here')
```

---

## Event Channel Notifications

### How it works

Event-specific notifications are broadcast to a Telegram channel or supergroup configured by the EP. For channels, the `@channelname` format **does** work with the Bot API — unlike user DMs.

### EP setup (one-time per channel)

1. **Add the bot as a channel admin:**
   - Open the Telegram channel → Manage Channel → Administrators
   - Add `@ShinyDogEventsBot` as admin
   - Grant at minimum: **Post Messages** permission
2. **Configure the channel in the platform:**
   - Go to EP Dashboard → select the event → **Notifications**
   - Enter the channel username (e.g. `@myeventchannel`) in the "Channel username" field
   - Enable/disable individual notification types and optionally provide custom message text
   - Click **Save notification settings**

The bot cannot post to a channel unless it has been added as an admin with Post Messages permission.

### Sending a channel message from code

```typescript
import { sendEventChannelMessage } from '@/lib/telegram/send'

// type must match one of the 6 configured keys (see DEFAULT_TEMPLATES in send.ts)
// variables are interpolated into the {token} placeholders in the template
void sendEventChannelMessage(eventId, 'status_transition', {
  event_name: 'My Event',
  new_status: 'Tickets Open',
})
```

### Available notification types

| Type | Default template | Variables |
|------|-----------------|-----------|
| `status_transition` | `📢 {event_name} update: {new_status}` | `{event_name}`, `{new_status}` |
| `new_attendee_enrolled` | `👋 Welcome to {event_name}, {scene_name}!` | `{event_name}`, `{scene_name}` |
| `rooms_open` | `🏨 Room selection is now open for {event_name}!` | `{event_name}` |
| `lock_deadline_1week` | `⏰ Room lock-in for {event_name} is in 1 week.` | `{event_name}`, `{lock_in_date}` |
| `lock_deadline_48h` | `⚠️ URGENT: Room lock-in for {event_name} is in 48 hours!` | `{event_name}`, `{lock_in_date}` |
| `event_locked` | `🔒 {event_name} is now locked. See you there!` | `{event_name}`, `{event_date}` |

The EP can override any template with custom text from the Notifications config page. Leaving it blank uses the default template above.

---

## Webhook (local development)

The bot runs in webhook mode. For local testing:

1. Start ngrok: `ngrok http 3000`
2. Register the webhook (replace `<ngrok-url>` with your ngrok HTTPS URL):
   ```
   curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "<ngrok-url>/api/telegram/webhook"}'
   ```
3. Use the bot normally — the webhook delivers to your local Next.js dev server

Re-register on each new ngrok session (the URL changes). The grammY library requires no code changes between dev and production.

---

## Production webhook registration

In production, the webhook must point to your live domain:

```
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/api/telegram/webhook"}'
```

Run this once after initial deployment and again whenever the domain changes.
