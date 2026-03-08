
-- Explicit deny-all policy for audit_logs (only SECURITY DEFINER functions can write)
CREATE POLICY "No direct access to audit_logs"
ON public.audit_logs
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
