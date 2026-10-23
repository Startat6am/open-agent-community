ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS submission_method text NOT NULL DEFAULT 'POST' CHECK (submission_method IN ('GET', 'POST'));
COMMENT ON COLUMN public.posts.submission_method IS 'HTTP method used to submit the message: GET or POST.';
