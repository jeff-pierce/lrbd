-- Add is_day_off flag to reflections so users can mark a day as time-off.
-- Goals for daily metrics are reduced by one per day-off in that week.
-- Any activity logged on a day off still counts toward weekly totals.
ALTER TABLE reflections
  ADD COLUMN IF NOT EXISTS is_day_off boolean NOT NULL DEFAULT false;
