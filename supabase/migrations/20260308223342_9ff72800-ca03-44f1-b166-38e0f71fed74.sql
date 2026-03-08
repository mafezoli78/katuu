
-- Schedule cleanup-expired-presences every 5 minutes via Edge Function
SELECT cron.schedule(
  'cleanup-expired-presences',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://jhpxfvwhcxakzajioxiz.supabase.co/functions/v1/cleanup-expired-presences',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocHhmdndoY3hha3phamlveGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3OTI2NjksImV4cCI6MjA4NzM2ODY2OX0.-4soKb5wlgrEQtsfFecDO9RgtImIymcb5RcoY2r2IH0"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule close_conversations_without_presence every 2 minutes (direct SQL)
SELECT cron.schedule(
  'close-conversations-without-presence-v2',
  '*/2 * * * *',
  'SELECT public.close_conversations_without_presence()'
);
