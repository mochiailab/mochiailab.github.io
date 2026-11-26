// Mochi AI Lab: the colour theme, loaded in <head> of every page (before it paints, so there is
// no flash of the wrong colours). Mode: light / dark / auto (follows the phone); accent: one of
// ACCENTS, or "Theo Mochi" (the body colour Mochi reports, saved by the pages as mochiBody);
// glass: the Liquid Glass effect on or off. Kept in localStorage on this browser only.
// site.js draws the picker; it calls MochiTheme.set(...).
(function () {
  const ACCENTS = [
    ['Hồng Mochi', '#ec5f9b', '#9b6bff'], ['Tím đêm', '#8b5cf6', '#3b82f6'], ['Bạc hà', '#10b981', '#06b6d4'],
    ['Biển', '#3b82f6', '#06b6d4'], ['Cam đào', '#f97316', '#ec4899'], ['Chanh', '#65a30d', '#14b8a6'],
    ['Than', '#64748b', '#334155'], ['Theo Mochi', null, null],
  ];
  // Mochi's body colours (mochi-link.js BODY_COLORS) as accent pairs for "Theo Mochi"
  const BODY_ACCENTS = [['#ec6f98', '#b48cf0'], ['#2fbf8a', '#3bb3d6'], ['#e0a31a', '#f08a5a'], ['#9a7cf0', '#5f8cf5'],
    ['#8a8fa3', '#5d6477'], ['#5d5a6e', '#2b2838']];
  const KEY = 'mochiTheme';
  const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  let t = { mode: 'auto', accent: 0, glass: 1 };  // glass on by default (the look the user chose); the picker turns it off
  try { t = Object.assign(t, JSON.parse(get(KEY, '{}'))); } catch (e) {}
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

  function apply() {
    const root = document.documentElement;
    const dark = t.mode === 'dark' || (t.mode === 'auto' && mq && mq.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.glass = t.glass ? 'on' : 'off';
    let pair = ACCENTS[t.accent] || ACCENTS[0];
    if (!pair[1]) {  // "Theo Mochi"
      const b = BODY_ACCENTS[+get('mochiBody', 0)] || BODY_ACCENTS[0];
      pair = [pair[0], b[0], b[1]];
    }
    root.style.setProperty('--accent', pair[1]);
    root.style.setProperty('--accent2', pair[2]);
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.content = dark ? '#120f1f' : '#fdf8fb';
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);

  // Has this browser the key of a Mochi? (mochi-link.js keeps it as mochiKey: localStorage, or
  // sessionStorage for this tab only.) Without one the site is a showcase: html[data-key="0"]
  // hides .needkey, html[data-key="1"] hides .intro (site.css), the menu drops Giao diện / Tính
  // năng (site.js), and pages marked <html data-needkey> go to the home page. Set before paint.
  const KEY_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;
  function hasKey() {
    try { return KEY_RE.test(sessionStorage.getItem('mochiKey') || '') || KEY_RE.test(localStorage.getItem('mochiKey') || ''); }
    catch (e) { return false; }
  }
  // Developer mode (localStorage mochiDev = 1), opened by tapping the footer 7 times (site.js),
  // like Android's "build number": until then the site shows only Mochi, the wiring and the
  // firmware flasher, and no key box. It only hides the controls (the key and its encryption
  // are what protect a Mochi), so people who are not told about it don't find the key box.
  function isDev() { try { return localStorage.getItem('mochiDev') === '1'; } catch (e) { return false; } }
  function markKey() {
    const dev = isDev(), k = dev && hasKey();
    document.documentElement.dataset.dev = dev ? '1' : '0';
    document.documentElement.dataset.key = k ? '1' : '0';
    return k;
  }
  if (!markKey() && document.documentElement.hasAttribute('data-needkey')) location.replace('./');
  window.MochiTheme = {
    ACCENTS, get: () => Object.assign({}, t),
    set(part) { t = Object.assign(t, part); put(KEY, JSON.stringify(t)); apply(); },
    // the pages call this with Mochi's body colour; it matters when "Theo Mochi" is picked
    body(i) { if (String(i) !== get('mochiBody', '')) { put('mochiBody', i); apply(); } },
    // re-read the key after it was saved / forgotten (site.js MochiSite.keyChanged); true = has one
    markKey,
    isDev,
    setDev(on) { try { if (on) localStorage.setItem('mochiDev', '1'); else localStorage.removeItem('mochiDev'); } catch (e) {} return markKey(); },
  };
})();
