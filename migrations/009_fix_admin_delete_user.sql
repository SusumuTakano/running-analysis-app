-- 009_fix_admin_delete_user.sql
-- 修正：admin_delete_user が auth.users 本体を削除しておらず、
-- 一覧（auth.users ベース）からユーザーが消えなかった問題を修正。
-- SECURITY DEFINER（postgres 所有）なら auth.users も削除でき、関連は FK の CASCADE で消える。
-- super_admin のみ実行可。自分自身は削除不可。

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
  delete from auth.users       where id = target_user_id;  -- 認証本体も削除（関連は CASCADE）
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
