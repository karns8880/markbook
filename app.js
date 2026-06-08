const KDF_ITERATIONS = 210000;

const state = {
  key: null,
  salt: null,
  records: [],
  user: null,
  vaultMeta: null,
  selectedTag: "全部",
  query: "",
};

const icons = {
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
};

const $ = (selector) => document.querySelector(selector);

const lockView = $("#lockView");
const vaultView = $("#vaultView");
const unlockForm = $("#unlockForm");
const emailInput = $("#emailInput");
const masterPassword = $("#masterPassword");
const confirmPassword = $("#confirmPassword");
const confirmWrap = $("#confirmWrap");
const authTitle = $("#authTitle");
const authMessage = $("#authMessage");
const unlockButton = $("#unlockButton");
const modeEyebrow = $("#modeEyebrow");
const recordDialog = $("#recordDialog");
const recordForm = $("#recordForm");
const toast = $("#toast");

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

async function encryptRecords(records) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(JSON.stringify(records));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, state.key, payload);

  state.vaultMeta = {
    version: 1,
    iterations: KDF_ITERATIONS,
    salt: bytesToBase64(state.salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted),
  };
  await api("/api/vault", {
    method: "PUT",
    body: JSON.stringify({ vault: state.vaultMeta }),
  });
}

async function decryptRecords(password, vault) {
  if (!vault) return [];

  const salt = base64ToBytes(vault.salt);
  const iv = base64ToBytes(vault.iv);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(vault.data),
  );

  state.key = key;
  state.salt = salt;
  state.vaultMeta = vault;
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function createVault(password) {
  state.salt = crypto.getRandomValues(new Uint8Array(16));
  state.key = await deriveKey(password, state.salt);
  state.records = [];
  await encryptRecords(state.records);
}

async function persist() {
  state.records.sort((a, b) => b.updatedAt - a.updatedAt);
  await encryptRecords(state.records);
  render();
}

function configureAuthMode() {
  const mode = unlockForm.dataset.mode || "login";
  const isLogin = mode === "login";
  unlockForm.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });

  if (isLogin) {
    confirmWrap.hidden = true;
    confirmPassword.required = false;
    authTitle.textContent = "登录账号";
    unlockButton.textContent = "登录并解锁";
    modeEyebrow.textContent = "同步保险库";
    masterPassword.autocomplete = "current-password";
  } else {
    confirmWrap.hidden = false;
    confirmPassword.required = true;
    authTitle.textContent = "注册账号";
    unlockButton.textContent = "创建并进入";
    modeEyebrow.textContent = "新保险库";
    masterPassword.autocomplete = "new-password";
  }
}

function showVault() {
  lockView.hidden = true;
  vaultView.hidden = false;
  emailInput.value = "";
  masterPassword.value = "";
  confirmPassword.value = "";
  authMessage.textContent = "";
  render();
}

async function lockVault() {
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
  } catch {
    // Local state is still cleared even if the network request fails.
  }
  state.key = null;
  state.salt = null;
  state.records = [];
  state.user = null;
  state.vaultMeta = null;
  state.selectedTag = "全部";
  state.query = "";
  $("#searchInput").value = "";
  vaultView.hidden = true;
  lockView.hidden = false;
  configureAuthMode();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function getTags() {
  const tags = new Set(state.records.map((record) => record.tag || "未分类"));
  return ["全部", ...Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-CN"))];
}

function getFilteredRecords() {
  const query = state.query.trim().toLowerCase();
  return state.records.filter((record) => {
    const tag = record.tag || "未分类";
    const matchesTag = state.selectedTag === "全部" || state.selectedTag === tag;
    const haystack = [record.title, record.username, record.url, record.tag, record.note]
      .join(" ")
      .toLowerCase();
    return matchesTag && (!query || haystack.includes(query));
  });
}

function renderTags() {
  const tagList = $("#tagList");
  tagList.innerHTML = "";

  getTags().forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-chip${state.selectedTag === tag ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => {
      state.selectedTag = tag;
      render();
    });
    tagList.append(button);
  });
}

function maskPassword(password) {
  return "•".repeat(Math.min(Math.max(password.length, 8), 18));
}

function createRecordCard(record) {
  const card = document.createElement("article");
  card.className = "record-card";
  card.innerHTML = `
    <div class="record-top">
      <div>
        <h3 class="record-title"></h3>
        <div class="record-tag"></div>
      </div>
      <button class="mini-btn" type="button" data-action="edit" aria-label="编辑">${icons.edit}</button>
    </div>
    <div class="record-line">
      <span class="username"></span>
      <button class="mini-btn" type="button" data-action="copy-user" aria-label="复制账号">${icons.copy}</button>
    </div>
    <div class="record-line">
      <span class="password"></span>
      <div class="mini-actions">
        <button class="mini-btn" type="button" data-action="reveal" aria-label="显示密码">${icons.eye}</button>
        <button class="mini-btn" type="button" data-action="copy-pass" aria-label="复制密码">${icons.copy}</button>
      </div>
    </div>
    <div class="record-footer">
      <span class="updated"></span>
      <a class="open-link" target="_blank" rel="noopener">打开</a>
    </div>
  `;

  card.querySelector(".record-title").textContent = record.title;
  card.querySelector(".record-tag").textContent = record.tag || "未分类";
  card.querySelector(".username").textContent = record.username || "未填写账号";
  card.querySelector(".password").textContent = maskPassword(record.password);
  card.querySelector(".updated").textContent = formatDate(record.updatedAt);

  const link = card.querySelector(".open-link");
  if (record.url) {
    link.href = record.url;
  } else {
    link.removeAttribute("href");
    link.style.opacity = "0.45";
  }

  card.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "edit") openRecordDialog(record.id);
    if (action === "copy-user") await copyText(record.username || "");
    if (action === "copy-pass") await copyText(record.password);
    if (action === "reveal") {
      const passwordEl = card.querySelector(".password");
      const isMasked = passwordEl.textContent !== record.password;
      passwordEl.textContent = isMasked ? record.password : maskPassword(record.password);
    }
  });

  return card;
}

