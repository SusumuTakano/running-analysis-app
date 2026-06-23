-- 008_fix_role_check_add_athlete.sql
-- 回帰修正：007 で張り替えた profiles_role_check に 'athlete' が抜けており、
-- 登録フォームの「選手」登録（profiles.role='athlete'）が失敗する問題を修正する。
-- Supabase SQL Editor で実行してください。べき等。

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'super_admin', 'group_admin', 'admin',
    'coach', 'instructor', 'student', 'guest',
    'athlete'
  ));

-- admin_set_user_role の許可ロールにも 'athlete' を追加（管理画面からの付与用）
create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if new_role not in ('super_admin', 'group_admin', 'coach', 'athlete', 'instructor', 'student', 'guest') then
    raise exception 'invalid role: %', new_role;
  end if;

  if public.is_super_admin() then
    null; -- 何でも可
  elsif public.is_registrant_admin() then
    if new_role in ('super_admin', 'group_admin') then
      raise exception 'group admin cannot grant admin roles';
    end if;
  else
    raise exception 'not authorized';
  end if;

  insert into public.profiles (id, role, updated_at)
  values (target_user_id, new_role, now())
  on conflict (id) do update
    set role = excluded.role, updated_at = now();
end;
$$;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
