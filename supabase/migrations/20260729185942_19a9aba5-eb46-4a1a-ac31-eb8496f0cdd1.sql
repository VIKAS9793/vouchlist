CREATE TABLE public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('export','delete')),
  token text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired')),
  requester_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz
);

GRANT ALL ON public.privacy_requests TO service_role;

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to privacy requests"
  ON public.privacy_requests FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE INDEX privacy_requests_email_created_idx ON public.privacy_requests (lower(email), created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_privacy_requests_updated_at
  BEFORE UPDATE ON public.privacy_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();