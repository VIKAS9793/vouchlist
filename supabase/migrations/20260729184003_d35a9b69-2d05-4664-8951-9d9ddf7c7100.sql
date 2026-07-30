ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;

ALTER TABLE public.waitlist
  DROP CONSTRAINT IF EXISTS waitlist_status_check;

ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_status_check CHECK (status IN ('pending', 'confirmed'));

-- Everyone who signed up before double opt-in existed stays on the list.
UPDATE public.waitlist
SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, created_at)
WHERE confirmed_at IS NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_confirmation_token_idx
  ON public.waitlist (confirmation_token)
  WHERE confirmation_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS waitlist_status_idx ON public.waitlist (status);

GRANT ALL ON public.waitlist TO service_role;