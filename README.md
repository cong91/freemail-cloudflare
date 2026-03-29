# Freemail

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cong91/freemail-cloudflare)

Dự án hộp thư tạm thời dựa trên Cloudflare Workers + D1 + R2 + Email Routing, hỗ trợ:

- Hộp thư được tạo ngẫu nhiên và hộp thư tùy chỉnh
- Nhận email, xem danh sách và xem chi tiết
- Gửi EML đầy đủ vào R2
- Ba vai trò: quản trị viên, người dùng thông thường và đăng nhập email
- Gửi email qua Resend
- Chuyển tiếp thư
- Tự động tạo quy tắc Định tuyến email Cloudflare ở chế độ tên miền phụ

## Nhập tài liệu

- Hoàn tất quá trình triển khai: [docs/cloudflare-deploy-guide.md](docs/cloudflare-deploy-guide.md)
- Tập lệnh triển khai bằng một cú nhấp chuột: [scripts/deploy-cloudflare.mjs](scripts/deploy-cloudflare.mjs)
- Gửi lại cấu hình: [docs/resend.md](docs/resend.md)
- Tài liệu API: [docs/api.md](docs/api.md)
- Hiển thị dự án gốc: [docs/zhanshi.md](docs/zhanshi.md)

## Quy trình dự án

Liên kết nhận cốt lõi:

1. Người dùng tạo địa chỉ email ở giao diện người dùng
2. Phần phụ trợ ghi hộp thư vào bảng `mailboxes` của D1
3. Nếu bật định tuyến tự động tên miền phụ, API định tuyến email Cloudflare sẽ được gọi để tạo quy tắc `Send to a worker -> freemail` cho hộp thư.
4. Email bên ngoài nhập Cloudflare Email Routing
5. Cloudflare chuyển email đến email handler của Worker
6. Worker phân tích email, ghi chỉ mục vào D1 và lưu nội dung EML đầy đủ vào R2
7. Giao diện người dùng đọc danh sách gửi thư và thông tin chi tiết thông qua API

Các tài nguyên tương ứng:

- Worker: trang, API, logic nhận email
- D1: hộp thư, thư, người dùng, bản ghi gửi, ID quy tắc định tuyến
- R2: Hoàn thiện nội dung email gốc
- Định tuyến email: Cổng nhận

## Chế độ triển khai

### Chế độ A: Tên miền gốc Catch-all

Thích hợp khi bạn có quyền kiểm soát trực tiếp tên miền gốc, chẳng hạn như `example.com`.

Phương pháp cấu hình:

1. Triển khai Worker
2. Mở `Email > Email Routing` trong Cloudflare
3. Kích hoạt định tuyến email
4. Đặt `Catch-all` thành `Send to a worker`
5. Chọn Worker `freemail`

Tác dụng:

- Bạn có thể nhận tin nhắn trực tiếp với bất kỳ tiền tố nào
- Gần nhất với "hộp thư tạm thời" thực sự

### Chế độ B: Tự động tạo tuyến cho tên miền phụ

Phù hợp khi bạn đang sử dụng tên miền phụ, chẳng hạn như `mail.example.com` hoặc `zaojun.de5.net`.

Hạn chế của Cloudflare là:

- `Catch-all` chỉ hỗ trợ tên miền cấp vùng
- Không thể mở Catch-all riêng cho tên miền phụ

Do đó, dự án này sử dụng những điều sau trong kịch bản tên miền phụ:

1. Tạo email trước
2. Sau đó, phần phụ trợ sẽ tự động gọi API định tuyến email
3. Tạo quy tắc `literal(to) -> worker` cho địa chỉ cụ thể này

Tác dụng:

- Hộp thư tên miền phụ mới được tạo có thể nhận email
- Hộp thư cũ cần chạy backfill một lần

## Bắt đầu nhanh

Đăng nhập vào Cloudflare trước:

```bash
npx wrangler login
```

