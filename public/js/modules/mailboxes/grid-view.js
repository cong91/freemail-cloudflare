/**
 * 邮箱网格视图模块
 * @module modules/mailboxes/grid-view
 */

import { escapeAttr, escapeHtml } from "../app/ui-helpers.js";

/**
 * 格式化时间戳
 * @param {string} ts - 时间戳
 * @returns {string}
 */
export function formatTime(ts) {
	if (!ts) return "";
	try {
		const d = new Date(String(ts).replace(" ", "T") + "Z");
		return new Intl.DateTimeFormat("zh-CN", {
			timeZone: "Asia/Shanghai",
			hour12: false,
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}).format(d);
	} catch (_) {
		return "";
	}
}

/**
 * 生成骨架屏卡片
 * @returns {string}
 */
export function createSkeletonCard() {
	return `
    <div class="skeleton-card">
      <div class="skeleton-line title"></div>
      <div class="skeleton-line subtitle"></div>
      <div class="skeleton-line text"></div>
      <div class="skeleton-line time"></div>
    </div>
  `;
}

/**
 * 生成骨架屏内容
 * @param {number} count - 数量
 * @returns {string}
 */
export function generateSkeletonContent(count = 8) {
	return Array(count)
		.fill(null)
		.map(() => createSkeletonCard())
		.join("");
}

/**
 * 渲染邮箱卡片
 * @param {object} mailbox - 邮箱数据
 * @param {object} options - 选项
 * @returns {string}
 */
export function renderMailboxCard(mailbox, options = {}) {
	const {
		onCopy,
		onJump,
		onTogglePin,
		onDelete,
		onToggleFavorite,
		onSetForward,
		onToggleLogin,
		onChangePassword,
	} = options;

	const address = mailbox.address || "";
	const createdAt = formatTime(mailbox.created_at);
	const isPinned = mailbox.is_pinned ? 1 : 0;
	const isFavorite = mailbox.is_favorite ? 1 : 0;
	const canLogin = mailbox.can_login ? 1 : 0;
	const forwardTo = mailbox.forward_to || "";
	const passwordIsDefault = mailbox.password_is_default ? 1 : 0;

	const escapedAddress = escapeAttr(address);
	const displayAddress = escapeHtml(address);

	return `
    <div class="mailbox-card ${isPinned ? "pinned" : ""}" data-address="${escapedAddress}">
      <div class="card-header">
        <div class="pin-status" title="${isPinned ? "Đã ghim" : "Chưa ghim"}">
          ${isPinned ? "📌" : ""}
        </div>
        <div class="favorite-status ${isFavorite ? "active" : ""}" title="${isFavorite ? "Đã đánh dấu" : "Chưa đánh dấu"}">
          ${isFavorite ? "⭐" : "☆"}
        </div>
      </div>
      
      <div class="card-body">
        <div class="mailbox-address" title="${escapedAddress}">${displayAddress}</div>
        <div class="mailbox-meta">
          <span class="created-time">${createdAt}</span>
          ${forwardTo ? `<span class="forward-indicator" title="Chuyển tiếp tới: ${escapeAttr(forwardTo)}">📤</span>` : ""}
          ${canLogin ? '<span class="login-indicator" title="Có thể đăng nhập">🔑</span>' : ""}
        </div>
      </div>
      
      <div class="card-actions">
        <button class="btn btn-sm btn-copy" data-action="copy" title="Sao chép địa chỉ">📋</button>
        <button class="btn btn-sm btn-jump" data-action="jump" title="Xem thư">📧</button>
        <button class="btn btn-sm btn-pin ${isPinned ? "active" : ""}" data-action="pin" title="${isPinned ? "Bỏ ghim" : "Ghim"}">📍</button>
        <button class="btn btn-sm btn-favorite ${isFavorite ? "active" : ""}" data-action="favorite" title="${isFavorite ? "Bỏ đánh dấu" : "Đánh dấu"}">⭐</button>
        <button class="btn btn-sm btn-more" data-action="more" title="Thêm thao tác">⋯</button>
      </div>
      
      <div class="card-dropdown" style="display: none;">
        <button class="dropdown-item" data-action="forward">📤 Thiết lập chuyển tiếp</button>
        <button class="dropdown-item" data-action="toggle-login">🔑 ${canLogin ? "Cấm đăng nhập" : "Cho phép đăng nhập"}</button>
        <button class="dropdown-item" data-action="change-password">🔒 ${passwordIsDefault ? "Đặt mật khẩu" : "Đổi mật khẩu"}</button>
        <button class="dropdown-item danger" data-action="delete">🗑️ Xóa hộp thư</button>
      </div>
    </div>
  `;
}

/**
 * 渲染网格视图
 * @param {Array} mailboxes - 邮箱列表
 * @param {HTMLElement} container - 容器元素
 * @param {object} options - 选项
 */
export function renderGridView(mailboxes, container, options = {}) {
	if (!container) return;

	if (!mailboxes || mailboxes.length === 0) {
		container.innerHTML = '<div class="empty-state">Chưa có hộp thư</div>';
		return;
	}

	container.innerHTML = mailboxes
		.map((m) => renderMailboxCard(m, options))
		.join("");

	// 绑定更多按钮事件
	container.querySelectorAll(".btn-more").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const card = btn.closest(".mailbox-card");
			const dropdown = card.querySelector(".card-dropdown");

			// 关闭其他下拉菜单
			container.querySelectorAll(".card-dropdown").forEach((d) => {
				if (d !== dropdown) d.style.display = "none";
			});

			// 切换当前下拉菜单
			dropdown.style.display =
				dropdown.style.display === "none" ? "block" : "none";
		});
	});

	// 点击其他地方关闭下拉菜单
	document.addEventListener("click", () => {
		container.querySelectorAll(".card-dropdown").forEach((d) => {
			d.style.display = "none";
		});
	});
}

// 导出默认对象
export default {
	formatTime,
	createSkeletonCard,
	generateSkeletonContent,
	renderMailboxCard,
	renderGridView,
};
