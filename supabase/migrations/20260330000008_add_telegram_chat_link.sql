-- Add telegram_chat_link to platform_events
-- Stores the public group chat invite URL (e.g. https://t.me/joinchat/...) shown to attendees.
-- Separate from telegram_group, which stores the bot notification channel ID (@username or numeric).

ALTER TABLE public.platform_events
  ADD COLUMN IF NOT EXISTS telegram_chat_link TEXT;
