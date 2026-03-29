/**
 * 邮箱用户专用页面
 * @module mailbox
 */

import {
	extractVerificationCode,
	renderEmailDetail,
	sanitizeHtml,
} from "./modules/mailbox/email-detail.js";
import {
	countUnread,
	filterEmails,
	formatTime,
	generateSkeletonList,
	renderEmailItem,
	renderEmailList,
} from "./modules/mailbox/email-list.js";

// showToast 由 toast-utils.js 全局提供
const showToast =
	window.showToast || ((msg, type) => console.log(`[${type}] ${msg}`));

// 状态
let currentUser = null,
	currentMailbox = null,
	emails = [],
	currentPage = 1;
const pageSize = 20;
let autoRefreshTimer = null,
	keyword = "";

// DOM 元素
const els = {
	roleBadge: document.getElementById("role-badge"),
	toast: document.getElementById("toast"),
	currentMailbox: document.getElementById("current-mailbox"),
	copyMailboxBtn: document.getElementById("copy-mailbox"),
	refreshEmailsBtn: document.getElementById("refresh-emails"),
	emailList: document.getElementById("email-list"),
	emptyState: document.getElementById("empty-state"),
	listLoading: document.getElementById("list-loading"),
	listPager: document.getElementById("list-pager"),
	prevPageBtn: document.getElementById("prev-page"),
	nextPageBtn: document.getElementById("next-page"),
	pageInfo: document.getElementById("page-info"),
	emailModal: document.getElementById("email-modal"),
	modalSubject: document.getElementById("modal-subject"),
	modalContent: document.getElementById("modal-content"),
	modalCloseBtn: document.getElementById("modal-close"),
	confirmModal: document.getElementById("confirm-modal"),
	confirmMessage: document.getElementById("confirm-message"),
	confirmOkBtn: document.getElementById("confirm-ok"),
	confirmCancelBtn: document.getElementById("confirm-cancel"),
	confirmCloseBtn: document.getElementById("confirm-close"),
	passwordModal: document.getElementById("password-modal"),
	passwordForm: document.getElementById("password-form"),
	currentPasswordInput: document.getElementById("current-password"),
	newPasswordInput: document.getElementById("new-password"),
	confirmPasswordInput: document.getElementById("confirm-password"),
	passwordClose: document.getElementById("password-close"),
	passwordCancel: document.getElementById("password-cancel"),
	passwordSubmit: document.getElementById("password-submit"),
	changePasswordBtn: document.getElementById("change-password"),
	logoutBtn: document.getElementById("logout"),
	autoRefresh: document.getElementById("auto-refresh"),
	refreshInterval: document.getElementById("refresh-interval"),
	searchBox: document.getElementById("search-box"),
	clearFilter: document.getElementById("clear-filter"),
	unreadCount: document.getElementById("unread-count"),
	totalCount: document.getElementById("total-count"),
};

// 动态导入 mock API（用于 guest 模式）
let mockApiModule = null;
async function getMockApi() {
	if (!mockApiModule) {
		mockApiModule = await import("./modules/app/mock-api.js");
	}
	return mockApiModule.mockApi;
}

// API 请求
async function api(path, options = {}) {
	// Guest 模式使用 mock API
	if (window.__GUEST_MODE__) {
		const mockApi = await getMockApi();
		return mockApi(path, options);
	}
	const r = await fetch(path, {
		...options,
		headers: { "Cache-Control": "no-cache", ...options.headers },
	});
	if (r.status === 401) {
		redirectToLogin("Vui lòng đăng nhập trước");
		throw new Error("unauthorized");
	}
	return r;
}

function redirectToLogin(msg) {
	if (msg) sessionStorage.setItem("mf:login-message", msg);
	location.replace("/html/login.html");
}

