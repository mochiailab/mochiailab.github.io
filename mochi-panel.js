// Mochi AI Lab: connection + controls of the remote-control pages (giao-dien.html, cai-dat.html).
// Each page holds only the cards it shows; this wires whatever is there.
// Commands / state must match OnRemoteCommand / StateJson in the firmware (mochi_c3_board.cc).
(function () {
const { Link, OldLink, KEY_RE, OLD_CODE_RE, normKey, prettyKey } = window.MochiLink;
// clock backgrounds, same order as kClockBgs in mochi_display.h (0 = Mochi's own colour)
const CLOCK_BGS = [['Theo màu Mochi', ''], ['Đen', '#000000'], ['Xanh trời', '#c4e2fc', 1], ['Tím nhạt', '#ded0fc', 1],
  ['Bạc hà', '#c6f2d8', 1], ['Cam đào', '#ffd8c8', 1], ['Vàng chanh', '#fcf0aa', 1], ['Hồng phấn', '#ffd2e4', 1],
  ['Kem', '#faeed6', 1], ['Trắng', '#f4f4f4', 1]];
const COLORS = window.MochiLink.BODY_COLORS.map((c) => [c.name, c.dark ? '#111111' : c.hex]);
// a page has only some of the controls: missing ones resolve to a detached dummy element
const DUMMY = document.createElement('div');
const $ = (id) => document.getElementById(id) || DUMMY;
let mq = null, code = '', online = null, state = null, gotState = false;

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function setStatus(kind, title, sub) {
  $('status').className = 'status ' + kind; $('stTitle').textContent = title; $('stSub').textContent = sub;
}
function refreshStatus() {
  const ready = !!(mq && mq.connected);
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
  document.querySelectorAll('#clockBg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === (state.cbg || 0)));
  // clock previews in the chosen background
  const bg = CLOCK_BGS[state.cbg || 0] || CLOCK_BGS[0];
  const bodyHex = (window.MochiLink.BODY_COLORS[state.color] || {}).hex;
  const light = bg[1] ? !!bg[2] : !(window.MochiLink.BODY_COLORS[state.color] || {}).dark;
  document.querySelectorAll('.face').forEach((f) => {
    f.style.background = bg[1] || bodyHex || '#0b0b10';
    f.style.color = light ? '#2c2838' : '#fff';
  });
  renderWeather();
  document.querySelectorAll('#colors button').forEach((b) => b.classList.toggle('on', +b.dataset.v === state.color));
  $('clock').checked = state.clock === 1;
  $('volume').value = state.volume; $('volVal').textContent = state.volume + '%';
  const bedOn = state.bed_s !== state.bed_e;
  $('bedOn').checked = bedOn; $('bedHours').hidden = !bedOn;
  if (bedOn) { $('bedS').value = state.bed_s; $('bedE').value = state.bed_e; }
  $('sleepNow').checked = !!state.sleep;
  document.querySelectorAll('#startle button').forEach((b) => b.classList.toggle('on', +b.dataset.v === state.startle));
  const t = state.timer;
  $('timerLeft').textContent = t > 0 ? 'Còn ' + Math.floor(t / 60) + ' phút ' + String(t % 60).padStart(2, '0') + ' giây' : 'Không có hẹn giờ';
  $('info').textContent = 'Giờ trên Mochi: ' + state.time + ' · lõi xiaozhi ' + state.fw + (state.sleep ? ' · Đang ngủ' : '');
  renderUpdate();
}

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
  window.MochiLink.saveCode(c);
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

function connect() {
  const c = normKey($('code').value);
  if (OLD_CODE_RE.test(c)) { connectOld(c); return; }
  const box = document.getElementById('oldFw');
  if (box) box.hidden = true;
  if (!KEY_RE.test(c)) { toast('Mã gồm 12 chữ/số, xem trong menu của Mochi (mục Code web)'); $('code').focus(); return; }
  if (mq) mq.close();
  code = c; online = null; state = null; gotState = false;
  window.MochiLink.saveCode(code);
  setStatus('busy', 'Đang kết nối…', 'Tới máy chủ nhắn tin');
  mq = new Link(code, (leaf, payload) => {
    if (leaf === 'status') online = payload === 'online';
    else if (leaf === 'state') {
      try { state = JSON.parse(payload); gotState = true; render(); } catch (e) {}
    }
    refreshStatus();
  }, (st) => {
    if (st === 'ready') {
      setTimeout(refreshStatus, 2500);
    } else if (st === 'nocrypto') setStatus('', 'Trình duyệt không hỗ trợ mã hoá', 'Mở trang bằng Chrome, Safari hoặc Edge bản mới');
    else if (st === 'closed') setStatus('', 'Mất kết nối', 'Bấm Kết nối để thử lại');
    else setStatus('', 'Máy chủ từ chối kết nối', 'Thử lại sau ít phút');
    refreshStatus();
  });
  mq.open();
}

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
$('startle').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (send('startle', { v: +b.dataset.v })) toast('Giật mình: ' + b.textContent);
});
$('wifi').addEventListener('click', () => {
  if (!confirm('Mochi sẽ ngắt Wi-Fi nhà và phát Wi-Fi "N-Mochi_AI_Lab-xxxx" để bạn chọn mạng khác. Trong lúc đó trang này không điều khiển được Mochi. Tiếp tục?')) return;
  if (send('wifi')) toast('Mochi đang vào chế độ cài Wi-Fi');
});
// ---------- firmware update over Wi-Fi ----------
// the latest version is the one the web flasher serves (firmware/manifest-c3.json)
let latest = null, updating = null, updStart = 0;
fetch('manifest-c3.json', { cache: 'no-store' }).then((r) => r.json()).then((m) => { latest = m.version; renderUpdate(); }).catch(() => {});
// "2026.11.24-7" -> compares as numbers part by part (an empty / old version is the oldest)
function cmpVersion(a, b) {
  const p = (v) => String(v || '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}
function renderUpdate() {
  if (!state) return;
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
  else if (!latest) sub = 'Không đọc được bản mới nhất trên web.';
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

$('clockBg').innerHTML = CLOCK_BGS.map(([n, c], i) =>
  `<button data-v="${i}"><i class="${c ? '' : 'mochi'}" style="${c ? 'background:' + c : ''}"></i>${n}</button>`).join('');
$('clockBg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (send('clock_bg', { v: +b.dataset.v })) toast('Nền đồng hồ: ' + CLOCK_BGS[+b.dataset.v][0] + ' (Mochi hiện thử 8 giây)');
});
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

$('btnConnect').addEventListener('click', connect);
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
window.MochiLink.keyInput($('code'));
const saved = window.MochiLink.savedCode();
if (KEY_RE.test(saved)) { $('code').value = prettyKey(saved); connect(); }
else if (OLD_CODE_RE.test(saved)) { $('code').value = saved; connect(); }

})();
