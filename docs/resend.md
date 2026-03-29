# Sử dụng Resend để gửi email (hướng dẫn cấu hình và lấy API key)

Dự án này hỗ trợ gửi email (outbox) thông qua API do Resend cung cấp. Tài liệu này giới thiệu quy trình hoàn chỉnh từ đăng ký khóa, ràng buộc tên miền cho đến định cấu hình nó trong Cloudflare Workers.

> Mức độ ưu tiên của biến môi trường được đọc theo mã: `RESEND_API_KEY` > `RESEND_TOKEN` > `RESEND`. Nên sử dụng `RESEND_API_KEY`.

## 1. Ràng buộc và xác minh tên miền gửi trong Resend

- Đăng nhập vào dashboard Resend, vào mục Domains và nhấn Add Domain.
- Làm theo trình hướng dẫn để thêm tên miền gửi của bạn và thêm bản ghi tương ứng vào DNS cho đến khi quá trình xác minh được thông qua.

Sơ đồ nguyên lý (tham khảo quy trình):

![Thêm tên miền 1 trong Resend](../pic/resend/2adddomain1.png)

![Thêm tên miền 2 trong Resend](../pic/resend/2adddomain2.png)

![Thêm tên miền 3 trong Resend](../pic/resend/2adddomain3.png)

![Thêm tên miền 4 trong Resend](../pic/resend/2adddomain4.png)

![Thêm tên miền 5 trong Resend](../pic/resend/2adddomain5.png)

Sau khi hoàn tất, hãy đảm bảo trạng thái tên miền là Đã xác minh. Địa chỉ giao hàng phải sử dụng tên miền đã được xác minh này, ví dụ: `no-reply@yourdomain.com`.

## 2. Tạo API key Resend

- Vào Resend → API Keys và nhấp Create API Key.
- Nên cấp quyền đọc/ghi (Email: send/read/update) và lưu API key an toàn.

Ảnh chụp màn hình tham khảo:

![Tạo khóa API 1](../pic/resend/createapikey1.png)

![Tạo khóa API 2](../pic/resend/createapikey2.png)

![Tạo khóa API 3](../pic/resend/createapikey3.png)

## 3. Cấu hình các biến trong Cloudflare Workers

Dự án này chạy trên Cloudflare Workers và khóa cần được định cấu hình là Bí mật và tên miền là biến thông thường.

Cách 1: Dòng lệnh (Wrangler)

```bash
# Thiết lập khóa Resend (Secret)
wrangler secret put RESEND_API_KEY
# Hoặc dùng các biến tương đương sau (không khuyến nghị): RESEND_TOKEN / RESEND

# Thiết lập biến thường (có thể ghi vào [vars] trong wrangler.toml)
# Nhiều tên miền phân tách bằng dấu phẩy/khoảng trắng
# Ví dụ: MAIL_DOMAIN="iding.asia, example.com"
```

Phương pháp 2: Bảng điều khiển (thường dùng khi triển khai qua Git)

- Đi tới Cloudflare Dashboard → Workers → chọn Worker của bạn → Settings → Variables.
- Thêm `RESEND_API_KEY` vào Bí mật.
- Thêm `MAIL_DOMAIN` vào Biến, giá trị là danh sách tên miền bạn dùng để nhận/gửi email (phải thống nhất với tên miền Resend verify).

## 4. Liên kết dự án và triển khai

```bash
# Phát triển cục bộ
wrangler dev

# Triển khai chính thức
wrangler deploy
```

Đảm bảo `wrangler.toml` đã được liên kết với cơ sở dữ liệu D1 và tài nguyên tĩnh (kho đã được định cấu hình).

## 5. Sử dụng chức năng gửi (hộp thư đi) ở giao diện người dùng

- Trước tiên, tạo hoặc chọn một địa chỉ email trên trang chủ.
- Nhấn “Gửi Email”, nhập người nhận, chủ đề và nội dung rồi gửi.
- Backend sẽ gọi Resend API để gửi email và ghi vào cơ sở dữ liệu. Trên giao diện, bạn có thể xem lịch sử và chi tiết trong "Hộp thư đi".

Để ý:

- Địa chỉ gửi là địa chỉ email đang chọn (dạng `xxx@ten-mien-cua-ban`). Tên miền này phải được xác minh trên Resend.
- Nếu trả về `Chưa cấu hình Resend API Key`, điều đó có nghĩa là `RESEND_API_KEY` không được đặt hoặc cung cấp ở biểu mẫu Bí mật.

## 6. Câu hỏi thường gặp

- 403/Unauthorized: Tên miền chưa được xác minh hoặc tên miền From không khớp với tên miền đã xác minh.
- 429/Giới hạn hiện tại: Số lượng yêu cầu lớn trong thời gian ngắn, thử lại sau hoặc mở hàng đợi.
- Với nội dung HTML: dự án gửi HTML trực tiếp tới Resend và tự tạo bản văn bản thuần để tăng tương thích.

## 7. Các giao diện phụ trợ liên quan

- `POST /api/send` Gửi một email duy nhất
- `GET /api/sent?from=xxx@domain` Lấy danh sách bản ghi gửi
- `GET /api/sent/:id` Nhận chi tiết lô hàng
- `DELETE /api/sent/:id` Xóa hồ sơ gửi

Các API trên được triển khai trong `src/apiHandlers.js` và `src/emailSender.js`, sử dụng Resend REST API để gửi/truy vấn/hủy.
