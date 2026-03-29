# Tài liệu giao diện API

## Mục lục

- [Xác thực và quyền](#Xác thực và quyền)
- [Chứng chỉ liên quan](#Liên quan xác thực)
- [Quản lý hộp thư](#Quản lý hộp thư)
- [Cài đặt email](#Cài đặt hộp thư)
- [Thao tác thư](#Thao tác email)
- [Gửi qua email](#Gửi email)
- [Quản lý người dùng](#Quản lý người dùng)
- [Giao diện hệ thống](#Giao diện hệ thống)

---

## Xác thực và quyền

### 🔐 Ghi đè quản trị viên gốc

Khi người yêu cầu mang mã thông báo giống hệt với biến môi trường máy chủ `JWT_TOKEN`, xác minh cookie phiên/JWT sẽ bị bỏ qua và được xác định trực tiếp là quản trị viên cao nhất (strictAdmin).

**Các mục cấu hình:**
- `wrangler.toml` → `[vars]` → `JWT_TOKEN="Mã thông báo quản trị của bạn"`

**Phương thức mang mã thông báo (chọn một):**
- Tiêu đề (tiêu chuẩn): `Authorization: Bearer <JWT_TOKEN>`
- Tiêu đề (tùy chỉnh): `X-Admin-Token: <JWT_TOKEN>`
- Query：`?admin_token=<JWT_TOKEN>`

**Phạm vi hiệu quả:**
- Tất cả các giao diện phụ trợ được bảo vệ: `/api/*`
- Kiểm tra phiên: `GET /api/session`
- Nhận cuộc gọi lại: `POST /receive`
- Phán quyết truy cập máy chủ trang quản lý (`/admin`/`/admin.html`) và phán đoán xác thực đường dẫn không xác định

**Mô tả hành vi:**
- Sau khi nhấn token, payload xác thực là: `{ role: 'admin', username: '__root__', userId: 0 }`
- `strictAdmin` đánh giá là đúng cho `__root__` (tương đương với quản trị viên nghiêm ngặt)
- Nếu không được mang theo hoặc không khớp, nó sẽ quay lại xác minh phiên Cookie/JWT ban đầu.

**Ví dụ sử dụng:**

```bash
# Header Authorization
curl -H "Authorization: Bearer <JWT_TOKEN>" https://your.domain/api/mailboxes

# Header X-Admin-Token
curl -H "X-Admin-Token: <JWT_TOKEN>" https://your.domain/api/domains

# Tham số Query
curl "https://your.domain/api/session?admin_token=<JWT_TOKEN>"
```

**Mẹo an toàn:** Giữ bí mật tuyệt đối `JWT_TOKEN` và thay đổi thường xuyên.

### Vai trò của người dùng

| Vai trò | Mô tả |
|------|------|
| `strictAdmin` | Quản trị viên hàng đầu, toàn quyền truy cập hệ thống |
| `admin` | Quản trị viên, Quản lý người dùng và Kiểm soát hộp thư |
| `user` | Người dùng thông thường chỉ có thể quản lý các hộp thư được chỉ định |
| `mailbox` | Người dùng email chỉ có thể truy cập vào địa chỉ email duy nhất của riêng họ |
| `guest` | Dữ liệu mô phỏng khách, chỉ đọc |

---

## Chứng nhận liên quan

### POST /api/login
Đăng nhập người dùng

**Thông số yêu cầu:**
```json
{
  "username": "Tên người dùng hoặc địa chỉ email",
  "password": "Mật khẩu"
}
```

**Các phương thức đăng nhập được hỗ trợ:**
1. Đăng nhập quản trị viên: sử dụng biến môi trường `ADMIN_NAME` / `ADMIN_PASSWORD`
2. Đăng nhập với tư cách khách: tên người dùng `guest`, mật khẩu `GUEST_PASSWORD` biến môi trường
3. Đăng nhập người dùng thông thường: người dùng trong bảng `users` cơ sở dữ liệu
4. Đăng nhập email: Đăng nhập bằng địa chỉ email của bạn (cần bật `can_login`)

**Ví dụ trả về:**
```json
{
  "success": true,
  "role": "admin",
  "can_send": 1,
  "mailbox_limit": 9999
}
```

### POST /api/logout
Người dùng đăng xuất

**trở lại:**
```json
{ "success": true }
```

### GET /api/session
Xác minh trạng thái phiên hiện tại

**trở lại:**
```json
{
  "authenticated": true,
  "role": "admin",
  "username": "admin",
  "strictAdmin": true
}
```

---

## Quản lý email

### GET /api/domains
Nhận danh sách các tên miền có sẵn

**trở lại:**
```json
["example.com", "mail.example.com"]
```

### GET /api/generate
Tạo ngẫu nhiên một hộp thư tạm thời mới

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `length` | số | Độ dài chuỗi ngẫu nhiên, tùy chọn |
| `domainIndex` | số | Tùy chọn, chọn chỉ mục tên miền (mặc định 0) |

**trở lại:**
```json
{
  "email": "abc123@example.com",
  "expires": 1704067200000
}
```

### POST /api/create
Tạo hộp thư tùy chỉnh

**Thông số yêu cầu:**
```json
{
  "local": "myname",
  "domainIndex": 0
}
```

**trở lại:**
```json
{
  "email": "myname@example.com",
  "expires": 1704067200000
}
```

### GET /api/mailboxes
Lấy danh sách email của người dùng hiện tại

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `limit` | số | Kích thước phân trang (mặc định 100, tối đa 500) |
| `offset` | số | bù đắp |
| `domain` | chuỗi | Lọc theo tên miền |
| `favorite` | boolean | Lọc theo trạng thái bộ sưu tập |
| `forward` | boolean | Lọc theo trạng thái chuyển tiếp |

**trở lại:**
```json
[
  {
    "id": 1,
    "address": "test@example.com",
    "created_at": "2024-01-01 00:00:00",
    "is_pinned": 1,
    "password_is_default": 1,
    "can_login": 0,
    "forward_to": "backup@gmail.com",
    "is_favorite": 1
  }
]
```

### DELETE /api/mailboxes
Xóa hộp thư được chỉ định

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `address` | chuỗi | Địa chỉ email cần xóa |

**trở lại:**
```json
{ "success": true, "deleted": true }
```

### GET /api/user/quota
Nhận hạn ngạch hộp thư của người dùng hiện tại

**Trở về (người dùng bình thường):**
```json
{
  "limit": 10,
  "used": 3,
  "remaining": 7
}
```

**Quay lại (quản trị viên):**
```json
{
  "limit": -1,
  "used": 150,
  "remaining": -1,
  "note": "Quản trị viên không giới hạn số lượng hộp thư"
}
```

### POST /api/mailboxes/pin
Chuyển hộp thư về trạng thái trên cùng

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `address` | chuỗi | Địa chỉ email |

**trở lại:**
```json
{ "success": true, "pinned": true }
```

### POST /api/mailboxes/reset-password
Đặt lại mật khẩu email (chỉ dành cho quản trị viên nghiêm ngặt)

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `address` | chuỗi | Địa chỉ email |

**trở lại:**
```json
{ "success": true }
```

### POST /api/mailboxes/toggle-login
Chuyển đổi quyền đăng nhập email (chỉ dành cho quản trị viên nghiêm ngặt)

**Thông số yêu cầu:**
```json
{
  "address": "test@example.com",
  "can_login": true
}
```

**trở lại:**
```json
{ "success": true, "can_login": true }
```

### POST /api/mailboxes/change-password
Thay đổi mật khẩu email (chỉ dành cho quản trị viên nghiêm ngặt)

**Thông số yêu cầu:**
```json
{
  "address": "test@example.com",
  "new_password": "newpassword123"
}
```

**trở lại:**
```json
{ "success": true }
```

### POST /api/mailboxes/batch-toggle-login
Chuyển đổi quyền đăng nhập email theo đợt (chỉ dành cho quản trị viên nghiêm ngặt)

**Thông số yêu cầu:**
```json
{
  "addresses": ["test1@example.com", "test2@example.com"],
  "can_login": true
}
```

**trở lại:**
```json
{
  "success": true,
  "success_count": 2,
  "fail_count": 0,
  "total": 2,
  "results": [
    { "address": "test1@example.com", "success": true, "updated": true }
  ]
}
```

---

## Cài đặt email

### POST /api/mailbox/forward
Thiết lập địa chỉ chuyển tiếp email

**Thông số yêu cầu:**
```json
{
  "mailbox_id": 1,
  "forward_to": "backup@gmail.com"
}
```

**trở lại:**
```json
{ "success": true }
```

### POST /api/mailbox/favorite
Chuyển trạng thái thu thập hộp thư

**Thông số yêu cầu:**
```json
{
  "mailbox_id": 1,
  "is_favorite": true
}
```

**trở lại:**
```json
{ "success": true }
```

### POST /api/mailboxes/batch-favorite
Đặt bộ sưu tập theo lô (theo ID, chỉ strictAdmin)

**Thông số yêu cầu:**
```json
{
  "mailbox_ids": [1, 2, 3],
  "is_favorite": true
}
```

### POST /api/mailboxes/batch-forward
Chuyển tiếp thiết lập hàng loạt (theo ID, chỉ strictAdmin)

**Thông số yêu cầu:**
```json
{
  "mailbox_ids": [1, 2, 3],
  "forward_to": "backup@gmail.com"
}
```

### POST /api/mailboxes/batch-favorite-by-address
Đặt mục yêu thích theo đợt (theo địa chỉ, chỉ strictAdmin)

**Thông số yêu cầu:**
```json
{
  "addresses": ["test1@example.com", "test2@example.com"],
  "is_favorite": true
}
```

### POST /api/mailboxes/batch-forward-by-address
Đặt chuyển tiếp theo đợt (theo địa chỉ, chỉ strictAdmin)

**Thông số yêu cầu:**
```json
{
  "addresses": ["test1@example.com", "test2@example.com"],
  "forward_to": "backup@gmail.com"
}
```

### PUT /api/mailbox/password
Người dùng email thay đổi mật khẩu của họ

**Thông số yêu cầu:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**trở lại:**
```json
{ "success": true, "message": "Đổi mật khẩu thành công" }
```

---

## Thao tác gửi email

### GET /api/emails
Nhận danh sách gửi thư

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `mailbox` | chuỗi | Địa chỉ email (bắt buộc) |
| `limit` | số | Số lượng trả lại (mặc định 20, tối đa 50) |

**trở lại:**
```json
[
  {
    "id": 1,
    "sender": "sender@example.com",
    "subject": "Tiêu đề email",
    "received_at": "2024-01-01 12:00:00",
    "is_read": 0,
    "preview": "Xem trước nội dung email...",
    "verification_code": "123456"
  }
]
```

### GET /api/emails/batch
Nhận siêu dữ liệu email theo đợt

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `ids` | chuỗi | ID tin nhắn được phân tách bằng dấu phẩy (tối đa 50) |

**trở lại:**
```json
[
  {
    "id": 1,
    "sender": "sender@example.com",
    "to_addrs": "recipient@example.com",
    "subject": "Tiêu đề email",
    "verification_code": "123456",
    "preview": "Xem trước...",
    "r2_bucket": "mail-eml",
    "r2_object_key": "2024/01/01/test@example.com/xxx.eml",
    "received_at": "2024-01-01 12:00:00",
    "is_read": 0
  }
]
```

### GET /api/email/:id
Nhận thông tin chi tiết của một email

**trở lại:**
```json
{
  "id": 1,
  "sender": "sender@example.com",
  "to_addrs": "recipient@example.com",
  "subject": "Tiêu đề email",
  "verification_code": "123456",
  "content": "Nội dung văn bản thuần",
  "html_content": "<p>Nội dung HTML</p>",
  "received_at": "2024-01-01 12:00:00",
  "is_read": 1,
  "download": "/api/email/1/download"
}
```

### GET /api/email/:id/download
Tải xuống tệp EML gốc

**Trả lại:** Tệp thư gốc ở định dạng `message/rfc822`

### DELETE /api/email/:id
Xóa một email duy nhất

**trở lại:**
```json
{
  "success": true,
  "deleted": true,
  "message": "Email đã bị xóa"
}
```

### DELETE /api/emails
Xóa tất cả thư khỏi hộp thư

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `mailbox` | chuỗi | Địa chỉ email (bắt buộc) |

**trở lại:**
```json
{
  "success": true,
  "deletedCount": 5
}
```

---

## Gửi email

> Cần định cấu hình biến môi trường `RESEND_API_KEY`

### GET /api/sent
Lấy danh sách hồ sơ gửi

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `from` | chuỗi | Địa chỉ email của người gửi (bắt buộc) |
| `limit` | số | Số lượng trả lại (mặc định 20, tối đa 50) |

**trở lại:**
```json
[
  {
    "id": 1,
    "resend_id": "abc123",
    "recipients": "to@example.com",
    "subject": "Tiêu đề email",
    "created_at": "2024-01-01 12:00:00",
    "status": "delivered"
  }
]
```

### GET /api/sent/:id
Nhận chi tiết vận chuyển

**trở lại:**
```json
{
  "id": 1,
  "resend_id": "abc123",
  "from_addr": "from@example.com",
  "recipients": "to@example.com",
  "subject": "Tiêu đề email",
  "html_content": "<p>Nội dung</p>",
  "text_content": "Nội dung",
  "status": "delivered",
  "scheduled_at": null,
  "created_at": "2024-01-01 12:00:00"
}
```

### DELETE /api/sent/:id
Xóa hồ sơ gửi

**trở lại:**
```json
{ "success": true }
```

### POST /api/send
Gửi một email duy nhất

**Thông số yêu cầu:**
```json
{
  "from": "sender@example.com",
  "fromName": "Tên người gửi",
  "to": "recipient@example.com",
  "subject": "Tiêu đề email",
  "html": "<p>Nội dung HTML</p>",
  "text": "Nội dung văn bản thuần",
  "scheduledAt": "2024-01-02T12:00:00Z"
}
```

**trở lại:**
```json
{ "success": true, "id": "resend-id-xxx" }
```

### POST /api/send/batch
Gửi email hàng loạt

**Thông số yêu cầu:**
```json
[
  {
    "from": "sender@example.com",
    "to": "recipient1@example.com",
    "subject": "Chủ đề 1",
    "html": "<p>Nội dung 1</p>"
  },
  {
    "from": "sender@example.com",
    "to": "recipient2@example.com",
    "subject": "Chủ đề 2",
    "html": "<p>Nội dung 2</p>"
  }
]
```

**trở lại:**
```json
{
  "success": true,
  "result": [
    { "id": "resend-id-1" },
    { "id": "resend-id-2" }
  ]
}
```

### GET /api/send/:id
Kết quả gửi truy vấn (từ API gửi lại)

### PATCH /api/send/:id
Cập nhật trạng thái gửi hoặc thời gian đã lên lịch

**Thông số yêu cầu:**
```json
{
  "status": "canceled",
  "scheduledAt": "2024-01-03T12:00:00Z"
}
```

### POST /api/send/:id/cancel
Hủy giao hàng theo lịch

**trở lại:**
```json
{ "success": true }
```

---

## Quản lý người dùng

> Các giao diện sau yêu cầu quyền `strictAdmin`

### GET /api/users
Lấy danh sách người dùng

**tham số:**
| Thông số | Loại | Mô tả |
|------|------|------|
| `limit` | số | Kích thước phân trang (mặc định 50, tối đa 100) |
| `offset` | số | bù đắp |
| `sort` | chuỗi | Phương pháp sắp xếp: `asc` hoặc `desc` (mô tả mặc định) |

**trở lại:**
```json
[
  {
    "id": 1,
    "username": "testuser",
    "role": "user",
    "mailbox_limit": 10,
    "can_send": 0,
    "mailbox_count": 3,
    "created_at": "2024-01-01 00:00:00"
  }
]
```

### POST /api/users
Tạo người dùng

**Thông số yêu cầu:**
```json
{
  "username": "newuser",
  "password": "password123",
  "role": "user",
  "mailboxLimit": 10
}
```

**trở lại:**
```json
{
  "id": 2,
  "username": "newuser",
  "role": "user",
  "mailbox_limit": 10,
  "can_send": 0,
  "created_at": "2024-01-01 00:00:00"
}
```

### PATCH /api/users/:id
Cập nhật thông tin người dùng

**Thông số yêu cầu:**
```json
{
  "username": "updatedname",
  "password": "newpassword",
  "mailboxLimit": 20,
  "can_send": 1,
  "role": "admin"
}
```

**trở lại:**
```json
{ "success": true }
```

### DELETE /api/users/:id
Xóa người dùng

**trở lại:**
```json
{ "success": true }
```

### GET /api/users/:id/mailboxes
Lấy danh sách email của người dùng được chỉ định

**trở lại:**
```json
[
  {
    "address": "test@example.com",
    "created_at": "2024-01-01 00:00:00",
    "is_pinned": 0
  }
]
```

### POST /api/users/assign
Gán email cho người dùng

**Thông số yêu cầu:**
```json
{
  "username": "testuser",
  "address": "newbox@example.com"
}
```

**trở lại:**
```json
{ "success": true }
```

### POST /api/users/unassign
Bỏ gán hộp thư của người dùng

**Thông số yêu cầu:**
```json
{
  "username": "testuser",
  "address": "oldbox@example.com"
}
```

**trở lại:**
```json
{ "success": true }
```

---

##Giao diện hệ thống

### POST /receive
Nhận email gọi lại (đối với Định tuyến email trên Cloudflare)

> Yêu cầu xác thực, thường được hệ thống gọi nội bộ

---

## Phản hồi lỗi

Tất cả các API đều trả về định dạng sau khi xảy ra lỗi:

```json
{
  "error": "Mô tả thông tin lỗi"
}
```

**Mã trạng thái HTTP phổ biến:**
| Mã trạng thái | Mô tả |
|--------|------|
| 400 | Lỗi tham số yêu cầu |
| 401 | Chưa được xác thực |
| 403 | Không đủ quyền (hạn chế chế độ demo hoặc hạn chế vai trò) |
| 404 | Tài nguyên không tồn tại |
| 500 | Lỗi nội bộ máy chủ |
