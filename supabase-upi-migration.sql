-- ─── UPI Payment Feature Migration ─────────────────────────────────────────
-- Run this in your Supabase SQL Editor to enable the UPI payment feature.
-- This script is idempotent — safe to run multiple times.

-- 1. UPI Settings (singleton row, managed by admin)
CREATE TABLE IF NOT EXISTS upi_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  upi_id              TEXT    NOT NULL DEFAULT '',
  account_holder_name TEXT    NOT NULL DEFAULT '',
  qr_code_base64      TEXT,
  payment_note        TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT upi_settings_single_row CHECK (id = 1)
);
INSERT INTO upi_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 2. Payment Submissions (member UPI payment submissions pending admin verification)
CREATE TABLE IF NOT EXISTS payment_submissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  month             TEXT        NOT NULL,   -- "YYYY-MM"
  claimed_amount    NUMERIC     NOT NULL DEFAULT 0,
  screenshot_base64 TEXT,
  utr               TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_amount   NUMERIC,
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  admin_notes       TEXT
);

-- Index for quick member lookups
CREATE INDEX IF NOT EXISTS idx_payment_submissions_member_month
  ON payment_submissions(member_id, month);

-- Index for admin listing by status
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status
  ON payment_submissions(status, submitted_at DESC);

-- 3. RLS for upi_settings
ALTER TABLE upi_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upi_settings_read"         ON upi_settings;
DROP POLICY IF EXISTS "upi_settings_admin_write"  ON upi_settings;

-- Any authenticated user can read UPI settings (members need to see UPI ID / QR code)
CREATE POLICY "upi_settings_read" ON upi_settings
  FOR SELECT TO authenticated USING (true);

-- Only admin can insert / update / delete
CREATE POLICY "upi_settings_admin_write" ON upi_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 4. RLS for payment_submissions
ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_submissions_select"       ON payment_submissions;
DROP POLICY IF EXISTS "payment_submissions_insert"       ON payment_submissions;
DROP POLICY IF EXISTS "payment_submissions_update"       ON payment_submissions;
DROP POLICY IF EXISTS "payment_submissions_admin_update" ON payment_submissions;

-- Members see their own; admin sees all
CREATE POLICY "payment_submissions_select" ON payment_submissions
  FOR SELECT TO authenticated USING (
    member_id = (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1)
    OR
    EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Members can insert their own submissions
CREATE POLICY "payment_submissions_insert" ON payment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1)
  );

-- Only admin can update (approve / reject) submissions
CREATE POLICY "payment_submissions_admin_update" ON payment_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5. Enable realtime for new tables
-- (Add each table to the realtime publication; ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE upi_settings;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payment_submissions;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
