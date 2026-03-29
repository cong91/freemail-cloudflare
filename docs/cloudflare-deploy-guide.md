# Quy trình nhận và triển khai Cloudflare

Tài liệu này chỉ nói về một điều: triển khai dự án hiện tại lên Cloudflare và làm cho hộp thư thực sự nhận được thư.

Các tình huống áp dụng:

- Triển khai tên miền gốc, sử dụng `Catch-all -> Worker`
- Triển khai tên miền phụ, sử dụng "Tự động tạo quy tắc Định tuyến Email khi tạo hộp thư"
- Cần phải hoàn thành quy tắc định tuyến Cloudflare cho các hộp thư lịch sử

##1. Cấu trúc dự án và nhận link

Các liên kết cốt lõi của dự án như sau:

1. Người dùng tạo địa chỉ email ở giao diện người dùng
2. Phần phụ trợ ghi hộp thư vào bảng `mailboxes` của D1
3. Nếu Định tuyến email Cloudflare tự động tạo quy tắc, quy tắc `Send to a worker -> freemail` sẽ được tạo cho địa chỉ này cùng một lúc.
4. Email bên ngoài được gửi đến địa chỉ này
5. Định tuyến email trên Cloudflare gửi email đến trình xử lý email của Worker
6. Nhân viên phân tích cú pháp email và viết nội dung và chỉ mục vào D1, đồng thời lưu EML hoàn chỉnh vào R2
7. Giao diện người dùng đọc danh sách gửi thư và thông tin chi tiết trong D1 thông qua API

Các tài nguyên tương ứng với liên kết này:

- Worker: trang, API, xử lý biên nhận
- D1: Hộp thư, email, người dùng, ID quy tắc định tuyến
- R2: Hoàn thành văn bản gốc EML
- Email Routing: chuyển email bên ngoài tới Worker

## 2. Chuẩn bị trước khi triển khai

Cần chuẩn bị trước:

- Tên miền đã được kết nối với Cloudflare
- Node.js 18+
- Trạng thái đăng nhập Cloudflare
- `wrangler` có sẵn

Đăng nhập vào Cloudflare trước:

```bash
npx wrangler login
```

## 3. Triển khai bằng một cú nhấp chuột

Dự án có tập lệnh triển khai tích hợp [deploy-cloudflare.mjs](/C:/Users/Administrator/Documents/Playground/freemail/scripts/deploy-cloudflare.mjs), tập lệnh này sẽ tự động hoàn thành các bước sau:

- Tạo hoặc tái sử dụng D1
- Tạo hoặc tái sử dụng R2
- Viết ID tài nguyên trở lại [wrangler.toml](/C:/Users/Administrator/Documents/Playground/freemail/wrangler.toml)
- Khởi tạo cấu trúc bảng D1
- viết bí mật
- Thực hiện `wrangler deploy`

Lệnh triển khai tối thiểu:

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123"
```

Nếu bạn đã có sẵn D1/R2:

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123" ^
  --database-id "<your-d1-id>" ^
  --bucket-name "<your-r2-bucket>"
```

## 4. Hai chế độ nhận

### Chế độ A: Tên miền gốc Catch-all

Đây là chế độ đơn giản nhất và gần giống nhất với chế độ "hộp thư tạm thời thực sự" của Cloudflare.

Áp dụng:

- Bạn kiểm soát tên miền gốc
- Ví dụ `example.com`

quá trình:

1. Triển khai công nhân
2. Mở `Email > Email Routing`
3. Kích hoạt định tuyến email
4. Đặt `Catch-all` thành `Send to a worker`
5. Chọn Công nhân: `freemail`

Tác dụng:

- Mọi tiền tố `anything@example.com` đều có thể được đưa trực tiếp vào Worker

###Chế độ B: Tự động tạo quy tắc cho tên miền phụ

Áp dụng:

- Bạn đang sử dụng tên miền phụ
- Ví dụ `mail.example.com`, `zaojun.de5.net`

Hạn chế của Cloudflare là:

