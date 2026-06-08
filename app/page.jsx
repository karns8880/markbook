"use client";

import { useMemo, useRef, useState } from "react";

const KDF_ITERATIONS = 210000;
const emptyRecord = {
  id: "",
  title: "",
  tag: "",
  username: "",
  url: "",
  password: "",
  note: "",
};

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function LockMark() {
  return (
    <svg viewBox="0 0 48 48" role="img">
      <path d="M15 20v-4a9 9 0 0 1 18 0v4" />
      <rect x="10" y="20" width="28" height="20" rx="7" />
      <path d="M24 29v5" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M14 12h20a4 4 0 0 1 4 4v22l-14-6-14 6V16a4 4 0 0 1 4-4Z" />
      <path d="M18 20h12M18 26h8" />
    </svg>
  );
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function normalizeUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function maskPassword(password) {
  return "•".repeat(Math.min(Math.max(password.length, 8), 18));
}

function generatePassword(length = 18) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedTag, setSelectedTag] = useState("全部");
  const [query, setQuery] = useState("");
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [recordDraft, setRecordDraft] = useState(emptyRecord);
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [toast, setToast] = useState("");
  const vaultRef = useRef({ key: null, salt: null });
  const toastTimer = useRef(null);

  const tags = useMemo(() => {
    const unique = new Set(records.map((record) => record.tag || "未分类"));
    return ["全部", ...Array.from(unique).sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const tag = record.tag || "未分类";
      const matchesTag = selectedTag === "全部" || selectedTag === tag;
      const haystack = [record.title, record.username, record.url, record.tag, record.note]
        .join(" ")
        .toLowerCase();
      return matchesTag && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [query, records, selectedTag]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }

  async function encryptAndSave(nextRecords) {
    const { key, salt } = vaultRef.current;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(JSON.stringify(nextRecords));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);

    await api("/api/vault", {
      method: "PUT",
      body: JSON.stringify({
        vault: {
          version: 1,
          iterations: KDF_ITERATIONS,
          salt: bytesToBase64(salt),
          iv: bytesToBase64(iv),
          data: bytesToBase64(encrypted),
        },
      }),
    });
  }

  async function decryptRecords(masterPassword, vault) {
    if (!vault) return [];

    const salt = base64ToBytes(vault.salt);
    const iv = base64ToBytes(vault.iv);
    const key = await deriveKey(masterPassword, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(vault.data),
    );

    vaultRef.current = { key, salt };
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  async function createVault(masterPassword) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(masterPassword, salt);
    vaultRef.current = { key, salt };
    await encryptAndSave([]);
    return [];
  }

  async function persist(nextRecords) {
    const sorted = [...nextRecords].sort((a, b) => b.updatedAt - a.updatedAt);
    await encryptAndSave(sorted);
    setRecords(sorted);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthMessage("");

    try {
      if (password.length < 8) throw new Error("密码至少 8 位");

      if (authMode === "login") {
        await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const { vault } = await api("/api/vault");
        setRecords(vault ? await decryptRecords(password, vault) : await createVault(password));
      } else {
        if (password !== confirmPassword) throw new Error("两次输入不一致");
        await api("/api/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setRecords(await createVault(password));
      }

      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setIsUnlocked(true);
    } catch (error) {
      setAuthMessage(error.message.includes("decrypt") ? "登录成功，但保险库密码无法解密" : error.message);
    }
  }

  async function handleLogout() {
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
    } catch {
      // The local vault should still lock if the network request fails.
    }
    vaultRef.current = { key: null, salt: null };
    setRecords([]);
    setQuery("");
    setSelectedTag("全部");
    setIsUnlocked(false);
    setRevealedIds(new Set());
  }

  async function copyText(text) {
    if (!text) {
      showToast("没有可复制内容");
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    showToast("已复制");
  }

  function openRecordDialog(record = null) {
    setRecordDraft(record || emptyRecord);
    setIsRecordDialogOpen(true);
  }

  function closeRecordDialog() {
    setRecordDraft(emptyRecord);
    setIsRecordDialogOpen(false);
  }

  async function handleRecordSubmit(event) {
    event.preventDefault();
    const id = recordDraft.id || crypto.randomUUID();
    const nextRecord = {
      id,
      title: recordDraft.title.trim(),
      tag: recordDraft.tag.trim(),
      username: recordDraft.username.trim(),
      url: normalizeUrl(recordDraft.url.trim()),
      password: recordDraft.password,
      note: recordDraft.note.trim(),
      updatedAt: Date.now(),
    };

    const exists = records.some((record) => record.id === id);
    const nextRecords = exists
      ? records.map((record) => (record.id === id ? nextRecord : record))
      : [...records, nextRecord];

    await persist(nextRecords);
    closeRecordDialog();
    showToast("已保存");
  }

  async function deleteRecord() {
    if (!recordDraft.id) return;
    await persist(records.filter((record) => record.id !== recordDraft.id));
    closeRecordDialog();
    showToast("已删除");
  }

  async function importRecords(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported)) throw new Error("文件格式不正确");

      const byId = new Map(records.map((record) => [record.id, record]));
      imported.forEach((record) => {
        if (!record.title || !record.password) return;
        const id = record.id || crypto.randomUUID();
        byId.set(id, {
          id,
          title: String(record.title),
          tag: String(record.tag || ""),
          username: String(record.username || ""),
          url: normalizeUrl(String(record.url || "")),
          password: String(record.password),
          note: String(record.note || ""),
          updatedAt: Number(record.updatedAt || Date.now()),
        });
      });

      await persist(Array.from(byId.values()));
      showToast("导入完成");
    } catch (error) {
      showToast(error.message);
    } finally {
      event.target.value = "";
    }
  }

  if (!isUnlocked) {
    return (
      <main className="lock-view">
        <div className="brand-panel">
          <div className="brand-mark" aria-hidden="true">
            <LockMark />
          </div>
          <p className="eyebrow">Encrypted cloud vault</p>
          <h1>MarkBook</h1>
          <p className="hero-copy">账号、密码、备注和链接会先加密，再跨设备同步。</p>
          <div className="signal-row" aria-label="应用状态">
            <span>Web Crypto</span>
            <span>Vercel Postgres</span>
            <span>Next.js Ready</span>
          </div>
        </div>

        <form className="auth-panel" onSubmit={handleAuthSubmit}>
          <div>
            <p className="eyebrow">{authMode === "login" ? "同步保险库" : "新保险库"}</p>
            <h2>{authMode === "login" ? "登录账号" : "注册账号"}</h2>
          </div>

          <div className="mode-switch" aria-label="认证方式">
            <button
              className={authMode === "login" ? "active" : ""}
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthMessage("");
              }}
            >
              登录
            </button>
            <button
              className={authMode === "register" ? "active" : ""}
              type="button"
              onClick={() => {
                setAuthMode("register");
                setAuthMessage("");
              }}
            >
              注册
            </button>
          </div>

          <label className="field">
            <span>邮箱</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="field">
            <span>密码</span>
            <input
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位"
              required
              type="password"
              value={password}
            />
          </label>

          {authMode === "register" && (
            <label className="field">
              <span>确认密码</span>
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次输入"
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          )}

          <button className="primary-btn" type="submit">
            {authMode === "login" ? "登录并解锁" : "创建并进入"}
          </button>
          <p className="form-message" role="status">
            {authMessage}
          </p>
        </form>
      </main>
    );
  }

  return (
    <>
      <section className="vault-view">
        <header className="topbar">
          <div>
            <p className="eyebrow">MarkBook</p>
            <h1>密码记录</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => downloadJson(`markbook-${new Date().toISOString().slice(0, 10)}.json`, records)}
            >
              导出
            </button>
            <label className="ghost-btn import-label">
              导入
              <input accept="application/json" onChange={importRecords} type="file" />
            </label>
            <button className="danger-btn" type="button" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <main className="workspace">
          <aside className="sidebar">
            <div className="metric">
              <span>记录</span>
              <strong>{records.length}</strong>
            </div>
            <div className="metric">
              <span>标签</span>
              <strong>{Math.max(tags.length - 1, 0)}</strong>
            </div>
            <div className="search-wrap">
              <SearchIcon />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、账号、标签"
                type="search"
                value={query}
              />
            </div>
            <div className="tag-list" aria-label="标签筛选">
              {tags.map((tag) => (
                <button
                  className={`tag-chip${selectedTag === tag ? " active" : ""}`}
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          </aside>

          <section className="records-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Vault</p>
                <h2>账号列表</h2>
              </div>
              <button className="primary-btn compact" type="button" onClick={() => openRecordDialog()}>
                新增记录
              </button>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">
                  <EmptyIcon />
                </div>
                <h3>还没有记录</h3>
                <p>新增第一条账号密码后会显示在这里。</p>
              </div>
            ) : (
              <div className="record-grid">
                {filteredRecords.map((record) => {
                  const isRevealed = revealedIds.has(record.id);
                  return (
                    <article className="record-card" key={record.id}>
                      <div className="record-top">
                        <div>
                          <h3 className="record-title">{record.title}</h3>
                          <div className="record-tag">{record.tag || "未分类"}</div>
                        </div>
                        <button
                          className="mini-btn"
                          type="button"
                          onClick={() => openRecordDialog(record)}
                          aria-label="编辑"
                        >
                          <EditIcon />
                        </button>
                      </div>
                      <div className="record-line">
                        <span>{record.username || "未填写账号"}</span>
                        <button
                          className="mini-btn"
                          type="button"
                          onClick={() => copyText(record.username || "")}
                          aria-label="复制账号"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                      <div className="record-line">
                        <span>{isRevealed ? record.password : maskPassword(record.password)}</span>
                        <div className="mini-actions">
                          <button
                            className="mini-btn"
                            type="button"
                            onClick={() => {
                              const next = new Set(revealedIds);
                              if (next.has(record.id)) next.delete(record.id);
                              else next.add(record.id);
                              setRevealedIds(next);
                            }}
                            aria-label="显示密码"
                          >
                            <EyeIcon />
                          </button>
                          <button
                            className="mini-btn"
                            type="button"
                            onClick={() => copyText(record.password)}
                            aria-label="复制密码"
                          >
                            <CopyIcon />
                          </button>
                        </div>
                      </div>
                      <div className="record-footer">
                        <span>{formatDate(record.updatedAt)}</span>
                        {record.url ? (
                          <a href={record.url} target="_blank" rel="noopener noreferrer">
                            打开
                          </a>
                        ) : (
                          <span className="disabled-link">打开</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </section>

      {isRecordDialogOpen && (
        <div className="dialog-backdrop" role="presentation">
          <form className="dialog-card" onSubmit={handleRecordSubmit}>
            <div className="dialog-head">
              <div>
                <p className="eyebrow">{recordDraft.id ? "Edit record" : "New record"}</p>
                <h2>{recordDraft.id ? "编辑记录" : "新增记录"}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={closeRecordDialog} aria-label="关闭">
                <CloseIcon />
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>标题</span>
                <input
                  onChange={(event) => setRecordDraft({ ...recordDraft, title: event.target.value })}
                  placeholder="例如 Github"
                  required
                  value={recordDraft.title}
                />
              </label>
              <label className="field">
                <span>标签</span>
                <input
                  onChange={(event) => setRecordDraft({ ...recordDraft, tag: event.target.value })}
                  placeholder="工作 / 个人 / 服务器"
                  value={recordDraft.tag}
                />
              </label>
              <label className="field">
                <span>账号</span>
                <input
                  autoComplete="off"
                  onChange={(event) => setRecordDraft({ ...recordDraft, username: event.target.value })}
                  placeholder="邮箱或用户名"
                  value={recordDraft.username}
                />
              </label>
              <label className="field">
                <span>链接</span>
                <input
                  onChange={(event) => setRecordDraft({ ...recordDraft, url: event.target.value })}
                  placeholder="https://example.com"
                  type="url"
                  value={recordDraft.url}
                />
              </label>
              <label className="field wide">
                <span>密码</span>
                <div className="password-row">
                  <input
                    autoComplete="off"
                    onChange={(event) => setRecordDraft({ ...recordDraft, password: event.target.value })}
                    required
                    type="text"
                    value={recordDraft.password}
                  />
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => setRecordDraft({ ...recordDraft, password: generatePassword() })}
                  >
                    生成
                  </button>
                </div>
              </label>
              <label className="field wide">
                <span>备注</span>
                <textarea
                  onChange={(event) => setRecordDraft({ ...recordDraft, note: event.target.value })}
                  placeholder="安全问题、恢复码位置或其他备注"
                  rows={3}
                  value={recordDraft.note}
                />
              </label>
            </div>

            <div className="dialog-actions">
              <button
                className="danger-btn muted"
                hidden={!recordDraft.id}
                type="button"
                onClick={deleteRecord}
              >
                删除
              </button>
              <div>
                <button className="ghost-btn" type="button" onClick={closeRecordDialog}>
                  取消
                </button>
                <button className="primary-btn" type="submit">
                  保存
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
