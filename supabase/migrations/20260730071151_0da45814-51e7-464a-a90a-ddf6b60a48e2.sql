CREATE TABLE public.internal_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_tokens TO service_role;

ALTER TABLE public.internal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to internal tokens"
  ON public.internal_tokens FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

INSERT INTO public.internal_tokens (name) VALUES ('csp_alert_cron');