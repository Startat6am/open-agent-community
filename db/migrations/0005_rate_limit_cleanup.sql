-- Clean expired rate-limit buckets without granting the app role table-wide DELETE.
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limit_buckets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.rate_limit_buckets
  WHERE expires_at < pg_catalog.now();
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limit_buckets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limit_buckets() TO oac_app_writer;
