-- 003: 不要な権限の取り消し（最小権限）。001/002 適用済みを前提とし、冪等。
-- 背景: RLS は TRUNCATE に効かない。Supabase の既定権限は anon/authenticated に全権限を付与するため、
--       001 の「anon だけ revoke」では authenticated が quiz_reviews 等を TRUNCATE できてしまう。
-- 方針: anon / authenticated / PUBLIC の権限をいったん全て取り消し、必要な SELECT だけ付け直す。書き込みは service_role（管理API）のみ。

revoke all on public.quiz_questions, public.quiz_post_log, public.quiz_post_attempts, public.quiz_reviews, public.admin_audit_log
  from public, anon, authenticated;

-- 管理者（app_metadata.role='admin'）の参照用。行は RLS ポリシーで絞られる。書き込み権限は付与しない。
grant select on public.quiz_post_log, public.quiz_post_attempts, public.quiz_reviews, public.admin_audit_log to authenticated;

-- 公開問題: 公開列のみ（承認者メール・本文ハッシュ等は列権限で非公開。002 と同じ列）。行は RLS で「published かつ予約時刻到達」に限定。
grant select (id, slug, category, question, choices, correct_answer, explanation, difficulty, status, scheduled_at, published_at, created_at, updated_at)
  on public.quiz_questions to anon, authenticated;

-- service_role は通常の SELECT/INSERT/UPDATE/DELETE のみ。TRUNCATE・REFERENCES・TRIGGER は不要なので取り消す。
-- （テーブル所有者・superuser は別。監査ログは 002 のトリガーで UPDATE/DELETE/TRUNCATE を拒否）
revoke truncate, references, trigger on public.quiz_questions, public.quiz_post_log, public.quiz_post_attempts, public.quiz_reviews, public.admin_audit_log
  from service_role;
