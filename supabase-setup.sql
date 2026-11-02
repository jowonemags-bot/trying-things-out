-- Aidly: bracelet-code version. Run once in Supabase: SQL Editor > New query > paste > Run.
-- (If you ran the older accounts version first, uncomment the next two lines to remove it.)
-- drop function if exists public.get_profile(text);
-- drop table if exists public.profiles;

create extension if not exists pgcrypto with schema extensions;

-- One row per bracelet. The edit code is stored only as a hash, never in plain text.
create table public.bracelets (
  id           text primary key,                      -- public ID that goes in the bracelet link
  code_hash    text not null,
  data         jsonb check (data is null or octet_length(data::text) < 20000),  -- null = not set up yet
  fails        int  not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- Row Level Security ON with NO policies: the public cannot read or write the table directly.
alter table public.bracelets enable row level security;

-- random text helper (used when generating IDs and codes)
create or replace function public.rand_str(len int, chars text)
returns text language plpgsql set search_path = public, extensions as $$
declare b bytea := gen_random_bytes(len); s text := ''; i int;
begin
  for i in 1..len loop
    s := s || substr(chars, (get_byte(b, i - 1) % length(chars)) + 1, 1);
  end loop;
  return s;
end $$;

-- Checks a code. After 5 wrong tries the bracelet locks for 15 minutes.
create or replace function public.check_code(p_id text, p_code text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare r public.bracelets;
begin
  select * into r from public.bracelets where id = p_id for update;
  if not found then return 'missing'; end if;
  if r.locked_until is not null and r.locked_until > now() then return 'locked'; end if;
  if r.code_hash = crypt(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), r.code_hash) then
    update public.bracelets set fails = 0, locked_until = null where id = p_id;
    return 'ok';
  end if;
  update public.bracelets
     set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
         locked_until = case when fails + 1 >= 5 then now() + interval '15 minutes' else locked_until end
   where id = p_id;
  return 'bad';
end $$;

-- PUBLIC: anyone with the link can read ONE profile (cannot list or search).
create or replace function public.get_profile(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select data from public.bracelets where id = p_id;
$$;

-- Owner: unlock with the code and load the profile for editing.
create or replace function public.unlock_bracelet(p_id text, p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s text; d jsonb;
begin
  s := public.check_code(p_id, p_code);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'reason', s); end if;
  select data into d from public.bracelets where id = p_id;
  return jsonb_build_object('ok', true, 'data', d);
end $$;

-- Owner: save changes (the code is checked again on every save).
create or replace function public.save_bracelet(p_id text, p_code text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := public.check_code(p_id, p_code);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'reason', s); end if;
  if jsonb_typeof(p_data) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad_data'); end if;
  update public.bracelets set data = p_data, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- TEAM ONLY (run from the SQL Editor): make N bracelets. Shows each ID and its code ONCE.
-- Usage:  select * from public.admin_create_bracelets(10);
create or replace function public.admin_create_bracelets(n int)
returns table(bracelet_id text, edit_code text) language plpgsql security definer set search_path = public, extensions as $$
declare i int; v_id text; v_code text;
begin
  if n < 1 or n > 500 then raise exception 'n must be between 1 and 500'; end if;
  for i in 1..n loop
    v_id   := public.rand_str(12, 'abcdefghjkmnpqrstuvwxyz23456789');
    v_code := public.rand_str(12, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    insert into public.bracelets(id, code_hash) values (v_id, crypt(v_code, gen_salt('bf')));
    bracelet_id := v_id;
    edit_code   := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4);
    return next;
  end loop;
end $$;

-- TEAM ONLY: new code for a lost one.  Usage:  select * from public.admin_reset_code('the-bracelet-id');
create or replace function public.admin_reset_code(p_id text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  v_code := public.rand_str(12, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
  update public.bracelets set code_hash = crypt(v_code, gen_salt('bf')), fails = 0, locked_until = null where id = p_id;
  if not found then raise exception 'no bracelet with that id'; end if;
  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4);
end $$;

-- Permissions: team-only functions are not callable from the website; the three public ones are.
revoke all on function public.rand_str(int, text), public.check_code(text, text),
  public.admin_create_bracelets(int), public.admin_reset_code(text) from public, anon, authenticated;
revoke all on function public.get_profile(text), public.unlock_bracelet(text, text),
  public.save_bracelet(text, text, jsonb) from public;
grant execute on function public.get_profile(text), public.unlock_bracelet(text, text),
  public.save_bracelet(text, text, jsonb) to anon, authenticated;
