/**
 * Cloudflare Email Routing 集成
 * 为子域名场景自动创建“指定地址 -> Worker”规则。
 */

const API_BASE = 'https://api.cloudflare.com/client/v4';

export function getCloudflareEmailRoutingConfig(env = {}) {
  const apiToken = String(
    env.CLOUDFLARE_API_TOKEN ||
    env.CLOUDFLARE_EMAIL_ROUTING_API_TOKEN ||
    env.CF_API_TOKEN ||
    ''
  ).trim();
  const apiEmail = String(
    env.CLOUDFLARE_API_EMAIL ||
    env.CF_EMAIL ||
    ''
  ).trim();
  const globalApiKey = String(
    env.CLOUDFLARE_GLOBAL_API_KEY ||
    env.CLOUDFLARE_API_KEY ||
    env.CF_API_KEY ||
    ''
  ).trim();
  const zoneId = String(env.CLOUDFLARE_ZONE_ID || env.CF_ZONE_ID || '').trim();
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID || '').trim();
  const workerName = String(
    env.CLOUDFLARE_EMAIL_ROUTING_WORKER ||
    env.CF_EMAIL_ROUTING_WORKER ||
    env.CLOUDFLARE_WORKER_NAME ||
    ''
  ).trim();
  const hasTokenAuth = Boolean(apiToken);
  const hasGlobalKeyAuth = Boolean(apiEmail && globalApiKey);
  const configured = Boolean((hasTokenAuth || hasGlobalKeyAuth) && zoneId && workerName);

  return {
    configured,
    apiToken,
    apiEmail,
    globalApiKey,
    zoneId,
    accountId,
    workerName,
    missing: [
      !(hasTokenAuth || hasGlobalKeyAuth) ? 'CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_API_EMAIL + CLOUDFLARE_GLOBAL_API_KEY' : '',
      !zoneId ? 'CLOUDFLARE_ZONE_ID' : '',
      !workerName ? 'CLOUDFLARE_EMAIL_ROUTING_WORKER' : '',
    ].filter(Boolean),
  };
}

export async function ensureWorkerRouteForMailbox(email, env = {}) {
  const config = getCloudflareEmailRoutingConfig(env);
  if (!config.configured) {
    return {
      enabled: false,
      status: 'disabled',
      ruleId: '',
      message: `Cloudflare 自动路由未启用，缺少配置：${config.missing.join(', ')}`,
    };
  }

  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('无效的邮箱地址');

  const existingRule = await findRuleByAddress(config, normalized);
  if (existingRule) {
    if (!ruleTargetsWorker(existingRule, config.workerName)) {
      throw new Error(`Cloudflare 中已存在 ${normalized} 的其他路由规则，请先调整该规则后再创建邮箱`);
    }

    if (existingRule.enabled === false) {
      const updated = await upsertRule(config, normalized, existingRule.id, existingRule.priority ?? 0);
      return {
        enabled: true,
        status: 'updated',
        created: false,
        ruleId: updated?.id || existingRule.id || '',
        message: '已自动恢复 Cloudflare 收件规则',
      };
    }

    return {
      enabled: true,
      status: 'existing',
      created: false,
      ruleId: existingRule.id || '',
      message: 'Cloudflare 收件规则已存在',
    };
  }

  const created = await createRule(config, normalized);
  return {
    enabled: true,
    status: 'created',
    created: true,
    ruleId: created?.id || '',
    message: '已自动创建 Cloudflare 收件规则',
  };
}

export async function deleteWorkerRouteForMailbox(email, env = {}, knownRuleId = '') {
  const config = getCloudflareEmailRoutingConfig(env);
  if (!config.configured) {
    return {
      enabled: false,
      status: 'disabled',
      deleted: false,
      message: 'Cloudflare 自动路由未启用',
    };
  }

  const normalized = normalizeEmail(email);
  if (!normalized) return { enabled: true, status: 'invalid', deleted: false };

  let rule = null;
  if (knownRuleId) {
    rule = await getRuleById(config, knownRuleId);
  }
  if (!rule) {
    rule = await findRuleByAddress(config, normalized);
  }
  if (!rule) {
    return {
      enabled: true,
      status: 'not_found',
      deleted: false,
      message: 'Cloudflare 中未找到对应规则',
    };
  }

  if (!ruleTargetsWorker(rule, config.workerName)) {
    return {
      enabled: true,
      status: 'foreign_rule',
      deleted: false,
      message: '检测到同地址规则但并非当前 Worker，未自动删除',
    };
  }

  await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules/${rule.id}`, {
    method: 'DELETE',
  });

  return {
    enabled: true,
    status: 'deleted',
    deleted: true,
    ruleId: rule.id || '',
    message: '已删除 Cloudflare 收件规则',
  };
}

export async function listRoutingRules(env = {}) {
  const config = getCloudflareEmailRoutingConfig(env);
  if (!config.configured) {
    return [];
  }

  const query = new URLSearchParams({ page: '1', per_page: '100' });
  const data = await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules?${query.toString()}`);
  return Array.isArray(data?.result) ? data.result : [];
}