// 初始化认证
async function initAuth() {
	try {
		const r = await fetch("/api/session");
		const data = await r.json();
		if (!data.authenticated) {
			redirectToLogin("Vui lòng đăng nhập trước");
			return;
		}
		if (data.role !== "mailbox") {
			redirectToLogin("Chỉ người dùng hộp thư mới có thể truy cập trang này");
			return;
		}

		currentUser = data;
		currentMailbox = data.mailboxAddress;

		if (els.roleBadge) els.roleBadge.textContent = `Hộp thư: ${currentMailbox}`;
		if (els.currentMailbox) els.currentMailbox.textContent = currentMailbox;

		await loadEmails();
		startAutoRefresh();
	} catch (e) {
		console.error("Xác thực thất bại:", e);
		redirectToLogin("Xác thực thất bại");
	}
}

// 加载邮件列表
async function loadEmails() {
	if (els.listLoading) els.listLoading.style.display = "flex";
	if (els.emailList) els.emailList.innerHTML = generateSkeletonList(5);

	try {
		const r = await api(
			`/api/emails?mailbox=${encodeURIComponent(currentMailbox)}`,
		);
		emails = await r.json();
		if (!Array.isArray(emails)) emails = [];

		renderEmails();
		updateCounts();
	} catch (e) {
		console.error("Tải email thất bại:", e);
		showToast("Tải thất bại", "error");
	} finally {
		if (els.listLoading) els.listLoading.style.display = "none";
	}
}

// 渲染邮件列表
function renderEmails() {
	const filtered = filterEmails(emails, keyword);
	const total = filtered.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	if (currentPage > totalPages) currentPage = totalPages;

	const start = (currentPage - 1) * pageSize;
	const pageItems = filtered.slice(start, start + pageSize);

	if (!pageItems.length) {
		els.emailList.innerHTML = "";
		if (els.emptyState) els.emptyState.style.display = "block";
		if (els.listPager) els.listPager.style.display = "none";
	} else {
		renderEmailList(pageItems, els.emailList);
		if (els.emptyState) els.emptyState.style.display = "none";

		// 绑定点击事件
		els.emailList.querySelectorAll(".email-item").forEach((item) => {
			item.onclick = () => showEmail(item.dataset.emailId);
		});

		// 分页
		if (els.listPager)
			els.listPager.style.display = total > pageSize ? "flex" : "none";
		if (els.pageInfo)
			els.pageInfo.textContent = `${currentPage} / ${totalPages}`;
		if (els.prevPageBtn) els.prevPageBtn.disabled = currentPage <= 1;
		if (els.nextPageBtn) els.nextPageBtn.disabled = currentPage >= totalPages;
	}
}

// 更新计数
function updateCounts() {
	if (els.totalCount) els.totalCount.textContent = emails.length;
	if (els.unreadCount) els.unreadCount.textContent = countUnread(emails);
}

// 显示邮件详情
async function showEmail(id) {
	try {
		const r = await api(`/api/email/${id}`);
		const email = await r.json();

		if (els.modalSubject)
			els.modalSubject.textContent = email.subject || "(Không có tiêu đề)";
		if (els.modalContent) els.modalContent.innerHTML = renderEmailDetail(email);

		// 绑定验证码复制
		els.modalContent?.querySelectorAll(".code-value").forEach((el) => {
			el.onclick = async () => {
				const code = el.dataset.code || el.textContent;
				try {
					await navigator.clipboard.writeText(code);
					showToast("Đã sao chép", "success");
				} catch (_) {
					showToast("Sao chép thất bại", "error");
				}
			};
		});

		els.emailModal?.classList.add("show");

		// 标记已读
		if (!email.is_read) {
			try {
				await api(`/api/email/${id}/read`, { method: "POST" });
				loadEmails();
			} catch (_) {}
		}
	} catch (e) {
		showToast("Tải email thất bại", "error");
	}
}

