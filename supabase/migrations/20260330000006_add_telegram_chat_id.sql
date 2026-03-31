-- Add telegram_chat_id to platform_users
-- This numeric user ID is captured when the user sends /verify CODE to the bot.
-- Required for sending DMs via the Telegram Bot API (chat_id: @handle only works for channels).

ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