export async function createRoutingRuleRaw(env = {}, payload) {
  const config = getCloudflareEmailRoutingConfig(env);
  if (!config.configured) {
    throw new Error(`Cloudflare 自动路由未启用，缺少配置：${config.missing.join(', ')}`);
  }
  const response = await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules`, {
    method: 'POST',
    body: payload,
  });
  return response?.result || response;
}

export async function updateRoutingRuleRaw(env = {}, ruleId, payload) {
  const config = getCloudflareEmailRoutingConfig(env);
  if (!config.configured) {
    throw new Error(`Cloudflare 自动路由未启用，缺少配置：${config.missing.join(', ')}`);
  }
  const response = await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules/${ruleId}`, {
    method: 'PUT',
    body: payload,
  });
  return response?.result || response;
}

export async function listWorkersRaw(env = {}) {
  const config = getCloudflareEmailRoutingConfig(env);
  if (!config.accountId) {
    throw new Error('缺少 CLOUDFLARE_ACCOUNT_ID');
  }
  const data = await cfRequest(config, `/accounts/${config.accountId}/workers/scripts`);
  return Array.isArray(data?.result) ? data.result : [];
}

async function createRule(config, email) {
  let lastError = null;
  for (const payload of buildRulePayloadCandidates(email, config.workerName)) {
    try {
      const response = await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules`, {
        method: 'POST',
        body: payload,
      });
      return response?.result || response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('创建 Cloudflare 收件规则失败');
}

async function upsertRule(config, email, ruleId, priority = 0) {
  let lastError = null;
  for (const payload of buildRulePayloadCandidates(email, config.workerName, priority)) {
    try {
      const response = await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules/${ruleId}`, {
        method: 'PUT',
        body: payload,
      });
      return response?.result || response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('更新 Cloudflare 收件规则失败');
}

function buildRulePayloadCandidates(email, workerName, priority = 0) {
  const matcher = [
    {
      type: 'literal',
      field: 'to',
      value: email,
    },
  ];
  const base = {
    enabled: true,
    matchers: matcher,
  };

  return [
    { ...base, actions: [{ type: 'worker', value: [workerName] }] },
    { ...base, name: '', actions: [{ type: 'worker', value: [workerName] }] },
    { ...base, name: '', priority, actions: [{ type: 'worker', value: [workerName] }] },
    { ...base, priority, actions: [{ type: 'worker', value: [workerName] }] },
    { ...base, actions: [{ type: 'worker', value: workerName }] },
    { ...base, actions: [{ type: 'worker' }] },
  ];
}

async function findRuleByAddress(config, email) {
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const query = new URLSearchParams({ page: String(page), per_page: '100' });
    const data = await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules?${query.toString()}`);
    const result = Array.isArray(data?.result) ? data.result : [];
    const found = result.find((rule) => ruleMatchesAddress(rule, email));
    if (found) return found;

    const nextTotalPages = Number(data?.result_info?.total_pages || 0);
    if (nextTotalPages > 0) {
      totalPages = nextTotalPages;
    } else if (result.length < 100) {
      break;
    } else {
      totalPages = page + 1;
    }
    page += 1;
  }

  return null;
}

async function getRuleById(config, ruleId) {
  try {
    const data = await cfRequest(config, `/zones/${config.zoneId}/email/routing/rules/${ruleId}`);
    return data?.result || data;
  } catch (error) {
    if (String(error?.message || '').includes('not found')) {
      return null;
    }
    throw error;
  }
}

function ruleMatchesAddress(rule, email) {
  const matchers = Array.isArray(rule?.matchers) ? rule.matchers : [];
  return matchers.some((matcher) => {
    if (String(matcher?.field || '').toLowerCase() !== 'to') return false;
    return normalizeEmail(matcher?.value) === email;
  });
}

function ruleTargetsWorker(rule, workerName) {
  const actions = Array.isArray(rule?.actions) ? rule.actions : [];
  return actions.some((action) => {
    if (String(action?.type || '').toLowerCase() !== 'worker') return false;
    const values = Array.isArray(action?.value) ? action.value : [action?.value];
    return values.map((value) => String(value || '').trim()).includes(workerName);
  });
}

async function cfRequest(config, path, options = {}) {
  const authHeaders = config.apiEmail && config.globalApiKey
    ? {
        'X-Auth-Email': config.apiEmail,
        'X-Auth-Key': config.globalApiKey,
      }
    : {
        Authorization: `Bearer ${config.apiToken}`,
      };
  const init = {
    method: options.method || 'GET',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, init);
  const data = await parseJson(response);
  if (!response.ok || data?.success === false) {
    throw new Error(extractCloudflareError(data, response.status));
  }
  return data;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function extractCloudflareError(data, status) {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const messages = errors
    .map((item) => {
      const code = item?.code ? `#${item.code} ` : '';
      const message = String(item?.message || '').trim();
      const source = item?.source?.pointer ? ` @ ${item.source.pointer}` : '';
      return `${code}${message}${source}`.trim();
    })
    .filter(Boolean);
  if (messages.length) {
    return `Cloudflare API 错误 (${status}): ${messages.join('; ')}`;
  }
  return `Cloudflare API 请求失败 (${status})`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
