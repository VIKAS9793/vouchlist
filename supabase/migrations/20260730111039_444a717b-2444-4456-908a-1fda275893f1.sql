REVOKE ALL ON public.privacy_requests FROM anon, authenticated;
REVOKE ALL ON public.csp_alerts FROM anon, authenticated;
REVOKE ALL ON public.internal_tokens FROM anon, authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
GRANT ALL ON public.csp_alerts TO service_role;
GRANT ALL ON public.internal_tokens TO service_role;