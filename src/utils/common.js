/**
 * 通用工具函数模块
 * @module utils/common
 */

import {
	FIRST_NAME_POOL,
	LAST_NAME_POOL,
	SOFT_MISC_SUFFIXES,
	SOFT_YEAR_SUFFIXES,
} from "./mailbox-pools.js";

const PLAUSIBLE_FIRST_NAMES = [
	"alex",
	"anna",
	"ben",
	"carol",
	"chris",
	"daniel",
	"david",
	"emma",
	"eric",
	"eva",
	"grace",
	"hannah",
	"ivy",
	"jack",
	"james",
	"jane",
	"julia",
	"kate",
	"lily",
	"lucas",
	"lucy",
	"maria",
	"mia",
	"noah",
	"olivia",
	"paul",
	"ruby",
	"sam",
	"sarah",
	"zoe",
];

const PLAUSIBLE_LAST_NAMES = [
	"anderson",
	"brown",
	"clark",
	"davis",
	"edwards",
	"evans",
	"garcia",
	"green",
	"hall",
	"harris",
	"hill",
	"jackson",
	"johnson",
	"king",
	"lee",
	"lewis",
	"martin",
	"miller",
	"moore",
	"nelson",
	"parker",
	"roberts",
	"scott",
	"smith",
	"taylor",
	"thomas",
	"walker",
	"white",
	"williams",
	"wright",
];

/**
 * 从邮件地址中提取纯邮箱地址
 * 处理各种格式如 "Name <email@domain.com>" 或 "<email@domain.com>"
 * @param {string} addr - 原始邮件地址字符串
 * @returns {string} 纯邮箱地址
 */
export function extractEmail(addr) {
	const s = String(addr || "").trim();
	const m = s.match(/<([^>]+)>/);
	if (m) return m[1].trim();
	return s.split(/\s/)[0] || s;
}

/**
 * 生成更接近人类习惯的邮箱 local-part。
 *
 * 规则：
 * - 只输出 [a-z0-9._-]
 * - 通过姓名/中性词模式组合，不生成高熵乱码
 * - 保持长度参数兼容（默认 8）
 *
 * @param {number} length - ID长度，默认为8
 * @param {() => number} rng - 随机函数，默认 Math.random（用于可测性）
 * @returns {string} 随机生成的ID字符串
 */
export function generateRandomId(length = 8, rng = Math.random) {
	const desiredLength = Number.isFinite(length)
		? Math.max(1, Math.min(64, Math.floor(length)))
		: 8;

	const first = pickPlausibleName(FIRST_NAME_POOL, rng);
	const last = pickPlausibleName(LAST_NAME_POOL, rng);
	const numericSuffix = pick(getNaturalNumericSuffixes(), rng) || "21";
	const lastInitial = last.slice(0, 1) || "a";
	const seed = buildHumanPatternSeed({
		first,
		last,
		lastInitial,
		numericSuffix,
		desiredLength,
		rng,
	});
	let candidate = seed;

	candidate = sanitizeLocalPart(candidate);
	candidate = fitToLength(candidate, desiredLength, rng);
	candidate = sanitizeLocalPart(candidate);

	if (!candidate) {
		return fitToLength(`${first}${numericSuffix}`, desiredLength, rng);
	}
	return candidate;
}

function buildHumanPatternSeed({
	first,
	last,
	lastInitial,
	numericSuffix,
	desiredLength,
	rng,
}) {
	if (desiredLength <= 4) {
		return first.slice(0, desiredLength);
	}

	if (desiredLength <= 9) {
		const compact = [
			buildFirstPlusDigits(first, numericSuffix, desiredLength),
			buildFirstSepInitial(first, lastInitial, ".", desiredLength),
			buildFirstSepInitial(first, lastInitial, "_", desiredLength),
			buildFirstLastInitial(first, lastInitial, desiredLength),
		];
		return chooseHumanSeed(compact, desiredLength, rng);
	}

	const primary = [
		buildFirstDotLast(first, last, desiredLength),
		buildLastDotFirst(last, first, desiredLength),
		buildFirstPlusDigits(first, numericSuffix, desiredLength),
		buildFirstSepInitial(first, lastInitial, "_", desiredLength),
		buildFirstDotLastDigits(first, last, numericSuffix, desiredLength),
		buildFirstLastInitial(first, lastInitial, desiredLength),
	];

	return chooseHumanSeed(primary, desiredLength, rng);
}

