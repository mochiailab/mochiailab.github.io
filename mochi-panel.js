// Mochi AI Lab: connection + controls of the remote-control pages (giao-dien.html, tinh-nang.html,
// cai-dat.html). Each page holds only the cards it shows; this wires whatever is there.
// Other scripts on the page (nhan-chu.js) share this one link through window.MochiPanel.
// Commands / state must match OnRemoteCommand / StateJson in the firmware (mochi_c3_board.cc).
(function () {
const { Link, OldLink, KEY_RE, OLD_CODE_RE, normKey, prettyKey } = window.MochiLink;
// clock backgrounds, same order as kClockBgs in mochi_display.h (0 = Mochi's own colour)
const CLOCK_BGS = [['Màu theo mẫu', ''], ['Đen', '#000000'], ['Xanh trời', '#c4e2fc', 1], ['Tím nhạt', '#ded0fc', 1],
  ['Bạc hà', '#c6f2d8', 1], ['Cam đào', '#ffd8c8', 1], ['Vàng chanh', '#fcf0aa', 1], ['Hồng phấn', '#ffd2e4', 1],
  ['Kem', '#faeed6', 1], ['Trắng', '#f4f4f4', 1]];
const COLORS = window.MochiLink.BODY_COLORS.map((c) => [c.name, c.dark ? '#111111' : c.hex]);
// a page has only some of the controls: missing ones resolve to a detached dummy element
const DUMMY = document.createElement('div');
const $ = (id) => document.getElementById(id) || DUMMY;
let mq = null, code = '', online = null, state = null, gotState = false;
// the key box lives on Cài đặt only; the other pages connect with the key saved there
const KEY_BOX = !!document.getElementById('code');
const listeners = [];  // (leaf, payload): every message, plus ('link', status) on connection changes
function emit(leaf, payload) { for (const f of listeners) { try { f(leaf, payload); } catch (e) { console.error(e); } } }
window.MochiPanel = { on: (f) => listeners.push(f), link: () => mq };

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function setStatus(kind, title, sub) {
  $('status').className = 'status ' + kind; $('stTitle').textContent = title; $('stSub').textContent = sub;
}
const PILL_MOODS = ['🙂', '🥺', '😪', '💬', '😢', '🤩'];  // the header pill (site.js)
function refreshStatus() {
  const ready = !!(mq && mq.connected);
  if (window.MochiSite) window.MochiSite.status(ready ? online : null, state && state.pet && state.pet.on === 1 ? PILL_MOODS[state.pet.m] : '');
  if (window.MochiTheme && state) window.MochiTheme.body(state.color);
  $('btnConnect').textContent = ready ? 'Đổi mã' : 'Kết nối';
  $('controls').disabled = !(ready && online && gotState);
  if (!ready) return;
  if (online === false) setStatus('off', 'Mochi đang tắt hoặc mất mạng', 'Bật Mochi rồi thử lại');
  else if (online && gotState) setStatus('on', 'Mochi đang trực tuyến', 'Mã ' + prettyKey(code) + ' · sẵn sàng');
  else if (online) setStatus('busy', 'Mochi trực tuyến, chưa có cài đặt', 'Firmware cũ chưa hỗ trợ trang này: nạp bản mới ở mục Nạp firmware');
  else setStatus('busy', 'Đã kết nối máy chủ', 'Chưa thấy Mochi mã ' + prettyKey(code) + '. Kiểm tra mã hoặc chờ Mochi khởi động xong');
}

// ---------- controls from the state Mochi publishes ----------
// WMO weather code -> emoji + Vietnamese words (for the page; Mochi draws its own icon)
function wxInfo(code, day) {
  if (code <= 1) return [day ? '☀️' : '🌙', 'Trời quang'];
  if (code === 2) return [day ? '⛅' : '☁️', 'Ít mây'];
  if (code === 3) return ['☁️', 'Nhiều mây'];
  if (code === 45 || code === 48) return ['🌫️', 'Sương mù'];
  if (code >= 95) return ['⛈️', 'Dông'];
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['❄️', 'Tuyết'];
  if (code >= 51 && code <= 57) return ['🌦️', 'Mưa phùn'];
  if (code >= 51) return ['🌧️', 'Mưa'];
  return ['🌡️', ''];
}
function renderWeather() {
  const w = state.wx || {};
  $('wxWhere').textContent = (w.auto ? 'Tự động theo mạng' : 'Đã chọn') + (w.city ? ': ' + w.city : '');
  $('wxAuto').classList.toggle('on', !!w.auto);
  if (typeof w.t !== 'number') {
    $('wxIcon').textContent = '…'; $('wxTemp').textContent = 'Chưa có thời tiết';
    $('wxMore').textContent = 'Mochi sẽ lấy khi rảnh, hoặc bấm Cập nhật ngay';
    return;
  }
  const [icon, words] = wxInfo(w.c, w.day);
  $('wxIcon').textContent = icon;
  $('wxTemp').textContent = Math.round(w.t) + '°C · ' + words;
  $('wxMore').textContent = 'Độ ẩm ' + w.h + '% · thấp ' + Math.round(w.mn) + '° cao ' + Math.round(w.mx) + '° · cập nhật ' +
    (w.age > 0 ? w.age + ' phút trước' : 'vừa xong');
}

function render() {
  if (!state) return;
  document.querySelectorAll('#faces button').forEach((b) => b.classList.toggle('on', +b.dataset.v === (state.cstyle || 0)));
  // (black is no longer offered: the clock faces keep their own colours on it, as with 0)
  document.querySelectorAll('#clockBg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === (state.cbg > 1 ? state.cbg : 0)));
  drawFacePreviews();
  renderWeather();
  document.querySelectorAll('#colors button').forEach((b) => b.classList.toggle('on', +b.dataset.v === state.color));
  $('clock').checked = state.clock === 1;
  $('volume').value = state.volume; $('volVal').textContent = state.volume + '%';
  renderPet();
  if (typeof state.bright === 'number') { $('bright').value = state.bright; $('brightVal').textContent = state.bright + '%'; }
  else $('brightVal').textContent = 'cần bản mới';  // firmware before the brightness setting
  const bedOn = state.bed_s !== state.bed_e;
  $('bedOn').checked = bedOn; $('bedHours').hidden = !bedOn;
  if (bedOn) { $('bedS').value = state.bed_s; $('bedE').value = state.bed_e; }
  $('sleepNow').checked = !!state.sleep;
  // "call to talk" (replaced the startle): state.call = sensitivity level, 0 = off
  const call = typeof state.call === 'number' ? state.call : 0;
  $('callOn').checked = call > 0; $('callLevelRow').hidden = $('callNote').hidden = !(call > 0);
  if (call > 0) lastCall = call;
  document.querySelectorAll('#callLevel button').forEach((b) => b.classList.toggle('on', +b.dataset.v === call));
  const t = state.timer;
  $('timerLeft').textContent = t > 0 ? 'Còn ' + Math.floor(t / 60) + ' phút ' + String(t % 60).padStart(2, '0') + ' giây' : 'Không có hẹn giờ';
  $('info').textContent = 'Mạch ' + BOARD_NAMES[boardOf(state)] + ' · Giờ trên Mochi: ' + state.time + ' · lõi xiaozhi ' + state.fw + (state.sleep ? ' · Đang ngủ' : '') +
    (state.rr ? ' · Đã chạy ' + upText(state.up) + ', lần bật: ' + resetText(state.rr) : '') +
    (state.crash ? ' · Sự cố gần nhất: ' + resetText(state.crash.split('|')[0]) + (state.crash.includes('|') ? ' lúc ' + state.crash.split('|')[1] : '') : '');
  renderUpdate();
}

// why Mochi last started (firmware Board::ResetReasonName), in plain words
const RESET_VI = { 'power-on': 'bật nguồn', 'software restart': 'khởi động lại theo lệnh', 'panic or exception': 'lỗi phần mềm',
  'interrupt watchdog': 'bị treo', 'task watchdog': 'bị treo', 'other watchdog': 'bị treo', brownout: 'sụt nguồn / pin yếu',
  'power glitch': 'chập nguồn', 'CPU lockup': 'bị treo', 'USB peripheral': 'cắm lại USB', 'external pin': 'nút reset' };
function resetText(r) { return RESET_VI[r] || r; }
function upText(s) { s = s || 0; return s < 3600 ? Math.round(s / 60) + ' phút' : s < 172800 ? Math.floor(s / 3600) + ' giờ' : Math.floor(s / 86400) + ' ngày'; }

// ---------- "Nuôi Mochi" (firmware: mochi_pet.h, state.pet) ----------
const MOODS = [['🙂', 'Mochi đang ổn'], ['🥺', 'Mochi đang đói'], ['😪', 'Mochi mệt rồi'],
  ['💬', 'Mochi cần tâm sự'], ['😢', 'Mochi đang buồn'], ['🤩', 'Mochi vui lắm']];
function renderPet() {
  const p = state.pet;
  $('tsnd').checked = state.tsnd !== 0;
  if (!p) { $('petMood').textContent = 'Cần cập nhật firmware mới'; $('petCard').classList.add('off'); return; }
  $('petOn').checked = p.on === 1; $('petSnd').checked = p.snd === 1;
  $('petCard').classList.toggle('off', p.on !== 1);
  const [face, text] = p.on === 1 ? (MOODS[p.m] || MOODS[0]) : ['💤', 'Đang tắt nuôi Mochi'];
  $('petFace').textContent = face; $('petMood').textContent = text;
  const a = p.ate;
  $('petAte').textContent = a < 0 ? '' : 'Ăn lần cuối: ' + (a < 1 ? 'vừa xong' : a < 60 ? a + ' phút trước' : Math.floor(a / 60) + ' tiếng trước');
  for (const [k, id] of [['f', 'petF'], ['j', 'petJ'], ['t', 'petT'], ['e', 'petE']]) {
    $(id).style.width = p[k] + '%'; $(id + 'v').textContent = p[k] + '%';
  }
}
$('foods').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (state && state.pet && state.pet.f >= 95) { toast('Mochi no rồi, để lát nữa nhé 😊'); return; }
  if (send('feed', { v: +b.dataset.food })) toast('Mochi đang ăn ' + b.textContent.replace(/^\S+\s/, '').toLowerCase() + ' 😋');
});
$('petOn').addEventListener('change', () => { if (send('pet_on', { v: $('petOn').checked ? 1 : 0 })) toast($('petOn').checked ? 'Đã bật nuôi Mochi' : 'Đã tắt nuôi Mochi'); });
$('petSnd').addEventListener('change', () => { if (send('pet_snd', { v: $('petSnd').checked ? 1 : 0 })) toast($('petSnd').checked ? 'Mochi sẽ kêu khi đói / buồn' : 'Mochi sẽ không kêu nữa'); });
$('tsnd').addEventListener('change', () => { if (send('tsnd', { v: $('tsnd').checked ? 1 : 0 })) toast($('tsnd').checked ? 'Đã bật tiếng khi chạm' : 'Đã tắt tiếng khi chạm'); });

function send(cmd, extra) {
  if (!mq || !mq.ready) return false;
  return mq.send('cmd', JSON.stringify(Object.assign({ cmd }, extra || {})));
}
const DONE = { weather_refresh: 'Mochi đang lấy thời tiết…', text_off: 'Đã tắt chạy chữ', pet: 'Mochi được thả tim 💗', clock_show: 'Mochi đang hiện giờ', sleep: 'Mochi sẽ đi ngủ', wake: 'Đã đánh thức Mochi' };

// A 6-letter code = firmware before the encrypted link: only offer the update to it.
// The box is on the Cài đặt page; the other pages point there.
function connectOld(c) {
  if (mq) mq.close();
  code = c; online = null; state = null; gotState = false;
  if (KEY_BOX) window.MochiLink.saveCode(c);
  $('controls').disabled = true;
  const box = document.getElementById('oldFw');
  if (box) box.hidden = false;
  let st = null;
  const show = () => {
    if (!mq || !mq.connected) return;
    if (online === false) setStatus('off', 'Mochi đang tắt hoặc mất mạng', 'Bật Mochi rồi thử lại');
    else setStatus('busy', 'Mochi đang chạy firmware cũ (mã 6 ký tự)',
      box ? 'Cập nhật lên bản mã hoá ở ô bên dưới' : 'Vào trang Cài đặt để cập nhật lên bản mã hoá');
    if (!box || $('oldFwBtn').dataset.sent) return;
    $('oldFwBtn').disabled = !(online && st && st.updater === 1);
    $('oldFwInfo').textContent = !st ? 'Đang chờ Mochi…'
      : st.updater === 1 ? 'Phiên bản Mochi: ' + (st.mfw || 'cũ') + ' · có thể cập nhật qua Wi-Fi'
      : 'Mochi này chưa có bộ cập nhật qua Wi-Fi: nạp lại bằng cáp USB ở trang Nạp firmware.';
  };
  setStatus('busy', 'Đang kết nối…', 'Tới máy chủ nhắn tin');
  mq = new OldLink(c, (leaf, payload) => {
    if (leaf === 'status') online = payload === 'online';
    else if (leaf === 'state') { try { st = JSON.parse(payload); } catch (e) {} }
    show();
  }, (s) => {
    if (s === 'ready') { setStatus('busy', 'Đã kết nối máy chủ', 'Chưa thấy Mochi mã ' + c + '. Kiểm tra mã hoặc chờ Mochi khởi động xong'); show(); }
    else setStatus('', 'Mất kết nối', 'Bấm Kết nối để thử lại');
    $('btnConnect').textContent = mq && mq.connected ? 'Đổi mã' : 'Kết nối';
  });
  mq.open();
}
$('oldFwBtn').addEventListener('click', () => {
  if (!mq || !mq.update || !mq.update()) return;
  $('oldFwBtn').disabled = true; $('oldFwBtn').dataset.sent = '1';
  $('oldFwInfo').textContent = 'Mochi đang cập nhật (khoảng 1 phút, màn hiện thanh tiến trình). Xong, mở menu trên Mochi, mục Code web, rồi nhập mã mới 12 ký tự ở ô trên.';
  toast('Đã gửi lệnh cập nhật');
});

function connect(key) {
  const c = normKey(key || $('code').value);
  if (OLD_CODE_RE.test(c)) { connectOld(c); return; }
  const box = document.getElementById('oldFw');
  if (box) box.hidden = true;
  if (!KEY_RE.test(c)) { toast('Mã gồm 12 chữ/số, xem trong menu của Mochi (mục Code web)'); $('code').focus(); return; }
  if (mq) mq.close();
  code = c; online = null; state = null; gotState = false;
  if (KEY_BOX) window.MochiLink.saveCode(code);
  setStatus('busy', 'Đang kết nối…', 'Tới máy chủ nhắn tin');
  mq = new Link(code, (leaf, payload) => {
    if (leaf === 'status') online = payload === 'online';
    else if (leaf === 'state') {
      try { state = JSON.parse(payload); gotState = true; render(); renderPomo(); } catch (e) {}
    } else if (leaf === 'alarms') {
      try { alarms = JSON.parse(payload) || []; renderAlarms(); } catch (e) {}
    }
    refreshStatus();
    emit(leaf, payload);
  }, (st) => {
    if (st === 'ready') {
      setTimeout(refreshStatus, 2500);
    } else if (st === 'nocrypto') setStatus('', 'Trình duyệt không hỗ trợ mã hoá', 'Mở trang bằng Chrome, Safari hoặc Edge bản mới');
    else if (st === 'closed') setStatus('busy', 'Mất kết nối, đang kết nối lại…', 'Trang tự thử lại khi có mạng');
    else setStatus('busy', 'Máy chủ chưa nhận kết nối', 'Trang tự thử lại sau ít giây');
    refreshStatus();
    emit('link', st);
  });
  mq.open();
}


// ---------- reminders & alarms (firmware: mochi_alarms.h; list on the sealed "alarms" topic) ----------
const KIND_NAME = ['Một lần', 'Hằng ngày', 'Lặp lại', 'Báo thức'];
const DAY_NAME = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
let alarms = [], aKind = 1;
const pad2 = (n) => String(n).padStart(2, '0');
function daysText(d) {
  if (d === 127) return 'mỗi ngày';
  if (d === 62) return 'thứ 2 - thứ 6';
  if (d === 65) return 'cuối tuần';
  return [1, 2, 3, 4, 5, 6, 0].filter((i) => d & (1 << i)).map((i) => DAY_NAME[i]).join(', ');
}
function renderAlarms() {
  const el = $('alarmList');
  if (!alarms.length) { el.innerHTML = '<p class="muted" style="margin:0">Chưa có lời nhắc nào.</p>'; return; }
  el.innerHTML = alarms.map((a, i) => {
    const when = a.k === 2 ? (a.n >= 60 ? (a.n / 60) + ' tiếng' : a.n + ' phút') : pad2(a.h) + ':' + pad2(a.m);
    const sub = a.k === 2 ? 'Lặp lại mỗi ' + when + ', 7:00–22:00' : a.k === 0 ? 'Một lần' : (a.k === 3 ? '☀ Báo thức, ' : '') + daysText(a.d);
    const what = a.t ? a.t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) : (a.k === 3 ? 'Chào buổi sáng' : 'Đến giờ rồi');
    return `<div class="alarm${a.on ? '' : ' off'}"><span class="when">${a.k === 2 ? '🔁' : when}</span>` +
      `<div class="what"><b>${what}</b><small>${sub}</small></div>` +
      `<label class="switch"><input type="checkbox" data-on="${i}" ${a.on ? 'checked' : ''} aria-label="Bật"><span></span></label>` +
      `<button class="del" data-del="${i}" aria-label="Xoá">✕</button></div>`;
  }).join('');
}
function syncForm() {
  document.querySelectorAll('#aKind button').forEach((b) => b.classList.toggle('on', +b.dataset.k === aKind));
  $('aTimeRow').hidden = aKind === 2;
  $('aEveryRow').hidden = aKind !== 2;
  $('aDaysRow').hidden = aKind === 0 || aKind === 2;
  $('aText').placeholder = aKind === 3 ? 'Lời chào (để trống: "Chào buổi sáng!")' : 'Nhắc gì? Ví dụ: Uống nước 💧';
}
$('aKind').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; aKind = +b.dataset.k; syncForm(); });
$('aDays').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); });
$('aAdd').addEventListener('click', () => {
  if (alarms.length >= 8) { toast('Tối đa 8 lời nhắc: xoá bớt một cái nhé'); return; }
  const [h, m] = ($('aTime').value || '07:00').split(':').map(Number);
  let d = 0; document.querySelectorAll('#aDays button.on').forEach((b) => { d |= +b.dataset.b; });
  if ((aKind === 1 || aKind === 3) && !d) { toast('Chọn ít nhất một ngày'); return; }
  const t = $('aText').value.trim();
  if (aKind !== 3 && !t) { toast('Gõ nội dung lời nhắc'); $('aText').focus(); return; }
  const item = { i: -1, k: aKind, h, m, d: d || 127, n: +$('aEvery').value, on: 1, t };
  if (send('alarm_set', item)) { toast('Đã thêm: ' + (t || 'báo thức') + ' ✓'); $('aText').value = ''; }
});
$('alarmList').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del && confirm('Xoá lời nhắc này?')) send('alarm_del', { v: +del.dataset.del });
});
$('alarmList').addEventListener('change', (e) => {
  const sw = e.target.closest('[data-on]'); if (!sw) return;
  const i = +sw.dataset.on, a = Object.assign({}, alarms[i], { i, on: sw.checked ? 1 : 0 });
  send('alarm_set', a);
});
syncForm();

