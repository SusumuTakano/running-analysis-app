-- 007_admin_groups_and_tiers.sql
-- 管理者権限を2段階（super_admin / group_admin）にし、管理グループ機能を追加する。
--   - super_admin : プラットフォーム統括。決済・グループ管理・管理者任命を含む全権限。
--   - group_admin : JRPO地域スタッフ。登録者管理が可能。複数グループ所属可。決済/グループ作成は不可。
-- 管理グループは「純粋な権限ラベル」（データ担当範囲は持たない）。group_admin は全登録者を管理できる。
-- Supabase SQL Editor で実行してください。べき等（再実行可）。

-- =====================================================================
-- 0) profiles.role の CHECK 制約を更新（新ロール super_admin / group_admin を許可）
--    既存の制約は旧ロールのみ許可しているため、先に張り替える。
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'group_admin', 'admin', 'coach', 'instructor', 'student', 'guest'));

-- 既存の admin を super_admin に移行
--   （現状 role='admin' のユーザー＝takano@jrpo.or.jp 等を super_admin へ）
update public.profiles set role = 'super_admin', updated_at = now()
where role = 'admin';

-- =====================================================================
-- 1) 管理グループ テーブル
-- =====================================================================
create table if not exists public.admin_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- グループ ⇔ ユーザー（多対多。1人が複数グループ所属可）
create table if not exists public.admin_group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.admin_groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists idx_agm_group on public.admin_group_members(group_id);
create index if not exists idx_agm_user  on public.admin_group_members(user_id);

-- RLS は有効化のみ（直接アクセスは拒否し、すべて SECURITY DEFINER の RPC 経由にする）
alter table public.admin_groups        enable row level security;
alter table public.admin_group_members enable row level security;

-- =====================================================================
-- 2) 権限ヘルパー関数
-- =====================================================================
-- super_admin か（旧 'admin' も後方互換で super とみなす）
create or replace function public.is_super_admin()
returns boolean
security definer set search_path = public
stable language sql
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin')
  );
$$;
grant execute on function public.is_super_admin() to authenticated;

-- 登録者管理ができる管理者か（super_admin または group_admin またはグループ所属者）
create or replace function public.is_registrant_admin()
returns boolean
security definer set search_path = public
stable language sql
as $$
  select
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'admin', 'group_admin')
    )
    or exists (
      select 1 from public.admin_group_members where user_id = auth.uid()
    );
$$;
grant execute on function public.is_registrant_admin() to authenticated;

-- フロント用：自分の管理ティアを返す（'super_admin' | 'group_admin' | null）
create or replace function public.get_my_admin_tier()
returns text
security definer set search_path = public
stable language sql
as $$
  select case
    when public.is_super_admin() then 'super_admin'
    when public.is_registrant_admin() then 'group_admin'
    else null
  end;
$$;
grant execute on function public.get_my_admin_tier() to authenticated;

-- =====================================================================
-- 3) 既存の登録者管理RPCのガードを更新（group_admin にも開放）
--    一覧・詳細・氏名編集は group_admin も可。役割変更・削除は段階制限。
-- =====================================================================

-- 3-1) 一覧（super_admin / group_admin）
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, role text, name text,
  full_name text, full_name_kana text, birth_date date,
  postal_code text, prefecture text, occupation text, affiliation text,
  athlete_count bigint, last_sign_in_at timestamptz, created_at timestamptz
)
security definer set search_path = public
language sql
as $$
  select
    u.id, u.email::text,
    coalesce(p.role, 'guest')::text as role,
    coalesce(p.name, au.full_name)  as name,
    au.full_name, au.full_name_kana, au.birth_date,
    au.postal_code, au.prefecture, au.occupation, au.affiliation,
    coalesce(ac.cnt, 0) as athlete_count,
    u.last_sign_in_at, u.created_at
  from auth.users u
  left join public.profiles  p  on p.id = u.id
  left join public.app_users au on au.auth_user_id = u.id
  left join (
    select owner_auth_user_id, count(*) as cnt
    from public.athletes
    where owner_auth_user_id is not null
    group by owner_auth_user_id
  ) ac on ac.owner_auth_user_id = u.id
  where public.is_registrant_admin()
  order by u.created_at desc;
$$;
grant execute on function public.admin_list_users() to authenticated;

-- 3-2) 詳細（super_admin / group_admin）
create or replace function public.admin_get_user_detail(target_user_id uuid)
returns table (
  id uuid, email text, role text,
  full_name text, full_name_kana text, birth_date date,
  postal_code text, prefecture text, occupation text, affiliation text,
  athlete_count bigint, last_sign_in_at timestamptz, created_at timestamptz
)
security definer set search_path = public
language sql
as $$
  select
    u.id, u.email::text, coalesce(p.role, 'guest')::text as role,
    au.full_name, au.full_name_kana, au.birth_date,
    au.postal_code, au.prefecture, au.occupation, au.affiliation,
    (select count(*) from public.athletes a where a.owner_auth_user_id = u.id) as athlete_count,
    u.last_sign_in_at, u.created_at
  from auth.users u
  left join public.profiles  p  on p.id = u.id
  left join public.app_users au on au.auth_user_id = u.id
  where u.id = target_user_id and public.is_registrant_admin();
$$;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;

-- 3-3) 氏名更新（super_admin / group_admin）
create or replace function public.admin_update_user_name(target_user_id uuid, new_name text)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if not public.is_registrant_admin() then
    raise exception 'not authorized';
  end if;
  update public.profiles  set name = new_name, updated_at = now() where id = target_user_id;
  update public.app_users set full_name = new_name where auth_user_id = target_user_id;
