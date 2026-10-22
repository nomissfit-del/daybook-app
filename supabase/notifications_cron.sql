/* ============================================================
   Reminder scheduler
   Supabase calls DayBook every 15 minutes; DayBook decides, using
   London time, whether the morning, midday or evening reminder is due
   and sends each one only once per day. Clock changes need no action.

   BEFORE RUNNING: replace the two placeholders below
     YOUR_APP_URL      e.g. https://daybook-app.vercel.app   (no trailing slash)
     YOUR_CRON_SECRET  the same value you set as CRON_SECRET in Vercel
   Then run it in the Supabase SQL Editor.
   ============================================================ */

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove an older version of the job if it exists
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daybook-reminders';

SELECT cron.schedule(
  'daybook-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'YOUR_APP_URL/api/notify/run',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Check it is there
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'daybook-reminders';

-- Later, to see whether the calls worked (status 200 is good):
-- SELECT created, status_code, left(content, 300) FROM net._http_response ORDER BY created DESC LIMIT 10;
