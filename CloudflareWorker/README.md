# Ji Clipboard - Cloudflare Worker

## 部署步骤

### 1. 创建 KV 命名空间

```bash
cd CloudflareWorker
npx wrangler kv:namespace create "AUTH_KV"
npx wrangler kv:namespace create "CLIPBOARD_KV"
```

记录返回的 ID，更新 `wrangler.toml` 中的 `id` 字段。

### 2. 设置环境变量

```bash
# 设置 GitHub OAuth Client ID
npx wrangler secret put GITHUB_CLIENT_ID
# 输入你的 GitHub Client ID

# 设置 GitHub OAuth Client Secret
npx wrangler secret put GITHUB_CLIENT_SECRET
# 输入你的 GitHub Client Secret
```

### 3. 更新配置

编辑 `wrangler.toml`：
- 替换 `你的_AUTH_KV_ID` 和 `你的_CLIPBOARD_KV_ID` 为实际 ID
- 更新 `FRONTEND_URL` 为你的前端地址
- 更新 `WORKER_URL` 为你的 Worker 地址

### 4. 部署

```bash
npm install
npm run deploy
```

## GitHub OAuth 设置

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - **Application name**: Ji-Clipboard
   - **Homepage URL**: 你的前端地址
   - **Authorization callback URL**: `https://你的worker地址.workers.dev/auth/callback`
4. 保存后获取 Client ID 和 Client Secret

## API 端点

- `GET /auth/github` - GitHub 登录入口
- `GET /auth/callback` - GitHub OAuth 回调
- `GET /api/me` - 获取当前用户信息
- `POST /api/logout` - 登出
- `POST /api/clipboard` - 保存剪贴板
- `GET /api/clipboard/:code` - 获取剪贴板
