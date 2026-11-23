# Mochi AI Lab

Trang web của Mochi: nạp firmware **Mochi AI** ngay trên trình duyệt, sơ đồ đấu dây bằng ảnh linh kiện thật, và các tính năng dùng trên điện thoại.

## Các trang

| Trang | Nội dung |
|---|---|
| `index.html` | Trang chủ: tổng quan, thẻ **Nạp firmware** (theo mạch) và thẻ **Tính năng** |
| `nap-firmware.html` | Mục **Nạp firmware** trên menu: chỉ các thẻ mạch |
| `esp32-c3.html` | ESP32-C3 + ST7735S 0.96": nút nạp, sơ đồ **Loại 1 – có pin** / **Loại 2 – không pin**, bảng chân, lưu ý |
| `esp32-s3.html` | ESP32-S3 N16R8 (sắp có): sơ đồ dự kiến |
| `nhan-chu.html` | Nhắn chữ lên Mochi qua Wi-Fi (MQTT qua `broker.emqx.io`, mã hoá đầu-cuối AES-GCM bằng mã 12 ký tự của Mochi), giao diện Mochi + chữ hoặc Màu nền + chữ to |
| `giao-dien.html` | Giao diện Mochi: màu thân, chế độ / kiểu / màu nền đồng hồ, thời tiết, giờ ngủ, giật mình |
| `cai-dat.html` | Cài đặt Mochi: âm lượng, hẹn giờ, cài lại Wi-Fi, khởi động lại, **cập nhật firmware qua Wi-Fi**, hướng dẫn đổi mã |

Dùng chung: `site.css` (màu sáng/tối, thanh menu, thẻ, bố cục), `site.js` (logo, menu và chân trang; thêm trang vào menu ở mảng `MENU`), `cards.js` (danh sách thẻ mạch `BOARDS` và tính năng `FEATURES`), `mochi-link.js` (kết nối MQTT tới Mochi, mã lưu chung), `mochi-panel.js` / `mochi-panel.css` (nút điều khiển của trang Giao diện và Cài đặt).
Sơ đồ C3: `parts.js` (ảnh linh kiện + toạ độ chân) và `diagram.js` (`MochiC3Diagram.show(1 | 2)`).

Thêm mạch hoặc tính năng mới: tạo trang mới, thêm một mục vào `BOARDS` hoặc `FEATURES` trong `cards.js` (trang chủ và trang Nạp firmware tự cập nhật), và (nếu cần) một dòng trong `MENU` của `site.js`.

## Nạp firmware

Mở trang bằng **Chrome hoặc Edge trên máy tính**, cắm Mochi bằng USB-C, bấm **Nạp Mochi AI** rồi chọn cổng COM. Nạp bằng [ESP Web Tools](https://github.com/esphome/esp-web-tools) (Web Serial). Firmware dựa trên [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32).

## Cập nhật firmware

Tăng `MOCHI_FW_VERSION` trong firmware, chạy `tools/release_firmware.ps1 -Version <bản mới>` (tạo `firmware/mochi_c3_full.bin` cho nạp USB và `firmware/mochi_c3_app.bin` cho cập nhật qua Wi-Fi, sửa `manifest-c3.json`), sửa dòng "Phiên bản" trong `esp32-c3.html`, rồi commit và push. Mochi có bộ cập nhật sẽ thấy bản mới trên trang Cài đặt.
Khi sửa `site.css`, `site.js`, `cards.js`, `mochi-link.js`, `parts.js` hoặc `diagram.js`, đổi luôn số `?v=` ở chỗ các trang gọi file đó để trình duyệt không dùng bản cũ.