// 自动刷新
function startAutoRefresh() {
	stopAutoRefresh();
	const interval = parseInt(els.refreshInterval?.value || "15", 10) * 1000;
	if (els.autoRefresh?.checked) {
		autoRefreshTimer = setInterval(loadEmails, interval);
	}
}

function stopAutoRefresh() {
	if (autoRefreshTimer) {
		clearInterval(autoRefreshTimer);
		autoRefreshTimer = null;
	}
}

// 对话框状态
let dialogResolver = null;
let dialogMode = null; // 'confirm' | 'alert'

// 初始化对话框事件（只绑定一次）
function initDialogEvents() {
	if (els._dialogInitialized) return;
	els._dialogInitialized = true;

	const closeDialog = (result) => {
		els.confirmModal?.classList.remove("show");
		if (els.confirmCancelBtn) els.confirmCancelBtn.style.display = "";
		if (dialogResolver) {
			dialogResolver(result);
			dialogResolver = null;
		}
	};

	els.confirmOkBtn?.addEventListener("click", () => closeDialog(true));
	els.confirmCancelBtn?.addEventListener("click", () => closeDialog(false));
	els.confirmCloseBtn?.addEventListener("click", () => closeDialog(false));
}

// 确认对话框
function showConfirm(message) {
	initDialogEvents();
	return new Promise((resolve) => {
		dialogResolver = resolve;
		dialogMode = "confirm";
		if (els.confirmMessage) els.confirmMessage.textContent = message;
		if (els.confirmCancelBtn) els.confirmCancelBtn.style.display = "";
		els.confirmModal?.classList.add("show");
	});
}

// 提示对话框（只有确定按钮，需要手动关闭）
function showAlert(message) {
	initDialogEvents();
	return new Promise((resolve) => {
		dialogResolver = resolve;
		dialogMode = "alert";
		if (els.confirmMessage) els.confirmMessage.textContent = message;
		if (els.confirmCancelBtn) els.confirmCancelBtn.style.display = "none";
		els.confirmModal?.classList.add("show");
	});
}

// 删除邮件
async function deleteEmail(id) {
	if (!(await showConfirm("Bạn có chắc muốn xóa email này?"))) return;
	try {
		await api(`/api/email/${id}`, { method: "DELETE" });
		showToast("Đã xóa", "success");
		els.emailModal?.classList.remove("show");
		loadEmails();
	} catch (e) {
		showToast("Xóa thất bại", "error");
	}
}

// 修改密码
async function changePassword() {
	const current = els.currentPasswordInput?.value;
	const newPass = els.newPasswordInput?.value;
	const confirmPass = els.confirmPasswordInput?.value;

	if (!current || !newPass) {
		await showAlert("Vui lòng điền đầy đủ");
		return;
	}
	if (newPass !== confirmPass) {
		await showAlert("Hai lần nhập mật khẩu không khớp");
		return;
	}
	if (newPass.length < 6) {
		await showAlert("Mật khẩu phải có ít nhất 6 ký tự");
		return;
	}

	// 二级确认
	const confirmed = await showConfirm(
		"Sau khi đổi mật khẩu bạn cần đăng nhập lại, có chắc muốn đổi không?",
	);
	if (!confirmed) return;

	try {
		// 直接使用 fetch 而不是 api 函数，避免 401 时自动跳转
		const r = await fetch("/api/mailbox/password", {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
			},
			body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
		});

		if (r.ok) {
			els.passwordModal?.classList.remove("show");
			els.currentPasswordInput.value = "";
			els.newPasswordInput.value = "";
			els.confirmPasswordInput.value = "";

			// 密码修改成功，强制退出登录
			showToast("Đổi mật khẩu thành công, sắp đăng nhập lại...", "success");
			stopAutoRefresh();

			// 清除会话
			try {
				await fetch("/api/logout", { method: "POST" });
			} catch (_) {}

			// 延迟跳转让用户看到提示
			setTimeout(() => {
				sessionStorage.setItem(
					"mf:login-message",
					"Mật khẩu đã được đổi, vui lòng dùng mật khẩu mới để đăng nhập",
				);
				location.replace("/html/login.html");
			}, 1500);
		} else {
			// 显示具体的错误信息（使用模态框，需要手动关闭）
			const errorText = await r.text();
			const errorMsg = errorText || "Thay đổi thất bại";
			console.error("Đổi mật khẩu thất bại:", r.status, errorMsg);

			// 显示错误提示框，等待用户确认
			await showAlert(errorMsg);

			// 如果是原Sai mật khẩu，聚焦到原密码输入框
			if (errorMsg.includes("Sai mật khẩu")) {
				els.currentPasswordInput?.focus();
				els.currentPasswordInput?.select();
			}
		}
	} catch (e) {
		console.error("Yêu cầu đổi mật khẩu thất bại:", e);
		await showAlert("Lỗi mạng, vui lòng thử lại");
	}
}

