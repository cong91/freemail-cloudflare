# Freemail

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/idinging/freemail)

基于 Cloudflare Workers + D1 + R2 + Email Routing 的临时邮箱项目，支持：

- 随机生成邮箱和自定义邮箱
- 邮件接收、列表查看、详情查看
- 完整 EML 存入 R2
- 管理员、普通用户、邮箱登录三种角色
- Resend 发信
- 邮件转发
- 子域名模式下自动创建 Cloudflare Email Routing 规则

## 文档入口

- 完整部署流程：[docs/cloudflare-deploy-guide.md](docs/cloudflare-deploy-guide.md)
- 一键部署脚本：[scripts/deploy-cloudflare.mjs](scripts/deploy-cloudflare.mjs)
- Resend 配置：[docs/resend.md](docs/resend.md)
- API 文档：[docs/api.md](docs/api.md)
- 原项目展示：[docs/zhanshi.md](docs/zhanshi.md)

## 项目流程

核心收件链路：

1. 用户在前端创建邮箱
2. 后端把邮箱写入 D1 的 `mailboxes` 表
3. 如果启用了子域名自动路由，会调用 Cloudflare Email Routing API 为该邮箱创建 `Send to a worker -> freemail` 规则
4. 外部邮件进入 Cloudflare Email Routing
5. Cloudflare 把邮件投递给 Worker 的 email handler
6. Worker 解析邮件并把索引写入 D1，把完整 EML 存入 R2
7. 前端通过 API 读取邮件列表和详情

对应资源：

- Worker：页面、API、邮件接收逻辑
- D1：邮箱、邮件、用户、发送记录、路由规则 ID
- R2：完整邮件原文
- Email Routing：收件入口

## 部署模式

### 模式 A：根域名 Catch-all

适合你能直接控制根域名的时候，例如 `example.com`。

配置方式：

1. 部署 Worker
2. 在 Cloudflare 打开 `Email > Email Routing`
3. 启用 Email Routing
4. 把 `Catch-all` 设置为 `Send to a worker`
5. Worker 选择 `freemail`

效果：

- 任意前缀都能直接收信
- 最接近真正的“临时邮箱”

### 模式 B：子域名自动建路由

适合你使用子域名的时候，例如 `mail.example.com` 或 `zaojun.de5.net`。

Cloudflare 的限制是：

- `Catch-all` 只支持 zone 级域名
- 不能对子域名单独开 Catch-all

所以本项目在子域名场景下采用：

1. 先创建邮箱
2. 再由后端自动调用 Email Routing API
3. 为这个具体地址创建一条 `literal(to) -> worker` 规则

效果：

- 新生成的子域名邮箱可以收信
- 历史邮箱需要执行一次回填

## 快速开始

先登录 Cloudflare：

```bash
npx wrangler login
```

然后执行一键部署：

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123"
```

如果你已经有现成的 D1 和 R2：

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123" ^
  --database-id "<your-d1-id>" ^
  --bucket-name "<your-r2-bucket>"
```

这个脚本会自动：

- 创建或复用 D1
- 创建或复用 R2
- 更新 `wrangler.toml`
- 初始化 D1 表结构
- 写入 secrets
- 执行 `wrangler deploy`

## 子域名自动收件配置

如果你部署在子域名上，需要再补一组 Cloudflare 凭证。

### 方案 1：API Token

```bash
CLOUDFLARE_ZONE_ID="你的 Zone ID"
CLOUDFLARE_API_TOKEN="你的 API Token"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

### 方案 2：Global API Key

```bash
CLOUDFLARE_ZONE_ID="你的 Zone ID"
CLOUDFLARE_API_EMAIL="你的 Cloudflare 登录邮箱"
CLOUDFLARE_GLOBAL_API_KEY="你的 Global API Key"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

这两种认证方式二选一即可：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_API_EMAIL + CLOUDFLARE_GLOBAL_API_KEY`

也可以在部署脚本里一次性传入：

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain zaojun.de5.net ^
  --admin-password "StrongPass!123" ^
  --cloudflare-zone-id "<zone-id>" ^
  --cloudflare-api-email "<cloudflare-email>" ^
  --cloudflare-global-api-key "<global-api-key>" ^
  --cloudflare-email-routing-worker freemail
```

## 配置项

### 必填

| 变量 | 说明 |
| --- | --- |
| `MAIL_DOMAIN` | 邮箱域名，支持逗号分隔多个域名 |
| `ADMIN_PASSWORD` | 管理员密码 |
| `JWT_TOKEN` | JWT 密钥 |
| `TEMP_MAIL_DB` | D1 绑定 |
| `MAIL_EML` | R2 绑定 |

### 常用可选项

| 变量 | 说明 |
| --- | --- |
| `ADMIN_NAME` | 管理员用户名，默认 `admin` |
| `GUEST_PASSWORD` | 访客账号密码 |
| `RESEND_API_KEY` | Resend 发信配置 |
| `FORWARD_RULES` | 前缀转发规则 |
| `CLOUDFLARE_ZONE_ID` | Zone ID |
| `CLOUDFLARE_API_TOKEN` | API Token |
| `CLOUDFLARE_API_EMAIL` | Cloudflare 登录邮箱 |
| `CLOUDFLARE_GLOBAL_API_KEY` | Global API Key |
| `CLOUDFLARE_EMAIL_ROUTING_WORKER` | 自动创建路由时指向的 Worker |

## 首次部署完成后要做什么

### 根域名模式

1. 打开 `Email > Email Routing`
2. 启用 Email Routing
3. 配置 `Catch-all -> Send to a worker -> freemail`
4. 发一封测试邮件到任意新地址
5. 登录后台确认是否收到

### 子域名模式

1. 确保 Cloudflare 凭证已经配置
2. 登录后台
3. 新生成一个从未使用过的邮箱
4. 发测试邮件到这个新邮箱
5. 确认可以收到

## 历史邮箱规则回填

如果你是在开启“子域名自动建路由”之前就已经创建过邮箱，这些老邮箱不会自动补规则。

项目现在提供管理员回填接口：

`POST /api/admin/backfill-routing`

示例：

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"limit\":100}"
```

指定邮箱回填：

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"addresses\":[\"old1@example.com\",\"old2@example.com\"]}"
```

## 常用命令

重新部署：

```bash
npx wrangler deploy --keep-vars
```

查看 secrets：

```bash
npx wrangler secret list --name freemail
```

查看最近部署：

```bash
npx wrangler deployments list --name freemail
```

查看数据库中的邮箱和路由规则：

```bash
npx wrangler d1 execute TEMP_MAIL_DB --remote --command "SELECT id, address, routing_rule_id FROM mailboxes ORDER BY id DESC LIMIT 20;"
```

## 故障排查

### 页面能打开，但收不到邮件

先看是哪种模式：

- 根域名模式：检查 `Catch-all -> Worker`
- 子域名模式：检查新邮箱是否创建成功，以及 Cloudflare 自动规则是否创建成功

### 随机生成时报 Cloudflare API 错误

优先检查：

- `CLOUDFLARE_ZONE_ID`
- API Token 或 Global API Key 是否有效
- `CLOUDFLARE_EMAIL_ROUTING_WORKER` 是否和 Worker 名称一致

### 只有新邮箱能收，老邮箱不能收

说明自动建路由已经正常，但历史邮箱还没回填。执行 `/api/admin/backfill-routing` 即可。

### 管理员密码要更新

```bash
npx wrangler secret put ADMIN_PASSWORD --name freemail
npx wrangler deploy --keep-vars
```

## 许可证

Apache-2.0