Sau đó thực hiện triển khai bằng một cú nhấp chuột:

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123"
```

Nếu bạn đã có D1 và R2:

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain mail.example.com ^
  --admin-password "StrongPass!123" ^
  --database-id "<your-d1-id>" ^
  --bucket-name "<your-r2-bucket>"
```

Tập lệnh này tự động:

- Tạo hoặc tái sử dụng D1
- Tạo hoặc tái sử dụng R2
- Cập nhật `wrangler.toml`
- Khởi tạo cấu trúc bảng D1
- viết bí mật
- Thực hiện `wrangler deploy`

## Cấu hình nhận tự động tên miền phụ

Nếu bạn triển khai trên tên miền phụ, bạn cần cung cấp một bộ thông tin xác thực Cloudflare khác.

### Cách 1: API Token

```bash
CLOUDFLARE_ZONE_ID="Zone ID của bạn"
CLOUDFLARE_API_TOKEN="API Token của bạn"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

### Tùy chọn 2: Global API Key

```bash
CLOUDFLARE_ZONE_ID="Zone ID của bạn"
CLOUDFLARE_API_EMAIL="Email đăng nhập Cloudflare của bạn"
CLOUDFLARE_GLOBAL_API_KEY="Global API Key của bạn"
CLOUDFLARE_EMAIL_ROUTING_WORKER="freemail"
```

Bạn có thể chọn một trong hai phương thức xác thực sau:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_API_EMAIL + CLOUDFLARE_GLOBAL_API_KEY`

Bạn cũng có thể chuyển nó một lần trong tập lệnh triển khai:

```bash
node scripts/deploy-cloudflare.mjs ^
  --worker-name freemail ^
  --mail-domain zaojun.de5.net ^
  --admin-password "StrongPass!123" ^
  --cloudflare-zone-id "<zone-id>" ^
  --cloudflare-api-email "<cloudflare-email>" ^
  --cloudflare-global-api-key "<global-api-key>" ^
  --cloudflare-email-routing-worker freemail
```

## Mục cấu hình

### Yêu cầu

| Biến             | Mô tả                                                         |
| ---------------- | ------------------------------------------------------------- |
| `MAIL_DOMAIN`    | Tên miền email, hỗ trợ nhiều tên miền cách nhau bằng dấu phẩy |
| `ADMIN_PASSWORD` | Mật khẩu quản trị viên                                        |
| `JWT_TOKEN`      | Khóa JWT                                                      |
| `TEMP_MAIL_DB`   | Ràng buộc D1                                                  |
| `MAIL_EML`       | R2 ràng buộc                                                  |

### Các tùy chọn phổ biến

| Biến                              | Mô tả                                          |
| --------------------------------- | ---------------------------------------------- |
| `ADMIN_NAME`                      | Tên người dùng quản trị viên, mặc định `admin` |
| `GUEST_PASSWORD`                  | Mật khẩu tài khoản khách                       |
| `RESEND_API_KEY`                  | Gửi lại gửi cấu hình                           |
| `FORWARD_RULES`                   | Quy tắc chuyển tiếp tiền tố                    |
| `CLOUDFLARE_ZONE_ID`              | Zone ID                                        |
| `CLOUDFLARE_API_TOKEN`            | API Token                                      |
| `CLOUDFLARE_API_EMAIL`            | Email đăng nhập Cloudflare                     |
| `CLOUDFLARE_GLOBAL_API_KEY`       | Global API Key                                 |
| `CLOUDFLARE_EMAIL_ROUTING_WORKER` | Worker đích khi tự động tạo quy tắc định tuyến |

### Cấu hình đa vùng (multi-zone) cho nhiều domain

Khi `MAIL_DOMAIN` chứa nhiều domain thuộc các zone Cloudflare khác nhau, khai báo map theo domain bằng JSON trong `MAIL_DOMAIN_ZONE_MAP` (hoặc alias `CLOUDFLARE_ZONE_MAP`).

Ví dụ:

