
## Hướng dẫn triển khai bằng một cú nhấp chuột

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cong91/freemail-cloudflare)

#### 1. Đầu tiên click vào Deploy to Cloudflare

#### 2 Sau khi đăng nhập tài khoản xong bạn sẽ vào. Nên chọn Châu Á (tất nhiên không chọn Châu Á cũng không sao)
`Không sửa tên cơ sở dữ liệu và tên R2, có thể dẫn tới không truy vấn được`
![5a0cc80913848aca4b5f4058538ad6aa|690x333](../pic/v4/depl1.png)
#### 3. Nhấp vào Tạo triển khai, sau đó kiên nhẫn chờ triển khai bản sao
![5a0cc80913848aca4b5f4058538ad6aa|690x333](../pic/v4/depl2.png)

#### 4. Nhấp để tiếp tục xử lý dự án và liên kết các biến môi trường cần thiết
![5a0cc80913848aca4b5f4058538ad6aa|690x333](../pic/v4/depl.png)

![5a0cc80913848aca4b5f4058538ad6aa|690x333](../pic/v4/depl5.png)


#### 5. Sau khi thêm xong nhấn Deploy

`Lưu ý: Ba biến này là bắt buộc, các biến khác như tên quản trị viên và khóa gửi mail có thể tùy chọn thêm`

Cuối cùng, bạn có thể mở kết nối công nhân tương ứng và đăng nhập.

![5a0cc80913848aca4b5f4058538ad6aa|690x333](../pic/v4/depl5.jpeg)

#### 6. Tài khoản quản trị mặc định là admin


#### 7. Hãy nhớ ràng buộc toàn bộ hộp thư tên miền với nhân viên (bạn không thể nhận email mà không ràng buộc)
![5a0cc80913848aca4b5f4058538ad6aa|690x333](../pic/v4/depl6.png)