end;
$$;
grant execute on function public.admin_update_user_name(uuid, text) to authenticated;

-- 3-4) 役割変更（ティア制限つき）
--      super_admin: 任意の役割を設定可
--      group_admin: coach/instructor/student/guest のみ設定可（管理者への昇格は不可）
create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if new_role not in ('super_admin', 'group_admin', 'coach', 'instructor', 'student', 'guest') then
    raise exception 'invalid role: %', new_role;
  end if;

  if public.is_super_admin() then
    null; -- 何でも可
  elsif public.is_registrant_admin() then
    -- group_admin は管理者ロールを付与できない
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

-- 3-5) ユーザー削除（super_admin のみ。破壊的操作のため）
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'cannot delete yourself';
  end if;
  delete from public.app_users where auth_user_id = target_user_id;
  delete from public.profiles  where id = target_user_id;
  -- 注: auth.users 本体の削除は service_role 権限が必要。Supabase ダッシュボード等で削除。
end;
$$;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- =====================================================================
-- 4) 管理グループ CRUD（すべて super_admin 限定）
-- =====================================================================
create or replace function public.admin_list_groups()
returns table (
  id uuid, name text, description text,
  member_count bigint, created_at timestamptz
)
security definer set search_path = public
language sql
as $$
  -- super_admin は全グループ、group_admin は自分の所属グループのみ閲覧可
  select g.id, g.name, g.description,
         (select count(*) from public.admin_group_members m where m.group_id = g.id) as member_count,
         g.created_at
  from public.admin_groups g
  where public.is_super_admin()
     or exists (
       select 1 from public.admin_group_members m
       where m.group_id = g.id and m.user_id = auth.uid()
     )
  order by g.created_at desc;
$$;
grant execute on function public.admin_list_groups() to authenticated;

create or replace function public.admin_create_group(p_name text, p_description text)
returns uuid
security definer set search_path = public
language plpgsql
as $$
declare new_id uuid;
begin
  if not public.is_super_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;
  insert into public.admin_groups (name, description, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.admin_create_group(text, text) to authenticated;

create or replace function public.admin_update_group(p_group_id uuid, p_name text, p_description text)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if not public.is_super_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;
  update public.admin_groups
     set name = trim(p_name),
         description = nullif(trim(coalesce(p_description, '')), ''),
         updated_at = now()
   where id = p_group_id;
end;
$$;
grant execute on function public.admin_update_group(uuid, text, text) to authenticated;

create or replace function public.admin_delete_group(p_group_id uuid)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if not public.is_super_admin() then raise exception 'not authorized'; end if;
  delete from public.admin_groups where id = p_group_id; -- members は ON DELETE CASCADE
end;
$$;
grant execute on function public.admin_delete_group(uuid) to authenticated;

-- =====================================================================
-- 5) グループメンバー（割当）管理
-- =====================================================================
-- グループのメンバー一覧（super_admin、または自グループの group_admin）
create or replace function public.admin_list_group_members(p_group_id uuid)
returns table (
  user_id uuid, email text, name text, role text, joined_at timestamptz
)
security definer set search_path = public
language sql
as $$
  select m.user_id, u.email::text,
         coalesce(p.name, au.full_name) as name,
         coalesce(p.role, 'guest')::text as role,
         m.created_at as joined_at
  from public.admin_group_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles  p  on p.id = m.user_id
  left join public.app_users au on au.auth_user_id = m.user_id
  where m.group_id = p_group_id
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.admin_group_members mm
        where mm.group_id = p_group_id and mm.user_id = auth.uid()
      )
    )
  order by m.created_at;
$$;
grant execute on function public.admin_list_group_members(uuid) to authenticated;

-- メンバー追加（super_admin のみ）。追加された人を group_admin に昇格（既存の管理者ロールは保持）。
create or replace function public.admin_add_group_member(p_group_id uuid, p_user_id uuid)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if not public.is_super_admin() then raise exception 'not authorized'; end if;

  insert into public.admin_group_members (group_id, user_id)
  values (p_group_id, p_user_id)
  on conflict (group_id, user_id) do nothing;

  -- まだ管理者ロールでなければ group_admin に設定
  update public.profiles
     set role = 'group_admin', updated_at = now()
   where id = p_user_id
     and coalesce(role, 'guest') not in ('super_admin', 'admin', 'group_admin');
end;
$$;
grant execute on function public.admin_add_group_member(uuid, uuid) to authenticated;

-- メンバー削除（super_admin のみ）。どのグループにも属さなくなり、かつ super でなければ guest に降格。
create or replace function public.admin_remove_group_member(p_group_id uuid, p_user_id uuid)
returns void
security definer set search_path = public
language plpgsql
as $$
begin
  if not public.is_super_admin() then raise exception 'not authorized'; end if;

  delete from public.admin_group_members
   where group_id = p_group_id and user_id = p_user_id;

  -- 他グループにも属さず、super_admin でもない場合は guest に戻す
  if not exists (
       select 1 from public.admin_group_members where user_id = p_user_id
     )
     and not exists (
       select 1 from public.profiles where id = p_user_id and role in ('super_admin', 'admin')
     )
  then
    update public.profiles set role = 'guest', updated_at = now()
    where id = p_user_id and role = 'group_admin';
  end if;
end;
$$;
grant execute on function public.admin_remove_group_member(uuid, uuid) to authenticated;
