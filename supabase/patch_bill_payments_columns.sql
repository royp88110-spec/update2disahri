-- Run this in Supabase SQL Editor to fix the bill_payments table schema.
-- Safe to run even if columns/constraints already exist.

-- 1. Add missing columns
ALTER TABLE bill_payments
  ADD COLUMN IF NOT EXISTS amount      numeric     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- 2. Add unique constraint needed for upsert (onConflict: member_id,month)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bill_payments_member_id_month_key'
      AND conrelid = 'bill_payments'::regclass
  ) THEN
    ALTER TABLE bill_payments
      ADD CONSTRAINT bill_payments_member_id_month_key UNIQUE (member_id, month);
  END IF;
END $$;
