# Daybook

Personal & Work dashboards for tracking daily/weekly/monthly tasks (with a
GitHub-style completion heatmap) and final targets, organized into project
folders. Built with Next.js (App Router) + Supabase (Postgres + Auth), ready
to deploy on Vercel.

## 1. Create a Supabase project

1. Go to https://supabase.com → New project (the free tier is enough).
2. Once it's ready, open **SQL Editor → New query**, paste in the contents
   of `supabase/schema.sql` from this repo, and run it. This creates the
   `projects`, `tasks`, `task_completions`, and `targets` tables with
   row-level security so each user only ever sees their own data.
3. Go to **Project Settings → API**. You'll need two values from there:
   - `Project URL`
   - `anon public` key

## 2. Run it locally in VS Code

```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```

Open http://localhost:3000 — you'll land on the login screen. Sign up with
an email + password (Supabase will send a confirmation email by default;
you can turn that off under **Authentication → Providers → Email → Confirm
email** in Supabase if you want to skip it for personal use).

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project**, import that repo.
3. Under **Environment Variables**, add the same two values from your
   `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Your phone and laptop will both hit the same Supabase database,
   so everything stays in sync.

## How the pieces fit together

- **Workspaces**: every project folder belongs to either `personal` or
  `work` — that's what powers the two dashboards.
- **Project folders**: created from either dashboard's "New project
  folder" box.
- **Tasks**: live inside a project folder. Each one repeats daily, weekly
  (pick a weekday), or monthly (pick a day-of-month). Checking one off
  today writes a row into `task_completions`.
- **Heatmap**: on each dashboard, looks across every task in that
  workspace. A day is green if everything due that day was checked off,
  red if something due was missed, and blank if nothing was due.
- **Final targets**: a simple progress bar per project — set a target
  number and update your current value as you go.

## Ideas for later

- Add a "due today" combined view across all project folders, not just
  per-folder task lists.
- Weekly/monthly digest email via a Supabase Edge Function + cron.
- Reordering/archiving project folders instead of hard-deleting them.

Bring your ideas back to Claude any time — this is a starting point, not
a finished product.
