-- 004 の取り消し: RPC を削除するだけ（データは変更しない）。アプリを 004 前の版（recordResult が直接更新する版）に戻す場合に使う。
-- 注意: 004 前のアプリ版は状態更新と履歴挿入が別リクエスト（非アトミック）に戻る。
drop function if exists public.quiz_record_post_result(uuid, timestamptz, jsonb, jsonb, boolean, jsonb);
