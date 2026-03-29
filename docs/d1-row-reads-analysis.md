# Phân tích đọc hàng cơ sở dữ liệu D1

## Tại sao có 4 triệu hàng được đọc?

Ngay cả khi không có nhiều người dùng thì vẫn có thể xảy ra số lượng lớn lượt đọc hàng. Sau đây là những lý do có thể:

### 1. **COUNT truy vấn quét toàn bộ bảng**

```sql
-- Truy vấn này sẽ quét toàn bộ bảng mailboxes
SELECT COUNT(1) AS count FROM mailboxes;
-- Nếu có 10.000 hộp thư, tính phí: 10.000 dòng đọc
```

**COUNT truy vấn trong dự án**:
- `getTotalMailboxCount()` - được kích hoạt mỗi khi quản trị viên cấp cao xem hạn mức
- `getCachedUserQuota()` - COUNT trong truy vấn hạn ngạch người dùng
- `listUsersWithCounts()` - COUNT(1) trong truy vấn phụ

**Giải pháp**: Đã thêm bộ nhớ đệm nhưng vẫn cần chú ý

---

### 2. **THAM GIA xếp chồng số hàng truy vấn**

```sql
-- Truy vấn trong listUsersWithCounts
SELECT u.*, COALESCE(cnt.c, 0) AS mailbox_count
FROM users u
LEFT JOIN (
  SELECT user_id, COUNT(1) AS c 
  FROM user_mailboxes 
  GROUP BY user_id
) cnt ON cnt.user_id = u.id;
```

**Thanh toán**:
- Quét bảng user: giả sử 100 user
- Quét bảng user_mailboxes: giả sử 5000 bản ghi
- Tổng cộng: 5100 hàng đã đọc (mỗi truy vấn cho danh sách người dùng)

---

### 3. **Truy vấn khởi tạo thường xuyên**

Được thực thi mỗi khi Worker khởi động nguội hoặc khởi động lại:
- nhiều lần `PRAGMA table_info()` - quét định nghĩa cột của bảng mỗi lần
- `SELECT name FROM sqlite_master` - Quét bảng hệ thống
- Kiểm tra và di chuyển cấu trúc bảng

**Ước lượng**:
- Nếu Công nhân khởi động lại 50 lần một ngày
- Mỗi lần khởi tạo tạo ra khoảng 200 dòng đọc
- Hàng ngày: 10.000 hàng được đọc

---

### 4. **Truy vấn không có LIMIT hoặc LIMIT quá lớn**

Truy vấn trước khi tối ưu hóa:
```sql
-- Mỗi lần truy vấn 50 email
SELECT * FROM messages WHERE mailbox_id = ? ORDER BY received_at DESC LIMIT 50;
```

Nếu có 100 người dùng hoạt động kiểm tra email 10 lần mỗi ngày:
- 100 người dùng × 10 lần × 50 hàng = 50.000 hàng/ngày

---

### 5. **Quét chỉ mục cũng được tính là lần đọc hàng**

Ngay cả khi một chỉ mục được sử dụng, các hàng chỉ mục được quét vẫn được tính:

```sql
-- Ngay cả khi có chỉ mục, vẫn quét toàn bộ các dòng khớp
SELECT * FROM messages WHERE mailbox_id = 123 ORDER BY received_at DESC;
-- Nếu hộp thư có 1.000 email, tính phí: 1.000 dòng đọc
```

---

### 6. **Hiệu quả tích lũy của các hoạt động hàng loạt**

```sql
-- Chuyển quyền đăng nhập hộp thư hàng loạt (trước tối ưu)
-- 100 hộp thư = 100 lần truy vấn × số dòng quét trung bình
```

---

## Ước tính trường hợp thực tế

Giả sử dự án của bạn có khối lượng dữ liệu sau:
- Số lượng hộp thư: 10.000
- Số lượng email: 100.000
- Số lượng người dùng: 50
- Số người hoạt động hàng ngày: 10 người

### Ước tính lượt đọc hàng ngày:

| Hoạt động | Tần số | Đọc đơn | Tổng số hàng ngày |
|------|------|----------|----------|
| Khởi tạo công nhân | 50 lần | 200 hàng | 10.000 |
| Xem danh sách gửi thư | 10 người dùng × 20 lần | 20 dòng | 4.000 |
| Xem chi tiết email | 10 người dùng × 50 lần | 1 hàng | 500 |
| Quản trị viên đã xem danh sách người dùng | 5 lần | 5.050 hàng | 25.250 |
| Hạn ngạch tổng quan (COUNT) | 10 lần | 10.000 hàng | 100.000 |
| Nhận tin nhắn mới | 200 tin nhắn | 5 dòng | 1.000 |
| Truy vấn hạn ngạch người dùng | 100 lần | 100 hàng | 10.000 |
| **Tổng số hàng ngày** | - | - | **~150.750 hàng** |

