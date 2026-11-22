# NGUYENNAM.ai

Trang nạp firmware **Mochi AI** (ESP32-C3 SuperMini) ngay trên trình duyệt, kèm sơ đồ đấu dây bằng ảnh linh kiện thật.

- Mở trang bằng **Chrome hoặc Edge trên máy tính**, cắm Mochi bằng USB-C, bấm **Nạp Mochi AI** rồi chọn cổng COM.
- Nạp bằng [ESP Web Tools](https://github.com/esphome/esp-web-tools) (Web Serial).
- Firmware dựa trên [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32).

## Cập nhật firmware
Thay file `firmware/mochi_c3_full.bin`, sửa `version` trong `manifest-c3.json`, rồi commit và push.
