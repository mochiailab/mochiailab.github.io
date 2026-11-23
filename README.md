# Mochi AI Lab

Trang web của Mochi: nạp firmware **Mochi AI** ngay trên trình duyệt, sơ đồ đấu dây bằng ảnh linh kiện thật, và các tính năng dùng trên điện thoại.

## Các trang

| Trang | Nội dung |
|---|---|
| `index.html` | Trang chủ: thẻ **Nạp firmware** (theo mạch) và thẻ **Tính năng** |
| `esp32-c3.html` | ESP32-C3 + ST7735S 0.96": nút nạp, sơ đồ **Loại 1 – có pin** / **Loại 2 – không pin**, bảng chân, lưu ý |
| `esp32-s3.html` | ESP32-S3 N16R8 (sắp có): sơ đồ dự kiến |
| `nhan-chu.html` | Nhắn chữ lên Mochi qua Wi-Fi (MQTT qua `broker.emqx.io`), giao diện Mochi + chữ hoặc Màu nền + chữ to |

Dùng chung: `site.css` (màu, thanh menu, bố cục), `site.js` (logo + menu; thêm trang vào menu ở mảng `MENU`).
Sơ đồ C3: `parts.js` (ảnh linh kiện + toạ độ chân) và `diagram.js` (`MochiC3Diagram.show(1 | 2)`).

Thêm mạch hoặc tính năng mới: tạo trang mới, thêm một thẻ trong `index.html`, và (nếu cần) một dòng trong `MENU` của `site.js`.

## Nạp firmware

Mở trang bằng **Chrome hoặc Edge trên máy tính**, cắm Mochi bằng USB-C, bấm **Nạp Mochi AI** rồi chọn cổng COM. Nạp bằng [ESP Web Tools](https://github.com/esphome/esp-web-tools) (Web Serial). Firmware dựa trên [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32).

## Cập nhật firmware

Thay `firmware/mochi_c3_full.bin`, sửa `version` trong `manifest-c3.json` và dòng "Phiên bản" trong `esp32-c3.html`, rồi commit và push.
Khi sửa `site.css`, `site.js`, `parts.js` hoặc `diagram.js`, đổi luôn số `?v=` ở chỗ các trang gọi file đó để trình duyệt không dùng bản cũ.