function renderRecords() {
  const recordGrid = $("#recordGrid");
  const records = getFilteredRecords();

  recordGrid.innerHTML = "";
  records.forEach((record) => recordGrid.append(createRecordCard(record)));
  $("#emptyState").hidden = records.length > 0;
}

function render() {
  $("#totalCount").textContent = state.records.length;
  $("#tagCount").textContent = Math.max(getTags().length - 1, 0);
  renderTags();
  renderRecords();
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

function openRecordDialog(recordId = "") {
  const record = state.records.find((item) => item.id === recordId);
  $("#recordId").value = record?.id || "";
  $("#titleInput").value = record?.title || "";
  $("#tagInput").value = record?.tag || "";
  $("#usernameInput").value = record?.username || "";
  $("#urlInput").value = record?.url || "";
  $("#passwordInput").value = record?.password || "";
  $("#noteInput").value = record?.note || "";
  $("#dialogTitle").textContent = record ? "编辑记录" : "新增记录";
  $("#dialogMode").textContent = record ? "Edit record" : "New record";
  $("#deleteRecordBtn").hidden = !record;
  recordDialog.showModal();
}

function normalizeUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
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

unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";
  const email = emailInput.value.trim();
  const password = masterPassword.value;
  const mode = unlockForm.dataset.mode || "login";

  try {
    if (password.length < 8) throw new Error("密码至少 8 位");

    if (mode === "login") {
      const login = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      state.user = login.user;
      const { vault } = await api("/api/vault");
      if (vault) {
        state.records = await decryptRecords(password, vault);
      } else {
        await createVault(password);
      }
    } else {
      if (password !== confirmPassword.value) throw new Error("两次输入不一致");
      const register = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      state.user = register.user;
      await createVault(password);
    }
    showVault();
  } catch (error) {
    authMessage.textContent = error.message.includes("decrypt")
      ? "登录成功，但保险库密码无法解密"
      : error.message;
  }
});

unlockForm.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    unlockForm.dataset.mode = button.dataset.authMode;
    authMessage.textContent = "";
    configureAuthMode();
  });
});

$("#newRecordBtn").addEventListener("click", () => openRecordDialog());
$("#closeDialogBtn").addEventListener("click", () => recordDialog.close());
$("#cancelBtn").addEventListener("click", () => recordDialog.close());
$("#lockBtn").addEventListener("click", lockVault);
$("#generateBtn").addEventListener("click", () => {
  $("#passwordInput").value = generatePassword();
});

$("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderRecords();
});

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#recordId").value || crypto.randomUUID();
  const existingIndex = state.records.findIndex((record) => record.id === id);
  const record = {
    id,
    title: $("#titleInput").value.trim(),
    tag: $("#tagInput").value.trim(),
    username: $("#usernameInput").value.trim(),
    url: normalizeUrl($("#urlInput").value.trim()),
    password: $("#passwordInput").value,
    note: $("#noteInput").value.trim(),
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    state.records[existingIndex] = record;
  } else {
    state.records.push(record);
  }

  await persist();
  recordDialog.close();
  showToast("已保存");
});

$("#deleteRecordBtn").addEventListener("click", async () => {
  const id = $("#recordId").value;
  state.records = state.records.filter((record) => record.id !== id);
  await persist();
  recordDialog.close();
  showToast("已删除");
});

$("#exportBtn").addEventListener("click", () => {
  downloadJson(`markbook-${new Date().toISOString().slice(0, 10)}.json`, state.records);
});

$("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("文件格式不正确");

    const byId = new Map(state.records.map((record) => [record.id, record]));
    imported.forEach((record) => {
      if (!record.title || !record.password) return;
      byId.set(record.id || crypto.randomUUID(), {
        id: record.id || crypto.randomUUID(),
        title: String(record.title),
        tag: String(record.tag || ""),
        username: String(record.username || ""),
        url: normalizeUrl(String(record.url || "")),
        password: String(record.password),
        note: String(record.note || ""),
        updatedAt: Number(record.updatedAt || Date.now()),
      });
    });
    state.records = Array.from(byId.values());
    await persist();
    showToast("导入完成");
  } catch (error) {
    showToast(error.message);
  } finally {
    event.target.value = "";
  }
});

configureAuthMode();
