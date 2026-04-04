-- Add refund_channel to orders for slicing refund data by channel.
-- Nullable: existing rows and orders without refunds stay null.
-- Analytics treats null as 'standard'.

ALTER TABLE orders ADD COLUMN refund_channel TEXT
  CHECK (refund_channel IN ('standard', 'hardship', 'chargeback'));
