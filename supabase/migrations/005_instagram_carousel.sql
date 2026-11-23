create table if not exists public.instagram_carousels (
  id uuid primary key default gen_random_uuid(),
  snapshot jsonb not null,
  hash text not null unique,
  scheduled_at timestamptz not null,
  state text not null default 'draft' check (state in ('draft','approved','sending','accepted','published','unknown','failed')),
  approved_by text,
  approved_at timestamptz,
  sending_at timestamptz,
  buffer_post_id text unique,
  permalink text,
  created_at timestamptz not null default now()
);
create index if not exists instagram_carousels_due on public.instagram_carousels (state, scheduled_at);
alter table public.instagram_carousels enable row level security;
revoke all on public.instagram_carousels from public, anon, authenticated, service_role;
grant select, insert, update on public.instagram_carousels to service_role;

-- This bucket stays private. The app addresses approved bytes by SHA-256.
insert into storage.buckets (id, name, public)
values ('instagram-carousels', 'instagram-carousels', false)
on conflict (id) do nothing;

create or replace function public.instagram_transition(
  p_id uuid, p_hash text, p_from text, p_to text,
  p_actor text, p_email text default null, p_buffer_id text default null,
  p_permalink text default null
) returns boolean language plpgsql security invoker
set search_path = public, pg_temp as $$
declare
  current_time_utc timestamptz := clock_timestamp();
begin
  if not (
    (p_from = 'draft' and p_to = 'approved' and p_email is not null) or
    (p_from = 'approved' and p_to = 'draft' and p_email is not null) or
    (p_from = 'approved' and p_to = 'sending' and p_email is null) or
    (p_from = 'sending' and p_to = 'accepted' and p_buffer_id is not null and p_email is null) or
    (p_from = 'sending' and p_to = 'unknown' and p_email is null) or
    (p_from = 'accepted' and p_to in ('published','failed') and p_email is null)
  ) then
    return false;
  end if;
  update public.instagram_carousels set
    state = p_to,
    approved_by = case p_to when 'approved' then p_actor when 'draft' then null else approved_by end,
    approved_at = case p_to when 'approved' then current_time_utc when 'draft' then null else approved_at end,
    sending_at = case when p_to = 'sending' then current_time_utc else sending_at end,
    buffer_post_id = coalesce(p_buffer_id, buffer_post_id),
    permalink = coalesce(p_permalink, permalink)
  where id = p_id and hash = p_hash and state = p_from
    and (p_to <> 'sending' or (approved_by is not null and approved_at is not null and scheduled_at <= current_time_utc));
  if not found then return false; end if;

  insert into public.admin_audit_log (actor_id, actor_kind, actor_email, action, entity, entity_id, detail)
  values (p_actor, case when p_email is null then 'system' else 'human' end, p_email,
    'instagram_' || p_to, 'instagram_carousel', p_id::text,
    jsonb_build_object('hash', p_hash, 'previous_state', p_from, 'buffer_post_id', p_buffer_id));
  return true;
end $$;
revoke all on function public.instagram_transition(uuid,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.instagram_transition(uuid,text,text,text,text,text,text,text) to service_role;

-- Saving a replacement and clearing the previous approval are atomic.
create or replace function public.instagram_replace(
  p_id uuid, p_previous_hash text, p_snapshot jsonb, p_hash text,
  p_scheduled_at timestamptz, p_actor text, p_email text
) returns boolean language plpgsql security invoker
set search_path = public, pg_temp as $$
begin
  update public.instagram_carousels
    set snapshot = p_snapshot, hash = p_hash, scheduled_at = p_scheduled_at,
        state = 'draft', approved_by = null, approved_at = null
    where id = p_id and hash = p_previous_hash and state in ('draft','approved');
  if not found then return false; end if;
  insert into public.admin_audit_log (actor_id, actor_kind, actor_email, action, entity, entity_id, detail)
  values (p_actor, 'human', p_email, 'instagram_replace', 'instagram_carousel', p_id::text,
    jsonb_build_object('previous_hash', p_previous_hash, 'hash', p_hash));
  return true;
end $$;
revoke all on function public.instagram_replace(uuid,text,jsonb,text,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.instagram_replace(uuid,text,jsonb,text,timestamptz,text,text) to service_role;
