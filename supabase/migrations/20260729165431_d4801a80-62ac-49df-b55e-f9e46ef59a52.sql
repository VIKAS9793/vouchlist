CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique ON public.waitlist (lower(email));

CREATE TABLE IF NOT EXISTS public.waitlist_throttle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.waitlist_throttle TO service_role;

ALTER TABLE public.waitlist_throttle ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS waitlist_throttle_bucket_time_idx ON public.waitlist_throttle (bucket, created_at DESC);

DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist;
REVOKE INSERT ON public.waitlist FROM anon, authenticated;