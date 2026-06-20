// src/pages/admin/AdminGroupsPage.tsx
// 管理グループの作成・編集・削除と、グループへの管理者割当（super_admin 限定）
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type Group = {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
};

type Member = {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
  joined_at: string;
};

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

const AdminGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);

  // 新規グループ
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // 編集中グループ
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // メンバー表示中グループ
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const loadGroups = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_groups");
    if (error) {
      setErrorMsg(`グループ取得に失敗しました: ${error.message}`);
      setGroups([]);
    } else {
      setGroups((data ?? []) as Group[]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate("/admin/login", { replace: true });
        return;
      }
      const { data: tier } = await supabase.rpc("get_my_admin_tier");
      if (tier !== "super_admin") {
        // スーパー管理者以外は管理トップへ
        navigate("/admin", { replace: true });
        return;
      }
      setAuthorized(true);
      await loadGroups();
      const { data: users } = await supabase.rpc("admin_list_users");
      setAllUsers((users ?? []) as UserRow[]);
      setLoading(false);
    };
    init();
  }, [navigate, loadGroups]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.rpc("admin_create_group", {
        p_name: newName.trim(),
        p_description: newDesc.trim() || null,
      });
      if (error) {
        alert(`作成に失敗しました: ${error.message}`);
        return;
      }
      setNewName("");
      setNewDesc("");
      await loadGroups();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (g: Group) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditDesc(g.description ?? "");
  };

  const handleSaveEdit = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_update_group", {
        p_group_id: id,
        p_name: editName.trim(),
        p_description: editDesc.trim() || null,
      });
      if (error) {
        alert(`更新に失敗しました: ${error.message}`);
        return;
      }
      setEditingId(null);
      await loadGroups();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGroup = async (g: Group) => {
    if (
      !window.confirm(
        `グループ「${g.name}」を削除します。\nメンバーの割当も解除されます（ユーザー自体は削除されません）。\nよろしいですか？`
      )
    )
      return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_delete_group", { p_group_id: g.id });
      if (error) {
        alert(`削除に失敗しました: ${error.message}`);
        return;
      }
      if (openGroupId === g.id) setOpenGroupId(null);
      await loadGroups();
    } finally {
      setBusy(false);
    }
  };

  const loadMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    const { data, error } = await supabase.rpc("admin_list_group_members", {
      p_group_id: groupId,
    });
    if (error) {
      alert(`メンバー取得に失敗しました: ${error.message}`);
      setMembers([]);
    } else {
      setMembers((data ?? []) as Member[]);
    }
    setMembersLoading(false);
  }, []);

  const toggleMembers = async (groupId: string) => {
    if (openGroupId === groupId) {
      setOpenGroupId(null);
      return;
    }
    setOpenGroupId(groupId);
    setAddUserId("");
    await loadMembers(groupId);
  };

  const handleAddMember = async () => {
    if (!openGroupId || !addUserId) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_add_group_member", {
        p_group_id: openGroupId,
        p_user_id: addUserId,
      });
      if (error) {
        alert(`追加に失敗しました: ${error.message}`);
        return;
      }
      setAddUserId("");
      await loadMembers(openGroupId);
      await loadGroups();
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!openGroupId) return;
    if (!window.confirm("このメンバーをグループから外しますか？")) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_remove_group_member", {
        p_group_id: openGroupId,
        p_user_id: userId,
      });
      if (error) {
        alert(`削除に失敗しました: ${error.message}`);
        return;
      }
      await loadMembers(openGroupId);
      await loadGroups();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>読み込み中…</div>
    );
  }
  if (!authorized) return null;

  // 追加候補（すでにメンバーの人は除外）
  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
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
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>管理グループ</h1>
            <p style={{ fontSize: 13, opacity: 0.85 }}>
              管理者をグループ単位でまとめます。グループに追加された人はグループ管理者になります。
            </p>
          </div>
          <Link to="/admin" style={backLinkStyle}>
            ← 管理トップへ戻る
          </Link>
        </header>

        {errorMsg && (
          <div style={errorBox}>{errorMsg}</div>
        )}

        {/* 新規グループ作成 */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>新規グループ作成</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <label style={{ flex: "1 1 200px" }}>
              <div style={labelText}>グループ名 *</div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="例：関東地域スタッフ"
                style={inputStyle}
              />
            </label>
            <label style={{ flex: "2 1 280px" }}>
              <div style={labelText}>説明（任意）</div>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={inputStyle}
              />
            </label>
            <button type="submit" disabled={creating} style={primaryBtn(creating)}>
              {creating ? "作成中…" : "＋ 作成"}
            </button>
          </form>
        </section>

        {/* グループ一覧 */}
        {groups.length === 0 ? (
          <div style={emptyBox}>まだグループがありません。上のフォームから作成してください。</div>
        ) : (
          groups.map((g) => {
            const isEditing = editingId === g.id;
            const isOpen = openGroupId === g.id;
            return (
              <section key={g.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  {isEditing ? (
                    <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="説明" style={inputStyle} />
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ fontSize: 17, marginBottom: 4 }}>{g.name}</h3>
                      <p style={{ fontSize: 12, opacity: 0.8 }}>
                        {g.description || "（説明なし）"} ・ メンバー {g.member_count} 人
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(g.id)} disabled={busy} style={actionBtn("#2563eb")}>保存</button>
                        <button onClick={() => setEditingId(null)} disabled={busy} style={actionBtn("#64748b")}>キャンセル</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => toggleMembers(g.id)} style={actionBtn("#0ea5e9")}>
                          {isOpen ? "メンバーを閉じる" : "メンバー管理"}
                        </button>
                        <button onClick={() => startEdit(g)} style={actionBtn("#6366f1")}>編集</button>
                        <button onClick={() => handleDeleteGroup(g)} disabled={busy} style={actionBtn("#dc2626")}>削除</button>
                      </>
                    )}
                  </div>
                </div>

                {/* メンバー管理 */}
                {isOpen && (
                  <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                      <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} style={{ ...inputStyle, minWidth: 260, flex: "1 1 260px" }}>
                        <option value="">＋ メンバーを追加（ユーザーを選択）</option>
                        {candidates.map((u) => (
                          <option key={u.id} value={u.id}>
                            {(u.name ? u.name + " / " : "") + (u.email ?? u.id)}（{u.role}）
                          </option>
                        ))}
                      </select>
                      <button onClick={handleAddMember} disabled={busy || !addUserId} style={primaryBtn(busy || !addUserId)}>
                        追加
                      </button>
                    </div>

                    {membersLoading ? (
                      <p style={{ fontSize: 13, opacity: 0.8 }}>メンバー読み込み中…</p>
                    ) : members.length === 0 ? (
                      <p style={{ fontSize: 13, opacity: 0.7 }}>まだメンバーがいません。</p>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                            <th style={th}>メール</th>
                            <th style={th}>表示名</th>
                            <th style={th}>権限</th>
                            <th style={th}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((m) => (
                            <tr key={m.user_id}>
                              <td style={td}>{m.email ?? "-"}</td>
                              <td style={td}>{m.name ?? "-"}</td>
                              <td style={td}>{m.role}</td>
                              <td style={td}>
                                <button onClick={() => handleRemoveMember(m.user_id)} disabled={busy} style={actionBtn("#dc2626")}>
                                  外す
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#fff",
  background: "linear-gradient(135deg, #0b1220 0%, #0f172a 40%, #1e3a8a 100%)",
};
const cardStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 16,
  borderRadius: 12,
  background: "rgba(15,23,42,0.7)",
  border: "1px solid rgba(255,255,255,0.2)",
};
const backLinkStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.6)",
  fontSize: 12,
  color: "#fff",
  textDecoration: "none",
};
const labelText: React.CSSProperties = { fontSize: 12, marginBottom: 4, opacity: 0.85 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(0,0,0,0.3)",
  color: "#fff",
  fontSize: 13,
};
const errorBox: React.CSSProperties = {
  marginBottom: 12,
  padding: 10,
  background: "#7f1d1d",
  color: "#fecaca",
  borderRadius: 8,
  fontSize: 12,
};
const emptyBox: React.CSSProperties = {
  padding: 24,
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.5)",
  fontSize: 13,
};
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 18px",
  borderRadius: 999,
  border: "none",
  background: disabled ? "#64748b" : "#2563eb",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
});
const actionBtn = (bg: string): React.CSSProperties => ({
  padding: "5px 12px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  background: bg,
  color: "#fff",
  border: "none",
  cursor: "pointer",
});
const th: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,0.25)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
};

export default AdminGroupsPage;