- `Catch-all` chỉ hỗ trợ tên miền cấp vùng
- Không hỗ trợ mở Catch-all riêng cho tên miền phụ

Do đó, trong chế độ tên miền phụ, dự án này áp dụng các phương pháp sau:

1. Trước tiên, người dùng tạo địa chỉ email ở giao diện người dùng
2. Cuộc gọi phụ trợ API định tuyến email của Cloudflare
3. Tự động tạo quy tắc `literal(to) -> worker` cho địa chỉ cụ thể này

Tác dụng:

- Hộp thư tên miền phụ mới được tạo có thể nhận email trực tiếp
- Không phải "bất kỳ tiền tố ngẫu nhiên nào được thu thập một cách tự nhiên"
- Hộp thư lịch sử yêu cầu các quy tắc chèn lấp riêng biệt

## 5. Cấu hình cần thiết để tự động tạo quy tắc cho tên miền phụ

Nếu bạn muốn sử dụng chế độ B, bạn cần cấu hình thêm các biến sau.

### Cách 1: API Token

```bash
CLOUDFLARE_ZONE_ID="Zone ID của bạn"
CLOUDFLARE_API_TOKEN="Cloudflare API Token của bạn"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

minh họa:

- `CLOUDFLARE_ZONE_ID`: ID vùng của vùng tương ứng với tên miền
- `CLOUDFLARE_API_TOKEN`: mã thông báo có thể truy cập API Quy tắc định tuyến email
- `CLOUDFLARE_EMAIL_ROUTING_WORKER`: Tên Worker nhận, thường là `freemail`

### Giải pháp 2: Chế độ tương thích Global API Key

Nếu khó tìm được quyền truy cập mã thông báo phù hợp trong tài khoản của mình, bạn có thể trực tiếp sử dụng:

```bash
CLOUDFLARE_ZONE_ID="Zone ID của bạn"
CLOUDFLARE_API_EMAIL="Email đăng nhập Cloudflare của bạn"
CLOUDFLARE_GLOBAL_API_KEY="Global API Key của bạn"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

Giải pháp này đã được xác minh trong dự án hiện tại.

### Truyền trực tiếp vào tập lệnh triển khai

Bạn cũng có thể tải nó lên cùng nhau trong quá trình triển khai bằng một cú nhấp chuột:

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain zaojun.de5.net ^
  --admin-password "StrongPass!123" ^
  --cloudflare-zone-id "<zone-id>" ^
  --cloudflare-api-email "<your-cloudflare-email>" ^
  --cloudflare-global-api-key "<your-global-api-key>" ^
  --cloudflare-email-routing-worker freemail
```

## 6. Các mục cấu hình cần thiết

###Cấu hình chạy cơ bản

| Biến | Mô tả | Bắt buộc |
| --- | --- | --- |
| `MAIL_DOMAIN` | Tên miền email, hỗ trợ nhiều tên miền cách nhau bằng dấu phẩy | Có |
| `ADMIN_PASSWORD` | Mật khẩu quản trị viên | Có |
| `ADMIN_NAME` | Tên người dùng quản trị viên, mặc định `admin` | Không |
| `JWT_TOKEN` | khóa JWT; tập lệnh triển khai tự động tạo | Có |
| `TEMP_MAIL_DB` | Tên ràng buộc D1 | Có |
| `MAIL_EML` | Tên ràng buộc R2 | Có |

###Cấu hình gửi tùy chọn

| Biến | Mô tả |
| --- | --- |
| `RESEND_API_KEY` | Gửi lại khóa gửi, hỗ trợ giá trị đơn, cặp khóa-giá trị và định dạng JSON |
| `FORWARD_RULES` | Quy tắc chuyển tiếp tiền tố |

### Cấu hình nhận tự động tên miền phụ

| Biến | Mô tả |
| --- | --- |
| `CLOUDFLARE_ZONE_ID` | ID của vùng mục tiêu |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_API_EMAIL` | Email đăng nhập Cloudflare |
| `CLOUDFLARE_GLOBAL_API_KEY` | Cloudflare Global API Key |
| `CLOUDFLARE_EMAIL_ROUTING_WORKER` | Công nhân được trỏ đến khi tự động tạo quy tắc |