```bash
MAIL_DOMAIN="a.example.com,b.example.net"
MAIL_DOMAIN_ZONE_MAP='{
  "a.example.com": {
    "zoneId": "zone-id-for-example-com",
    "apiToken": "token-for-zone-a",
    "workerName": "freemail"
  },
  "b.example.net": {
    "zoneId": "zone-id-for-example-net",
    "apiEmail": "you@example.net",
    "globalApiKey": "global-key-for-zone-b",
    "workerName": "freemail"
  }
}'
```

Mỗi entry domain hỗ trợ:

- `zoneId` (bắt buộc nếu khai báo entry)
- `apiToken` **hoặc** `apiEmail + globalApiKey`
- `workerName` (tùy chọn, fallback `CLOUDFLARE_EMAIL_ROUTING_WORKER` global)
- `accountId` (tùy chọn)

Nếu domain không có entry trong map, hệ thống fallback về cấu hình global hiện có (`CLOUDFLARE_ZONE_ID` + auth + worker), giữ tương thích ngược.

## Việc cần làm sau khi hoàn thành lần triển khai đầu tiên

### Mẫu tên miền gốc

1. Mở `Email > Email Routing`
2. Kích hoạt định tuyến email
3. Định cấu hình `Catch-all -> Send to a worker -> freemail`
4. Gửi email kiểm tra tới bất kỳ địa chỉ mới nào
5. Đăng nhập vào phần phụ trợ để xác nhận xem bạn đã nhận được chưa

### Mẫu tên miền phụ

1. Đảm bảo thông tin đăng nhập Cloudflare được định cấu hình
2. Đăng nhập vào phần phụ trợ
3. Tạo một hộp thư mới chưa từng được sử dụng trước đây
4. Gửi email kiểm tra đến địa chỉ email mới này
5. Xác nhận đã nhận

## Chèn lấp quy tắc hộp thư lịch sử

Nếu bạn đã tạo hộp thư trước khi bật "Tự động tạo định tuyến cho tên miền phụ", các hộp thư cũ sẽ chưa có quy tắc tự động.

Dự án hiện cung cấp giao diện chèn lấp dành cho quản trị viên:

`POST /api/admin/backfill-routing`

Ví dụ:

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"limit\":100}"
```

Chèn lấp email được chỉ định:

```bash
curl -X POST "https://your-worker.workers.dev/api/admin/backfill-routing" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"addresses\":[\"old1@example.com\",\"old2@example.com\"]}"
```

## Các lệnh thông dụng

Triển khai lại:

```bash
npx wrangler deploy --keep-vars
```

Xem bí mật:

```bash
npx wrangler secret list --name freemail
```

Xem các triển khai gần đây:

```bash
npx wrangler deployments list --name freemail
```

Xem hộp thư và quy tắc định tuyến trong cơ sở dữ liệu:

```bash
npx wrangler d1 execute TEMP_MAIL_DB --remote --command "SELECT id, address, routing_rule_id FROM mailboxes ORDER BY id DESC LIMIT 20;"
```

## Khắc phục sự cố

### Trang mở được nhưng không nhận được email

Trước tiên chúng ta hãy xem đó là chế độ nào:

- Mẫu miền gốc: kiểm tra `Catch-all -> Worker`
- Chế độ tên miền phụ: Kiểm tra xem hộp thư mới được tạo thành công hay không và quy tắc tự động Cloudflare có được tạo thành công hay không

### Số lần tạo ngẫu nhiên Lỗi Cloudflare API

Kiểm tra ưu tiên:

- `CLOUDFLARE_ZONE_ID`
- Mã thông báo API hoặc Khóa API toàn cầu có hợp lệ không
- `CLOUDFLARE_EMAIL_ROUTING_WORKER` có khớp với tên Worker không?

### Chỉ nhận được hộp thư mới, không nhận được hộp thư cũ.

Điều đó nghĩa là cơ chế tạo quy tắc tự động đang hoạt động, nhưng hộp thư cũ chưa được backfill. Hãy gọi `/api/admin/backfill-routing`.

### Mật khẩu quản trị viên cần được cập nhật

```bash
npx wrangler secret put ADMIN_PASSWORD --name freemail
npx wrangler deploy --keep-vars
```

## Giấy phép

Apache-2.0
