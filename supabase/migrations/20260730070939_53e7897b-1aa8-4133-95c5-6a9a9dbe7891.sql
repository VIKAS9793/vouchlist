CREATE TABLE public.csp_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL,
  effective_directive text NOT NULL DEFAULT '',
  blocked_uri text NOT NULL DEFAULT '',
  document_uri text NOT NULL DEFAULT '',
  window_count integer NOT NULL DEFAULT 0,
  baseline_count integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'warning',
  notified boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'log'
);

CREATE INDEX csp_alerts_fingerprint_created_idx ON public.csp_alerts (fingerprint, created_at DESC);

GRANT ALL ON public.csp_alerts TO service_role;

ALTER TABLE public.csp_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to csp alerts"
  ON public.csp_alerts FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);