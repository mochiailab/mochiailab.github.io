// "Nhắn chữ" card of the Tính năng page (tinh-nang.html): kept out of the page so its CSP can forbid
// inline scripts. The link to Mochi is the one mochi-panel.js opens (window.MochiPanel), loaded first.
// Messages must match mochi_remote.h in the firmware.
(function () {
const MAX_BYTES = 300;

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const link = () => window.MochiPanel && window.MochiPanel.link();
const ready = () => { const l = link(); return !!(l && l.ready && l.send); };  // Mochi's state arrived: messages can be sealed for it

// ---------- page ----------
let waitingAck = null;
const MAX_MSG = 640;   // whole message incl. settings (firmware: kMaxMessage)
const st = Object.assign({ mode: 'mochi', bg: '#f7b6cb', bg2: '#8a5cf0', grad: false, dir: 'h', fg: '#ffffff', sz: 48, sp: 40 },
  JSON.parse(localStorage.getItem('mochiStyle') || '{}'));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}
function bytesOf(s) { return enc.encode(s).length; }
function updateSend() {
  const s = $('msg').value.trim(), n = bytesOf(s);
  $('count').textContent = n + ' / ' + MAX_BYTES;
  $('count').className = n > MAX_BYTES ? 'over' : '';
  const ok = ready();
  $('btnSend').disabled = !ok || !s || n > MAX_BYTES;
  $('btnClear').disabled = !ok;
  const p = $('preview');
  p.textContent = s || 'xin chào!';
  p.className = s.length > 14 ? '' : 'short';
  renderPoster();
}

// ---------- style controls ----------
function saveStyle() { localStorage.setItem('mochiStyle', JSON.stringify(st)); }
function renderControls() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
  $('screen').classList.toggle('color', st.mode === 'color');
  $('colorOpts').classList.toggle('hidden', st.mode !== 'color');
  $('symNote').classList.toggle('hidden', st.mode === 'color');
  $('bg').value = st.bg; $('bg2').value = st.bg2; $('fg').value = st.fg; $('grad').checked = st.grad;
  $('bg2').classList.toggle('hidden', !st.grad); $('dirSeg').classList.toggle('hidden', !st.grad);
  document.querySelectorAll('#dirSeg button').forEach(b => b.classList.toggle('on', b.dataset.dir === st.dir));
  document.querySelectorAll('#sizeSeg button').forEach(b => b.classList.toggle('on', +b.dataset.sz === st.sz));
  $('speed').value = st.sp; $('speedVal').textContent = st.sp;
  renderPoster();
}
function renderPoster() {
  const box = $('poster'), span = $('posterText');
  if (st.mode !== 'color') return;
  box.style.background = st.grad
    ? `linear-gradient(${st.dir === 'v' ? '180deg' : '90deg'}, ${st.bg}, ${st.bg2})` : st.bg;
  const scale = box.clientWidth / 160 || 2;          // preview px per mochi px
  span.style.color = st.fg;
  span.style.fontSize = (st.sz * scale) + 'px';
  span.textContent = $('msg').value.trim() || 'xin chào!';
  span.className = '';
  span.style.animationDuration = '0s';
  requestAnimationFrame(() => {
    const textW = span.scrollWidth - box.clientWidth;   // padding-left = box width
    if (textW <= box.clientWidth) { span.className = 'short'; return; }
    span.style.animationDuration = ((textW + box.clientWidth) / (st.sp * scale)) + 's';
  });
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  st.mode = b.dataset.mode; saveStyle(); renderControls();
});
['bg', 'bg2', 'fg'].forEach(id => $(id).addEventListener('input', () => { st[id] = $(id).value; saveStyle(); renderPoster(); }));
$('grad').addEventListener('change', () => { st.grad = $('grad').checked; saveStyle(); renderControls(); });
$('dirSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.dir = b.dataset.dir; saveStyle(); renderControls(); });
$('sizeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.sz = +b.dataset.sz; saveStyle(); renderControls(); });
$('speed').addEventListener('input', () => { st.sp = +$('speed').value; $('speedVal').textContent = st.sp; saveStyle(); renderPoster(); });
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const [bg, bg2, fg] = b.dataset.p.split(',');
  st.bg = bg; st.grad = !!bg2; if (bg2) st.bg2 = bg2; st.fg = fg; saveStyle(); renderControls();
});
window.addEventListener('resize', renderPoster);

