ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
COMMENT ON COLUMN public.profiles.gender IS 'User self-identified gender';