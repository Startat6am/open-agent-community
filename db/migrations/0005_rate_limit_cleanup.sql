-- Permit the application writer to remove only expired rate-limit buckets.
-- The application cleanup query always filters by expires_at < NOW().
GRANT DELETE ON TABLE public.rate_limit_buckets TO oac_app_writer;
