-- 侍日本語ラボ: SNS連携クイズ。既存テーブル（questions / approvals 等）には一切触れない。
create table if not exists public.quiz_questions (
  id            text primary key,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category      text not null,
  question      text not null,
  choices       jsonb not null check (
                  jsonb_typeof(choices) = 'object'
                  and choices ?& array['A','B','C','D']
                  and (choices - 'A' - 'B' - 'C' - 'D') = '{}'::jsonb),
  correct_answer text not null check (correct_answer in ('A','B','C','D')),
  explanation   text not null,
  difficulty    text not null default '中級' check (difficulty in ('初級','中級','上級')),
  status        text not null default 'draft' check (status in ('draft','reviewed','approved','published')),
  scheduled_at  timestamptz,
  published_at  timestamptz,
  reviewed_by   text,
  approved_by   text,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 承認なしの published / 予約なしの approved を DB レベルで禁止
  constraint quiz_publish_requires_approval check (
    status not in ('approved','published') or (approved_by is not null and approved_at is not null)),
  constraint quiz_published_requires_schedule check (status <> 'published' or scheduled_at is not null)
);

create table if not exists public.quiz_post_log (
  id            uuid primary key default gen_random_uuid(),
  question_id   text not null references public.quiz_questions(id) on delete restrict,
  platform      text not null check (platform in ('threads','x','instagram')),
  status        text not null check (status in ('sending','succeeded','failed','unknown')),
  attempts      int  not null default 0,
  external_id   text,
  external_url  text,
  last_error    text,
  lease_until   timestamptz,
  posted_at     timestamptz,
  next_retry_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 重複投稿防止: 問題×媒体は1行のみ
  constraint quiz_post_log_unique unique (question_id, platform)
);

create table if not exists public.quiz_post_attempts (
  id          uuid primary key default gen_random_uuid(),
  post_log_id uuid not null references public.quiz_post_log(id) on delete cascade,
  question_id text not null,
  platform    text not null,
  attempt_no  int  not null,
  outcome     text not null check (outcome in ('succeeded','failed','unknown','reconciled_found','reconciled_missing')),
  error       text,
  at          timestamptz not null default now()
);
create index if not exists quiz_post_attempts_q on public.quiz_post_attempts(question_id, at desc);

-- RLS: 匿名・一般ユーザーは「公開済み かつ 予約時刻到達」の問題だけ読める。書き込みは service_role のみ（RLSをバイパス）。
alter table public.quiz_questions     enable row level security;
alter table public.quiz_post_log      enable row level security;
alter table public.quiz_post_attempts enable row level security;

drop policy if exists quiz_public_read on public.quiz_questions;
create policy quiz_public_read on public.quiz_questions
  for select to anon, authenticated
  using (status = 'published' and scheduled_at is not null and scheduled_at <= now());

-- 管理者（JWT の app_metadata.role = 'admin'）は全件参照可。書き込みは管理APIが service_role で実施。
drop policy if exists quiz_admin_read on public.quiz_questions;
create policy quiz_admin_read on public.quiz_questions
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists quiz_log_admin_read on public.quiz_post_log;
create policy quiz_log_admin_read on public.quiz_post_log
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists quiz_attempts_admin_read on public.quiz_post_attempts;
create policy quiz_attempts_admin_read on public.quiz_post_attempts
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on public.quiz_questions, public.quiz_post_log, public.quiz_post_attempts from anon;
grant select on public.quiz_questions to anon;
