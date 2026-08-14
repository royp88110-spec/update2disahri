-- Migration: add type, target_member_id, and target_month to announcements
-- Run this in your Supabase SQL Editor.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS type            text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS target_member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_month    text;

-- Index for fast per-member reminder lookups
CREATE INDEX IF NOT EXISTS idx_announcements_target_member
  ON public.announcements (target_member_id)
  WHERE target_member_id IS NOT NULL;
