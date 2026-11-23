-- 002: AI一次校閲・最終承認の記録・コンテンツハッシュ・管理操作の監査ログ。
-- 前提: 001_quiz.sql 適用済み。001 の制約（approved/published は approved_by・approved_at 必須 等）と矛盾しない追加のみ。

alter table public.quiz_questions
  add column if not exists approved_by_email text,
  add column if not exists content_hash text;

-- 001 時点の承認済み/公開済みの行には本文ハッシュがない。制約追加前に draft へ戻し、再校閲・再承認を要求する（承認時の本文を保証できないため）。
-- ※ 公開済みだった問題は HP から非公開になる。既存データがある環境ではこの影響を確認してから適用すること。
update public.quiz_questions
   set status = 'draft', approved_by = null, approved_at = null, scheduled_at = null, published_at = null
 where status in ('approved','published') and content_hash is null;

-- approved / published は承認時の本文ハッシュ必須（001 の approved_by/approved_at 制約に追加）
alter table public.quiz_questions drop constraint if exists quiz_approved_requires_hash;
alter table public.quiz_questions add constraint quiz_approved_requires_hash
  check (status not in ('approved','published') or content_hash is not null);

-- 校閲記録（AI一次校閲 と 人間の確認 を kind で区別）
create table if not exists public.quiz_reviews (
  id           uuid primary key default gen_random_uuid(),
  question_id  text not null references public.quiz_questions(id) on delete cascade,
  kind         text not null check (kind in ('ai','human')),
  reviewer     text not null,
  verdict      text not null check (verdict in ('pass','needs_changes','fail')),
  comments     text not null default '',
  checks       jsonb not null default '[]'::jsonb,
  content_hash text not null,           -- 校閲した時点の本文ハッシュ（本文変更後は無効扱い）
  created_at   timestamptz not null default now()
);
create index if not exists quiz_reviews_q on public.quiz_reviews(question_id, created_at desc);

-- 管理操作の監査ログ（追記のみ）
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    text not null,
  actor_kind  text not null check (actor_kind in ('human','ai','system')),
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_log_at on public.admin_audit_log(created_at desc);

-- 監査ログは更新・削除不可（service_role でもトリガーで拒否）
create or replace function public.admin_audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'admin_audit_log is append-only';
end $$;
drop trigger if exists admin_audit_log_no_update on public.admin_audit_log;
create trigger admin_audit_log_no_update before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_immutable();

-- 承認後に本文（問題・選択肢・正答・解説）が変わったら承認を自動無効化（アプリ側の withInvalidation と同じ規則）
create or replace function public.quiz_invalidate_on_content_change() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and (
       new.question is distinct from old.question
    or new.choices is distinct from old.choices
    or new.correct_answer is distinct from old.correct_answer
    or new.explanation is distinct from old.explanation) then
    new.status := 'draft';
    new.approved_by := null;
    new.approved_by_email := null;
    new.approved_at := null;
    new.content_hash := null;
    new.published_at := null;
    new.scheduled_at := null;
  end if;
  return new;
end $$;
drop trigger if exists quiz_invalidate_on_content_change on public.quiz_questions;
create trigger quiz_invalidate_on_content_change before update on public.quiz_questions
  for each row execute function public.quiz_invalidate_on_content_change();

-- RLS: 管理者(app_metadata.role='admin')のみ参照。書き込みは service_role（管理API）のみ。anon/authenticated の直接書き込みは不可。
alter table public.quiz_reviews    enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists quiz_reviews_admin_read on public.quiz_reviews;
create policy quiz_reviews_admin_read on public.quiz_reviews for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists admin_audit_admin_read on public.admin_audit_log;
create policy admin_audit_admin_read on public.admin_audit_log for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on public.quiz_reviews, public.admin_audit_log from anon;

-- 監査ログの全消去（TRUNCATE）も拒否する。行トリガーは TRUNCATE では発火しないため、文トリガーを追加し、権限も取り消す。
create or replace function public.admin_audit_log_no_truncate() returns trigger language plpgsql as $$
begin
  raise exception 'admin_audit_log is append-only (truncate denied)';
end $$;
drop trigger if exists admin_audit_log_no_truncate on public.admin_audit_log;
create trigger admin_audit_log_no_truncate before truncate on public.admin_audit_log
  for each statement execute function public.admin_audit_log_no_truncate();
revoke truncate on public.admin_audit_log from anon, authenticated, service_role;

-- 承認者のメール/ID・承認日時・本文ハッシュ等を匿名・一般ユーザーに露出させない（列単位の権限で公開項目のみ許可）。
-- 管理画面・管理API は service_role 経由で全列を読む。
revoke select on public.quiz_questions from anon, authenticated;
grant select (id, slug, category, question, choices, correct_answer, explanation, difficulty, status, scheduled_at, published_at, created_at, updated_at)
  on public.quiz_questions to anon, authenticated;
