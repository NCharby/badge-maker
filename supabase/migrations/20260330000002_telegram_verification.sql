-- Add Telegram handle verification columns to platform_users
-- Used by the sendTelegramVerificationCode / verifyTelegramCode flow.
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS telegram_verification_code TEXT,
  ADD COLUMN IF NOT EXISTS telegram_verification_expires_at TIMESTAMPTZ;