// ---------- Pomodoro ----------
function renderPomo() {
  const on = !!(state && state.pomo);
  $('pomoCard').classList.toggle('on', on);
  if (on) $('pomoInfo').textContent = (state.pomo === 1 ? '🍅 Đang tập trung, lần ' : '☕ Đang nghỉ, sau lần ') + (state.pr || 1) + '/4';
  $('pomoStart').textContent = on ? '↻ Bắt đầu lại' : '🍅 Bắt đầu';
}
$('pomoStart').addEventListener('click', () => { if (send('pomo', { v: 1 })) toast('Pomodoro: tập trung 25 phút 🍅'); });
$('pomoStop').addEventListener('click', () => { if (send('pomo', { v: 0 })) toast('Đã dừng Pomodoro'); });

// ---------- build + wire the controls ----------
$('colors').innerHTML = COLORS.map(([n, c], i) => `<button data-v="${i}"><i style="background:${c}"></i>${n}</button>`).join('');
$('colors').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (send('color', { v: +b.dataset.v })) toast('Đổi màu: ' + COLORS[+b.dataset.v][0]);
});
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => {
  if (send(b.dataset.cmd)) toast(DONE[b.dataset.cmd] || 'Đã gửi');
}));
$('clock').addEventListener('change', () => {
  if (send('clock', { v: $('clock').checked ? 1 : 0 })) toast($('clock').checked ? 'Đã bật chế độ đồng hồ' : 'Đã tắt chế độ đồng hồ');
});
const setTimer = (min) => { if (send('timer', { v: Math.round(min * 60) })) toast('Hẹn giờ ' + min + ' phút'); };
$('timerQuick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTimer(+b.dataset.min); });
$('timerSet').addEventListener('click', () => {
  const m = +$('timerMin').value;
  if (!(m >= 1 && m <= 600)) { toast('Chọn từ 1 đến 600 phút'); return; }
  setTimer(m);
});
$('timerCancel').addEventListener('click', () => { if (send('timer', { v: 0 })) toast('Đã huỷ hẹn giờ'); });
$('volume').addEventListener('input', () => { $('volVal').textContent = $('volume').value + '%'; });
$('volume').addEventListener('change', () => { if (send('volume', { v: +$('volume').value })) toast('Âm lượng ' + $('volume').value + '%'); });
$('bright').addEventListener('input', () => { $('brightVal').textContent = $('bright').value + '%'; });
$('bright').addEventListener('change', () => { if (send('bright', { v: +$('bright').value })) toast('Độ sáng ' + $('bright').value + '%'); });
for (const id of ['bedS', 'bedE']) {
  $(id).innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('');
}
// night sleep: the firmware keeps start == end for "off", so the switch remembers the hours here
const BED_KEY = 'mochiBedHours';
function lastBedHours() {
  try { const h = JSON.parse(localStorage.getItem(BED_KEY)); if (h && h[0] !== h[1]) return h; } catch (e) {}
  return [22, 7];
}
function sendBed(s, e) {
  if (s !== e) { try { localStorage.setItem(BED_KEY, JSON.stringify([s, e])); } catch (err) {} }
  return send('bed', { start: s, end: e });
}
$('bedSave').addEventListener('click', () => {
  const s = +$('bedS').value, e = +$('bedE').value;
  if (s === e) { toast('Chọn giờ ngủ và giờ dậy khác nhau'); return; }
  if (sendBed(s, e)) toast('Ngủ từ ' + s + ':00 đến ' + e + ':00');
});
$('bedOn').addEventListener('change', () => {
  const on = $('bedOn').checked;
  const [s, e] = on ? lastBedHours() : [0, 0];
  if (!sendBed(s, e)) { $('bedOn').checked = !on; return; }
  $('bedHours').hidden = !on;
  if (on) { $('bedS').value = s; $('bedE').value = e; }
  toast(on ? 'Đã bật ngủ đêm: ' + s + ':00 đến ' + e + ':00' : 'Đã tắt ngủ đêm');
});
$('sleepNow').addEventListener('change', () => {
  const on = $('sleepNow').checked;
  if (send(on ? 'sleep' : 'wake')) toast(on ? 'Mochi sẽ đi ngủ' : 'Đã đánh thức Mochi');
  else $('sleepNow').checked = !on;
});
let lastCall = 1500;
$('callOn').addEventListener('change', () => {
  const on = $('callOn').checked;
  if (!send('call', { v: on ? lastCall : 0 })) { $('callOn').checked = !on; return; }
  $('callLevelRow').hidden = $('callNote').hidden = !on;
  toast(on ? 'Gọi "Mochi ơi!" là Mochi nghe luôn' : 'Đã tắt gọi để trò chuyện');
});
$('callLevel').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  lastCall = +b.dataset.v;
  if (send('call', { v: lastCall })) toast('Độ nhạy khi gọi: ' + b.textContent);
});
$('wifi').addEventListener('click', () => {
  if (!confirm('Mochi sẽ ngắt Wi-Fi nhà và phát Wi-Fi "N-Mochi_AI_Lab-xxxx" để bạn chọn mạng khác. Trong lúc đó trang này không điều khiển được Mochi. Tiếp tục?')) return;
  if (send('wifi')) toast('Mochi đang vào chế độ cài Wi-Fi');
});
// ---------- firmware update over Wi-Fi ----------
// the latest version is the one the web flasher serves for this Mochi's board: manifest-<hw>.json
// (state.hw "c3" / "s3"; firmware without it is a C3). Fetched again when the board changes.
const BOARD_NAMES = { c3: 'ESP32-C3 · màn 0.96"', s3: 'ESP32-S3 · màn 1.69"' };
let latest = null, latestHw = null, updating = null, updStart = 0;
const boardOf = (st) => (st && BOARD_NAMES[st.hw] ? st.hw : 'c3');
function loadLatest(hw) {
  if (latestHw === hw) return;
  latestHw = hw; latest = null;
  fetch('manifest-' + hw + '.json', { cache: 'no-store' }).then((r) => r.json())
    .then((m) => { if (latestHw === hw) { latest = m.version; renderUpdate(); } }).catch(() => {});
}
loadLatest('c3');
// "2026.11.24-7" -> compares as numbers part by part (an empty / old version is the oldest)
function cmpVersion(a, b) {
  const p = (v) => String(v || '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}
function renderUpdate() {
  if (!state) return;
  loadLatest(boardOf(state));
  const cur = state.mfw || '';
  $('updTitle').textContent = 'Phiên bản Mochi: ' + (cur || 'cũ (chưa ghi phiên bản)');
  // done = Mochi restarted after we asked (it reports its uptime), or reports a new version
  const restarted = typeof state.up === 'number' && Date.now() - updStart > (state.up + 5) * 1000;
  if (updating && cur && (cur !== updating || restarted)) {
    toast('Cập nhật xong ✓ Mochi đang chạy bản ' + cur);
    updating = null;
  }
  let sub, can = false;
  if (updating) sub = 'Mochi đang tải bản mới, màn hiện thanh tiến độ. Khoảng 1–2 phút, đừng rút điện.';
  else if (!latest) sub = boardOf(state) === 's3' ? 'Chưa có bản cập nhật cho Mochi ESP32-S3 trên web.' : 'Không đọc được bản mới nhất trên web.';
  else if (cmpVersion(cur, latest) >= 0) sub = cur === latest ? '✓ Đang là bản mới nhất' : '✓ Mới hơn bản trên web (' + latest + ')';
  else if (!state.updater) sub = 'Có bản mới ' + latest + ', nhưng Mochi này chưa có bộ cập nhật qua Wi-Fi: nạp lại bằng cáp USB một lần ở trang Nạp firmware.';
  else { sub = '🎉 Có bản mới: ' + latest; can = true; }
  $('updSub').textContent = sub;
  $('upd').classList.toggle('new', can);
  $('updBtn').hidden = !can && !updating;  // the button only appears when there is a newer version
  $('updBtn').disabled = !can || !!updating;
  $('updBtn').textContent = '⬆ Cập nhật lên ' + (latest || 'bản mới');
}
$('updBtn').addEventListener('click', () => {
  if (!confirm('Mochi sẽ khởi động lại, tải bản ' + (latest || 'mới nhất') + ' qua Wi-Fi (khoảng 1–2 phút) rồi tự quay lại. ' +
               'Cài đặt, Wi-Fi và mã được giữ nguyên. Đừng rút điện trong lúc cập nhật. Tiếp tục?')) return;
  if (send('update')) {
    updating = state.mfw || '?'; updStart = Date.now(); renderUpdate(); toast('Mochi bắt đầu cập nhật');
    setTimeout(() => { updating = null; renderUpdate(); }, 240000);  // (a re-install keeps the same version)
  }
});

$('reboot').addEventListener('click', () => {
  if (!confirm('Khởi động lại Mochi? Mochi sẽ mất kết nối khoảng 30 giây.')) return;
  if (send('reboot')) toast('Mochi đang khởi động lại');
});

$('clockBg').innerHTML = CLOCK_BGS.map(([n, c], i) => i === 1 ? '' :
  `<button data-v="${i}"><i class="${c ? '' : 'mochi'}" style="${c ? 'background:' + c : ''}"></i>${n}</button>`).join('');
$('clockBg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (send('clock_bg', { v: +b.dataset.v })) toast('Nền đồng hồ: ' + CLOCK_BGS[+b.dataset.v][0] + ' (Mochi hiện thử 8 giây)');
});
// clock faces: same order as the firmware's clock_style (MochiDisplay::kClockStyles); each button
// shows the face itself, drawn by mochi-screen.js in Mochi's colour, with the time and weather now
const FACE_NAMES = ['Mochi ôm giờ', 'Bầu trời', 'Thẻ thông minh', 'Xiên dango', 'Lịch âm', 'Đêm sao',
  'Mochi trèo số', 'Trà sữa', 'Theo mùa', 'Thời tiết'];
const facePrev = [];
if (document.getElementById('faces') && window.MochiScreen) {
  $('faces').innerHTML = FACE_NAMES.map((n, i) => `<button data-v="${i}"><canvas class="facecv" aria-hidden="true"></canvas>${n}</button>`).join('');
  document.querySelectorAll('#faces canvas').forEach((cv) => facePrev.push(new MochiScreen(cv, { still: true })));
  setInterval(drawFacePreviews, 30000);
}
function drawFacePreviews() {
  if (!facePrev.length) return;
  const now = (Date.now() - new Date().getTimezoneOffset() * 60000) / 1000;  // local time, read as UTC
  const st = state || {};
  facePrev.forEach((s, i) => {
    s.setState(st);
    s.setScene({ f: 0, b: st.color || 0, s: 0, ck: i, cb: st.cbg || 0, now });
    s.render();
  });
}
drawFacePreviews();
$('faces').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (send('clock_style', { v: +b.dataset.v })) toast('Kiểu đồng hồ: ' + b.textContent.replace(/^[^A-Za-zÀ-ỹ]+/, '').trim() + ' (Mochi hiện thử 8 giây)');
});
$('wxAuto').addEventListener('click', () => { if (send('weather_loc', { auto: 1 })) toast('Vị trí: tự động theo mạng'); });
async function findCity() {
  const q = $('wxCity').value.trim();
  if (q.length < 2) { toast('Gõ tên thành phố'); return; }
  $('wxResults').innerHTML = '<span class="muted">Đang tìm…</span>';
  try {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=vi&name=' + encodeURIComponent(q));
    const j = await r.json();
    const list = j.results || [];
    if (!list.length) { $('wxResults').innerHTML = '<span class="muted">Không tìm thấy, thử tên khác</span>'; return; }
    $('wxResults').innerHTML = '';
    for (const c of list) {
      const b = document.createElement('button');
      const where = [c.admin1, c.country].filter(Boolean).join(', ');
      b.innerHTML = '';
      b.append(c.name, Object.assign(document.createElement('small'), { textContent: where ? ' · ' + where : '' }));
      b.addEventListener('click', () => {
        if (send('weather_loc', { lat: +c.latitude.toFixed(4), lon: +c.longitude.toFixed(4), city: c.name })) {
          toast('Vị trí: ' + c.name + '. Mochi đang lấy thời tiết…');
          $('wxResults').innerHTML = ''; $('wxCity').value = '';
        }
      });
      $('wxResults').appendChild(b);
    }
  } catch (e) {
    $('wxResults').innerHTML = '<span class="muted">Không tìm được (mất mạng?)</span>';
  }
}
$('wxFind').addEventListener('click', findCity);
$('wxCity').addEventListener('keydown', (e) => { if (e.key === 'Enter') findCity(); });

