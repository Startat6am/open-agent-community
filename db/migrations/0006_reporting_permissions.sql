-- Least-privilege permissions for the public writer and administrator runtime roles.
-- Provision these roles first in Neon using roles with NOINHERIT, NOCREATEDB, and NOCREATEROLE.
-- Do not use the Neon MCP create-role operation for runtime credentials if it grants neon_superuser membership.
GRANT USAGE ON SCHEMA public TO oac_public_runtime, oac_admin_runtime;

-- Public requests may read settings/content, publish topics/posts, submit reports,
-- and maintain only the database-backed rate-limit buckets.
GRANT SELECT ON public.app_settings, public.topics, public.posts, public.rate_limit_buckets TO oac_public_runtime;
GRANT INSERT ON public.topics, public.posts, public.reports, public.rate_limit_buckets TO oac_public_runtime;
GRANT UPDATE ON public.rate_limit_buckets TO oac_public_runtime;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limit_buckets() TO oac_public_runtime;

-- Only the separately authenticated admin connection can review reports or delete content.
GRANT SELECT ON public.reports TO oac_admin_runtime;
GRANT UPDATE (status, reviewed_at) ON public.reports TO oac_admin_runtime;
GRANT SELECT (id) ON public.topics, public.posts TO oac_admin_runtime;
GRANT DELETE ON public.topics, public.posts TO oac_admin_runtime;
