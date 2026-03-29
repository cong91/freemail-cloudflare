((global) => {
	function formatTs(ms) {
		return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
	}

	function mockGenerateId(len) {
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
		const L = Math.max(8, Math.min(30, Number(len) || 8));
		let s = "";
		for (let i = 0; i < L; i++)
			s += chars[Math.floor(Math.random() * chars.length)];
		return s;
	}

	function buildMockEmails(count) {
		const now = Date.now();
		const templates = [
			(code) => `Mã xác thực của bạn là ${code}, có hiệu lực trong 5 phút`,
			(code) => `Your verification code is ${code}. It expires in 5 minutes`,
			(code) => `One-time code: ${code}`,
			(code) => `Xác minh bảo mật · Mã ${code}`,
			(code) => `Login code is ${code}`,
		];
		return Array.from({ length: count || 6 }).map((_, i) => {
			const id = 10000 + i;
			const code = String(Math.abs((id * 7919) % 900000) + 100000).slice(0, 6);
			return {
				id,
				sender: `demo${i}@example.com`,
				subject: templates[i % templates.length](code),
				received_at: formatTs(now - i * 600000),
				is_read: i > 1,
				content: `Xin chào, bạn đang trải nghiệm chế độ demo. Mã xác thực: ${code}, vui lòng hoàn tất xác minh trong vòng 5 phút.`,
				html_content: `<p>Xin chào, bạn đang trải nghiệm <strong>chế độ demo</strong>.</p><p><strong>Mã xác thực: ${code}</strong></p>`,
			};
		});
	}

	function buildMockMailboxes(limit, offset, domains) {
		const now = Date.now();
		const list = [];
		const size = Math.min(limit || 10, 10);
		const arrDomains =
			Array.isArray(domains) && domains.length ? domains : ["example.com"];
		for (let i = 0; i < size; i++) {
			list.push({
				address: `${mockGenerateId(10)}@${arrDomains[(offset || 0 + i) % arrDomains.length]}`,
				created_at: formatTs(now - (offset || 0 + i) * 3600000),
			});
		}
		return list;
	}

	function buildMockEmailDetail(id) {
		const code = String(
			Math.abs((Number(id || 10000) * 7919) % 900000) + 100000,
		).slice(0, 6);
		return {
			id: Number(id) || 10000,
			sender: "noreply@example.com",
			subject: `Nội dung email demo (mã xác thực ${code})`,
			received_at: formatTs(Date.now()),
			content: `Đây là nội dung email trong chế độ demo, chỉ dùng để hiển thị giao diện. Mã xác thực: ${code}`,
			html_content: `<p><strong>Chế độ demo</strong>: nội dung này là dữ liệu mô phỏng.</p><p>Mã xác thực: <strong>${code}</strong></p>`,
		};
	}

	global.MockData = {
		formatTs,
		mockGenerateId,
		buildMockEmails,
		buildMockMailboxes,
		buildMockEmailDetail,
	};
})(typeof window !== "undefined" ? window : this);
