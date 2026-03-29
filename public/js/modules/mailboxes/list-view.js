/**
 * 邮箱列表视图模块
 * @module modules/mailboxes/list-view
 */

import { escapeAttr, escapeHtml } from "../app/ui-helpers.js";
import { formatTime } from "./grid-view.js";

/**
 * 生成骨架屏列表项
 * @returns {string}
 */
export function createSkeletonListItem() {
	return `
    <div class="skeleton-list-item">
      <div class="skeleton-line skeleton-pin"></div>
      <div class="skeleton-content">
        <div class="skeleton-line title"></div>
        <div class="skeleton-line subtitle"></div>
      </div>
      <div class="skeleton-actions">
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>
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
		.map(() => createSkeletonListItem())
		.join("");
}

/**
 * 渲染邮箱列表项
 * @param {object} mailbox - 邮箱数据
 * @param {object} options - 选项
 * @returns {string}
 */
export function renderMailboxListItem(mailbox, options = {}) {
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
    <div class="mailbox-list-item ${isPinned ? "pinned" : ""}" data-address="${escapedAddress}">
      <div class="item-pin ${isPinned ? "active" : ""}" data-action="pin" title="${isPinned ? "Bỏ ghim" : "Ghim"}">
        ${isPinned ? "📌" : "📍"}
      </div>
      
      <div class="item-content">
        <div class="item-address" title="${escapedAddress}">${displayAddress}</div>
        <div class="item-meta">
          <span class="item-time">${createdAt}</span>
          <span class="item-indicators">
            ${isFavorite ? '<span class="indicator favorite" title="Đã đánh dấu">⭐</span>' : ""}
            ${forwardTo ? `<span class="indicator forward" title="Chuyển tiếp tới: ${escapeAttr(forwardTo)}">📤</span>` : ""}
            ${canLogin ? '<span class="indicator login" title="Có thể đăng nhập">🔑</span>' : ""}
          </span>
        </div>
      </div>
      
      <div class="item-actions">
        <button class="btn btn-sm" data-action="copy" title="Sao chép">📋</button>
        <button class="btn btn-sm" data-action="jump" title="Xem">📧</button>
        <button class="btn btn-sm ${isFavorite ? "active" : ""}" data-action="favorite" title="${isFavorite ? "Bỏ đánh dấu" : "Đánh dấu"}">⭐</button>
        <button class="btn btn-sm" data-action="forward" title="Thiết lập chuyển tiếp">📤</button>
        <button class="btn btn-sm" data-action="toggle-login" title="${canLogin ? "Cấm đăng nhập" : "Cho phép đăng nhập"}">🔑</button>
        <button class="btn btn-sm danger" data-action="delete" title="Xóa">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * 渲染列表视图
 * @param {Array} mailboxes - 邮箱列表
 * @param {HTMLElement} container - 容器元素
 * @param {object} options - 选项
 */
export function renderListView(mailboxes, container, options = {}) {
	if (!container) return;

	if (!mailboxes || mailboxes.length === 0) {
		container.innerHTML = '<div class="empty-state">Chưa có hộp thư</div>';
		return;
	}

	container.innerHTML = mailboxes
		.map((m) => renderMailboxListItem(m, options))
		.join("");
}

/**
 * 渲染表格视图头部
 * @returns {string}
 */
export function renderTableHeader() {
	return `
    <div class="table-header">
      <div class="col-pin">📌</div>
      <div class="col-address">Địa chỉ email</div>
      <div class="col-status">Trạng thái</div>
      <div class="col-time">Thời gian tạo</div>
      <div class="col-actions">Thao tác</div>
    </div>
  `;
}

/**
 * 渲染表格行
 * @param {object} mailbox - 邮箱数据
 * @returns {string}
 */
export function renderTableRow(mailbox) {
	const address = mailbox.address || "";
	const createdAt = formatTime(mailbox.created_at);
	const isPinned = mailbox.is_pinned ? 1 : 0;
	const isFavorite = mailbox.is_favorite ? 1 : 0;
	const canLogin = mailbox.can_login ? 1 : 0;
	const forwardTo = mailbox.forward_to || "";

	const escapedAddress = escapeAttr(address);
	const displayAddress = escapeHtml(address);

	const statusIcons = [
		isFavorite ? "⭐" : "",
		forwardTo ? "📤" : "",
		canLogin ? "🔑" : "",
	]
		.filter(Boolean)
		.join(" ");

	return `
    <div class="table-row ${isPinned ? "pinned" : ""}" data-address="${escapedAddress}">
      <div class="col-pin">
        <button class="btn btn-sm ${isPinned ? "active" : ""}" data-action="pin">${isPinned ? "📌" : "📍"}</button>
      </div>
      <div class="col-address" title="${escapedAddress}">${displayAddress}</div>
      <div class="col-status">${statusIcons || "-"}</div>
      <div class="col-time">${createdAt}</div>
      <div class="col-actions">
        <button class="btn btn-sm" data-action="copy" title="Sao chép">📋</button>
        <button class="btn btn-sm" data-action="jump" title="Xem">📧</button>
        <button class="btn btn-sm" data-action="more" title="Thêm">⋯</button>
      </div>
    </div>
  `;
}

// 导出默认对象
export default {
	createSkeletonListItem,
	generateSkeletonContent,
	renderMailboxListItem,
	renderListView,
	renderTableHeader,
	renderTableRow,
};
