#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const configPath = resolve(rootDir, 'wrangler.toml');
const initSqlPath = resolve(rootDir, 'd1-init.sql');
const secretsPath = resolve(rootDir, '.deploy-secrets.env');

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

const workerName = sanitizeSlug(args['worker-name'] || 'freemail', 'Worker 名称');
const mailDomain = requireText(args['mail-domain'], 'MAIL_DOMAIN');
const adminPassword = requireText(args['admin-password'], 'ADMIN_PASSWORD');
const adminName = (args['admin-name'] || 'admin').trim();
const guestPassword = (args['guest-password'] || '').trim();
const resendApiKey = (args['resend-api-key'] || '').trim();
const cloudflareZoneId = (args['cloudflare-zone-id'] || '').trim();
const cloudflareApiToken = (args['cloudflare-api-token'] || '').trim();
const cloudflareApiEmail = (args['cloudflare-api-email'] || '').trim();
const cloudflareGlobalApiKey = (args['cloudflare-global-api-key'] || '').trim();
const emailRoutingWorker = (args['cloudflare-email-routing-worker'] || workerName).trim();
const jwtToken = (args['jwt-token'] || randomBytes(32).toString('hex')).trim();
const d1Location = (args['d1-location'] || 'apac').trim();
const r2Location = (args['r2-location'] || 'apac').trim();
const databaseName = sanitizeSlug(args['database-name'] || `${workerName}-db`, 'D1 名称');
const bucketName = sanitizeBucketName(
  args['bucket-name'] || `${workerName}-eml-${Date.now().toString(36)}`,
);
const suppliedDatabaseId = (args['database-id'] || '').trim();
const skipDeploy = isTruthy(args['skip-deploy']);

if (!existsSync(configPath)) {
  fail(`未找到配置文件: ${configPath}`);
}

if (!existsSync(initSqlPath)) {
  fail(`未找到数据库初始化脚本: ${initSqlPath}`);
}

let createdSecretsFile = false;

try {
  ensureWranglerLogin();

  const databaseId = suppliedDatabaseId || createD1Database(databaseName, d1Location);

  if (!args['bucket-name']) {
    createR2Bucket(bucketName, r2Location);
  }

  updateWranglerConfig({
    workerName,
    databaseName,
    databaseId,
    bucketName,
  });

  writeSecretsFile({
    MAIL_DOMAIN: mailDomain,
    ADMIN_PASSWORD: adminPassword,
    JWT_TOKEN: jwtToken,
    ...(adminName ? { ADMIN_NAME: adminName } : {}),
    ...(guestPassword ? { GUEST_PASSWORD: guestPassword } : {}),
    ...(resendApiKey ? { RESEND_API_KEY: resendApiKey } : {}),
    ...(cloudflareZoneId ? { CLOUDFLARE_ZONE_ID: cloudflareZoneId } : {}),
    ...(cloudflareApiToken ? { CLOUDFLARE_API_TOKEN: cloudflareApiToken } : {}),
    ...(cloudflareApiEmail ? { CLOUDFLARE_API_EMAIL: cloudflareApiEmail } : {}),
    ...(cloudflareGlobalApiKey ? { CLOUDFLARE_GLOBAL_API_KEY: cloudflareGlobalApiKey } : {}),
    ...(cloudflareZoneId || cloudflareApiToken || cloudflareApiEmail || cloudflareGlobalApiKey
      ? { CLOUDFLARE_EMAIL_ROUTING_WORKER: emailRoutingWorker }
      : {}),
  });
  createdSecretsFile = true;

  runWrangler(
    ['d1', 'execute', 'TEMP_MAIL_DB', '--file', initSqlPath, '--remote', '--yes'],
    '初始化 D1 数据库失败',
  );

  if (!skipDeploy) {
    runWrangler(
      ['deploy', '--keep-vars', '--secrets-file', secretsPath],
      '部署 Worker 失败',
    );
  }

  console.log('\n部署参数已写入 wrangler.toml。');
  console.log(`Worker 名称: ${workerName}`);
  console.log(`D1 数据库: ${databaseName}`);
  console.log(`R2 存储桶: ${bucketName}`);
  console.log(`MAIL_DOMAIN: ${mailDomain}`);
  console.log(`JWT_TOKEN: ${jwtToken}`);
  if (skipDeploy) {
    console.log('\n已跳过 deploy。后续可手动运行:');
    console.log('npx wrangler deploy --keep-vars');
  } else {
    console.log('\nCloudflare 部署命令已经执行完成。');
  }
  console.log('别忘了在 Cloudflare 控制台把目标域名的 Email Routing Catch-all 绑定到这个 Worker。');
} finally {
  if (createdSecretsFile && existsSync(secretsPath)) {
    unlinkSync(secretsPath);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      fail(`无法识别的参数: ${token}`);
    }
    const raw = token.slice(2);
    const eqIndex = raw.indexOf('=');
    if (eqIndex >= 0) {
      const key = raw.slice(0, eqIndex);
      const value = raw.slice(eqIndex + 1);
      parsed[key] = value;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[raw] = 'true';
      continue;
    }
    parsed[raw] = next;
    i += 1;
  }
  return parsed;
}