// 事件绑定
els.copyMailboxBtn?.addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(currentMailbox);
		showToast("Đã sao chép", "success");
	} catch (_) {
		showToast("Sao chép thất bại", "error");
	}
});

els.refreshEmailsBtn?.addEventListener("click", async () => {
	const icon = els.refreshEmailsBtn.querySelector(".btn-icon");
	if (icon) icon.classList.add("spinning");
	els.refreshEmailsBtn.disabled = true;
	try {
		await loadEmails();
		showToast("Làm mới thành công", "success");
	} finally {
		if (icon) icon.classList.remove("spinning");
		els.refreshEmailsBtn.disabled = false;
	}
});
els.prevPageBtn?.addEventListener("click", () => {
	if (currentPage > 1) {
		currentPage--;
		renderEmails();
	}
});
els.nextPageBtn?.addEventListener("click", () => {
	const totalPages = Math.ceil(filterEmails(emails, keyword).length / pageSize);
	if (currentPage < totalPages) {
		currentPage++;
		renderEmails();
	}
});

els.modalCloseBtn?.addEventListener("click", () =>
	els.emailModal?.classList.remove("show"),
);
els.emailModal?.addEventListener("click", (e) => {
	if (e.target === els.emailModal) els.emailModal.classList.remove("show");
});

els.autoRefresh?.addEventListener("change", startAutoRefresh);
els.refreshInterval?.addEventListener("change", startAutoRefresh);

els.searchBox?.addEventListener("input", () => {
	keyword = els.searchBox.value;
	currentPage = 1;
	renderEmails();
});
els.clearFilter?.addEventListener("click", () => {
	keyword = "";
	if (els.searchBox) els.searchBox.value = "";
	currentPage = 1;
	renderEmails();
});

els.changePasswordBtn?.addEventListener("click", () => {
	els.passwordModal?.classList.add("show");
	els.currentPasswordInput?.focus();
});
els.passwordClose?.addEventListener("click", () =>
	els.passwordModal?.classList.remove("show"),
);
els.passwordCancel?.addEventListener("click", () =>
	els.passwordModal?.classList.remove("show"),
);

// 阻止表单默认提交行为
els.passwordForm?.addEventListener("submit", (e) => {
	e.preventDefault();
	changePassword();
});
els.passwordSubmit?.addEventListener("click", (e) => {
	e.preventDefault();
	changePassword();
});

// 点击背景关闭（但确认框显示时不关闭）
els.passwordModal?.addEventListener("click", (e) => {
	if (
		e.target === els.passwordModal &&
		!els.confirmModal?.classList.contains("show")
	) {
		els.passwordModal.classList.remove("show");
	}
});

els.logoutBtn?.addEventListener("click", async () => {
	try {
		await api("/api/logout", { method: "POST" });
	} catch (_) {}
	stopAutoRefresh();
	location.replace("/html/login.html");
});

// 全局函数
window.deleteEmail = deleteEmail;

// 初始化
document.addEventListener("DOMContentLoaded", initAuth);
