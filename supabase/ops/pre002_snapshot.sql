-- 【002 適用前に必ず実行】承認済み/公開済みの問題の退避。002 は、ハッシュのない承認済み/公開済みの行を draft に戻し、
-- approved_by / approved_at / scheduled_at / published_at を消去する（元に戻せない）。この退避が復元の唯一の手段になる。
-- 本番では先に Supabase のバックアップ/pg_dump を取得すること（この退避は補助）。冪等。
create table if not exists public.ops_pre002_quiz_questions_backup as
  select now() as backed_up_at, q.* from public.quiz_questions q where q.status in ('approved','published');

-- 退避表は管理用。anon / authenticated から一切見えないようにする（RLS 有効＋権限なし。ポリシー無し＝service_role 以外は 0 件）。
alter table public.ops_pre002_quiz_questions_backup enable row level security;
revoke all on public.ops_pre002_quiz_questions_backup from public, anon, authenticated;