Bạn có thể chọn một trong hai phương thức xác thực:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_API_EMAIL + CLOUDFLARE_GLOBAL_API_KEY`

## 7. Kiểm tra sau lần triển khai đầu tiên

Nên kiểm tra theo thứ tự sau:

1. Mở URL Công nhân và xác nhận rằng có thể truy cập trang chủ
2. Đăng nhập bằng tài khoản quản trị viên
3. Tạo hộp thư mới
4. Gửi email kiểm tra tới hộp thư mới này
5. Mở trang để xác nhận email đã được lưu trữ trong cơ sở dữ liệu

Nếu đó là chế độ tên miền phụ, hãy tập trung vào bước 3:

- Tạo ngẫu nhiên thành công
- Không có lỗi API Cloudflare nào được báo cáo
- Bạn có thể nhận thư trong hộp thư mới của mình

## 8. Chèn lấp quy tắc hộp thư lịch sử

Nếu bạn đã tạo hộp thư trước khi bật "quy tắc tạo tự động tên miền phụ", những hộp thư cũ này sẽ không tự động bổ sung các tuyến đường.

Dự án đã cung cấp giao diện chèn lấp dành cho quản trị viên:

`POST /api/admin/backfill-routing`

Phương thức gọi:

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"limit\":100}"
```

minh họa:

- Sử dụng `JWT_TOKEN` trực tiếp trong `Authorization`
- `limit` cho biết số lượng hộp thư lịch sử tối đa được xử lý lần này
- Nếu `addresses` không được chuyển, tất cả các hộp thư có `routing_rule_id` trống sẽ được xử lý tự động.

Chèn lấp email được chỉ định:

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"addresses\":[\"old1@example.com\",\"old2@example.com\"]}"
```

##9. Các lệnh vận hành và bảo trì chung

Xem triển khai:

```bash
npx wrangler deployments list --name freemail
```

Xem bí mật:

```bash
npx wrangler secret list --name freemail
```

Xem D1:

```bash
npx wrangler d1 execute TEMP_MAIL_DB --remote --command "SELECT id, address, routing_rule_id FROM mailboxes ORDER BY id DESC LIMIT 20;"
```

Triển khai lại:

```bash
npx wrangler deploy --keep-vars
```

##10. Câu hỏi thường gặp

### Trang mở được nhưng không nhận được thư

Chúng ta hãy nhìn vào những cảnh đầu tiên:

- Mẫu miền gốc: kiểm tra `Catch-all -> Send to a worker -> freemail`
- Chế độ tên miền phụ: Kiểm tra xem quy tắc định tuyến có được tạo tự động khi tạo hộp thư hay không

### Số lần tạo ngẫu nhiên Lỗi Cloudflare API

Kiểm tra ưu tiên:

- `CLOUDFLARE_ZONE_ID` có đúng không?
- Phương thức xác thực có thực sự sẵn có không?
- `CLOUDFLARE_EMAIL_ROUTING_WORKER` có nhất quán với tên Công nhân không?

### Tôi không thể nhận nó bằng địa chỉ email cũ nhưng tôi có thể nhận nó bằng địa chỉ email mới.

Đây là một hiện tượng bình thường. Điều đó có nghĩa là bạn vừa kích hoạt tính năng tự động tạo quy tắc cho tên miền phụ nhưng quy tắc đó vẫn chưa được thêm vào hộp thư lịch sử. Chỉ cần thực hiện "Chèn lấp quy tắc hộp thư lịch sử".

### Quên mật khẩu quản trị viên?

Đặt lại bí mật `ADMIN_PASSWORD` và triển khai lại:

```bash
npx wrangler secret put ADMIN_PASSWORD --name freemail
npx wrangler deploy --keep-vars
```
