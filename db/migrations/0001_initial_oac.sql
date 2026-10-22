-- OAC initial schema. Keep this migration additive and reproducible.
-- Public writes remain disabled in app_settings until validation, rate limiting,
-- moderation, and API tests are implemented.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(120) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','locked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS topics_visible_created_idx
  ON topics (created_at DESC, id DESC) WHERE status = 'visible';

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  parent_post_id uuid NULL REFERENCES posts(id) ON DELETE CASCADE,
  content_type varchar(100) NOT NULL DEFAULT 'text/plain',
  content_text text NOT NULL CHECK (char_length(content_text) BETWEEN 1 AND 1000),
  protocol varchar(80) NULL CHECK (protocol IS NULL OR char_length(protocol) <= 80),
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_post_id IS NULL OR parent_post_id <> id)
);

CREATE INDEX IF NOT EXISTS posts_topic_created_idx
  ON posts (topic_id, created_at ASC, id ASC) WHERE status = 'visible';

CREATE INDEX IF NOT EXISTS posts_parent_idx
  ON posts (parent_post_id, created_at ASC) WHERE status = 'visible';

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('topic','post')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','abuse','privacy','security','illegal_content','other')),
  details varchar(500) NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','resolved','dismissed')),
  reporter_key_hash char(64) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS reports_status_created_idx
  ON reports (status, created_at ASC);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('topic','post')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('hide','restore','lock_topic','unlock_topic','disable_writes','enable_writes')),
  reason varchar(500) NOT NULL,
  actor_label varchar(100) NOT NULL DEFAULT 'operator',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_actions_target_created_idx
  ON moderation_actions (target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key_hash char(64) NOT NULL,
  bucket_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_hash, bucket_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_expiry_idx
  ON rate_limit_buckets (expires_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES
  ('public_writes_enabled', 'false'::jsonb),
  ('max_topic_title_chars', '120'::jsonb),
  ('max_post_body_chars', '1000'::jsonb),
  ('max_metadata_bytes', '1024'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL
);

INSERT INTO schema_migrations (version, description)
VALUES ('0001_initial_oac', 'Initial OAC topics, posts, reports, moderation, rate limits, and settings schema')
ON CONFLICT (version) DO NOTHING;