function chooseHumanSeed(patterns, desiredLength, rng) {
	const scored = patterns
		.map((value) => sanitizeLocalPart(value))
		.filter(Boolean)
		.map((value) => {
			const delta = value.length - desiredLength;
			const underPenalty = delta < 0 ? Math.abs(delta) + 14 : Math.abs(delta);
			const qualityScore = scoreHumanLike(value);
			return {
				value,
				score: qualityScore - underPenalty,
			};
		})
		.sort((a, b) => b.score - a.score);

	if (scored.length === 0) return "mail21";
	return scored[0].value;
}

function buildFirstPlusDigits(first, digits, desiredLength) {
	if (desiredLength <= 2) return first.slice(0, desiredLength);
	const firstLen = Math.max(1, desiredLength - 2);
	return `${first.slice(0, firstLen)}${digits}`;
}

function buildFirstSepInitial(first, lastInitial, separator, desiredLength) {
	if (desiredLength <= 2) return first.slice(0, desiredLength);
	const firstLen = Math.max(1, desiredLength - 2);
	return `${first.slice(0, firstLen)}${separator}${lastInitial}`;
}

function buildFirstLastInitial(first, lastInitial, desiredLength) {
	if (desiredLength <= 1) return first.slice(0, desiredLength);
	const firstLen = Math.max(1, desiredLength - 1);
	return `${first.slice(0, firstLen)}${lastInitial}`;
}

function buildFirstDotLast(first, last, desiredLength) {
	if (desiredLength <= 4) {
		return buildFirstSepInitial(first, last.slice(0, 1), ".", desiredLength);
	}
	const firstLen = Math.max(2, Math.min(first.length, desiredLength - 2));
	const lastLen = Math.max(1, desiredLength - firstLen - 1);
	return `${first.slice(0, firstLen)}.${last.slice(0, lastLen)}`;
}

function buildLastDotFirst(last, first, desiredLength) {
	if (desiredLength <= 4) {
		return buildFirstSepInitial(last, first.slice(0, 1), ".", desiredLength);
	}
	const lastLen = Math.max(2, Math.min(last.length, desiredLength - 2));
	const firstLen = Math.max(1, desiredLength - lastLen - 1);
	return `${last.slice(0, lastLen)}.${first.slice(0, firstLen)}`;
}

function buildFirstDotLastDigits(first, last, digits, desiredLength) {
	if (desiredLength <= 6) {
		return buildFirstPlusDigits(first, digits, desiredLength);
	}
	const core = buildFirstDotLast(first, last, desiredLength - 2);
	return `${core}${digits}`;
}

function pickPlausibleName(pool, rng) {
	if (pool === FIRST_NAME_POOL) {
		return pick(PLAUSIBLE_FIRST_NAMES, rng) || "alex";
	}
	if (pool === LAST_NAME_POOL) {
		return pick(PLAUSIBLE_LAST_NAMES, rng) || "smith";
	}
	if (!Array.isArray(pool) || pool.length === 0) return "mail";
	return pick(pool, rng) || "mail";
}

function pick(arr, rng) {
	if (!Array.isArray(arr) || arr.length === 0) return "";
	const idx = Math.min(arr.length - 1, Math.floor(rng() * arr.length));
	return arr[idx];
}

function sanitizeLocalPart(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[^a-z0-9._-]/g, "")
		.replace(/[._-]{2,}/g, ".")
		.replace(/^[._-]+|[._-]+$/g, "")
		.slice(0, 64);
}

function fitToLength(base, desiredLength, rng) {
	if (!base) return "";
	if (base.length === desiredLength) return base;

	if (base.length > desiredLength) {
		return shortenHumanLike(base, desiredLength);
	}

	return extendHumanLike(base, desiredLength, rng);
}

