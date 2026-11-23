-- Project Ref must be checked in the connection or dashboard: jjefffbmwkgylbdpipsj.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

WITH target_tables(name) AS (
  VALUES ('quiz_questions'), ('quiz_post_log'), ('quiz_post_attempts'),
         ('quiz_reviews'), ('admin_audit_log')
), relation_names(name) AS (
  SELECT name FROM target_tables
  UNION ALL VALUES
    ('quiz_post_attempts_q'), ('quiz_reviews_q'), ('admin_audit_log_at'),
    ('quiz_questions_pkey'), ('quiz_questions_slug_key'),
    ('quiz_post_log_pkey'), ('quiz_post_log_unique'),
    ('quiz_post_attempts_pkey'), ('quiz_reviews_pkey'), ('admin_audit_log_pkey')
), target_relations AS (
  SELECT c.oid, c.relname
  FROM pg_catalog.pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN (SELECT name FROM target_tables)
)
SELECT 'relation' AS kind, c.relname::text AS object_name,
       c.relkind::text AS detail
FROM pg_catalog.pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (SELECT name FROM relation_names)
UNION ALL
SELECT 'routine', p.proname::text, pg_catalog.pg_get_function_identity_arguments(p.oid)
FROM pg_catalog.pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('admin_audit_log_immutable', 'quiz_invalidate_on_content_change',
                    'admin_audit_log_no_truncate', 'quiz_record_post_result')
UNION ALL
SELECT 'trigger', t.tgname::text, r.relname::text
FROM pg_catalog.pg_trigger t JOIN target_relations r ON r.oid = t.tgrelid
UNION ALL
SELECT 'policy', p.polname::text, r.relname::text
FROM pg_catalog.pg_policy p JOIN target_relations r ON r.oid = p.polrelid
UNION ALL
SELECT 'constraint', c.conname::text, r.relname::text
FROM pg_catalog.pg_constraint c JOIN target_relations r ON r.oid = c.conrelid
ORDER BY 1, 2, 3;

