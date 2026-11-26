// Mochi AI Lab: the board cards (Cài đặt › Nạp firmware) and feature cards.
// To add a board or a feature, add one entry here. A page shows a list with
// <div class="cards" data-cards="boards"></div> (or "features").
(function () {
  const BOARDS = [
    {
      icon: 'C3', title: 'ESP32-C3 + ST7735S 0.96"', status: 'ok', sub: 'ESP32-C3 SuperMini · 4 MB flash',
      text: 'Mochi đang dùng. Mic INMP441, ampli MAX98357A, nút chạm TTP223.',
      href: 'esp32-c3.html',
      variants: [
        { href: 'esp32-c3.html?loai=1', icon: '🔋', name: 'Loại 1 · Có pin', sub: 'Pin 14250 + mạch sạc' },
        { href: 'esp32-c3.html?loai=2', icon: '🔌', name: 'Loại 2 · Không pin', sub: 'Cắm cáp USB-C' },
      ],
    },
    {
      icon: 'S3', title: 'ESP32-S3 + ST7789 1.69"', status: 'soon', sub: 'N16R8 · 16 MB flash · 8 MB PSRAM',
      text: 'Màn 240×280 đặt dọc, mặt Mochi to hơn. Sơ đồ đấu dây và giao diện xem trước. Firmware đang chuẩn bị.',
      href: 'esp32-s3.html', go: 'Xem sơ đồ & giao diện ›',
    },
  ];
  const FEATURES = [
    {
      icon: '🎨', feature: true, title: 'Giao diện Mochi', sub: 'Màu, đồng hồ, thời tiết, giờ ngủ',
      text: 'Đổi màu và độ sáng, bật đồng hồ, chọn kiểu và màu nền đồng hồ, xem thời tiết, giờ ngủ.',
      href: 'giao-dien.html', go: 'Mở ›',
    },
    {
      icon: '✨', feature: true, title: 'Tính năng Mochi', sub: 'Nhắn chữ, nuôi Mochi, lời nhắc',
      text: 'Nhắn chữ lên Mochi, cho Mochi ăn, lời nhắc và báo thức, Pomodoro, hẹn giờ, gọi để trò chuyện.',
      href: 'tinh-nang.html', go: 'Mở ›',
    },
    {
      icon: '⚙', feature: true, title: 'Cài đặt Mochi', sub: 'Điều khiển từ xa qua Wi-Fi',
      text: 'Âm lượng, cập nhật, cài lại Wi-Fi, khởi động lại, đổi mã của Mochi.',
      href: 'cai-dat.html', go: 'Mở ›',
    },
  ];

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TAGS = { ok: '<span class="tag ok">Sẵn sàng</span>', soon: '<span class="tag warn">Sắp có</span>' };

  function card(c) {
    const head = `<div class="top"><span class="icon${c.feature ? ' feature' : ''}">${esc(c.icon)}</span>` +
      `<h3>${esc(c.title)} ${TAGS[c.status] || ''}<small>${esc(c.sub)}</small></h3></div>` +
      `<p>${esc(c.text)}</p>`;
    if (c.variants) {  // a div (links inside links are not allowed) with a full-card link behind
      const v = c.variants.map((x) => `<a href="${x.href}">${x.icon} ${esc(x.name)}<small>${esc(x.sub)}</small></a>`).join('');
      return `<div class="card link"><a class="cover" href="${c.href}" aria-label="${esc(c.title)}"></a>${head}` +
        `<div class="variants">${v}</div></div>`;
    }
    return `<a class="card${c.status === 'soon' ? ' soon' : ''}" href="${c.href}">${head}<span class="go">${esc(c.go || 'Mở ›')}</span></a>`;
  }

  const LISTS = { boards: BOARDS, features: FEATURES };
  document.querySelectorAll('[data-cards]').forEach((el) => {
    el.innerHTML = (LISTS[el.dataset.cards] || []).map(card).join('');
  });
})();
