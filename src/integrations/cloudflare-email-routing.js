/**
 * Cloudflare Email Routing 集成
 * 为子域名场景自动创建“指定地址 -> Worker”规则。
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

const DEFAULT_MAIL_DOMAIN = "temp.example.com";

export function resolveMailDomainConfigs(env = {}) {
	const rawMap = String(
		env.MAIL_DOMAIN_ZONE_MAP || env.CLOUDFLARE_ZONE_MAP || "",
	).trim();
	const domainMap = parseDomainZoneMap(rawMap);

	let domains = parseDomainList(env.MAIL_DOMAIN);
	if (!domains.length) domains = Object.keys(domainMap);
	if (!domains.length) domains = [DEFAULT_MAIL_DOMAIN];

	return domains.map((domain) => ({
		domain,
		routing: domainMap[domain] || null,
	}));
}

const workerIdCache = new Map();

export function getCloudflareEmailRoutingConfig(env = {}) {
	const apiToken = String(
		env.CLOUDFLARE_EMAIL_ROUTING_API_TOKEN ||
			env.CLOUDFLARE_API_TOKEN ||
			env.CF_API_TOKEN ||
			"",
	).trim();
	const apiEmail = String(
		env.CLOUDFLARE_API_EMAIL || env.CF_EMAIL || "",
	).trim();
	const globalApiKey = String(
		env.CLOUDFLARE_GLOBAL_API_KEY ||
			env.CLOUDFLARE_API_KEY ||
			env.CF_API_KEY ||
			"",
	).trim();
	const zoneId = String(env.CLOUDFLARE_ZONE_ID || env.CF_ZONE_ID || "").trim();
	const accountId = String(
		env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID || "",
	).trim();
	const workerName = String(
		env.CLOUDFLARE_EMAIL_ROUTING_WORKER ||
			env.CF_EMAIL_ROUTING_WORKER ||
			env.CLOUDFLARE_WORKER_NAME ||
			"",
	).trim();
	const workerId = String(
		env.CLOUDFLARE_EMAIL_ROUTING_WORKER_ID ||
			env.CF_EMAIL_ROUTING_WORKER_ID ||
			"",
	).trim();
	const hasTokenAuth = Boolean(apiToken);
	const hasGlobalKeyAuth = Boolean(apiEmail && globalApiKey);
	const configured = Boolean(
		(hasTokenAuth || hasGlobalKeyAuth) && zoneId && workerName,
	);

	return {
		configured,
		apiToken,
		apiEmail,
		globalApiKey,
		zoneId,
		accountId,
		workerName,
		workerId,
		missing: [
			!(hasTokenAuth || hasGlobalKeyAuth)
				? "CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_API_EMAIL + CLOUDFLARE_GLOBAL_API_KEY"
				: "",
			!zoneId ? "CLOUDFLARE_ZONE_ID" : "",
			!workerName ? "CLOUDFLARE_EMAIL_ROUTING_WORKER" : "",
		].filter(Boolean),
	};
}

export function getCloudflareEmailRoutingConfigForDomain(
	domain,
	env = {},
	domainConfig = null,
) {
	const normalizedDomain = normalizeDomain(domain);
	const resolvedDomainConfig =
		domainConfig || findDomainConfig(normalizedDomain, env);
	if (!resolvedDomainConfig?.routing) {
		return getCloudflareEmailRoutingConfig(env);
	}

	const override = resolvedDomainConfig.routing;
	const mergedEnv = {
		...env,
		CLOUDFLARE_ZONE_ID: override.zoneId || env.CLOUDFLARE_ZONE_ID,
		CLOUDFLARE_EMAIL_ROUTING_WORKER:
			override.workerName || env.CLOUDFLARE_EMAIL_ROUTING_WORKER,
		CLOUDFLARE_EMAIL_ROUTING_API_TOKEN:
			override.apiToken || env.CLOUDFLARE_EMAIL_ROUTING_API_TOKEN,
		CLOUDFLARE_API_TOKEN: override.apiToken || env.CLOUDFLARE_API_TOKEN,
		CLOUDFLARE_API_EMAIL: override.apiEmail || env.CLOUDFLARE_API_EMAIL,
		CLOUDFLARE_GLOBAL_API_KEY:
			override.globalApiKey || env.CLOUDFLARE_GLOBAL_API_KEY,
		CLOUDFLARE_ACCOUNT_ID: override.accountId || env.CLOUDFLARE_ACCOUNT_ID,
	};

	return getCloudflareEmailRoutingConfig(mergedEnv);
}

export async function ensureWorkerRouteForMailbox(
	email,
	env = {},
	domainConfig = null,
) {
	const normalized = normalizeEmail(email);
	if (!normalized) throw new Error("无效的邮箱地址");

	const domain = extractDomainFromEmail(normalized);
	const config = getCloudflareEmailRoutingConfigForDomain(
		domain,
		env,
		domainConfig,
	);
	if (!config.configured) {
		return {
			enabled: false,
			status: "disabled",
			ruleId: "",
			message: `Cloudflare 自动路由未启用（域名 ${domain || "unknown"}），缺少配置：${config.missing.join(", ")}`,
		};
	}

	const existingRule = await findRuleByAddress(config, normalized);
	if (existingRule) {
		if (!ruleTargetsWorker(existingRule, config.workerName)) {
			throw new Error(
				`Cloudflare 中已存在 ${normalized} 的其他路由规则，请先调整该规则后再创建邮箱`,
			);
		}

		if (existingRule.enabled === false) {
			const updated = await upsertRule(
				config,
				normalized,
				existingRule.id,
				existingRule.priority ?? 0,
			);
			return {
				enabled: true,
				status: "updated",
				created: false,
				ruleId: updated?.id || existingRule.id || "",
				message: "已自动恢复 Cloudflare 收件规则",
			};
		}

		return {
			enabled: true,
			status: "existing",
			created: false,
			ruleId: existingRule.id || "",
			message: "Cloudflare 收件规则已存在",
		};
	}

	const created = await createRule(config, normalized);
	return {
		enabled: true,
		status: "created",
		created: true,
		ruleId: created?.id || "",
		message: "已自动创建 Cloudflare 收件规则",
	};
}

export async function deleteWorkerRouteForMailbox(
	email,
	env = {},
	knownRuleId = "",
	domainConfig = null,
) {
	const normalized = normalizeEmail(email);
	if (!normalized) return { enabled: true, status: "invalid", deleted: false };

	const domain = extractDomainFromEmail(normalized);
	const config = getCloudflareEmailRoutingConfigForDomain(
		domain,
		env,
		domainConfig,
	);
	if (!config.configured) {
		return {
			enabled: false,
			status: "disabled",
			deleted: false,
			message: "Cloudflare 自动路由未启用",
		};
	}

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
			status: "not_found",
			deleted: false,
			message: "Cloudflare 中未找到对应规则",
		};
	}

	if (!ruleTargetsWorker(rule, config.workerName)) {
		return {
			enabled: true,
			status: "foreign_rule",
			deleted: false,
			message: "检测到同地址规则但并非当前 Worker，未自动删除",
		};
	}

	await cfRequest(
		config,
		`/zones/${config.zoneId}/email/routing/rules/${rule.id}`,
		{
			method: "DELETE",
		},
	);

	return {
		enabled: true,
		status: "deleted",
		deleted: true,
		ruleId: rule.id || "",
		message: "已删除 Cloudflare 收件规则",
	};
}

export async function listRoutingRules(env = {}) {
	const config = getCloudflareEmailRoutingConfig(env);
	if (!config.configured) {
		return [];
	}

	const query = new URLSearchParams({ page: "1", per_page: "100" });
	const data = await cfRequest(
		config,
		`/zones/${config.zoneId}/email/routing/rules?${query.toString()}`,
	);
	return Array.isArray(data?.result) ? data.result : [];
}

export async function createRoutingRuleRaw(env = {}, payload) {
	const config = getCloudflareEmailRoutingConfig(env);
	if (!config.configured) {
		throw new Error(
			`Cloudflare 自动路由未启用，缺少配置：${config.missing.join(", ")}`,
		);
	}
	const response = await cfRequest(
		config,
		`/zones/${config.zoneId}/email/routing/rules`,
		{
			method: "POST",
			body: payload,
		},
	);
	return response?.result || response;
}

export async function updateRoutingRuleRaw(env = {}, ruleId, payload) {
	const config = getCloudflareEmailRoutingConfig(env);
	if (!config.configured) {
		throw new Error(
			`Cloudflare 自动路由未启用，缺少配置：${config.missing.join(", ")}`,
		);
	}
	const response = await cfRequest(
		config,
		`/zones/${config.zoneId}/email/routing/rules/${ruleId}`,
		{
			method: "PUT",
			body: payload,
		},
	);
	return response?.result || response;
}

export async function listWorkersRaw(env = {}) {
	const config = getCloudflareEmailRoutingConfig(env);
	if (!config.accountId) {
		throw new Error("缺少 CLOUDFLARE_ACCOUNT_ID");
	}
	const data = await cfRequest(
		config,
		`/accounts/${config.accountId}/workers/scripts`,
	);
	return Array.isArray(data?.result) ? data.result : [];
}

async function resolveWorkerId(config) {
	if (config.workerId) return config.workerId;
	if (!config.accountId || !config.workerName) {
		return "";
	}
	const cacheKey = `${config.accountId}:${config.workerName}`;
	if (workerIdCache.has(cacheKey)) return workerIdCache.get(cacheKey);
	try {
		const workers = await cfRequest(
			config,
			`/accounts/${config.accountId}/workers/scripts`,
		);
		const list = Array.isArray(workers?.result) ? workers.result : [];
		const matched = list.find((item) => String(item?.id || item?.name || item?.script || "").trim() === config.workerName || String(item?.name || "").trim() === config.workerName);
		const workerId = String(matched?.id || matched?.script || matched?.name || "").trim();
		if (workerId) {
			workerIdCache.set(cacheKey, workerId);
			return workerId;
		}
	} catch (_) {
		// Optional fallback path only; worker-name routing is still valid for current zone API contract.
	}
	return "";
}

async function createRule(config, email) {
	const workerId = await resolveWorkerId(config);
	let lastError = null;
	for (const payload of buildRulePayloadCandidates(email, config.workerName, workerId, 0)) {
		try {
			const response = await cfRequest(
				config,
				`/zones/${config.zoneId}/email/routing/rules`,
				{
					method: "POST",
					body: payload,
				},
			);
			return response?.result || response;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError || new Error("创建 Cloudflare 收件规则失败");
}

async function upsertRule(config, email, ruleId, priority = 0) {
	const workerId = await resolveWorkerId(config);
	let lastError = null;
	for (const payload of buildRulePayloadCandidates(
		email,
		config.workerName,
		workerId,
		priority,
	)) {
		try {
			const response = await cfRequest(
				config,
				`/zones/${config.zoneId}/email/routing/rules/${ruleId}`,
				{
					method: "PUT",
					body: payload,
				},
			);
			return response?.result || response;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError || new Error("更新 Cloudflare 收件规则失败");
}

function buildRulePayloadCandidates(email, workerName, workerId = "", priority = 0) {
	const matcher = [
		{
			type: "literal",
			field: "to",
			value: email,
		},
	];
	const base = {
		enabled: true,
		matchers: matcher,
	};

	const payloads = [
		{ ...base, actions: [{ type: "worker", value: [workerName] }] },
		{ ...base, name: "", actions: [{ type: "worker", value: [workerName] }] },
		{
			...base,
			name: "",
			priority,
			actions: [{ type: "worker", value: [workerName] }],
		},
		{ ...base, priority, actions: [{ type: "worker", value: [workerName] }] },
		{ ...base, actions: [{ type: "worker", value: workerName }] },
	];
	if (workerId) {
		payloads.push(
			{ ...base, actions: [{ type: "worker", value: [workerId] }] },
			{ ...base, actions: [{ type: "worker", value: workerId }] },
			{ ...base, actions: [{ type: "worker", worker: { id: workerId } }] },
		);
	}
	return payloads;
}

async function findRuleByAddress(config, email) {
	let page = 1;
	let totalPages = 1;

	while (page <= totalPages) {
		const query = new URLSearchParams({ page: String(page), per_page: "100" });
		const data = await cfRequest(
			config,
			`/zones/${config.zoneId}/email/routing/rules?${query.toString()}`,
		);
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
		const data = await cfRequest(
			config,
			`/zones/${config.zoneId}/email/routing/rules/${ruleId}`,
		);
		return data?.result || data;
	} catch (error) {
		if (String(error?.message || "").includes("not found")) {
			return null;
		}
		throw error;
	}
}

function ruleMatchesAddress(rule, email) {
	const matchers = Array.isArray(rule?.matchers) ? rule.matchers : [];
	return matchers.some((matcher) => {
		if (String(matcher?.field || "").toLowerCase() !== "to") return false;
		return normalizeEmail(matcher?.value) === email;
	});
}

function ruleTargetsWorker(rule, workerNameOrId) {
	const actions = Array.isArray(rule?.actions) ? rule.actions : [];
	return actions.some((action) => {
		if (String(action?.type || "").toLowerCase() !== "worker") return false;
		const values = Array.isArray(action?.value)
			? action.value
			: [action?.value, action?.worker?.id, action?.worker?.name];
		return values
			.map((value) => String(value || "").trim())
			.includes(workerNameOrId);
	});
}

async function cfRequest(config, path, options = {}) {
	const authHeaders =
		config.apiEmail && config.globalApiKey
			? {
					"X-Auth-Email": config.apiEmail,
					"X-Auth-Key": config.globalApiKey,
				}
			: {
					Authorization: `Bearer ${config.apiToken}`,
				};
	const init = {
		method: options.method || "GET",
		headers: {
			...authHeaders,
			"Content-Type": "application/json",
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
			const code = item?.code ? `#${item.code} ` : "";
			const message = String(item?.message || "").trim();
			const source = item?.source?.pointer ? ` @ ${item.source.pointer}` : "";
			return `${code}${message}${source}`.trim();
		})
		.filter(Boolean);
	if (messages.length) {
		return `Cloudflare API 错误 (${status}): ${messages.join("; ")}`;
	}
	return `Cloudflare API 请求失败 (${status})`;
}

function normalizeEmail(email) {
	return String(email || "")
		.trim()
		.toLowerCase();
}

function parseDomainList(rawDomains) {
	const input = String(rawDomains || "").trim();
	if (!input) return [];
	return Array.from(
		new Set(
			input
				.split(/[\s,]+/)
				.map((domain) => normalizeDomain(domain))
				.filter(Boolean),
		),
	);
}

function parseDomainZoneMap(rawMap) {
	if (!rawMap) return {};
	let parsed = null;
	try {
		parsed = JSON.parse(rawMap);
	} catch (_) {
		return {};
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {};
	}

	const output = {};
	for (const [rawDomain, rawEntry] of Object.entries(parsed)) {
		const domain = normalizeDomain(rawDomain);
		if (!domain) continue;
		const routing = normalizeDomainRoutingEntry(rawEntry);
		if (!routing?.zoneId) continue;
		output[domain] = routing;
	}

	return output;
}

function normalizeDomainRoutingEntry(rawEntry) {
	if (!rawEntry) return null;
	if (typeof rawEntry === "string") {
		const zoneId = String(rawEntry).trim();
		return zoneId ? { zoneId } : null;
	}
	if (typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
		return null;
	}

	const zoneId = pickString(rawEntry, [
		"zoneId",
		"zone_id",
		"CLOUDFLARE_ZONE_ID",
	]);
	if (!zoneId) return null;

	return {
		zoneId,
		apiToken: pickString(rawEntry, [
			"apiToken",
			"api_token",
			"CLOUDFLARE_API_TOKEN",
		]),
		apiEmail: pickString(rawEntry, [
			"apiEmail",
			"api_email",
			"CLOUDFLARE_API_EMAIL",
		]),
		globalApiKey: pickString(rawEntry, [
			"globalApiKey",
			"global_api_key",
			"CLOUDFLARE_GLOBAL_API_KEY",
		]),
		workerName: pickString(rawEntry, [
			"workerName",
			"worker_name",
			"CLOUDFLARE_EMAIL_ROUTING_WORKER",
		]),
		accountId: pickString(rawEntry, [
			"accountId",
			"account_id",
			"CLOUDFLARE_ACCOUNT_ID",
		]),
		workerId: pickString(rawEntry, [
			"workerId",
			"worker_id",
			"CLOUDFLARE_EMAIL_ROUTING_WORKER_ID",
		]),
	};
}

function findDomainConfig(domain, env = {}) {
	if (!domain) return null;
	const normalizedDomain = normalizeDomain(domain);
	if (!normalizedDomain) return null;

	const configs = resolveMailDomainConfigs(env);
	return configs.find((item) => item.domain === normalizedDomain) || null;
}

function extractDomainFromEmail(email) {
	const normalized = normalizeEmail(email);
	const at = normalized.lastIndexOf("@");
	if (at <= 0 || at >= normalized.length - 1) return "";
	return normalizeDomain(normalized.slice(at + 1));
}

function normalizeDomain(domain) {
	return String(domain || "")
		.trim()
		.toLowerCase();
}

function pickString(source, keys = []) {
	for (const key of keys) {
		const value = String(source?.[key] || "").trim();
		if (value) return value;
	}
	return "";
}
