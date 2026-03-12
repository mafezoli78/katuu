
-- Make checkin-selfies bucket private
UPDATE storage.buckets SET public = false WHERE id = 'checkin-selfies';

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Checkin selfies are publicly accessible" ON storage.objects;

-- Allow authenticated users to view checkin selfies (needed for co-present users to see each other's selfies)
CREATE POLICY "Authenticated users can view checkin selfies"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'checkin-selfies');
