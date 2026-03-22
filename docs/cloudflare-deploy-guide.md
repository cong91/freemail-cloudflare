# Cloudflare 部署与收件流程

这份文档只讲一件事：把当前项目部署到 Cloudflare，并让邮箱真正能收信。

适用场景：

- 根域名部署，使用 `Catch-all -> Worker`
- 子域名部署，使用“生成邮箱时自动创建 Email Routing 规则”
- 需要补齐历史邮箱的 Cloudflare 路由规则

## 1. 项目结构和收件链路

项目的核心链路如下：

1. 用户在前端创建一个邮箱地址
2. 后端把邮箱写入 D1 的 `mailboxes` 表
3. 如果启用了 Cloudflare Email Routing 自动建规则，会同时为这个地址创建 `Send to a worker -> freemail` 规则
4. 外部邮件发送到这个地址
5. Cloudflare Email Routing 把邮件投递给 Worker 的 email handler
6. Worker 解析邮件并把正文、索引写入 D1，把完整 EML 存到 R2
7. 前端通过 API 读取 D1 中的邮件列表和详情

和这条链路对应的资源：

- Worker：页面、API、收件处理
- D1：邮箱、邮件、用户、路由规则 ID
- R2：完整 EML 原文
- Email Routing：把外部邮件转进 Worker

## 2. 部署前准备

需要先准备：

- 一个已经接入 Cloudflare 的域名
- Node.js 18+
- Cloudflare 登录态
- `wrangler` 可用

先登录 Cloudflare：

```bash
npx wrangler login
```

## 3. 一键部署

项目已经内置了部署脚本 [deploy-cloudflare.mjs](/C:/Users/Administrator/Documents/Playground/freemail/scripts/deploy-cloudflare.mjs)，会自动完成下面这些步骤：

- 创建或复用 D1
- 创建或复用 R2
- 把资源 ID 写回 [wrangler.toml](/C:/Users/Administrator/Documents/Playground/freemail/wrangler.toml)
- 初始化 D1 表结构
- 写入 secrets
- 执行 `wrangler deploy`

最小部署命令：

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123"
```

如果你已经有现成的 D1/R2：

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123" ^
  --database-id "<your-d1-id>" ^
  --bucket-name "<your-r2-bucket>"
```

## 4. 两种收件模式

### 模式 A：根域名 Catch-all

这是 Cloudflare 最省事、也最接近“真正临时邮箱”的模式。

适用：

- 你控制的是根域名
- 例如 `example.com`

流程：

1. 部署 Worker
2. 打开 `Email > Email Routing`
3. 启用 Email Routing
4. 把 `Catch-all` 设置为 `Send to a worker`
5. 选择 Worker：`freemail`

效果：

- 任意前缀 `anything@example.com` 都能直接收进 Worker

### 模式 B：子域名自动建规则

适用：

- 你使用的是子域名
- 例如 `mail.example.com`、`zaojun.de5.net`

Cloudflare 的限制是：

- `Catch-all` 只支持 zone 级域名
- 不支持对子域名单独开 Catch-all

所以子域名模式下，本项目采取的是：

1. 用户先在前端生成邮箱
2. 后端调用 Cloudflare Email Routing API
3. 自动为这个具体地址创建一条 `literal(to) -> worker` 规则

效果：

- 新生成的子域名邮箱可以直接收信
- 不是“任意随机前缀天然全收”
- 历史邮箱需要单独回填规则

## 5. 子域名自动建规则所需配置

如果你要用模式 B，需要额外配置下面这些变量。

### 方案 1：API Token

```bash
CLOUDFLARE_ZONE_ID="你的 Zone ID"
CLOUDFLARE_API_TOKEN="你的 Cloudflare API Token"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

说明：

- `CLOUDFLARE_ZONE_ID`：域名对应 zone 的 Zone ID
- `CLOUDFLARE_API_TOKEN`：能访问 Email Routing Rules API 的 token
- `CLOUDFLARE_EMAIL_ROUTING_WORKER`：收件目标 Worker 名称，通常就是 `freemail`

### 方案 2：Global API Key 兼容模式

如果你的账号里不好找对的 token 权限，可以直接改用：

```bash
CLOUDFLARE_ZONE_ID="你的 Zone ID"
CLOUDFLARE_API_EMAIL="你的 Cloudflare 登录邮箱"
CLOUDFLARE_GLOBAL_API_KEY="你的 Global API Key"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

