# MarkBook

一个 Next.js 网页端账号密码记录应用，使用邮箱密码认证，并把保险库密文同步到 Vercel Postgres。账号密码记录在浏览器端用 Web Crypto 加密，服务端只保存加密后的保险库 JSON。

## 功能

- 主密码创建和解锁本地保险库
- 新增、编辑、删除账号密码记录
- 搜索标题、账号、链接、标签和备注
- 标签筛选
- 密码生成
- 复制账号和密码
- JSON 导入和导出
- 邮箱密码认证
- 跨设备同步加密保险库

## 本地运行

需要先配置环境变量：

```bash
export AUTH_SECRET="replace-with-a-long-random-secret-at-least-32-chars"
export POSTGRES_URL="postgres://..."
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
3. 在 Project 的 Storage 里创建或连接 Vercel Postgres。
4. 确认 Vercel 自动注入了 `POSTGRES_URL` 等 Postgres 环境变量。
5. 在 Environment Variables 添加 `AUTH_SECRET`，值建议用 32 位以上随机字符串。
6. Framework Preset 选择 `Next.js`，通常 Vercel 会自动识别。
7. Build Command 使用默认的 `next build`。
8. Output Directory 留空。
9. 点击 Deploy。

生成 `AUTH_SECRET` 可以用：

```bash
openssl rand -base64 48
```

## 数据说明

认证密码同时用于登录和保险库加密。服务端会保存登录密码的 PBKDF2 哈希，并保存加密后的保险库密文。导出的 JSON 是明文记录，适合自己备份或迁移，保存位置需要自行保护。