function buildMessage(text, secs) {
  if (!text || secs === 0) return JSON.stringify({ m: 'mochi', t: '', s: 0 });   // clear
  if (st.mode !== 'color') return JSON.stringify({ m: 'mochi', t: text, s: secs });
  const m = { m: 'color', t: text, s: secs, bg: st.bg, fg: st.fg, sz: st.sz, sp: st.sp };
  if (st.grad) { m.bg2 = st.bg2; m.dir = st.dir; }
  return JSON.stringify(m);
}

// paint the preview in Mochi's real body colour (black body: white eyes on black, as on Mochi)
function setBody(i) {
  const c = window.MochiLink.BODY_COLORS[i];
  if (!c) return;
  const root = document.documentElement.style;
  root.setProperty('--body', c.hex);
  root.setProperty('--ink', c.dark ? '#ffffff' : '#2c2838');
  // the rim: the colour three times further from white (firmware Rim()); none on the black body
  const n = parseInt(c.hex.slice(1), 16), d = (v) => Math.max(0, 255 - (255 - v) * 3);
  root.setProperty('--rim', c.dark ? c.hex : `rgb(${d(n >> 16)},${d((n >> 8) & 255)},${d(n & 255)})`);
}

window.MochiPanel.on((leaf, payload) => {
  if (leaf === 'state') { try { setBody(JSON.parse(payload).color); } catch (e) {} }
  else if (leaf === 'ack' && waitingAck) {
    clearTimeout(waitingAck.timer);
    toast(waitingAck.clear ? 'Đã tắt chạy chữ trên Mochi' : 'Mochi đã nhận ✓');
    waitingAck = null;
  }
  updateSend();
});

function send(text, secs) {
  if (!ready()) return;
  const msg = buildMessage(text, secs);
  if (bytesOf(text) > MAX_BYTES || bytesOf(msg) > MAX_MSG) { toast('Câu dài quá, bớt chữ đi nhé'); return; }
  link().send('text', msg);
  if (waitingAck) clearTimeout(waitingAck.timer);
  waitingAck = { clear: !text, timer: setTimeout(() => {
    waitingAck = null;
    toast('Đã gửi, nhưng chưa thấy Mochi trả lời. Mochi có đang bật không?');
  }, 6000) };
  toast('Đang gửi…');
}

$('btnSend').addEventListener('click', () => send($('msg').value.trim().replace(/\s+/g, ' '), +$('secs').value));
$('btnClear').addEventListener('click', () => {  // stops both styles (firmware: text_off)
  if (!ready()) return;
  link().send('cmd', JSON.stringify({ cmd: 'text_off' }));
  if (waitingAck) clearTimeout(waitingAck.timer);
  waitingAck = { clear: true, timer: setTimeout(() => { waitingAck = null; toast('Chưa thấy Mochi trả lời. Mochi có đang bật không?'); }, 6000) };
});
$('msg').addEventListener('input', updateSend);
$('msg').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!$('btnSend').disabled) $('btnSend').click(); }
});
$('quick').addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  $('msg').value = e.target.textContent; updateSend(); $('msg').focus();
});
$('syms').addEventListener('click', (e) => {  // insert the symbol where the cursor is
  if (e.target.tagName !== 'BUTTON') return;
  const m = $('msg'), sym = e.target.textContent;
  const a = m.selectionStart ?? m.value.length, b = m.selectionEnd ?? m.value.length;
  m.value = m.value.slice(0, a) + sym + m.value.slice(b);
  m.focus();
  m.setSelectionRange(a + sym.length, a + sym.length);
  updateSend();
});

renderControls();
updateSend();
})();
