-- Run this in your Supabase SQL editor to create the announcements table.

CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Allow all authenticated users to read announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read announcements"
  ON public.announcements FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role / admin can insert/update/delete (handled server-side)
CREATE POLICY "Service role can manage announcements"
  ON public.announcements FOR ALL
  USING (auth.role() = 'service_role');
