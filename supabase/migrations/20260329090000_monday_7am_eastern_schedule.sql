-- Update weekly summary schedule to Monday 7:00 AM America/New_York.
-- Strategy: run hourly on Mondays in UTC, and let the function gate
-- itself to exactly 7:00 AM ET (handles EDT and EST automatically).

select cron.unschedule('weekly-summary-friday')
where exists (
  select 1 from cron.job where jobname = 'weekly-summary-friday'
);

select cron.unschedule('weekly-summary-monday-7am-et')
where exists (
  select 1 from cron.job where jobname = 'weekly-summary-monday-7am-et'
);

select cron.schedule(
  'weekly-summary-monday-7am-et',
  '0 * * * 1',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/weekly-summary',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{"scheduled": true}'::jsonb
  )
  $$
);