这个方案已经在当前项目里验证通过。

### 部署脚本里直接传入

也可以在一键部署时一起传：

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain zaojun.de5.net ^
  --admin-password "StrongPass!123" ^
  --cloudflare-zone-id "<zone-id>" ^
  --cloudflare-api-email "<your-cloudflare-email>" ^
  --cloudflare-global-api-key "<your-global-api-key>" ^
  --cloudflare-email-routing-worker freemail
```

## 6. 必要配置项

### 基础运行配置

| 变量 | 说明 | 必填 |
| --- | --- | --- |
| `MAIL_DOMAIN` | 邮箱域名，支持逗号分隔多个域名 | 是 |
| `ADMIN_PASSWORD` | 管理员密码 | 是 |
| `ADMIN_NAME` | 管理员用户名，默认 `admin` | 否 |
| `JWT_TOKEN` | JWT 密钥；部署脚本会自动生成 | 是 |
| `TEMP_MAIL_DB` | D1 绑定名 | 是 |
| `MAIL_EML` | R2 绑定名 | 是 |

### 可选发送配置

| 变量 | 说明 |
| --- | --- |
| `RESEND_API_KEY` | Resend 发件密钥，支持单值、键值对、JSON 三种格式 |
| `FORWARD_RULES` | 前缀转发规则 |

### 子域名自动收件配置

| 变量 | 说明 |
| --- | --- |
| `CLOUDFLARE_ZONE_ID` | 目标 zone 的 ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_API_EMAIL` | Cloudflare 登录邮箱 |
| `CLOUDFLARE_GLOBAL_API_KEY` | Cloudflare Global API Key |
| `CLOUDFLARE_EMAIL_ROUTING_WORKER` | 自动创建规则时指向的 Worker |

认证方式二选一即可：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_API_EMAIL + CLOUDFLARE_GLOBAL_API_KEY`

## 7. 首次部署后的检查

建议按这个顺序检查：

1. 打开 Worker 网址，确认首页能访问
2. 用管理员账号登录
3. 生成一个全新邮箱
4. 给这个新邮箱发送测试邮件
5. 打开页面确认邮件已经入库

如果是子域名模式，重点看第 3 步：

- 随机生成成功
- 没有报 Cloudflare API 错误
- 新邮箱能收到信

## 8. 历史邮箱规则回填

如果你是在启用“子域名自动建规则”之前就已经创建过邮箱，这些老邮箱不会自动补路由。

项目已经提供了管理员回填接口：

`POST /api/admin/backfill-routing`

调用方式：

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"limit\":100}"
```

说明：

- `Authorization` 里直接用 `JWT_TOKEN`
- `limit` 表示本次最多处理多少个历史邮箱
- 如果不传 `addresses`，就会自动处理所有 `routing_rule_id` 为空的邮箱

指定邮箱回填：

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"addresses\":[\"old1@example.com\",\"old2@example.com\"]}"
```

## 9. 常用运维命令

查看部署：

```bash
npx wrangler deployments list --name freemail
```

查看 secrets：

```bash
npx wrangler secret list --name freemail
```

查看 D1：

```bash
npx wrangler d1 execute TEMP_MAIL_DB --remote --command "SELECT id, address, routing_rule_id FROM mailboxes ORDER BY id DESC LIMIT 20;"
```

重新部署：

```bash
npx wrangler deploy --keep-vars
```

## 10. 常见问题

### 页面能打开，但收不到信

先分场景看：

- 根域名模式：检查 `Catch-all -> Send to a worker -> freemail`
- 子域名模式：检查创建邮箱时是否已经自动生成路由规则

### 随机生成时报 Cloudflare API 错误

优先检查：

- `CLOUDFLARE_ZONE_ID` 是否正确
- 认证方式是否真的可用
- `CLOUDFLARE_EMAIL_ROUTING_WORKER` 是否和 Worker 名称一致

### 老邮箱收不到，新邮箱能收

这是正常现象，说明你刚启用了子域名自动建规则，但历史邮箱还没补规则。执行“历史邮箱规则回填”即可。

### 管理员密码忘了

重新设置 `ADMIN_PASSWORD` secret，然后重新部署：

```bash
npx wrangler secret put ADMIN_PASSWORD --name freemail
npx wrangler deploy --keep-vars
```
