DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
    CREATE TYPE public.gender_type AS ENUM (
      'man', 'woman', 'non_binary', 'trans_man', 'trans_woman',
      'agender', 'genderfluid', 'prefer_not_to_say', 'other'
    );
  END IF;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN gender TYPE public.gender_type USING gender::public.gender_type;