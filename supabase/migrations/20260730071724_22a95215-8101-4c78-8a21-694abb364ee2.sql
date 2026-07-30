-- Make the existing "server-side only" access rule explicit for internal tables.
-- These tables are written/read exclusively by trusted server code (service role,
-- which bypasses RLS). No anon/authenticated access is granted or intended.

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_throttle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to waitlist" ON public.waitlist;
CREATE POLICY "No public access to waitlist"
  ON public.waitlist
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to waitlist throttle" ON public.waitlist_throttle;
CREATE POLICY "No public access to waitlist throttle"
  ON public.waitlist_throttle
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No public access to csp reports" ON public.csp_reports;
CREATE POLICY "No public access to csp reports"
  ON public.csp_reports
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

GRANT ALL ON public.waitlist TO service_role;
GRANT ALL ON public.waitlist_throttle TO service_role;
GRANT ALL ON public.csp_reports TO service_role;

REVOKE ALL ON public.waitlist FROM anon, authenticated;
REVOKE ALL ON public.waitlist_throttle FROM anon, authenticated;
REVOKE ALL ON public.csp_reports FROM anon, authenticated;