-- Run against the explicitly verified project. Check migration hashes outside SQL.
DO $precheck$
DECLARE
  role_name text;
  table_name text;
  table_oid oid;
  expected record;
  table_count integer := 0;
  row_count bigint;
  migration_uuid oid := pg_catalog.to_regprocedure('gen_random_uuid()');
  rpc_uuid oid;
  jwt oid := pg_catalog.to_regprocedure('auth.jwt()');
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF pg_catalog.to_regrole(role_name) IS NULL THEN
      RAISE EXCEPTION 'STOP: missing role %', role_name;
    END IF;
  END LOOP;
  IF jwt IS NULL OR NOT pg_catalog.has_schema_privilege('authenticated', 'auth', 'USAGE')
     OR NOT pg_catalog.has_function_privilege('authenticated', jwt, 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: auth.jwt() unavailable to authenticated';
  END IF;

  -- 004 uses public, pg_temp with implicit pg_catalog first. Temp routines
  -- are excluded from function lookup. An extensions-only function is insufficient.
  PERFORM pg_catalog.set_config('search_path', 'public, pg_temp', true);
  rpc_uuid := pg_catalog.to_regprocedure('gen_random_uuid()');
  IF migration_uuid IS NULL OR NOT pg_catalog.has_function_privilege(migration_uuid, 'EXECUTE')
     OR rpc_uuid IS NULL OR NOT pg_catalog.has_function_privilege('service_role', rpc_uuid, 'EXECUTE')
     OR NOT EXISTS (
       SELECT FROM pg_catalog.pg_proc p WHERE p.oid = rpc_uuid
         AND p.prokind = 'f' AND p.prorettype = 'uuid'::pg_catalog.regtype
         AND pg_catalog.has_schema_privilege('service_role', p.pronamespace, 'USAGE')
     ) THEN
    RAISE EXCEPTION 'STOP: gen_random_uuid() unavailable to migration session or 004 RPC';
  END IF;

  IF EXISTS (
    SELECT FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace
      AND relname IN ('quiz_reviews', 'admin_audit_log', 'quiz_reviews_q',
                      'admin_audit_log_at', 'quiz_reviews_pkey', 'admin_audit_log_pkey')
  ) OR EXISTS (
    SELECT FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('quiz_record_post_result', 'admin_audit_log_immutable',
                      'quiz_invalidate_on_content_change', 'admin_audit_log_no_truncate')
  ) THEN
    RAISE EXCEPTION 'STOP: 002–004 objects already exist';
  END IF;

  FOR expected IN SELECT * FROM (VALUES
    ('quiz_questions', 'id slug category question choices correct_answer explanation difficulty status scheduled_at published_at reviewed_by approved_by approved_at created_at updated_at', ARRAY['quiz_questions_pkey','quiz_questions_slug_key','quiz_publish_requires_approval','quiz_published_requires_schedule'], ARRAY['quiz_public_read','quiz_admin_read']),
    ('quiz_post_log', 'id question_id platform status attempts external_id external_url last_error lease_until posted_at next_retry_at created_at updated_at', ARRAY['quiz_post_log_pkey','quiz_post_log_unique','quiz_post_log_question_id_fkey'], ARRAY['quiz_log_admin_read']),
    ('quiz_post_attempts', 'id post_log_id question_id platform attempt_no outcome error at', ARRAY['quiz_post_attempts_pkey','quiz_post_attempts_post_log_id_fkey'], ARRAY['quiz_attempts_admin_read'])
  ) AS shape(name, columns, constraints, policies) LOOP
    table_name := expected.name;
    table_oid := pg_catalog.to_regclass(pg_catalog.format('public.%I', table_name));
    IF table_oid IS NULL THEN CONTINUE; END IF;
    table_count := table_count + 1;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_class WHERE oid = table_oid AND relkind = 'r' AND relrowsecurity)
       OR (SELECT pg_catalog.string_agg(attname::text, ' ' ORDER BY attnum)
           FROM pg_catalog.pg_attribute WHERE attrelid = table_oid AND attnum > 0 AND NOT attisdropped)
          IS DISTINCT FROM expected.columns
       OR (SELECT pg_catalog.string_agg(pg_catalog.format_type(atttypid, atttypmod), '|' ORDER BY attnum)
           FROM pg_catalog.pg_attribute WHERE attrelid = table_oid AND attnum > 0 AND NOT attisdropped)
          IS DISTINCT FROM (CASE table_name
            WHEN 'quiz_questions' THEN 'text|text|text|text|jsonb|text|text|text|text|timestamp with time zone|timestamp with time zone|text|text|timestamp with time zone|timestamp with time zone|timestamp with time zone'
            WHEN 'quiz_post_log' THEN 'uuid|text|text|text|integer|text|text|text|timestamp with time zone|timestamp with time zone|timestamp with time zone|timestamp with time zone|timestamp with time zone'
            ELSE 'uuid|uuid|text|text|integer|text|text|timestamp with time zone'
          END)
       OR NOT expected.constraints <@ ARRAY(SELECT conname::text FROM pg_catalog.pg_constraint WHERE conrelid = table_oid)
       OR (SELECT pg_catalog.array_agg(polname::text ORDER BY polname)
           FROM pg_catalog.pg_policy WHERE polrelid = table_oid)
          IS DISTINCT FROM ARRAY(SELECT p FROM pg_catalog.unnest(expected.policies) p ORDER BY p)
       OR EXISTS (SELECT FROM pg_catalog.pg_trigger WHERE tgrelid = table_oid AND NOT tgisinternal)
       OR NOT pg_catalog.has_table_privilege(table_oid, 'SELECT')
       OR pg_catalog.row_security_active(table_oid) THEN
      RAISE EXCEPTION 'STOP: unexpected table or incomplete visibility for %', table_name;
    END IF;
    EXECUTE pg_catalog.format('SELECT count(*) FROM public.%I', table_name) INTO row_count;
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'STOP: public.% contains % rows', table_name, row_count;
    END IF;
  END LOOP;
  IF table_count NOT IN (0, 3) THEN
    RAISE EXCEPTION 'STOP: incomplete 001 installation';
  END IF;
  IF table_count = 0 AND EXISTS (
    SELECT FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace
      AND relname IN ('quiz_post_attempts_q', 'quiz_questions_pkey', 'quiz_questions_slug_key',
                      'quiz_post_log_pkey', 'quiz_post_log_unique', 'quiz_post_attempts_pkey')
  ) THEN
    RAISE EXCEPTION 'STOP: 001 object name collision';
  END IF;
  IF table_count = 3 THEN
    IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_index i
      WHERE i.indexrelid = pg_catalog.to_regclass('public.quiz_post_attempts_q')
        AND i.indrelid = 'public.quiz_post_attempts'::regclass
        AND i.indisvalid AND i.indisready
        AND pg_catalog.pg_get_indexdef(i.indexrelid, 1, true) = 'question_id'
        AND pg_catalog.pg_get_indexdef(i.indexrelid, 2, true) = 'at'
        AND (i.indoption[1] & 1) = 1
        AND i.indnatts = 2 AND i.indpred IS NULL
    ) THEN
      RAISE EXCEPTION 'STOP: unexpected 001 quiz_post_attempts_q index';
    END IF;
    RAISE NOTICE 'REVIEW_AFTER_001: compare listed objects and table definitions to audited 001; skip 001';
  ELSE
    RAISE NOTICE 'REVIEW_FRESH: no target objects found; verify project and migration hashes';
  END IF;
END
$precheck$;

ROLLBACK;
