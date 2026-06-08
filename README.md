# MarkBook

一个 Next.js 网页端账号密码记录应用，使用 Supabase Auth 做邮箱密码认证，并把保险库密文同步到 Supabase Database。账号密码记录在浏览器端用 Web Crypto 加密，数据库只保存加密后的保险库 JSON。

## 功能

- 主密码创建和解锁本地保险库
- 新增、编辑、删除账号密码记录
- 搜索标题、账号、链接、标签和备注
- 标签筛选
- 密码生成
- 复制账号和密码
- JSON 导入和导出
- Supabase 邮箱密码认证
- 跨设备同步加密保险库

## 本地运行

需要先配置环境变量：

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

```bash
npm install
npm run dev
```

然后打开：

```text
http://localhost:4173
```

## 部署到 Vercel

1. 把这个目录推到 GitHub、GitLab 或 Bitbucket。
2. 在 Vercel 新建 Project 并导入仓库。
3. 在 Supabase 创建项目，并启用 Email Auth。
4. 在 Supabase SQL Editor 执行下面的建表和 RLS SQL。
5. 在 Vercel Environment Variables 添加 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
6. Framework Preset 选择 `Next.js`，通常 Vercel 会自动识别。
7. Build Command 使用默认的 `next build`。
8. Output Directory 留空。
9. 点击 Deploy。

## Supabase 数据表

```sql
create table if not exists public.vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vault_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

create policy "Users can read their own vault"
on public.vaults
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own vault"
on public.vaults
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own vault"
on public.vaults
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 数据说明

Supabase 负责登录认证和数据库访问控制。登录密码同时用于浏览器端保险库加密；Supabase 数据库只保存加密后的 `vault_json`。导出的 JSON 是明文记录，适合自己备份或迁移，保存位置需要自行保护。
