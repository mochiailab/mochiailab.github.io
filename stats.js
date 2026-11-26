// Mochi AI Lab: anonymous counts in GoatCounter (https://www.goatcounter.com, no cookies).
//   - one visit per page view: only the page path (never the #hash, which can hold a Mochi key
//     from the QR code, nor the ?query) plus the referring site and the screen width;
//   - firmware flashes on the flasher pages as events "nap-<board>-bat-dau / -xong / -loi".
// It sends GoatCounter's no-JavaScript pixel from our own code: no third-party script runs on this
// origin, where Mochi keys are stored. Off on localhost and while GC_CODE is empty.
(function () {
  const GC_CODE = 'mochiailab';  // the GoatCounter site code: https://<GC_CODE>.goatcounter.com
  const on = !!GC_CODE && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  // the referring site (another site only), without its query or hash
  function referrer() {
    try {
      const r = new URL(document.referrer);
      return r.origin === location.origin ? '' : r.origin + r.pathname;
    } catch (e) { return ''; }
  }
  function hit(path, title, event) {
    if (!on) return;
    const q = new URLSearchParams({ p: path, t: title || '', rnd: Math.random().toString(36).slice(2) });
    if (event) q.set('e', 'true');
    else {
      const r = referrer();
      if (r) q.set('r', r);
      q.set('s', [screen.width, screen.height, window.devicePixelRatio || 1].join(','));
    }
    new Image().src = 'https://' + GC_CODE + '.goatcounter.com/count?' + q;
  }

  // Firmware flashes: ESP Web Tools fires no public event, so watch its install dialog's own
  // state (ewt-install-dialog._installState.state: ... writing, finished, error) while a flash
  // button is on the page. Each state is counted once per dialog.
  function watchFlash() {
    const btn = document.querySelector('esp-web-install-button');
    if (!btn) return;
    const m = (btn.getAttribute('manifest') || '').match(/manifest-(\w+)\.json/);
    const board = m ? m[1] : 'khac';
    const NAMES = { writing: 'bat-dau', finished: 'xong', error: 'loi' };
    const TITLES = { writing: 'Bắt đầu nạp', finished: 'Nạp xong', error: 'Nạp lỗi' };
    const seen = new WeakMap();
    setInterval(() => {
      const d = document.querySelector('ewt-install-dialog');
      const st = d && d._installState && d._installState.state;
      if (!NAMES[st]) return;
      const done = seen.get(d) || new Set();
      seen.set(d, done);
      if (done.has(st)) return;
      done.add(st);
      hit('nap-' + board + '-' + NAMES[st], TITLES[st] + ' ' + board.toUpperCase(), true);
    }, 700);
  }

  window.MochiStats = { code: GC_CODE, on, event: (name, title) => hit(name, title, true) };
  // (the owner's own stats page is not counted)
  if (!/thong-ke\.html$/.test(location.pathname)) hit(location.pathname.replace(/index\.html$/, ''), document.title);
  watchFlash();
})();