**Một tháng**: 150.750 × 30 = **4.522.500 hàng** (4,52 triệu hàng)

---

## Lý do chính khiến việc đọc hàng cao

### 🔴 1. COUNT quét toàn bộ bảng khi kiểm tra quá hạn ngạch
```javascript
// getTotalMailboxCount() - Mỗi lần quét toàn bộ hộp thư
SELECT COUNT(1) AS count FROM mailboxes;
// 10.000 hộp thư = 10.000 dòng đọc
```

### 🔴 2. Quản trị viên thường xuyên kiểm tra danh sách người dùng
```javascript
// listUsersWithCounts() - Bao gồm JOIN và truy vấn con
// Mỗi lần truy vấn quét toàn bộ dòng của users + user_mailboxes
```

### 🔴 3. Công nhân thường xuyên khởi động nguội
- Kiểm tra cấu trúc bảng mỗi lần khởi động nguội
- Mặc dù truy vấn PRAGMA đã được lưu vào bộ đệm nhưng bộ đệm sẽ bị mất sau khi Worker được khởi động lại.

### 🔴 4. Không phân trang và lưu vào bộ nhớ đệm hợp lý
- Một số truy vấn danh sách có thể trả về quá nhiều dữ liệu
- Lặp lại truy vấn sau khi vô hiệu hóa bộ đệm

---

## Đề xuất tối ưu hóa hơn nữa

### 1. **Cache COUNT kết quả**
```javascript
// Lưu đệm tổng số hộp thư, làm mới mỗi 10 phút
let cachedMailboxCount = null;
let cachedMailboxCountTime = 0;

export async function getTotalMailboxCount(db) {
  const now = Date.now();
  if (cachedMailboxCount !== null && now - cachedMailboxCountTime < 600000) {
    return cachedMailboxCount;
  }
  
  const result = await db.prepare('SELECT COUNT(1) AS count FROM mailboxes').all();
  cachedMailboxCount = result?.results?.[0]?.count || 0;
  cachedMailboxCountTime = now;
  return cachedMailboxCount;
}
```

### 2. **Tối ưu hóa truy vấn danh sách người dùng**
```javascript
// Chỉ tính số hộp thư khi cần, thay vì JOIN mỗi lần
// Hoặc dùng dữ liệu thống kê đã lưu đệm
```

### 3. **Sử dụng Đối tượng bền vững của Cloudflare để lưu trữ số liệu thống kê**
- Lưu trữ số liệu thống kê như COUNT trong DO
- Cập nhật không đồng bộ, không ảnh hưởng đến tiến trình chính
- Giảm đáng kể COUNT truy vấn

### 4. **Thêm yêu cầu xóa trùng lặp**
- Yêu cầu tương tự sẽ không được thực hiện nhiều lần trong một khoảng thời gian ngắn
- Sử dụng ID yêu cầu hoặc Hash làm khóa bộ đệm

### 5. **Giám sát và ghi nhật ký**
```javascript
// Thêm giám sát truy vấn
const queryStats = {
  totalQueries: 0,
  estimatedRows: 0
};

// Ghi lại mỗi lần truy vấn
function logQuery(query, estimatedRows) {
  queryStats.totalQueries++;
  queryStats.estimatedRows += estimatedRows;
}
```

---

## Hạn ngạch miễn phí của Cloudflare D1

- **Số hàng được đọc hàng ngày**: 5 triệu hàng
- **Bài viết hàng ngày**: 100.000 dòng
- **Bộ nhớ**: 5 GB

Nếu vượt quá hạn ngạch:
- Worker sẽ trả về lỗi
- Yêu cầu nâng cấp lên gói trả phí

---

## Tóm tắt

4 triệu hàng được đọc chủ yếu đến từ:
1. ✅ **COUNT truy vấn** (được lưu vào bộ nhớ đệm một phần)
2. ✅ **THAM GIA truy vấn** (cần tối ưu hóa thêm)
3. ✅ **Khởi tạo thường xuyên** (bộ đệm cấu trúc bảng được tối ưu hóa)
4. ✅ **Không GIỚI HẠN hợp lý** (tối ưu hóa)
5. ⚠️ **Quản lý quá mức hạn ngạch xem thường xuyên** (cần thêm bộ đệm dài hơn)
6. ⚠️ **Worker khởi động lại thường xuyên** (cân nhắc sử dụng bộ nhớ đệm liên tục)

Nên ưu tiên tối ưu hóa thời gian bộ đệm của các truy vấn vượt quá hạn mức quản lý!

