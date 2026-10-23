ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_submission_method_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_submission_method_check CHECK (submission_method IN ('GET', 'POST', 'WEB'));
COMMENT ON COLUMN public.posts.submission_method IS 'Submission channel: GET, POST, or WEB form (transported via POST).';