function printUsage() {
  console.log(`用法:
node scripts/deploy-cloudflare.mjs --mail-domain example.com --admin-password "你的密码" [可选参数]

必填参数:
  --mail-domain      邮箱域名，多个域名可用逗号分隔
  --admin-password   严格管理员密码

可选参数:
  --worker-name      Worker 名称，默认 freemail
  --admin-name       严格管理员用户名，默认 admin
  --guest-password   启用 guest 账号时的密码
  --jwt-token        自定义 JWT_TOKEN，不传则自动生成
  --database-name    D1 数据库名，默认 <worker-name>-db
  --database-id      复用已有 D1 时传入 ID，传入后会跳过创建
  --bucket-name      复用已有 R2 时传入桶名，传入后会跳过创建
  --d1-location      D1 区域，默认 apac
  --r2-location      R2 区域，默认 apac
  --resend-api-key   可选，配置发信能力
  --cloudflare-zone-id              可选，启用子域名自动创建地址规则
  --cloudflare-api-token            可选，Cloudflare API Token，需有 Email Routing Rules Write 权限
  --cloudflare-api-email            可选，使用 Global API Key 时对应的登录邮箱
  --cloudflare-global-api-key       可选，Cloudflare Global API Key
  --cloudflare-email-routing-worker 可选，自动建规则时指向的 Worker，默认等于 worker-name
  --skip-deploy      只创建资源和初始化数据库，不执行最终 deploy

示例:
  node scripts/deploy-cloudflare.mjs --worker-name freemail-demo --mail-domain mail.example.com --admin-password "StrongPass!123"
`);
}

function ensureWranglerLogin() {
  const result = runWrangler(['whoami'], '检查 Cloudflare 登录状态失败', { capture: true });
  const combined = `${result.stdout}\n${result.stderr}`;
  if (/not authenticated/i.test(combined) || /wrangler login/i.test(combined)) {
    fail('当前机器尚未登录 Cloudflare。请先执行 `npx wrangler login`，完成浏览器授权后再重新运行脚本。');
  }
}

function createD1Database(name, location) {
  const result = runWranglerAllowFailure(
    ['d1', 'create', name, '--location', location],
    { capture: true },
  );
  const combined = `${result.stdout}\n${result.stderr}`;
  if (result.status !== 0) {
    if (/already exists/i.test(combined)) {
      const existingId = findD1DatabaseIdByName(name);
      if (existingId) {
        return existingId;
      }
    }
    fail(`创建 D1 数据库失败: ${name}\n${combined}`);
  }
  const match = combined.match(/database_id\s*=\s*"([^"]+)"/i);
  if (!match) {
    fail(`已执行 D1 创建，但没能从输出中解析 database_id。\n${combined}`);
  }
  return match[1];
}

function createR2Bucket(name, location) {
  runWrangler(
    ['r2', 'bucket', 'create', name, '--location', location],
    `创建 R2 存储桶失败: ${name}`,
  );
}

function updateWranglerConfig({ workerName, databaseName, databaseId, bucketName }) {
  let content = readFileSync(configPath, 'utf8');
  content = replaceTomlString(content, 'name', workerName);
  content = replaceTomlString(content, 'database_name', databaseName);
  content = replaceTomlString(content, 'database_id', databaseId);
  content = replaceTomlString(content, 'bucket_name', bucketName);
  writeFileSync(configPath, content, 'utf8');
}

function writeSecretsFile(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${quoteEnvValue(String(value))}`);
  writeFileSync(secretsPath, `${lines.join('\n')}\n`, 'utf8');
}

function quoteEnvValue(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`;
}

function replaceTomlString(content, key, value) {
  const pattern = new RegExp(`^(\\s*${escapeRegex(key)}\\s*=\\s*")([^"]*)(".*)$`, 'm');
  if (!pattern.test(content)) {
    fail(`没有在 wrangler.toml 中找到可替换的配置项: ${key}`);
  }
  return content.replace(pattern, `$1${value}$3`);
}

function runWrangler(argsList, errorMessage, options = {}) {
  const invocation = process.platform === 'win32'
    ? {
        command: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', 'npx', 'wrangler', ...argsList],
      }
    : {
        command: 'npx',
        args: ['wrangler', ...argsList],
      };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error) {
    fail(`${errorMessage}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = options.capture ? `\n${result.stdout || ''}\n${result.stderr || ''}` : '';
    fail(`${errorMessage}${details}`);
  }
  return result;
}

function runWranglerAllowFailure(argsList, options = {}) {
  const invocation = process.platform === 'win32'
    ? {
        command: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', 'npx', 'wrangler', ...argsList],
      }
    : {
        command: 'npx',
        args: ['wrangler', ...argsList],
      };
  return spawnSync(invocation.command, invocation.args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function findD1DatabaseIdByName(name) {
  const result = runWrangler(
    ['d1', 'list', '--json'],
    '查询现有 D1 数据库失败',
    { capture: true },
  );
  try {
    const rows = JSON.parse(result.stdout || '[]');
    const match = rows.find((row) => row && row.name === name);
    return match?.uuid || '';
  } catch (error) {
    fail(`解析 D1 列表失败: ${error.message}`);
  }
}

function sanitizeSlug(value, label) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!normalized) {
    fail(`${label}不能为空。`);
  }
  return normalized;
}

function sanitizeBucketName(value) {
  const normalized = sanitizeSlug(value, 'R2 存储桶名称').slice(0, 63).replace(/^-|-$/g, '');
  if (normalized.length < 3) {
    fail('R2 存储桶名称至少需要 3 个字符。');
  }
  return normalized;
}

function requireText(value, label) {
  const text = String(value || '').trim();
  if (!text) {
    fail(`缺少必填参数: ${label}`);
  }
  return text;
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(message) {
  console.error(`\n[deploy-cloudflare] ${message}`);
  process.exit(1);
}
