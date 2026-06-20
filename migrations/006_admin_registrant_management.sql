-- 006_admin_registrant_management.sql
-- 管理画面で「登録者情報（app_users）」をフル表示・管理できるようにする。
-- 将来のチーム/コーチ単位の課金を見据え、コーチごとの選手数（席数）も返す。
-- Supabase SQL Editor で実行してください。べき等（何度実行してもOK）。

-- =====================================================================
-- 1) 登録者一覧（admin だけ実行可能）
--    profiles + auth.users + app_users を結合し、登録者の全項目を返す。
--    コーチ判定用に owner_auth_user_id ベースの選手数 (athlete_count) も付与。
-- =====================================================================
drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  role text,
  name text,
  full_name text,
  full_name_kana text,
  birth_date date,
  postal_code text,
  prefecture text,
  occupation text,
  affiliation text,
  athlete_count bigint,
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
    coalesce(p.role, 'guest')::text                       as role,
    coalesce(p.name, au.full_name)                        as name,
    au.full_name,
    au.full_name_kana,
    au.birth_date,
    au.postal_code,
    au.prefecture,
    au.occupation,
    au.affiliation,
    coalesce(ac.cnt, 0)                                    as athlete_count,
    u.last_sign_in_at,
    u.created_at
  from auth.users u
  left join public.profiles  p  on p.id = u.id
  left join public.app_users au on au.auth_user_id = u.id
  left join (
    select owner_auth_user_id, count(*) as cnt
    from public.athletes
    where owner_auth_user_id is not null
    group by owner_auth_user_id
  ) ac on ac.owner_auth_user_id = u.id
  where exists (
    select 1 from public.profiles pa
    where pa.id = auth.uid() and pa.role = 'admin'
  )
  order by u.created_at desc;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- =====================================================================
-- 2) 不足RPCの補完（※存在しない場合のみ作成）
--    admin_update_user_name / admin_delete_user は AdminUsersPage から
--    呼ばれているが本マイグレーション群には未定義。
--    既に Supabase 上に手動作成済みで正しく動作している場合は、
--    その挙動（例: Auth 本体の削除）を弱めないため上書きしない。
--    下の DO ブロックは「無い場合だけ」作成する。
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'admin_update_user_name'
  ) then
    execute $fn$
      create function public.admin_update_user_name(target_user_id uuid, new_name text)
      returns void
      security definer
      set search_path = public
      language plpgsql
      as $body$
      begin
        if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
          raise exception 'not authorized';
        end if;
        update public.profiles  set name = new_name, updated_at = now() where id = target_user_id;
        update public.app_users set full_name = new_name where auth_user_id = target_user_id;
      end;
      $body$;
    $fn$;
    execute 'grant execute on function public.admin_update_user_name(uuid, text) to authenticated';
    raise notice 'created admin_update_user_name';
  else
    raise notice 'admin_update_user_name already exists - skipped';
  end if;

  if not exists (
    select 1 from pg_proc where proname = 'admin_delete_user'
  ) then
    execute $fn$
      create function public.admin_delete_user(target_user_id uuid)
      returns void
      security definer
      set search_path = public
      language plpgsql
      as $body$
      begin
        if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
          raise exception 'not authorized';
        end if;
        if target_user_id = auth.uid() then
          raise exception 'cannot delete yourself';
        end if;
        delete from public.app_users where auth_user_id = target_user_id;
        delete from public.profiles  where id = target_user_id;
        -- 注: auth.users 本体の削除は service_role 権限が必要。
        -- この関数では従属データのみ削除する。Auth 本体は Supabase ダッシュボード等で削除。
      end;
      $body$;
    $fn$;
    execute 'grant execute on function public.admin_delete_user(uuid) to authenticated';
    raise notice 'created admin_delete_user';
  else
    raise notice 'admin_delete_user already exists - skipped';
  end if;
end
$$;

-- =====================================================================
-- 3) 登録者の詳細1件取得（将来の詳細モーダル用、admin だけ）
-- =====================================================================
create or replace function public.admin_get_user_detail(target_user_id uuid)
returns table (
  id uuid,
  email text,
  role text,
  full_name text,
  full_name_kana text,
  birth_date date,
  postal_code text,
  prefecture text,
  occupation text,
  affiliation text,
  athlete_count bigint,
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
    au.full_name,
    au.full_name_kana,
    au.birth_date,
    au.postal_code,
    au.prefecture,
    au.occupation,
    au.affiliation,
    (select count(*) from public.athletes a where a.owner_auth_user_id = u.id) as athlete_count,
    u.last_sign_in_at,
    u.created_at
  from auth.users u
  left join public.profiles  p  on p.id = u.id
  left join public.app_users au on au.auth_user_id = u.id
  where u.id = target_user_id
    and exists (
      select 1 from public.profiles pa
      where pa.id = auth.uid() and pa.role = 'admin'
    );
$$;

grant execute on function public.admin_get_user_detail(uuid) to authenticated;
