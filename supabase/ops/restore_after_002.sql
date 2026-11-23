-- 002 で draft に戻された行を、pre002_snapshot.sql の退避から復元する（001 時点の状態への復元）。
-- 注意: 002 の制約 quiz_approved_requires_hash を外す。旧承認にはハッシュが無いため、制約があると approved/published に戻せない。
--       復元後は「001 時点のアプリ」でのみ使うこと。002 以降のアプリを使い続けるなら復元せず、管理画面で再校閲→再承認する。
-- 安全条件: 復元するのは「本文（問題・選択肢・正答・解説）が退避時と完全に一致する行」だけ。
--       002 適用後に本文が編集された行へ旧本文の承認を付け直すと、人間が承認していない本文が公開されるため、
--       本文が違う行は復元せず draft のままにする（再校閲→再承認が必要）。単一の UPDATE 文＝1 トランザクションで判定と更新を行う。
alter table public.quiz_questions drop constraint if exists quiz_approved_requires_hash;
update public.quiz_questions q
   set status = b.status, approved_by = b.approved_by, approved_at = b.approved_at,
       scheduled_at = b.scheduled_at, published_at = b.published_at
  from public.ops_pre002_quiz_questions_backup b
 where q.id = b.id and q.status = 'draft' and q.content_hash is null
   and q.question = b.question and q.choices = b.choices
   and q.correct_answer = b.correct_answer and q.explanation = b.explanation;

-- 復元されずに残った行（本文が退避時と異なる）の一覧。管理画面で再校閲→再承認すること。
select b.id, b.status as status_before_002 from public.ops_pre002_quiz_questions_backup b
  join public.quiz_questions q on q.id = b.id where q.status = 'draft';
