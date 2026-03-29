# Chức năng hàng đầu của hộp thư

## Tổng quan về chức năng

Chức năng hàng đầu của hộp thư cho phép người dùng ghim các địa chỉ email được sử dụng thường xuyên vào đầu danh sách lịch sử hộp thư để truy cập và quản lý nhanh chóng.

## Các tính năng chính

### 1. Ghim/bỏ ghim
- Bấm vào biểu tượng 📍 bên phải mục hộp thư để ghim hộp thư lên trên cùng
- Sau khi ghim biểu tượng sẽ chuyển thành 👍. Nhấp để hủy ghim.
- Trạng thái được ghim sẽ được lưu vào cơ sở dữ liệu

### 2. Nhận dạng hình ảnh
- Hộp thư được ghim sẽ có màu nền và đường viền đặc biệt
- Dấu ** hiển thị ở góc trên bên trái hộp thư được ghim
- Hiển thị các nút hành động khi di chuột qua

### 3. Phân loại thông minh
- Email được ghim luôn xuất hiện ở đầu danh sách
- Sắp xếp theo thời gian truy cập lần cuối trong cùng cấp độ
- Hỗ trợ tải trang

## Cách sử dụng

### Email được ghim
1. Tìm email bạn muốn ghim lên đầu danh sách lịch sử email
2. Di chuột qua mục hộp thư và nút 📍 sẽ được hiển thị.
3. Nhấp vào nút 📍 và email sẽ được ghim lên trên cùng

### Hủy mã pin
1. Tìm địa chỉ email đã ghim (có dấu ???)
2. Hiển thị nút 📌 khi di chuột
3. Nhấn vào nút 📌 để hủy mã pin.

### Quản lý hàng loạt
- Bạn có thể ghim nhiều hộp thư cùng lúc
- Các email được ghim sẽ được sắp xếp theo thời gian được ghim.
- Khi xóa hộp thư, trạng thái đã ghim sẽ bị xóa đồng thời

## Triển khai kỹ thuật

###Cấu trúc cơ sở dữ liệu
```sql
ALTER TABLE mailboxes ADD COLUMN is_pinned INTEGER DEFAULT 0;
CREATE INDEX idx_mailboxes_is_pinned ON mailboxes(is_pinned DESC);
```

###Giao diện API
- `POST /api/mailboxes/pin?address=Địa chỉ email` - Chuyển sang trạng thái trên cùng
- `GET /api/mailboxes` - Trả về danh sách email được sắp xếp theo trạng thái được ghim

### Tương tác từ phía trước
- Cập nhật trạng thái được ghim theo thời gian thực
- Tự động sắp xếp lại hiển thị
- Hỗ trợ chế độ demo

## khả năng tương thích

-Hỗ trợ tự động di chuyển dữ liệu hộp thư hiện có
- Tương thích ngược, không ảnh hưởng đến chức năng hiện có
- Hoàn toàn có thể sử dụng được ở chế độ demo

## Ghi chú

1. Trạng thái được ghim là cấp độ người dùng và không được chia sẻ giữa những người dùng khác nhau.
2. Khi xóa hộp thư, trạng thái đã ghim sẽ bị xóa đồng thời.
3. Chức năng ghim không ảnh hưởng đến việc nhận và gửi email.
4. Hỗ trợ chế độ trình diễn ngoại tuyến
