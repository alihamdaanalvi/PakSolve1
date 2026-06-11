create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('admin', 'mentor', 'student');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.profile_status as enum ('pending', 'active', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.submission_status as enum ('pending', 'graded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.academic_batch as enum ('basic', 'intermediate', 'advanced');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subject_area as enum ('physics', 'math');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'student',
  status public.profile_status not null default 'pending',
  total_points integer not null default 0 check (total_points >= 0),
  badge_level text not null default 'Beginner',
  batch public.academic_batch not null default 'basic',
  subjects public.subject_area[] not null default array['math']::public.subject_area[],
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  file_url text,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  subject public.subject_area not null default 'math',
  batch public.academic_batch not null default 'basic',
  deadline timestamptz not null,
  max_points integer not null check (max_points > 0),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists batch public.academic_batch not null default 'basic',
  add column if not exists subjects public.subject_area[] not null default array['math']::public.subject_area[];

alter table public.problems
  add column if not exists subject public.subject_area not null default 'math',
  add column if not exists batch public.academic_batch not null default 'basic';

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  file_url text not null,
  r2_key text not null,
  original_filename text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  uploaded_at timestamptz not null default now(),
  archived boolean not null default false,
  archived_at timestamptz,
  google_drive_file_id text,
  status public.submission_status not null default 'pending',
  score integer check (score >= 0),
  feedback text,
  graded_by uuid references auth.users(id),
  graded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.submissions
  add column if not exists r2_key text,
  add column if not exists original_filename text,
  add column if not exists file_size integer,
  add column if not exists uploaded_at timestamptz,
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists google_drive_file_id text;

update public.submissions
set
  r2_key = coalesce(r2_key, file_url),
  original_filename = coalesce(original_filename, 'submission.pdf'),
  file_size = coalesce(file_size, 1),
  uploaded_at = coalesce(uploaded_at, created_at),
  archived = coalesce(archived, false);

alter table public.submissions
  alter column r2_key set not null,
  alter column original_filename set not null,
  alter column file_size set not null,
  alter column uploaded_at set not null;

do $$ begin
  alter table public.submissions
    add constraint submissions_file_size_limit check (file_size > 0 and file_size <= 10485760);
exception when duplicate_object then null;
end $$;

delete from public.submissions duplicate
where exists (
  select 1
  from public.submissions keeper
  where keeper.problem_id = duplicate.problem_id
    and keeper.student_id = duplicate.student_id
    and (
      keeper.created_at > duplicate.created_at
      or (keeper.created_at = duplicate.created_at and keeper.ctid > duplicate.ctid)
    )
);

create unique index if not exists submissions_one_per_student_problem
on public.submissions (problem_id, student_id);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null,
  points_threshold integer not null unique check (points_threshold >= 0)
);

insert into public.badges (name, icon, points_threshold)
values
  ('Beginner', '🌱', 0),
  ('Intermediate', '⭐', 100),
  ('Advanced', '🏆', 300)
on conflict (name) do nothing;

create or replace function public.badge_for_points(p_points integer)
returns text
language sql
stable
as $$
  select name
  from public.badges
  where points_threshold <= p_points
  order by points_threshold desc
  limit 1
$$;

create or replace function public.recalculate_all_badges()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set badge_level = coalesce(public.badge_for_points(total_points), 'Beginner')
  where role = 'student';
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'student');
begin
  insert into public.profiles (user_id, name, email, role, status, batch, subjects)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    requested_role,
    case when requested_role = 'student' then 'pending'::public.profile_status else 'active'::public.profile_status end,
    coalesce((new.raw_user_meta_data->>'batch')::public.academic_batch, 'basic'::public.academic_batch),
    case
      when jsonb_typeof(new.raw_user_meta_data->'subjects') = 'array'
      then array(select jsonb_array_elements_text(new.raw_user_meta_data->'subjects')::public.subject_area)
      else array['math']::public.subject_area[]
    end
  )
  on conflict (user_id) do update set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    status = excluded.status,
    batch = excluded.batch,
    subjects = excluded.subjects;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.grade_submission(
  p_submission_id uuid,
  p_score integer,
  p_feedback text,
  p_graded_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_submission public.submissions%rowtype;
  max_allowed integer;
  new_total integer;
begin
  select * into target_submission from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found';
  end if;

  select max_points into max_allowed from public.problems where id = target_submission.problem_id;
  if p_score < 0 or p_score > max_allowed then
    raise exception 'Score must be between 0 and %', max_allowed;
  end if;

  update public.submissions
  set status = 'graded',
      score = p_score,
      feedback = p_feedback,
      graded_by = p_graded_by,
      graded_at = now()
  where id = p_submission_id;

  select coalesce(sum(score), 0) into new_total
  from public.submissions
  where student_id = target_submission.student_id and status = 'graded';

  update public.profiles
  set total_points = new_total,
      badge_level = coalesce(public.badge_for_points(new_total), 'Beginner')
  where user_id = target_submission.student_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.submissions enable row level security;
alter table public.badges enable row level security;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
create policy "profiles readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "users update own avatar" on public.profiles;
create policy "users update own avatar"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "problems readable by authenticated users" on public.problems;
create policy "problems readable by authenticated users"
on public.problems for select
to authenticated
using (true);

drop policy if exists "mentors create problems" on public.problems;
create policy "mentors create problems"
on public.problems for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.profiles where user_id = auth.uid() and role = 'mentor' and status = 'active')
);

drop policy if exists "submissions scoped read" on public.submissions;
create policy "submissions scoped read"
on public.submissions for select
to authenticated
using (
  student_id = auth.uid()
  or exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin' and status = 'active')
  or exists (select 1 from public.problems where id = problem_id and uploaded_by = auth.uid())
);

drop policy if exists "students submit own work" on public.submissions;
create policy "students submit own work"
on public.submissions for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (select 1 from public.profiles where user_id = auth.uid() and role = 'student' and status = 'active')
);

drop policy if exists "badges readable by authenticated users" on public.badges;
create policy "badges readable by authenticated users"
on public.badges for select
to authenticated
using (true);
