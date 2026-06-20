-- 管理画面から auth.users 全件の閲覧 / ロール変更を行うためのRPC
-- Supabase SQL Editor で実行してください。

-- 1) 全ユーザー一覧 (admin だけ実行可能)
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  role text,
  name text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
security definer
set search_path = public
language sql
as $$
  select
    u.id,
    u.email::text,
    coalesce(p.role, 'guest')::text as role,
    p.name,
    u.last_sign_in_at,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where exists (
    select 1 from public.profiles pa
    where pa.id = auth.uid() and pa.role = 'admin'
  )
  order by u.created_at desc;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- 2) ロール更新 (admin だけ実行可能)
create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  if new_role not in ('admin', 'coach', 'instructor', 'student', 'guest') then
    raise exception 'invalid role: %', new_role;
  end if;

  insert into public.profiles (id, role, updated_at)
  values (target_user_id, new_role, now())
  on conflict (id) do update
    set role = excluded.role,
        updated_at = now();
end;
$$;

grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- 3) プロファイル自動作成トリガー（新規ユーザー登録時に profiles を作る）
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, role, created_at, updated_at)
  values (new.id, 'guest', now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
