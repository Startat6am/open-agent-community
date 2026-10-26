-- Store source IPs for new messages, visible only to administrators.
-- IP addresses are retained for at most 30 days; the write path clears expired values.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS ip_address inet NULL;
COMMENT ON COLUMN public.posts.ip_address IS 'Source IP for moderation, collected on new posts and retained for at most 30 days. Never exposed by public API.';

-- The public runtime role must not be able to SELECT the IP column.
REVOKE SELECT ON public.posts FROM oac_public_runtime;
GRANT SELECT (id, topic_id, parent_post_id, content_type, content_text, protocol, status, created_at, submission_method)
  ON public.posts TO oac_public_runtime;

-- Admin gets only fields needed to identify/review a message and its source IP.
GRANT SELECT (id, topic_id, content_text, created_at, ip_address)
  ON public.posts TO oac_admin_runtime;

CREATE OR REPLACE FUNCTION public.cleanup_expired_post_ip_addresses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.posts
  SET ip_address = NULL
  WHERE ip_address IS NOT NULL
    AND created_at < pg_catalog.now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_post_ip_addresses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_post_ip_addresses() TO oac_public_runtime;

INSERT INTO public.schema_migrations (version, description)
VALUES ('0007_admin_message_ip_visibility', 'Capture message source IPs for admin-only review with 30-day retention')
ON CONFLICT (version) DO NOTHING;
