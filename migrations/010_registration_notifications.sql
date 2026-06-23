-- 010_registration_notifications.sql
-- 新規登録（app_users への INSERT）時に、本人と管理者へ自動でメール通知する。
-- pg_net で Brevo の Transactional Email API を呼び出す。
-- ※ __BREVO_API_KEY__ は実際のキーに置換してから適用すること。

-- HTTP 送信用拡張
create extension if not exists pg_net;

create or replace function public.notify_new_registration()
returns trigger
security definer
set search_path = public, net, extensions
language plpgsql
as $$
declare
  api_key      text := '__BREVO_API_KEY__';
  sender_email text := 'takano@jrpo.or.jp';                  -- Brevoで承認済みの送信元
  sender_name  text := 'ランニング動作解析システム';
  admin_email  text := 'takano@jrpo.or.jp';                  -- 管理者の通知先
  display_name text := coalesce(nullif(trim(NEW.full_name), ''), 'ご利用者');
begin
  -- ① 本人へウェルカムメール
  if NEW.email is not null then
    perform net.http_post(
      url     := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object('api-key', api_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'sender', jsonb_build_object('email', sender_email, 'name', sender_name),
        'to',     jsonb_build_array(jsonb_build_object('email', NEW.email, 'name', display_name)),
        'subject','【ランニング動作解析システム】ご登録ありがとうございます',
        'htmlContent',
          '<div style="font-family:sans-serif;line-height:1.7;color:#0f172a">'
          || '<h2 style="color:#1e3a8a">ご登録ありがとうございます</h2>'
          || '<p>' || display_name || ' 様</p>'
          || '<p>ランニング動作解析システムへのご登録が完了しました。<br>'
          || '下記よりログインしてご利用いただけます。</p>'
          || '<p><a href="https://analyze.jrpo.jp/login" '
          || 'style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;'
          || 'border-radius:8px;text-decoration:none">ログインする</a></p>'
          || '<p style="font-size:12px;color:#64748b">'
          || 'このメールに心当たりがない場合は破棄してください。</p></div>'
      )
    );
  end if;

  -- ② 管理者へ新規登録の通知
  perform net.http_post(
    url     := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', api_key, 'Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'sender', jsonb_build_object('email', sender_email, 'name', sender_name),
      'to',     jsonb_build_array(jsonb_build_object('email', admin_email)),
      'subject','【新規登録】' || display_name || ' 様が登録しました',
      'htmlContent',
        '<div style="font-family:sans-serif;line-height:1.7;color:#0f172a">'
        || '<h3>新規ユーザー登録がありました</h3>'
        || '<table style="border-collapse:collapse;font-size:14px">'
        || '<tr><td style="padding:4px 12px;color:#64748b">氏名</td><td style="padding:4px 12px">'
        ||   coalesce(NEW.full_name,'-') || '（' || coalesce(NEW.full_name_kana,'-') || '）</td></tr>'
        || '<tr><td style="padding:4px 12px;color:#64748b">メール</td><td style="padding:4px 12px">'
        ||   coalesce(NEW.email,'-') || '</td></tr>'
        || '<tr><td style="padding:4px 12px;color:#64748b">所属</td><td style="padding:4px 12px">'
        ||   coalesce(NEW.affiliation,'-') || '</td></tr>'
        || '<tr><td style="padding:4px 12px;color:#64748b">所在地</td><td style="padding:4px 12px">'
        ||   coalesce(NEW.prefecture,'-') || '</td></tr>'
        || '</table>'
        || '<p style="font-size:12px;color:#64748b">'
        || '管理画面: <a href="https://analyze.jrpo.jp/admin/users">ユーザー管理</a></p></div>'
    )
  );

  return NEW;
exception when others then
  -- 通知失敗で登録自体を止めない（メール送信エラーは握りつぶす）
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_registration on public.app_users;
create trigger trg_notify_new_registration
  after insert on public.app_users
  for each row execute function public.notify_new_registration();
