// src/pages/admin/AdminUsersPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

type AdminUserRow = {
  id: string;
  email: string | null;
  role: string;
  name: string | null;
  full_name: string | null;
  full_name_kana: string | null;
  birth_date: string | null;
  postal_code: string | null;
  prefecture: string | null;
  occupation: string | null;
  affiliation: string | null;
  athlete_count: number | null;
  last_sign_in_at: string | null;
  created_at: string;
};

const ROLE_OPTIONS = [
  "super_admin",
  "group_admin",
  "coach",
  "instructor",
  "student",
  "guest",
] as const;
type Role = (typeof ROLE_OPTIONS)[number];
// group_admin が付与できるのは管理者以外のロールのみ（super/group は super_admin 専用）
const NON_ADMIN_ROLES: Role[] = ["coach", "instructor", "student", "guest"];

const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // 検索・絞り込み・詳細表示
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 新規ユーザー作成フォーム
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<Role>("student");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      navigate("/admin/login", { replace: true });
      return;
    }

    const { data: tierData } = await supabase.rpc("get_my_admin_tier");
    setTier(typeof tierData === "string" ? tierData : null);

    const { data, error } = await supabase.rpc("admin_list_users");

    if (error) {
      setErrorMsg(
        `一覧取得に失敗しました: ${error.message} ` +
          "（Supabase で admin_list_users RPC が未作成の可能性があります。migrations/admin_user_management.sql を実行してください）"
      );
      setUsers([]);
    } else {
      setUsers((data ?? []) as AdminUserRow[]);
    }

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleChangeRole = async (userId: string, newRole: Role) => {
    if (!window.confirm(`このユーザーの権限を「${newRole}」に変更しますか？`)) return;
    try {
      setBusyId(userId);
      const { error } = await supabase.rpc("admin_set_user_role", {
        target_user_id: userId,
        new_role: newRole,
      });
      if (error) {
        alert(`変更に失敗しました: ${error.message}`);
        return;
      }
      await loadUsers();
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (user: AdminUserRow) => {
    setEditingId(user.id);
    setEditingName(user.name ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveName = async (userId: string) => {
    try {
      setBusyId(userId);
      const { error } = await supabase.rpc("admin_update_user_name", {
        target_user_id: userId,
        new_name: editingName.trim(),
      });
      if (error) {
        alert(`保存に失敗しました: ${error.message}`);
        return;
      }
      cancelEdit();
      await loadUsers();
    } finally {
      setBusyId(null);
    }
  };

  const handleSendPasswordReset = async (user: AdminUserRow) => {
    if (!user.email) {
      alert("メールアドレスが未設定のユーザーです。リセットメールを送信できません。");
      return;
    }
    if (
      !window.confirm(
        `${user.email} 宛にパスワードリセット用のメールを送信します。よろしいですか？`
      )
    ) {
      return;
    }
    try {
      setBusyId(user.id);
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        alert(`送信に失敗しました: ${error.message}`);
        return;
      }
      alert(`${user.email} にリセットメールを送信しました。`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteUser = async (user: AdminUserRow) => {
    const ok = window.confirm(
      `ユーザー「${user.email ?? user.id}」を完全に削除します。\n` +
        "この操作は取り消せません。Supabase Auth / メンバーデータ / プロフィールすべて削除されます。\n\n" +
        "本当に削除しますか？"
    );
    if (!ok) return;

    try {
      setBusyId(user.id);
      const { error } = await supabase.rpc("admin_delete_user", {
        target_user_id: user.id,
      });
      if (error) {
        alert(`削除に失敗しました: ${error.message}`);
        return;
      }
      await loadUsers();
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);

    if (!createEmail || !createPassword) {
      setCreateMsg("メールとパスワードは必須です。");
      return;
    }
    if (createPassword.length < 6) {
      setCreateMsg("パスワードは6文字以上で入力してください。");
      return;
    }

    setCreateBusy(true);
    try {
      // 管理者の現在セッションを壊さないため別クライアントで signUp
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { data, error } = await tempClient.auth.signUp({
        email: createEmail,
        password: createPassword,
      });

      if (error) {
        setCreateMsg(`登録に失敗しました: ${error.message}`);
        return;
      }

      const newUserId = data.user?.id;
      if (!newUserId) {
        setCreateMsg(
          "登録はされましたが、ユーザーIDを取得できませんでした。Supabase の メール確認設定をご確認ください。"
        );
        return;
      }

      // ロール / 名前を管理者権限でセット
      const { error: roleError } = await supabase.rpc("admin_set_user_role", {
        target_user_id: newUserId,
        new_role: createRole,
      });
      if (roleError) {
        setCreateMsg(`ロール設定に失敗しました: ${roleError.message}`);
        return;
      }

      if (createName.trim()) {
        await supabase
          .from("profiles")
          .update({ name: createName.trim(), updated_at: new Date().toISOString() })
          .eq("id", newUserId);
      }

      setCreateMsg(`登録しました: ${createEmail}`);
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      setCreateRole("student");
      await loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateMsg(`予期せぬエラー: ${msg}`);
    } finally {
      setCreateBusy(false);
    }
  };

  // 検索（氏名・かな・メール・所属）＋ロール絞り込み
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = [
        u.email,
        u.name,
        u.full_name,
        u.full_name_kana,
        u.affiliation,
        u.prefecture,
        u.occupation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, search, roleFilter]);

  // 付与できるロール（super_admin は全て、group_admin は管理者以外のみ）
  const assignableRoles: readonly Role[] =
    tier === "super_admin" ? ROLE_OPTIONS : NON_ADMIN_ROLES;
  const isAdminRole = (r: string) => r === "super_admin" || r === "group_admin";

  const handleExportCsv = () => {
    const headers = [
      "登録日時",
      "メール",
      "表示名",
      "氏名(かな)",
      "権限",
      "生年月日",
      "郵便番号",
      "所在地(県)",
      "職業",
      "所属",
      "選手数",
      "最終ログイン",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredUsers.map((u) =>
      [
        u.created_at ? new Date(u.created_at).toLocaleString("ja-JP") : "",
        u.email ?? "",
        u.name ?? "",
        u.full_name_kana ?? "",
        u.role,
        u.birth_date ?? "",
        u.postal_code ?? "",
        u.prefecture ?? "",
        u.occupation ?? "",
        u.affiliation ?? "",
        u.athlete_count ?? 0,
        u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("ja-JP") : "",
      ]
        .map(escape)
        .join(",")
    );
    // Excel での文字化け防止に BOM を付与
    const csv = "﻿" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrants_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", padding: 24, color: "#fff", background: "linear-gradient(135deg, #0b1220 0%, #0f172a 40%, #1e3a8a 100%)" }}>
        読み込み中…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24, color: "#fff", background: "linear-gradient(135deg, #0b1220 0%, #0f172a 40%, #1e3a8a 100%)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>ユーザー管理</h1>
            <p style={{ fontSize: 13, opacity: 0.85 }}>
              Supabase Auth に登録されている全ユーザーの一覧・権限変更・新規追加ができます。
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowCreate((v) => !v)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                background: showCreate ? "#64748b" : "#22c55e",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {showCreate ? "フォームを閉じる" : "＋ 新規ユーザー登録"}
            </button>
            <Link
              to="/admin"
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.6)",
                fontSize: 12,
                color: "#fff",
              }}
            >
              ← 管理トップへ戻る
            </Link>
          </div>
        </header>

        {showCreate && (
          <section
            style={{
              marginBottom: 24,
              padding: 16,
              borderRadius: 12,
              background: "rgba(15,23,42,0.7)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>新規ユーザー登録</h2>
            <form onSubmit={handleCreateUser}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={labelStyle}>
                  メール<span style={requiredMark}>*</span>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  パスワード<span style={requiredMark}>*</span>（6文字以上）
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    required
                    minLength={6}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  表示名（任意）
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  権限
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as Role)}
                    style={inputStyle}
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {createMsg && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 8,
                    background: "rgba(0,0,0,0.4)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  {createMsg}
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <button
                  type="submit"
                  disabled={createBusy}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 999,
                    border: "none",
                    background: createBusy ? "#64748b" : "#2563eb",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: createBusy ? "default" : "pointer",
                  }}
                >
                  {createBusy ? "登録中…" : "この内容で登録"}
                </button>
              </div>
              <p style={{ fontSize: 11, opacity: 0.75, marginTop: 8 }}>
                ※ Supabase のメール確認が有効な場合、新規ユーザーはメール確認後にログインできます。
              </p>
            </form>
          </section>
        )}

        {errorMsg && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              background: "#7f1d1d",
              color: "#fecaca",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {errorMsg}
          </div>
        )}

        {users.length > 0 && (
          <section
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="氏名・かな・メール・所属で検索"
              style={{
                flex: "1 1 240px",
                minWidth: 200,
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(0,0,0,0.3)",
                color: "#fff",
                fontSize: 13,
              }}
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "all" | Role)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(0,0,0,0.3)",
                color: "#fff",
                fontSize: 13,
              }}
            >
              <option value="all">すべての権限</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              {filteredUsers.length} / {users.length} 件
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredUsers.length === 0}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "none",
                background: "#0ea5e9",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              CSV出力
            </button>
          </section>
        )}

        {users.length === 0 ? (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              border: "1px dashed rgba(255,255,255,0.6)",
              background: "rgba(15,23,42,0.5)",
              fontSize: 13,
            }}
          >
            ユーザーが取得できませんでした。
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(15,23,42,0.55)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ background: "rgba(15,23,42,0.85)" }}>
                  <th style={thStyle}>登録日時</th>
                  <th style={thStyle}>メール</th>
                  <th style={thStyle}>表示名</th>
                  <th style={thStyle}>所属</th>
                  <th style={thStyle}>選手数</th>
                  <th style={thStyle}>権限</th>
                  <th style={thStyle}>最終ログイン</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isBusy = busyId === u.id;
                  const isAdmin = isAdminRole(u.role);
                  const isEditing = editingId === u.id;
                  const isExpanded = expandedId === u.id;
                  return (
                  <React.Fragment key={u.id}>
                    <tr>
                      <td style={tdStyle}>
                        {new Date(u.created_at).toLocaleString("ja-JP")}
                      </td>
                      <td style={tdStyle}>{u.email ?? "-"}</td>
                      <td style={tdStyle}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                            style={{
                              padding: "4px 6px",
                              borderRadius: 6,
                              fontSize: 12,
                              background: "#fff",
                              color: "#0f172a",
                              border: "1px solid rgba(255,255,255,0.3)",
                              minWidth: 140,
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : u.id)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "#fff",
                              cursor: "pointer",
                              fontSize: 12,
                              padding: 0,
                              textDecoration: "underline",
                            }}
                            title="クリックで詳細を表示"
                          >
                            {(u.name ?? u.full_name) ?? "-"} {isExpanded ? "▲" : "▼"}
                          </button>
                        )}
                      </td>
                      <td style={tdStyle}>{u.affiliation ?? "-"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {u.athlete_count ?? 0}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: isAdmin ? "#dc2626" : "rgba(255,255,255,0.15)",
                            color: "#fff",
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString("ja-JP")
                          : "-"}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <select
                            defaultValue={u.role}
                            disabled={
                              isBusy ||
                              isEditing ||
                              (tier !== "super_admin" && isAdminRole(u.role))
                            }
                            onChange={(e) =>
                              handleChangeRole(u.id, e.target.value as Role)
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              background: "rgba(0,0,0,0.4)",
                              color: "#fff",
                              border: "1px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            {(assignableRoles.includes(u.role as Role)
                              ? assignableRoles
                              : [u.role as Role, ...assignableRoles]
                            ).map((r) => (
                              <option key={r} value={r}>
                                {r === "super_admin"
                                  ? "super_admin (統括)"
                                  : r === "group_admin"
                                  ? "group_admin (グループ)"
                                  : r}
                              </option>
                            ))}
                          </select>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSaveName(u.id)}
                                style={actionButton("#2563eb")}
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={cancelEdit}
                                style={actionButton("#64748b")}
                              >
                                キャンセル
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => startEdit(u)}
                                style={actionButton("#0ea5e9")}
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSendPasswordReset(u)}
                                style={actionButton("#f59e0b")}
                              >
                                PWリセット
                              </button>
                              {tier === "super_admin" && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteUser(u)}
                                  style={actionButton("#dc2626")}
                                >
                                  削除
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ ...tdStyle, background: "rgba(0,0,0,0.25)" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(180px, 1fr))",
                              gap: 8,
                              padding: "4px 2px",
                            }}
                          >
                            <DetailItem label="氏名（かな）" value={u.full_name_kana} />
                            <DetailItem label="生年月日" value={u.birth_date} />
                            <DetailItem label="郵便番号" value={u.postal_code} />
                            <DetailItem label="所在地（県）" value={u.prefecture} />
                            <DetailItem label="職業" value={u.occupation} />
                            <DetailItem label="所属" value={u.affiliation} />
                            <DetailItem
                              label="登録選手数"
                              value={String(u.athlete_count ?? 0)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: string | null }> = ({
  label,
  value,
}) => (
  <div>
    <div style={{ fontSize: 10, opacity: 0.6 }}>{label}</div>
    <div style={{ fontSize: 12 }}>{value && value.trim() ? value : "-"}</div>
  </div>
);

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.3)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.15)",
  whiteSpace: "nowrap",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#e2e8f0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(0,0,0,0.3)",
  color: "#fff",
  fontSize: 13,
};

const requiredMark: React.CSSProperties = {
  color: "#fbbf24",
  marginLeft: 4,
};

const actionButton = (bg: string): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  background: bg,
  color: "#fff",
  border: "none",
  cursor: "pointer",
});

export default AdminUsersPage;
