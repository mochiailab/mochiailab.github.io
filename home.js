// Mochi AI Lab: the home page. With the key saved on this browser it connects to Mochi (the
// sealed link, mochi-link.js), mirrors its screen live (mochi-screen.js, "scene" topic), shows
// the pet's mood and needs, and runs the quick actions. Without a key it shows how to pair.
(function () {
const $ = (id) => document.getElementById(id);
const ML = window.MochiLink;
const MOODS = [['🙂', 'Mochi đang ổn'], ['🥺', 'Mochi đang đói'], ['😪', 'Mochi mệt rồi'],
  ['💬', 'Mochi cần tâm sự'], ['😢', 'Mochi đang buồn'], ['🤩', 'Mochi vui lắm']];
let link = null, state = null, online = null, askedScene = false;

function toast(t) {
  const el = $('toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2000);
}
const h = new Date().getHours();
$('greet').textContent = h < 11 ? '☀️ Chào buổi sáng' : h < 14 ? '🍱 Chào buổi trưa' : h < 18 ? '🌤️ Chào buổi chiều' : '🌙 Chào buổi tối';

const scr = new MochiScreen($('live'));

function render() {
  const p = state && state.pet;
  if (p && p.on === 1) {
    const [e, txt] = MOODS[p.m] || MOODS[0];
    $('moodE').textContent = e; $('moodT').textContent = txt;
    const a = p.ate;
    $('moodS').textContent = a < 0 ? '' : 'Ăn lần cuối: ' + (a < 1 ? 'vừa xong' : a < 60 ? a + ' phút trước' : Math.floor(a / 60) + ' tiếng trước');
    [['f', 'sF'], ['j', 'sJ'], ['t', 'sT'], ['e', 'sE']].forEach(([k, id]) => {
      $(id).querySelector('i').style.width = p[k] + '%'; $(id).querySelector('b').textContent = p[k] + '%';
    });
  } else if (state) { $('moodE').textContent = '💤'; $('moodT').textContent = 'Đang tắt nuôi Mochi'; $('moodS').textContent = 'Bật lại ở trang Tính năng'; }
  if (state) {
    $('qCall').classList.toggle('on', (state.call || 0) > 0);
    $('qTsnd').classList.toggle('on', state.tsnd !== 0);
    if (window.MochiTheme) window.MochiTheme.body(state.color);
  }
  const mood = p && p.on === 1 ? (MOODS[p.m] || MOODS[0])[0] : '';
  if (window.MochiSite) window.MochiSite.status(online, mood);
  $('who').textContent = 'Mochi của bạn · ' + (online === true ? 'đang trực tuyến' : online === false ? 'đang tắt' : 'đang kết nối…');
  document.querySelectorAll('.q[data-cmd]').forEach((b) => { b.disabled = !(link && link.ready && online); });
}

function connect(key) {
  link = new ML.Link(key, (leaf, payload) => {
    if (leaf === 'status') online = payload === 'online';
    else if (leaf === 'state') {
      try { state = JSON.parse(payload); scr.setState(state); } catch (e) {}
      if (!askedScene && link.ready) { askedScene = true; link.send('cmd', JSON.stringify({ cmd: 'scene' })); }  // the screen, now
    } else if (leaf === 'scene') {
      try { scr.setScene(JSON.parse(payload)); $('liveTag').textContent = 'TRỰC TIẾP'; $('liveTag').classList.add('on'); } catch (e) {}
    }
    render();
  }, (st) => { if (st !== 'ready') { online = null; render(); } });
  link.open();
}

function send(cmd, extra) {
  if (!link || !link.ready) { toast('Chưa kết nối được Mochi'); return false; }
  return link.send('cmd', JSON.stringify(Object.assign({ cmd }, extra || {})));
}
document.querySelectorAll('.q').forEach((q) => q.addEventListener('click', () => {
  if (q.dataset.href) { location.href = q.dataset.href; return; }
  const extra = q.dataset.v ? { v: +q.dataset.v } : {};
  if (q.dataset.cmd && send(q.dataset.cmd, extra)) toast(q.dataset.t);
  else if (!q.dataset.cmd) toast(q.dataset.t);
}));
$('qCall').addEventListener('click', () => {
  const on = !$('qCall').classList.contains('on');
  if (send('call', { v: on ? 1500 : 0 })) { $('qCall').classList.toggle('on', on); toast(on ? 'Gọi "Mochi ơi!" là Mochi nghe luôn' : 'Đã tắt gọi để trò chuyện'); }
});
$('qTsnd').addEventListener('click', () => {
  const on = !$('qTsnd').classList.contains('on');
  if (send('tsnd', { v: on ? 1 : 0 })) { $('qTsnd').classList.toggle('on', on); toast(on ? 'Đã bật tiếng khi chạm' : 'Đã tắt tiếng khi chạm'); }
});

// palette commands that act on Mochi
if (window.MochiSite) window.MochiSite.addCommands([
  ['🍡', 'Cho Mochi ăn bánh', 'Mochi', () => send('feed', { v: 0 }) && toast('Mochi đang ăn bánh 😋')],
  ['🍓', 'Cho Mochi ăn trái cây', 'Mochi', () => send('feed', { v: 1 }) && toast('Mochi đang ăn trái cây 😋')],
  ['🥛', 'Cho Mochi uống sữa', 'Mochi', () => send('feed', { v: 2 }) && toast('Mochi đang uống sữa 😋')],
  ['💗', 'Thả tim cho Mochi', 'Mochi', () => send('pet') && toast('Đã thả tim 💗')],
  ['⏰', 'Xem giờ trên Mochi', 'Mochi', () => send('clock_show') && toast('Mochi hiện giờ 8 giây')],
  ['😴', 'Cho Mochi ngủ', 'Mochi', () => send('sleep') && toast('Mochi đi ngủ 😴')],
  ['☀️', 'Đánh thức Mochi', 'Mochi', () => send('wake') && toast('Đã đánh thức Mochi')],
  ['🍅', 'Bắt đầu Pomodoro', 'Mochi', () => send('pomo', { v: 1 }) && toast('Pomodoro: tập trung 25 phút 🍅')],
  ['✉️', 'Nhắn chữ lên Mochi', 'Mochi', () => { location.href = 'tinh-nang.html#chu'; }],
  ['⏰', 'Thêm lời nhắc hay báo thức', 'Mochi', () => { location.href = 'tinh-nang.html#alarmCard'; }],
]);

const key = ML.savedCode();
if (ML.KEY_RE.test(key)) { connect(key); render(); }
else { $('dashboard').hidden = true; $('nokey').hidden = false; $('who').textContent = 'Chưa kết nối Mochi'; }
})();
