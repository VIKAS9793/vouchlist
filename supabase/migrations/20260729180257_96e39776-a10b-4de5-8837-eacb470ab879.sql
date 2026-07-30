DELETE FROM public.waitlist a
USING public.waitlist b
WHERE lower(a.email) = lower(b.email)
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx
  ON public.waitlist (lower(email));