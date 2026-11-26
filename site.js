// Mochi AI Lab: what every page shares, drawn from here so the pages stay plain.
//   - the top bar: logo, menu, quick search (Ctrl+K), Mochi's status pill, the colour picker
//   - the bottom dock on phones (the same menu, app style, with a sliding "drop")
//   - the Liquid Glass backdrop (drifting colour blobs + an SVG lens for refraction)
//   - the footer
// A page writes <header data-active="..."> (plus anything page-specific inside it); to add a page
// to the menu, add one line to MENU. Pages can add palette commands with MochiSite.addCommands()
// and show Mochi's state in the pill with MochiSite.status(). Colours: theme.js.
(function () {
  const MENU = [
    { id: 'home', href: './', text: 'Trang chủ', icon: '🏠' },
    { id: 'look', href: 'giao-dien.html', text: 'Giao diện', icon: '🎨', key: true },
    { id: 'features', href: 'tinh-nang.html', text: 'Tính năng', icon: '✨', key: true },
    { id: 'stats', href: 'thong-ke.html', text: 'Thống kê', icon: '📊', owner: true },
    { id: 'settings', href: 'cai-dat.html', text: 'Cài đặt', icon: '⚙️' },
  ];
  // pages that live inside a menu item (the firmware pages are part of Cài đặt)
  const PARENT = { firmware: 'settings' };
  // items with key: true (and palette commands of the 'Mochi' group) only show once this browser
  // has a Mochi key (theme.js markKey: html[data-key])
  const T0 = window.MochiTheme;
  let hasKey = document.documentElement.dataset.key === '1';
  // the owner's devices: the GoatCounter secret link saved on thong-ke.html (mochiOwner); items
  // with owner: true (and palette commands of the 'Chủ' group) only show there
  const ownerNow = () => { try { return !!localStorage.getItem('mochiOwner'); } catch (e) { return false; } };
  let isOwner = ownerNow();
  const shows = (m) => (hasKey || !m.key) && (isOwner || !m.owner);
  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="10" width="56" height="48" rx="22" fill="#f7b6cb"/>' +
    '<rect x="18" y="26" width="8" height="11" rx="4" fill="#2c2838"/><rect x="38" y="26" width="8" height="11" rx="4" fill="#2c2838"/>' +
    '<circle cx="20" cy="28" r="1.6" fill="#fff"/><circle cx="40" cy="28" r="1.6" fill="#fff"/>' +
    '<path d="M28 44 q4 4 8 0" stroke="#2c2838" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  const header = document.querySelector('header[data-active]');
  if (!header) return;
  const active = PARENT[header.dataset.active] || header.dataset.active;

  // ---------- Liquid Glass backdrop ----------
  const blobs = el('div', 'blobs', '<i></i><i></i><i></i>');
  blobs.setAttribute('aria-hidden', 'true');
  const lens = el('div', null, '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="lens" x="0" y="0" width="100%" height="100%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="3" result="n"/><feGaussianBlur in="n" stdDeviation="2" result="nb"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="nb" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter></svg>');
  document.body.prepend(blobs, lens);
  document.addEventListener('pointermove', (e) => {
    document.documentElement.style.setProperty('--gx', Math.round(e.clientX / innerWidth * 100) + '%');
  }, { passive: true });

  // ---------- top bar ----------
  const brand = el('a', 'brand', LOGO + 'Mochi AI <span>Lab</span>');
  brand.href = './';
  const nav = el('nav', 'menu');
  nav.setAttribute('aria-label', 'Menu');
  for (const item of MENU) {
    const a = el('a', null, item.text);
    a.href = item.href; a.dataset.id = item.id;
    if (item.id === active) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    nav.appendChild(a);
  }
  const tools = el('div', 'hdr-tools');
  const search = el('button', 'gbtn gsearch', '🔎 <span>Tìm hay ra lệnh…</span><kbd>Ctrl K</kbd>');
  search.type = 'button';
  const pill = el('a', 'gpill', '<span class="dot"></span><span class="txt">Mochi</span>');
  pill.href = 'cai-dat.html#ma';  // the key and Mochi's full status live on Cài đặt
  pill.hidden = true;
  const paint = el('button', 'gbtn', '🎨');
  paint.type = 'button'; paint.title = 'Đổi màu giao diện'; paint.setAttribute('aria-label', 'Đổi màu giao diện');
  tools.append(search, pill, paint);
  header.prepend(brand, nav);
  header.append(tools);

  // ---------- colour picker ----------
  const T = window.MochiTheme;
  const pop = el('div', 'theme-pop', '<h4>Chế độ</h4><div class="seg3"><button data-m="light">☀️ Sáng</button><button data-m="dark">🌙 Tối</button><button data-m="auto">🖥️ Theo máy</button></div>' +
    '<h4>Màu chủ đạo</h4><div class="swatches"></div>' +
    '<div class="trow"><div>Hiệu ứng kính<small>Tắt nếu máy chạy chậm</small></div><button class="gtoggle" aria-label="Hiệu ứng kính"></button></div>' +
    '<p style="color:var(--muted);font-size:12.5px;margin:10px 0 0">"Theo Mochi" lấy màu thân Mochi đang dùng. Lựa chọn được nhớ trên máy này.</p>');
  document.body.appendChild(pop);
  const sw = pop.querySelector('.swatches');
  if (T) {
    sw.innerHTML = T.ACCENTS.map(([n, a, b], i) => `<button class="sw${a ? '' : ' mochi'}" data-i="${i}"><i style="background:${a ? `linear-gradient(135deg,${a},${b})` : 'linear-gradient(135deg,#fac8d4,#d6c6f6)'}"></i>${n}</button>`).join('');
  }
  function syncPop() {
    if (!T) return;
    const t = T.get();
    pop.querySelectorAll('.seg3 button').forEach((b) => b.classList.toggle('on', b.dataset.m === t.mode));
    sw.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', +b.dataset.i === t.accent));
    pop.querySelector('.gtoggle').classList.toggle('on', !!t.glass);
  }
  pop.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]'), s = e.target.closest('.sw'), g = e.target.closest('.gtoggle');
    if (m && T) T.set({ mode: m.dataset.m });
    if (s && T) T.set({ accent: +s.dataset.i });
    if (g && T) T.set({ glass: T.get().glass ? 0 : 1 });
    syncPop();
  });
  paint.addEventListener('click', (e) => { e.stopPropagation(); syncPop(); pop.classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.theme-pop')) pop.classList.remove('open'); });

  // ---------- quick search / commands (Ctrl+K) ----------
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const COMMANDS = [
    ...MENU.map((m) => [m.icon, 'Mở trang ' + m.text, m.owner ? 'Chủ' : m.key ? 'Mochi' : 'Trang', () => { location.href = m.href; }]),
    ['🔑', 'Nhập mã của Mochi', 'Trang', () => { location.href = 'cai-dat.html#ma'; }],
    ['⚡', 'Nạp firmware cho Mochi mới', 'Trang', () => { location.href = 'cai-dat.html#nap'; }],
    ['☀️', 'Giao diện sáng', 'Màu', () => T && T.set({ mode: 'light' })],
    ['🌙', 'Giao diện tối', 'Màu', () => T && T.set({ mode: 'dark' })],
    ['🖥️', 'Giao diện theo máy', 'Màu', () => T && T.set({ mode: 'auto' })],
    ...(T ? T.ACCENTS.map(([n], i) => ['🎨', 'Màu ' + n, 'Màu', () => T.set({ accent: i })]) : []),
  ];
  const bg = el('div', 'cmd-bg', '<div class="cmd"><input placeholder="Gõ: cho ăn, đồng hồ, màu tím, tối…" autocomplete="off"><ul></ul></div>');
  document.body.appendChild(bg);
  const input = bg.querySelector('input'), list = bg.querySelector('ul');
  let sel = 0, shown = [];
  function render() {
    const q = fold(input.value.trim());
    shown = COMMANDS.filter((c) => (hasKey || c[2] !== 'Mochi') && (isOwner || c[2] !== 'Chủ') && fold(c[1]).includes(q)).slice(0, 12);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((c, i) => `<li class="${i === sel ? 'sel' : ''}" data-i="${i}">${c[0]} ${c[1]}<small>${c[2]}</small></li>`).join('') ||
      '<li>Không thấy lệnh nào</li>';
  }
  function run(i) { const c = shown[i]; bg.classList.remove('open'); if (c) c[3](); }
  function openCmd() { bg.classList.add('open'); input.value = ''; sel = 0; render(); setTimeout(() => input.focus(), 30); }
  search.addEventListener('click', openCmd);
  input.addEventListener('input', () => { sel = 0; render(); });
  list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) run(+li.dataset.i); });
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.classList.remove('open'); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmd(); return; }
    if (!bg.classList.contains('open')) return;
    if (e.key === 'Escape') bg.classList.remove('open');
    else if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter') run(sel);
  });

  // ---------- bottom dock (phones) ----------
  const dock = el('nav', 'dock', '<i class="drop" aria-hidden="true"></i>');
  dock.setAttribute('aria-label', 'Menu');
  const drop = dock.querySelector('.drop');
  const visible = () => MENU.filter(shows);
  MENU.forEach((m) => {
    const a = el('a', m.id === active ? 'active' : null, `<span>${m.icon}</span>${m.text}`);
    a.href = m.href; a.dataset.id = m.id;
    a.addEventListener('click', () => { drop.style.transform = `translateX(${visible().indexOf(m) * 100}%)`; });
    dock.appendChild(a);
  });
  document.body.appendChild(dock);
  // show / hide the key-only items in the menu and the dock (the dock's columns follow the count)
  function applyKey() {
    const shownItems = visible();
    for (const a of [...nav.children, ...dock.querySelectorAll('a')]) {
      const m = MENU.find((x) => x.id === a.dataset.id);
      a.hidden = !shownItems.includes(m);
    }
    dock.style.setProperty('--n', shownItems.length);
    const ai = shownItems.findIndex((m) => m.id === active);
    drop.hidden = ai < 0;
    if (ai >= 0) drop.style.transform = `translateX(${ai * 100}%)`;
  }
  applyKey();

  // ---------- footer ----------
  const footer = document.querySelector('footer');
  if (footer) {
    footer.innerHTML = '© ' + new Date().getFullYear() + ' <b>Nguyễn Nam</b> · Mochi AI Lab';
  }

  window.MochiSite = {
    // extra palette commands from a page: [[icon, text, group, fn], ...]
    addCommands(cmds) { COMMANDS.unshift(...cmds); },
    hasKey: () => hasKey,
    // after a key was saved or forgotten (mochi-link.js saveCode / forgetCode)
    keyChanged() {
      hasKey = T0 && T0.markKey ? T0.markKey() : hasKey;
      isOwner = ownerNow();
      applyKey();
    },
    // the status pill: online true (green dot) / false (yellow) / null (connecting, yellow) /
    // 'nokey' (grey: no key saved yet), plus an emoji for the mood. A tap opens the key on Cài đặt.
    status(online, emoji) {
      pill.hidden = false;
      pill.classList.toggle('on', online === true);
      pill.classList.toggle('off', online !== true && online !== 'nokey');
      const t = online === true ? 'Mochi ' + (emoji || '') : online === false ? 'Mochi ngoại tuyến'
        : online === 'nokey' ? 'Chưa có mã' : 'Đang kết nối…';
      pill.querySelector('.txt').textContent = t;
      pill.title = online === true ? 'Mochi đang trực tuyến' : t;
    },
  };
})();
