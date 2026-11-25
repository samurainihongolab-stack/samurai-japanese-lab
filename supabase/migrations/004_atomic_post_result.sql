-- 004: 投稿結果の記録を単一トランザクション化する RPC。前提: 001〜003 適用済み。冪等（create or replace）。
-- 目的: quiz_post_log の状態更新 と quiz_post_attempts への履歴挿入（＋任意で admin_audit_log）を一体で行う。
--       どれかが失敗すれば全てロールバックされ、「状態だけ変わって履歴が無い」状態を作らない。
-- 方針:
--   * CAS: 呼び出し側が読み取った時点の updated_at と一致するときだけ適用（不一致は applied=false で何も変えない）。
--   * 行ロック(for update)で同一行の並行更新を直列化する。
--   * succeeded は終端状態。p_terminal_ok=false の結果では巻き戻さない。
--   * 更新できる列は許可リストのみ（p_patch の他のキーは無視）。履歴の post_log_id / question_id / platform は行から導出し、入力を信用しない。
--   * 権限: service_role のみ実行可。SECURITY INVOKER（呼び出し元の権限で動くので、仮に実行権限が漏れても表の権限が無ければ何もできない）。

create or replace function public.quiz_record_post_result(
  p_log_id              uuid,
  p_expected_updated_at timestamptz,
  p_patch               jsonb,
  p_attempt             jsonb,
  p_terminal_ok         boolean,
  p_audit               jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  cur public.quiz_post_log%rowtype;
  new_ts timestamptz;
  upd public.quiz_post_log%rowtype;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'quiz_record_post_result: p_patch must be a json object';
  end if;
  if p_attempt is null or jsonb_typeof(p_attempt) <> 'object' then
    raise exception 'quiz_record_post_result: p_attempt must be a json object';
  end if;

  select * into cur from public.quiz_post_log where id = p_log_id for update;
  if not found then
    raise exception 'quiz_record_post_result: post log not found';
  end if;

  -- 世代照合: 他の操作で既に状態が進んでいる → 何も変えない（安全な拒否）
  if cur.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('applied', false, 'reason', 'stale', 'log', to_jsonb(cur));
  end if;
  -- 終端状態の保護
  if cur.status = 'succeeded' and not coalesce(p_terminal_ok, false) then
    return jsonb_build_object('applied', false, 'reason', 'terminal', 'log', to_jsonb(cur));
  end if;

  -- 世代トークンは必ず前進させる（同一時刻でも古い読み取りが再適用できないように）
  new_ts := greatest(coalesce((p_patch ->> 'updated_at')::timestamptz, now()), cur.updated_at + interval '1 microsecond');

  update public.quiz_post_log set
    status        = case when p_patch ? 'status'        then p_patch ->> 'status'                        else status end,
    attempts      = case when p_patch ? 'attempts'      then (p_patch ->> 'attempts')::int               else attempts end,
    external_id   = case when p_patch ? 'external_id'   then p_patch ->> 'external_id'                   else external_id end,
    external_url  = case when p_patch ? 'external_url'  then p_patch ->> 'external_url'                  else external_url end,
    last_error    = case when p_patch ? 'last_error'    then p_patch ->> 'last_error'                    else last_error end,
    lease_until   = case when p_patch ? 'lease_until'   then (p_patch ->> 'lease_until')::timestamptz    else lease_until end,
    posted_at     = case when p_patch ? 'posted_at'     then (p_patch ->> 'posted_at')::timestamptz      else posted_at end,
    next_retry_at = case when p_patch ? 'next_retry_at' then (p_patch ->> 'next_retry_at')::timestamptz  else next_retry_at end,
    updated_at    = new_ts
  where id = p_log_id
  returning * into upd;

  insert into public.quiz_post_attempts (id, post_log_id, question_id, platform, attempt_no, outcome, error, at)
  values (
    coalesce((p_attempt ->> 'id')::uuid, gen_random_uuid()),
    upd.id, upd.question_id, upd.platform,
    (p_attempt ->> 'attempt_no')::int,
    p_attempt ->> 'outcome',
    p_attempt ->> 'error',
    coalesce((p_attempt ->> 'at')::timestamptz, now())
  );

  if p_audit is not null then
    insert into public.admin_audit_log (id, actor_id, actor_kind, actor_email, action, entity, entity_id, detail, created_at)
    values (
      coalesce((p_audit ->> 'id')::uuid, gen_random_uuid()),
      p_audit ->> 'actor_id',
      p_audit ->> 'actor_kind',
      p_audit ->> 'actor_email',
      p_audit ->> 'action',
      coalesce(p_audit ->> 'entity', 'quiz_question'),
      coalesce(p_audit ->> 'entity_id', upd.question_id),
      coalesce(p_audit -> 'detail', '{}'::jsonb),
      coalesce((p_audit ->> 'created_at')::timestamptz, now())
    );
  end if;

  return jsonb_build_object('applied', true, 'log', to_jsonb(upd));
end $$;

-- 実行権限: service_role のみ（PUBLIC / anon / authenticated は不可）
revoke all on function public.quiz_record_post_result(uuid, timestamptz, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.quiz_record_post_result(uuid, timestamptz, jsonb, jsonb, boolean, jsonb) to service_role;
