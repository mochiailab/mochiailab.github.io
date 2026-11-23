// Mochi AI Lab: the top bar (logo + menu) shared by every page.
// A page writes <header data-active="..."> (plus anything page-specific inside it, such as
// the browser-check chip); this fills in the logo and the menu in front of that content.
// To add a page to the menu, add one line to MENU.
(function () {
  const MENU = [
    { id: 'home', href: './', text: 'Trang chủ' },
    { id: 'firmware', href: './#nap-firmware', text: 'Nạp firmware' },
    { id: 'text', href: 'nhan-chu.html', text: 'Nhắn chữ' },
  ];
  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="10" width="56" height="48" rx="22" fill="#f7b6cb"/>' +
    '<rect x="18" y="26" width="8" height="11" rx="4" fill="#2c2838"/><rect x="38" y="26" width="8" height="11" rx="4" fill="#2c2838"/>' +
    '<circle cx="20" cy="28" r="1.6" fill="#fff"/><circle cx="40" cy="28" r="1.6" fill="#fff"/>' +
    '<path d="M28 44 q4 4 8 0" stroke="#2c2838" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';

  const header = document.querySelector('header[data-active]');
  if (!header) return;
  const active = header.dataset.active;
  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = './';
  brand.innerHTML = LOGO + 'Mochi AI <span>Lab</span>';
  const nav = document.createElement('nav');
  nav.className = 'menu';
  nav.setAttribute('aria-label', 'Menu');
  for (const item of MENU) {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.text;
    if (item.id === active) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    nav.appendChild(a);
  }
  header.prepend(brand, nav);
})();