$('btnConnect').addEventListener('click', () => connect());
// "Quên mã trên máy này" (Cài đặt): drop the link and the saved key; the site becomes the showcase
$('forget').addEventListener('click', () => {
  if (!confirm('Quên mã của Mochi trên máy này? Muốn điều khiển lại thì quét mã QR trên Mochi hoặc nhập mã.')) return;
  if (mq) mq.close();
  mq = null; code = ''; online = null; state = null; gotState = false;
  window.MochiLink.forgetCode();
  $('code').value = '';
  $('btnConnect').textContent = 'Kết nối';
  $('controls').disabled = true;
  setStatus('', 'Chưa kết nối', 'Giữ nút chạm 2 giây, chạm tới mục Code web rồi quét mã QR trên màn Mochi');
  if (window.MochiSite) window.MochiSite.status('nokey');
  toast('Đã quên mã trên máy này');
});
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
window.MochiLink.keyInput($('code'));
// "Tắt chế độ nhà phát triển": back to the public site (the saved key stays, unused, until dev mode again)
$('devOff').addEventListener('click', () => {
  if (window.MochiTheme) window.MochiTheme.setDev(false);
  location.href = './';
});
// Without developer mode (7 taps on the footer) the page is only the flasher: no link at all.
const DEV = !window.MochiTheme || !window.MochiTheme.isDev || window.MochiTheme.isDev();
// opened from the QR code on Mochi (index.html passes #<key> on): take the key, drop it from the URL
const fromQr = normKey(location.hash);
if (!DEV) {
  if (location.hash.length === 13) history.replaceState(null, '', location.pathname);
} else if (KEY_RE.test(fromQr) && location.hash.length === 13) {
  history.replaceState(null, '', location.pathname);
  $('code').value = prettyKey(fromQr);
  connect();
  toast('Đã nhận mã từ Mochi ✓');
} else {
  const saved = window.MochiLink.savedCode();
  if (KEY_RE.test(saved)) { $('code').value = prettyKey(saved); connect(saved); }
  else if (OLD_CODE_RE.test(saved)) { $('code').value = saved; connect(saved); }
  else if (!KEY_BOX) {  // these pages have no key box: point to Cài đặt
    if (window.MochiSite) window.MochiSite.status('nokey');
    toast('Chưa có mã của Mochi: nhập ở trang Cài đặt 🔑');
  }
}

})();
