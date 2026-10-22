/* ============================================================
   One off fix: summer time (BST) date shift
   ------------------------------------------------------------
   Until this release the weekly planner turned local midnight into
   a date with toISOString(), which is UTC. During British Summer
   Time that gives the previous day, so between 30 Mar and 25 Oct 2026:
     * habit ticks were saved one day early
     * weekly planner rows were saved under the Sunday before the week
   The app now uses the real local date. This script moves the summer
   rows forward by one day so old weeks still line up.

   Run it ONCE in the Supabase SQL Editor, right before or right after
   deploying the new version. It records itself in app_migrations, so
   running it twice does nothing the second time.
   ============================================================ */

CREATE TABLE IF NOT EXISTS app_migrations (
  name        text PRIMARY KEY,
  applied_at  timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_migrations WHERE name = 'fix_bst_dates_2026') THEN
    RAISE NOTICE 'fix_bst_dates_2026 already applied, nothing to do';
    RETURN;
  END IF;

  -- Habit ticks: stored dates 29 Mar .. 24 Oct 2026 really belong to the next day.
  -- Two steps avoid clashing with the unique (user_id, habit_id, date) key mid update.
  UPDATE weekly_habit_completions
     SET date = date + 100000
   WHERE date BETWEEN DATE '2026-03-29' AND DATE '2026-10-24';
  UPDATE weekly_habit_completions
     SET date = date - 99999
   WHERE date > DATE '2200-01-01';

  -- Weekly planner rows saved under a Sunday move to their Monday
  UPDATE weekly_planner_entries
     SET week_start = week_start + 1
   WHERE EXTRACT(DOW FROM week_start) = 0
     AND week_start BETWEEN DATE '2026-03-29' AND DATE '2026-10-18';

  INSERT INTO app_migrations (name) VALUES ('fix_bst_dates_2026');
END $$;

-- Check: every planner row should now start on a Monday (dow = 1)
SELECT EXTRACT(DOW FROM week_start) AS dow, count(*) FROM weekly_planner_entries GROUP BY 1;
