// Mochi AI Lab: the owner's stats page (thong-ke.html, not in the menu). Counts the Mochis on the
// public broker from their plain status topics (mochi_remote.h: mochiailab/v2/<topic id>/status =
// "online" every 2 min / "offline"; old firmware: mochiailab/v1/<code>/status). The topic id is a
// hash of the key, so this sees how many Mochis, never their keys or messages.
// "Seen" ids are kept in this browser (localStorage mochiSeen) to count Mochis over time.
(function () {
const $ = (id) => document.getElementById(id);
const ML = window.MochiLink;
const now = new Map(), old = new Map();  // topic id -> last status
let seen = {};
try { seen = JSON.parse(localStorage.getItem('mochiSeen') || '{}'); } catch (e) {}
const t0 = Date.now();

function render() {
  const count = (m, v) => [...m.values()].filter((s) => s === v).length;
  $('nOn').textContent = count(now, 'online');
  $('nOff').textContent = count(now, 'offline');
  $('nOld').textContent = old.size;
  const ids = Object.keys(seen);
  $('nSeen').textContent = ids.length;
  const first = Math.min(...Object.values(seen).map((s) => s.first));
  $('since').textContent = ids.length ? '(từ ' + new Date(first).toLocaleDateString('vi-VN') + ')' : '';
}
function save() { try { localStorage.setItem('mochiSeen', JSON.stringify(seen)); } catch (e) {} }

function onMessage(topic, payload) {
  const p = topic.split('/');  // mochiailab / v1|v2 / id / status
  if (p.length !== 4 || p[3] !== 'status') return;
  const st = payload === 'online' ? 'online' : 'offline';
  if (p[1] === 'v1') { old.set(p[2], st); render(); return; }
  if (p[1] !== 'v2' || !/^[0-9a-f]{32}$/.test(p[2])) return;
  now.set(p[2], st);
  const s = seen[p[2]] || (seen[p[2]] = { first: Date.now() });
  if (st === 'online') s.last = Date.now();
  save(); render();
}

let mq = null, retry = 2000;
function connect() {
  mq = new ML.Mqtt(ML.BROKER, 'web-tk-' + Math.random().toString(36).slice(2, 10), onMessage, (st) => {
    if (st === 'ready') {
      retry = 2000;
      mq.subscribe('mochiailab/v2/+/status');
      mq.subscribe('mochiailab/v1/+/status');
      $('log').textContent = 'Đã kết nối, đang nghe các Mochi…';
    } else {
      $('log').textContent = 'Mất kết nối máy chủ, thử lại sau ' + Math.round(retry / 1000) + ' giây…';
      setTimeout(connect, retry); retry = Math.min(retry * 2, 30000);
    }
  });
  mq.open();
}
setInterval(() => {
  if (!mq || !mq.ready) return;
  const s = Math.round((Date.now() - t0) / 1000);
  $('log').textContent = s < 150 ? 'Đang nghe các Mochi… ' + s + ' giây (đủ sau khoảng 2–3 phút)' : 'Đang nghe các Mochi, cập nhật liên tục.';
}, 1000);

const code = window.MochiStats && window.MochiStats.code;
if (code) {
  const a = document.createElement('a');
  a.href = 'https://' + code + '.goatcounter.com'; a.target = '_blank'; a.rel = 'noopener';
  a.textContent = '📊 Mở GoatCounter (' + code + ')';
  $('gc').replaceChildren(a);
}
render();
connect();
})();
