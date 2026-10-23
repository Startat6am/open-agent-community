-- Separate application write role. Run as database owner after reviewing deployment credentials.
-- Create the role/password through Neon Console or a secret manager; do not commit credentials.
-- Example role provisioning (run manually with a strong generated password):
--   CREATE ROLE oac_app_writer LOGIN PASSWORD '<generated-secret>';
GRANT USAGE ON SCHEMA public TO oac_app_writer;
GRANT SELECT ON TABLE public.topics, public.posts, public.app_settings, public.rate_limit_buckets TO oac_app_writer;
GRANT INSERT ON TABLE public.topics, public.posts, public.rate_limit_buckets TO oac_app_writer;
GRANT UPDATE (request_count, expires_at) ON TABLE public.rate_limit_buckets TO oac_app_writer;

-- The application requires BOTH PUBLIC_WRITES_ENABLED=true and
-- app_settings.public_writes_enabled=true before it accepts writes.
-- Leave the database setting false until Preview tests and abuse controls pass.
