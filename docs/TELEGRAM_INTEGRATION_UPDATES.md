# Telegram Integration Updates

## Overview
Updated the Telegram integration to use a hybrid approach: bot token from environment variables and group-specific configuration from the database, making it flexible and secure for multi-event configurations.

## Changes Made

### 1. Type Updates (`src/types/telegram.ts`)
- Updated `TelegramConfig` interface to make `botToken` optional (comes from environment)
- Made `privateGroupId` required for group-specific configuration
- Updated comments to reflect the hybrid approach

### 2. Bot Service Updates (`src/lib/telegram/bot-service.ts`)
- Modified `createTelegramBotService()` factory function to read from `TELEGRAM_BOT_TOKEN` environment variable
- Added validation for bot token from environment
- Maintains backward compatibility with existing environment variable setup

### 3. Telegram Service Updates (`src/lib/telegram/telegram-service.ts`)
- Updated constructor to initialize bot service with environment token
- Added `isAvailable(eventSlug)` method to check both environment and database configuration
- Modified `generatePrivateInvite()` method to merge environment token with database config
- Updated `testBotConnection()` method to accept event slug parameter and check availability

### 4. API Route Updates (`src/app/api/telegram/test-connection/route.ts`)
- Modified to accept `eventSlug` query parameter
- Updated to use new async `isAvailable()` method
- Updated to pass event slug to `testBotConnection()` method

### 5. Test Page Updates (`src/app/test-telegram/page.tsx`)
- Updated bot connection test to pass event slug parameter
- Modified environment check to show bot token status from environment
- Fixed HTML structure issues

### 6. Environment Configuration (`env.example`)
- Restored `TELEGRAM_BOT_TOKEN` as a required environment variable
- Maintains existing environment variable setup

## Configuration Approach

### Environment Variables
- **`TELEGRAM_BOT_TOKEN`**: Bot API token stored securely in environment variables
- **`TELEGRAM_INVITE_EXPIRY_HOURS`**: Global configuration for invite expiration

### Database Configuration
The Telegram configuration is stored in the `events.telegram_config` JSON field with the following structure:

```json
{
  "enabled": true,
  "privateGroupId": "-4942968486",
  "groupName": "Test Badge Maker Group",
  "description": "Join our private group for event updates and networking"
}
```

**Note**: The `botToken` is NOT stored in the database - it comes from environment variables.

## Benefits of This Approach
1. **Security**: Bot tokens remain in environment variables, not exposed in database
2. **Multi-event Support**: Each event can have its own group configuration
3. **Flexibility**: Easy to update group configurations without redeploying
4. **Scalability**: Support for multiple events with different Telegram setups
5. **Backward Compatibility**: Maintains existing environment variable setup

## Migration Notes
- Bot token continues to be configured via `TELEGRAM_BOT_TOKEN` environment variable
- Group-specific configuration (group ID, name, description) is stored in database
- All Telegram service methods now require an `eventSlug` parameter
- The `isAvailable()` method is now async and checks both environment and database configuration

## Testing
Use the `/test-telegram` page to verify:
1. Bot connection with environment-stored token
2. Group info retrieval from database
3. Invite generation using combined configuration
4. Component functionality

The test page now requires an event slug parameter for all operations.
