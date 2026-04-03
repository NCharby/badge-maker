-- Add first_name and last_name columns to platform_users
ALTER TABLE platform_users ADD COLUMN first_name TEXT;
ALTER TABLE platform_users ADD COLUMN last_name TEXT;
