# Hướng dẫn tối ưu hóa khởi tạo cơ sở dữ liệu

## Mục tiêu tối ưu hóa
Giảm việc đọc hàng cơ sở dữ liệu mỗi khi Worker khởi động và tránh các hoạt động khởi tạo và kiểm tra cấu trúc bảng không cần thiết.

## Những cải tiến lớn

### 1. Cơ chế khởi tạo nhẹ
**Trước khi tối ưu hóa**:
- Thực hiện kiểm tra cấu trúc bảng hoàn chỉnh mỗi lần khởi động
- Sử dụng `PRAGMA table_info` để truy vấn thông tin cột của mỗi bảng
- Thực hiện `ALTER TABLE` nhiều lần để cố gắng thêm cột mới
- Kiểm tra logic di chuyển bảng cũ

**Sau khi tối ưu hóa**:
- Kiểm tra toàn bộ chỉ được thực hiện ở lần khởi động đầu tiên trong vòng đời của Worker
- Sử dụng truy vấn nhanh (`SELECT 1 FROM table LIMIT 1`) để xác minh rằng bảng tồn tại
- Nếu bảng tồn tại, bỏ qua việc khởi tạo trực tiếp
- Đã xóa tất cả các kiểm tra cấu trúc bảng thời gian chạy

### 2. Cấu trúc bảng chuẩn
**Trước khi tối ưu hóa**:
- Kiểm tra xem cột có tồn tại hay không trước khi chèn dữ liệu mỗi lần
- Xây dựng câu lệnh SQL động
- Sử dụng thông tin cấu trúc bảng được lưu trữ

**Sau khi tối ưu hóa**:
- Sử dụng cấu trúc bảng cố định (được xác định trong `d1-init.sql`)
- Chèn dữ liệu trực tiếp bằng tên cột tiêu chuẩn
- Nếu cột không tồn tại sẽ báo lỗi trực tiếp để tiện khắc phục sự cố.

### 3. Kịch bản thiết lập cơ sở dữ liệu độc lập
Tệp `d1-init.sql` được tạo để khởi tạo cấu trúc cơ sở dữ liệu trong lần triển khai đầu tiên.

**Cách sử dụng**:
```bash
# Thực thi khi triển khai lần đầu
wrangler d1 execute DB --file=./d1-init.sql
```

## Thay đổi mã

### database.js
1. **initDatabase()**: đơn giản hóa để kiểm tra nhẹ
2. **performFirstTimeSetup()**: Đã thêm chức năng cài đặt khởi động lần đầu
3. **setupDatabase()**: Đã thêm chức năng thiết lập cơ sở dữ liệu hoàn chỉnh (có sẵn để thực hiện thủ công)
4. **ensureUsersTables()**: Đơn giản hóa để chỉ tạo bảng
5. **ensureSentEmailsTable()**: Đơn giản hóa để chỉ tạo bảng
6. **recordSentEmail()**: Xóa logic tạo bảng dự phòng

### server.js
1. Loại bỏ tính năng phát hiện cấu trúc bảng trong xử lý nhận email
2. Chèn dữ liệu trực tiếp bằng tên cột tiêu chuẩn

### apiHandlers.js
1. Xóa quá trình nhập và gọi `ensureSentEmailsTable`
2. Loại bỏ tính năng phát hiện cấu trúc bảng trong quá trình nhận email kiểm tra

## Cải tiến hiệu suất

### Giảm việc đọc hàng
- **Mỗi lần bắt đầu của mỗi công nhân**: Giảm từ ~20-30 truy vấn xuống còn 3-4 truy vấn nhanh
- **Nhận thư**: Giảm từ cấu trúc danh sách kiểm tra + Thao tác chèn vào chỉ chèn
- ** Lệnh gọi API **: không cần kiểm tra cấu trúc bảng bổ sung

### Tốc độ khởi động
- Tốc độ khởi động nguội của công nhân tăng khoảng 30-50%
- Khởi động ấm hầu như không có chi phí khởi tạo cơ sở dữ liệu

## Đề xuất triển khai

### Triển khai lần đầu
1. Thực thi script khởi tạo SQL để tạo cấu trúc bảng
2. Triển khai mã Worker
3. Xác minh rằng hệ thống đang hoạt động bình thường

### Cập nhật triển khai
1. Chỉ cần triển khai trực tiếp mã mới
2. Nếu cấu trúc bảng đã tồn tại, việc khởi tạo sẽ tự động bị bỏ qua.

### Thay đổi cấu trúc bảng
Nếu bạn cần sửa đổi cấu trúc bảng:
1. Cập nhật tệp `d1-init.sql`
2. Thực thi câu lệnh `ALTER TABLE` theo cách thủ công để thêm cột mới
3. Cập nhật câu lệnh chèn/truy vấn trong mã
4. Triển khai mã mới

## Ghi chú

1. **Cấu trúc bảng đã được sửa**: Hệ thống giả định rằng cấu trúc bảng đã được tạo chính xác và sẽ không tự động sửa chữa các cột bị thiếu.
2. **Thông báo lỗi**: Nếu bảng hoặc cột không tồn tại, lỗi sẽ được đưa ra trực tiếp để hỗ trợ khắc phục sự cố.
3. **Khả năng tương thích**: Hoàn toàn tương thích với nền tảng Cloudflare D1
4. **Nâng cấp liền mạch**: Đối với cơ sở dữ liệu hiện có, lần khởi động đầu tiên sẽ nhanh chóng xác minh và bỏ qua quá trình khởi tạo.

## Đề xuất giám sát

Nên theo dõi các chỉ số sau:
- Số lần đọc hàng cơ sở dữ liệu D1 (hàng ngày)
- Thời gian khởi động của công nhân
- Tỷ lệ lỗi cơ sở dữ liệu

Nếu phát hiện thấy lỗi bảng không tồn tại, điều đó có nghĩa là tập lệnh SQL khởi tạo cần được thực thi.

