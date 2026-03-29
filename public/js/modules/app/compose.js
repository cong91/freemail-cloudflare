/**
 * 邮件撰写模块
 * @module modules/app/compose
 */

import { getCurrentMailbox } from "./mailbox-state.js";
import { escapeHtml } from "./ui-helpers.js";

/**
 * 初始化撰写模态框
 * @param {object} elements - DOM 元素
 * @param {Function} api - API 函数
 * @param {Function} showToast - 提示函数
 */
export function initCompose(elements, api, showToast) {
	const {
		compose,
		composeModal,
		composeClose,
		composeCancel,
		composeSend,
		composeTo,
		composeSubject,
		composeHtml,
		composeFromName,
	} = elements;

	if (!compose || !composeModal) return;

	// 打开撰写模态框
	compose.onclick = () => {
		const mailbox = getCurrentMailbox();
		if (!mailbox) {
			showToast("Vui lòng chọn hoặc tạo một hộp thư trước", "warn");
			return;
		}

		// 清空表单
		if (composeTo) composeTo.value = "";
		if (composeSubject) composeSubject.value = "";
		if (composeHtml) composeHtml.value = "";
		if (composeFromName) composeFromName.value = "";

		composeModal.classList.add("show");
		setTimeout(() => composeTo?.focus(), 100);
	};

	// 关闭
	const closeModal = () => {
		composeModal.classList.remove("show");
	};

	if (composeClose) composeClose.onclick = closeModal;
	if (composeCancel) composeCancel.onclick = closeModal;

	// 发送
	if (composeSend) {
		composeSend.onclick = async () => {
			const mailbox = getCurrentMailbox();
			if (!mailbox) {
				showToast("Vui lòng chọn hộp thư gửi trước", "warn");
				return;
			}

			const to = (composeTo?.value || "").trim();
			const subject = (composeSubject?.value || "").trim();
			const html = (composeHtml?.value || "").trim();
			const fromName = (composeFromName?.value || "").trim();

			if (!to) {
				showToast("Vui lòng nhập địa chỉ người nhận", "warn");
				return;
			}

			if (!subject && !html) {
				showToast("Tiêu đề và nội dung không thể đồng thời để trống", "warn");
				return;
			}

			// 设置加载状态
			const originalText = composeSend.textContent;
			composeSend.disabled = true;
			composeSend.innerHTML = '<span class="spinner"></span> Đang gửi...';

			try {
				const body = {
					from: mailbox,
					to,
					subject: subject || "(Không có tiêu đề)",
					html: html || "",
				};
				if (fromName) body.fromName = fromName;

				const r = await api("/api/send", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				if (!r.ok) {
					const text = await r.text();
					throw new Error(text || "Gửi thất bại");
				}

				showToast("Gửi email thành công!", "success");
				closeModal();
			} catch (e) {
				showToast(e.message || "Gửi thất bại, vui lòng thử lại sau", "error");
			} finally {
				composeSend.disabled = false;
				composeSend.textContent = originalText;
			}
		};
	}
}

/**
 * 显示已发送邮件详情
 * @param {object} email - 邮件数据
 * @param {object} elements - DOM 元素
 */
export function showSentEmailDetail(email, elements) {
	const { modal, modalSubject, modalContent } = elements;
	if (!modal || !email) return;

	const e = email;
	modalSubject.innerHTML = `
    <span class="modal-icon">📤</span>
    <span>${escapeHtml(e.subject || "(Không có tiêu đề)")}</span>
  `;

	const recipients = (e.recipients || e.to_addrs || "").toString();
	const status = e.status || "unknown";

	let statusBadge = "";
	const statusMap = {
		queued: { class: "status-queued", text: "Đang xếp hàng" },
		delivered: { class: "status-delivered", text: "Đã gửi tới" },
		failed: { class: "status-failed", text: "Gửi thất bại" },
		processing: { class: "status-processing", text: "Đang xử lý" },
	};
	const statusInfo = statusMap[status] || { class: "", text: status };
	statusBadge = `<span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>`;

	modalContent.innerHTML = `
    <div class="sent-detail">
      <div class="detail-meta">
        <div class="meta-row"><span class="meta-label">Người nhận:</span><span class="meta-value">${escapeHtml(recipients)}</span></div>
        <div class="meta-row"><span class="meta-label">Trạng thái:</span>${statusBadge}</div>
        <div class="meta-row"><span class="meta-label">Thời gian gửi:</span><span class="meta-value">${escapeHtml(e.created_at || "")}</span></div>
      </div>
      <div class="detail-content">
        ${e.html_content ? e.html_content : `<pre>${escapeHtml(e.text_content || "")}</pre>`}
      </div>
    </div>
  `;

	modal.classList.add("show");
}

export default {
	initCompose,
	showSentEmailDetail,
};
