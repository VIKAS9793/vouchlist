CREATE TABLE public.csp_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  document_uri TEXT NOT NULL DEFAULT '',
  violated_directive TEXT NOT NULL DEFAULT '',
  effective_directive TEXT NOT NULL DEFAULT '',
  blocked_uri TEXT NOT NULL DEFAULT '',
  source_file TEXT NOT NULL DEFAULT '',
  line_number INTEGER,
  disposition TEXT NOT NULL DEFAULT 'report',
  user_agent TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL DEFAULT ''
);

GRANT ALL ON public.csp_reports TO service_role;

ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX csp_reports_created_at_idx ON public.csp_reports (created_at DESC);
CREATE INDEX csp_reports_fingerprint_idx ON public.csp_reports (fingerprint);