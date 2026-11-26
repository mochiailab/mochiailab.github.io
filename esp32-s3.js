// Mochi AI Lab: the ESP32-S3 page. Diagram / pin-table tabs, and a preview of Mochi on the
// ST7789 1.69" 240x280 screen (mochi-screen.js with board "s3"), cycling through a few scenes.
(function () {
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.seg button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
  document.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.view));
}));

const cv = document.getElementById('s3prev');
if (!cv || !window.MochiScreen) return;
const scr = new MochiScreen(cv, { board: 's3' });
scr.setState({ wx: { t: 27, c: 2, day: 1, mn: 23, mx: 31, h: 72 } });
const now = () => (Date.now() - new Date().getTimezoneOffset() * 60000) / 1000;  // local time, read as UTC
const SCENES = [
  () => ({ f: 0, b: 0, s: 0 }),
  () => ({ f: 1, b: 1, s: 2, sub: 'Chào bạn! Mình là Mochi nè. Hôm nay bạn thấy thế nào, có muốn nghe một bài hát không?' }),
  () => ({ f: 0, b: 0, s: 0, ck: 0, cb: 0, now: now(), nt: '⏰ 21:30 Đi ngủ sớm nha' }),
  () => ({ f: 0, b: 0, s: 0, ck: 9, cb: 0, now: now() }),
  () => ({ p: { t: 'Chúc bạn một ngày thật vui ♥', bg: 0xffd2e4, bg2: 0xc4e2fc, g: 2, fg: 0x2c2838, sz: 32 } }),
];
const chips = document.querySelectorAll('#s3demo button');
let cur = 0, auto = true;
function show(i) {
  cur = i; scr.setScene(SCENES[i]());
  chips.forEach((b) => { const on = +b.dataset.i === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
}
document.getElementById('s3demo').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  auto = false; show(+b.dataset.i);  // a picked scene stays
});
setInterval(() => { if (auto) show((cur + 1) % SCENES.length); }, 5000);
show(0);
})();