function shortenHumanLike(base, desiredLength) {
	if (desiredLength <= 0) return "";
	if (base.length <= desiredLength) return base;

	const sep = base.includes(".")
		? "."
		: base.includes("_")
			? "_"
			: base.includes("-")
				? "-"
				: "";
	const parts = sep ? base.split(/[._-]/).filter(Boolean) : [base];

	if (parts.length === 2) {
		const [a, b] = parts;
		const options = [
			`${a}${sep}${b}`,
			`${a}${sep}${b.slice(0, 1)}`,
			`${a.slice(0, 1)}${sep}${b}`,
			`${a}${b}`,
			`${a}${b.slice(0, 1)}`,
			`${a.slice(0, 1)}${b}`,
			`${a.slice(0, Math.max(3, desiredLength - 3))}${b.slice(0, 2)}`,
		]
			.map(sanitizeLocalPart)
			.filter(Boolean)
			.filter((v) => v.length <= desiredLength);

		if (options.length > 0) {
			return options.sort((x, y) => scoreHumanLike(y) - scoreHumanLike(x))[0];
		}
	}

	return sanitizeLocalPart(base).slice(0, desiredLength);
}

function extendHumanLike(base, desiredLength, rng) {
	let out = base;
	const numericSuffixes = getNaturalNumericSuffixes();
	const yearSuffixes = SOFT_YEAR_SUFFIXES.map((v) => v.slice(-2)).filter(
		(v) => /^\d{2}$/.test(v) && v !== "00",
	);

	while (out.length < desiredLength) {
		const remaining = desiredLength - out.length;
		const numericCandidates = [...yearSuffixes, ...numericSuffixes].filter(
			(item) => item.length <= remaining,
		);

		if (numericCandidates.length === 0 && remaining <= 0) break;

		const alreadyHasDigits = /\d/.test(out);
		const exactNumeric = numericCandidates.filter(
			(item) => item.length === remaining,
		);

		let suffix = "";
		if (exactNumeric.length > 0 && !alreadyHasDigits) {
			suffix = pick(exactNumeric, rng);
		} else if (!alreadyHasDigits && remaining === 2 && rng() < 0.45) {
			suffix = pick(numericCandidates, rng);
		} else {
			suffix = "a";
		}

		if (!suffix) break;
		out += suffix.slice(0, remaining);
	}

	return sanitizeLocalPart(out).slice(0, desiredLength);
}

function getNaturalNumericSuffixes() {
	return SOFT_MISC_SUFFIXES.filter((v) => /^\d{2}$/.test(v) && v !== "00");
}

function scoreHumanLike(value) {
	let score = 0;
	if (/[._-]/.test(value)) score += 4;
	if (/\d{4,}/.test(value)) score -= 3;
	if (/\d{3,}$/.test(value)) score -= 3;
	if (/^[a-z]+[._-]?[a-z]+$/.test(value)) score += 3;
	if (/^[a-z]+\d{2}$/.test(value)) score += 2;
	return score;
}

/**
 * 验证邮箱地址格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否为有效的邮箱格式
 */
export function isValidEmail(email) {
	if (!email || typeof email !== "string") return false;
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email.trim());
}

/**
 * 计算文本的SHA-256哈希值并返回十六进制字符串
 * @param {string} text - 需要计算哈希的文本内容
 * @returns {Promise<string>} 十六进制格式的SHA-256哈希值
 */
export async function sha256Hex(text) {
	const enc = new TextEncoder();
	const data = enc.encode(String(text || ""));
	const digest = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(digest);
	let out = "";
	for (let i = 0; i < bytes.length; i++) {
		out += bytes[i].toString(16).padStart(2, "0");
	}
	return out;
}

/**
 * 验证原始密码与哈希密码是否匹配
 * @param {string} rawPassword - 原始明文密码
 * @param {string} hashed - 已哈希的密码
 * @returns {Promise<boolean>} 验证结果，true表示密码匹配
 */
export async function verifyPassword(rawPassword, hashed) {
	if (!hashed) return false;
	try {
		const hex = (await sha256Hex(rawPassword)).toLowerCase();
		return hex === String(hashed || "").toLowerCase();
	} catch (_) {
		return false;
	}
}
