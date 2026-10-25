-- Allow the least-privilege application writer to accept reports only.
GRANT INSERT ON TABLE public.reports TO oac_app_writer;

-- Administrator operations must use a separate DATABASE_ADMIN_URL and a separately
-- provisioned oac_admin role; never grant content deletion to oac_app_writer.
-- Provision oac_admin through Neon Console/secret manager, then grant only:
--   GRANT USAGE ON SCHEMA public TO oac_admin;
--   GRANT SELECT ON TABLE public.reports TO oac_admin;
--   GRANT UPDATE (status, reviewed_at) ON TABLE public.reports TO oac_admin;
--   GRANT DELETE ON TABLE public.topics, public.posts TO oac_admin;
-- Store its connection string only in the server-side DATABASE_ADMIN_URL secret.
