-- 読み取り専用の事前調査（変更なし）。検証/本番のどちらでも、マイグレーション適用前に実行して結果を記録する。
-- 1) 同名テーブルが既に存在しないか（001 は create table if not exists のため、形の違う既存表があると黙ってスキップされ 002 以降が失敗する）
select table_name, (select count(*) from information_schema.columns c where c.table_schema='public' and c.table_name=t.table_name) as columns
  from information_schema.tables t
 where table_schema='public' and table_name in ('quiz_questions','quiz_post_log','quiz_post_attempts','quiz_reviews','admin_audit_log');
-- 2) 002 で draft に戻る行（001 状態の DB では approved/published の全行が該当）。content_hash 列が未作成なら 001 状態。
select status, count(*) from public.quiz_questions where status in ('approved','published') group by status;
-- 3) 影響を受ける公開中の問題（HP から非公開になる）と、SNS 投稿済みで解答 URL が 404 になるもの
select q.id, q.slug, q.status, q.scheduled_at, (select count(*) from public.quiz_post_log l where l.question_id=q.id and l.status='succeeded') as sns_posted
  from public.quiz_questions q where q.status='published' order by q.scheduled_at;
-- 4) 結果不明のまま残っている投稿（人間の手動照合が必要）
select question_id, platform, status, attempts, last_error from public.quiz_post_log where status in ('unknown','sending');
