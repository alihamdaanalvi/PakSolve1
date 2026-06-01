# PakSolve Portal

A full-stack role-based portal built with Next.js 14 App Router, Supabase Auth/Postgres/Storage, and Tailwind CSS.

## Features

- Supabase Auth login/signup with role-based redirects.
- Student self-registration with `pending`, `active`, and `rejected` approval states.
- Admin dashboard for approvals, mentor invites, users, platform stats, submissions, and badge thresholds.
- Mentor dashboard for problem uploads, submission review, and grading.
- Student dashboard for problem downloads, solution uploads, submission status, feedback, profile, and rank.
- Leaderboard visible to all active logged-in users.
- Supabase Storage buckets for public problem files and private submission files.
- SQL functions for grading, point totals, and badge recalculation.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

3. Run `supabase/schema.sql` in your Supabase SQL editor.

4. Seed an admin by creating a user in Supabase Auth, then update their profile:

```sql
update public.profiles
set role = 'admin', status = 'active'
where email = 'admin@example.com';
```

5. Start the app:

```bash
npm run dev
```

## Notes

- Student accounts are created as `pending` by the database trigger and cannot access protected routes until approved.
- Mentor invites use `supabase.auth.admin.inviteUserByEmail`, so `SUPABASE_SERVICE_ROLE_KEY` must be set server-side.
- Problem uploads accept PDF, DOC, and DOCX files up to 10MB in the public `problems` bucket.
- Submission uploads accept the same formats in the private `submissions` bucket and are served through a permission-checking signed URL route.
