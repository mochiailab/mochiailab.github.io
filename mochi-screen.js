// Mochi AI Lab: a live mirror of Mochi's 160x80 screen, drawn in a <canvas> with the same shapes
// as the firmware's renderer (mochi_display.h: BuildFace, the clock faces, DrawDigits, the poster).
// Mochi sends what is on screen on the sealed "scene" topic (face, colour, clock, subtitle,
// poster, sleep, chat state); the small animations (blinks, glances, bobbing, talking) run here.
//   const scr = new MochiScreen(canvasElement); scr.setScene(sceneJson); scr.setState(stateJson);
// Two screens (state.hw, or ?hw= in the page URL, or opts.board; default "c3"):
//   c3 = ST7735S 0.96" 160x80, landscape: the scene is drawn 1:1 on the 160x80 "stage".
//   s3 = ST7789 1.69" 240x280, portrait, rounded glass corners: the same 160x80 stage is scaled up
//        and placed in a portrait layout (S3_FACE / S3_CARD and the bubble / widget panel below).
//        The S3 firmware should follow this layout.
(function () {
const W = 160, H = 80;  // the stage, in Mochi pixels (the firmware's shapes)
const HW = { c3: { w: 160, h: 80, px: 4, r: 0 }, s3: { w: 240, h: 280, px: 3, r: 38 } };  // px = canvas scale
const S3_FACE = { k: 1.5, x: 0, y: 80 };      // the face: stage x1.5, centred (rows 80..200)
const S3_FACE_SUB = { k: 1.5, x: 0, y: 50 };  // ... moved up to rows 50..170 when the subtitle bubble shows
const S3_CARD = { k: 1.4, x: 8, y: 16 };  // a clock face: a 224x112 card on top, the widget panel below
const urlHw = (() => { try { return new URLSearchParams(location.search).get('hw'); } catch (e) { return null; } })();
// faces, same order as MochiDisplay::Face
const F = { NEUTRAL: 0, HAPPY: 1, LOVE: 2, SLEEPY: 3, ANGRY: 4, SAD: 5, SURPRISED: 6, THINKING: 7, WINK: 8,
  HUNGRY: 9, EATING: 10, LONELY: 11, TIRED: 12 };
const BODIES = ['#fac8d4', '#baecd4', '#fce6ac', '#d6c6f6', '#eeeeee', '#000000'];  // kBodies
const CLOCK_BGS = [null, ['#000000', 0], ['#c4e2fc', 1], ['#ded0fc', 1], ['#c6f2d8', 1], ['#ffd8c8', 1],
  ['#fcf0aa', 1], ['#ffd2e4', 1], ['#faeed6', 1], ['#f4f4f4', 1]];                    // kClockBgs
const DAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WHITE = '#ffffff', RED = '#ff1544', BLUE = '#5aacff', PINK = '#ff6ab4', TONGUE = '#f05452';

function ink(face, pastel) {  // InkFor
  switch (face) {
    case F.HAPPY: case F.WINK: return pastel ? '#964800' : '#ffd24a';
    case F.SLEEPY: return pastel ? '#3c4a80' : '#8fa8ff';
    case F.ANGRY: return pastel ? '#b8142c' : '#ff5a4a';
    case F.SAD: return pastel ? '#1f4ea0' : '#7fc8ff';
    case F.THINKING: return pastel ? '#602c96' : '#c9a2ff';
    default: return pastel ? '#2c2838' : WHITE;
  }
}
// the rim round mochi's body (firmware Rim()): the colour three times further from white
function deepen(hex) {
  const n = parseInt(hex.slice(1), 16), d = (v) => Math.max(0, 255 - (255 - v) * 3);
  return 'rgb(' + d(n >> 16) + ',' + d((n >> 8) & 255) + ',' + d(n & 255) + ')';
}
// Vietnamese lunar calendar, same algorithm as mochi_lunar.h (UTC+7)
const Lunar = (() => {
  const TZ = 7, F = Math.floor, PI = Math.PI;
  const idiv = (a, b) => Math.trunc(a / b);
  function jd(d, m, y) {
    const a = idiv(14 - m, 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    let j = d + idiv(153 * mm + 2, 5) + 365 * yy + idiv(yy, 4) - idiv(yy, 100) + idiv(yy, 400) - 32045;
    if (j < 2299161) j = d + idiv(153 * mm + 2, 5) + 365 * yy + idiv(yy, 4) - 32083;
    return j;
  }
  function newMoon(k) {
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const Fm = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * Fm) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * Fm + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * Fm - M)) - 0.0006 * Math.sin(dr * (2 * Fm + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * Fm - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    const dt = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
                       : -0.000278 + 0.000265 * T + 0.000262 * T2;
    return F(Jd1 + C1 - dt + 0.5 + TZ / 24);
  }
  function sunLong(jdn) {
    const T = (jdn - 2451545.5 - TZ / 24) / 36525, T2 = T * T, dr = PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = (L0 + DL) * dr;
    L = L - PI * 2 * F(L / (PI * 2));
    return F(L / PI * 6);
  }
  function month11(y) {
    const off = jd(31, 12, y) - 2415021, k = F(off / 29.530588853);
    let nm = newMoon(k);
    if (sunLong(nm) >= 9) nm = newMoon(k - 1);
    return nm;
  }
  function leapOffset(a11) {
    const k = F((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last, i = 1, arc = sunLong(newMoon(k + i));
    do { last = arc; i++; arc = sunLong(newMoon(k + i)); } while (arc !== last && i < 14);
    return i - 1;
  }
  function fromSolar(dd, mm, yy) {
    const day = jd(dd, mm, yy), k = F((day - 2415021.076998695) / 29.530588853);
    let start = newMoon(k + 1);
    if (start > day) start = newMoon(k);
    let a11 = month11(yy), b11 = a11, ly;
    if (a11 >= start) { ly = yy; a11 = month11(yy - 1); } else { ly = yy + 1; b11 = month11(yy + 1); }
    const r = { day: day - start + 1, leap: false };
    const diff = F((start - a11) / 29);
    r.month = diff + 11;
    if (b11 - a11 > 365) {
      const leap = leapOffset(a11);
      if (diff >= leap) { r.month = diff + 10; if (diff === leap) r.leap = true; }
    }
    if (r.month > 12) r.month -= 12;
    if (r.month >= 11 && diff < 4) ly -= 1;
    r.year = ly;
    return r;
  }
  function tetJd(ly) {
    const a11 = month11(ly - 1), b11 = month11(ly), k = F(0.5 + (a11 - 2415021.076998695) / 29.530588853);
    let off = 2;
    if (b11 - a11 > 365 && off >= leapOffset(a11)) off++;
    return newMoon(k + off);
  }
  function daysToTet(dd, mm, yy) {
    const l = fromSolar(dd, mm, yy);
    if (l.month === 1 && !l.leap && l.day <= 7) return 1 - l.day;
    return tetJd(l.year + 1) - jd(dd, mm, yy);
  }
  return { fromSolar, daysToTet, jd };
})();

// mix two "#rrggbb" colours (t = share of b), like the firmware's Blend
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const snowy = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const rainy = (c) => c >= 51 && !snowy(c);
function weatherWord(c, day) {
  if (c <= 1) return day ? 'Nắng' : 'Trời quang';
  if (c === 2) return 'Ít mây'; if (c === 3) return 'Nhiều mây'; if (c === 45 || c === 48) return 'Sương mù';
  if (snowy(c)) return 'Tuyết'; if (c >= 95) return 'Dông'; if (c >= 51) return 'Mưa'; return '';
}
function tip(tm, w) {  // the smart card's line (firmware Tip())
  const t = w ? Math.round(w.t) : 20;
  if (w && rainy(w.c)) return 'Trời mưa, mang ô!';
  if (w && snowy(w.c)) return 'Có tuyết, mặc ấm!';
  if (t < 15) return 'Lạnh, mặc ấm nha';
  if (t >= 33) return 'Nóng, uống nước!';
  const h = tm.h;
  if (h >= 22 || h < 5) return 'Khuya rồi, ngủ nha';
  if (h < 9) return 'Chào buổi sáng!';
  if (h >= 11 && h < 13) return 'Tới giờ ăn trưa';
  if (h >= 17 && h < 19) return 'Nghỉ mắt chút nhé';
  return 'Trời đẹp ghê!';
}
function teaTip(h) {
  return h < 9 ? 'Chào buổi sáng' : h < 11 ? 'Uống nước nha' : h < 13 ? 'Ăn trưa chưa?' : h < 17 ? 'Uống nước nha' : h < 20 ? 'Nghỉ mắt chút' : 'Sắp ngủ rồi nè';
}
// hue(h) as #rrggbb (for mix)
function hslHex(h) {
  h -= Math.floor(h); const f = (n) => { const k = (n + h * 12) % 12; return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function hue(h) { h -= Math.floor(h); return `hsl(${Math.round(h * 360)} 100% 50%)`; }

class MochiScreen {
  // opts.still: no animation loop, draw only when render() is called (the clock-face previews)
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.forced = opts.board || urlHw || null;
    this.setBoard(this.forced || 'c3');
    this.scene = { f: 0, b: 0, s: 0 }; this.state = null; this.recv = 0;
    this.look = [0, 0]; this.lookT = [0, 0]; this.nextLook = 0; this.nextBlink = 0;
    this.glow = 0; this.posterT0 = 0; this.subT0 = 0;
    if (opts.still) return;
    const loop = (t) => { this.draw(t / 1000); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  setScene(sc) {
    const prev = this.scene;
    this.scene = sc || {}; this.recv = Date.now();
    if (!prev.p || !sc.p || prev.p.t !== sc.p.t) this.posterT0 = performance.now() / 1000;
    if (prev.sub !== sc.sub) this.subT0 = performance.now() / 1000;
  }
  // the board comes with each state (firmware without hw = C3, so switching to another Mochi's
  // key switches back too); ?hw= in the URL or opts.board win while no state names one
  setState(st) { this.state = st; this.setBoard((st && st.hw) || this.forced || 'c3'); }
  // "c3" / "s3": sizes the canvas (drawn at L.px x, so it stays sharp when scaled); the page's CSS
  // reads canvas[data-hw] for the aspect ratio
  setBoard(hw) {
    hw = HW[hw] ? hw : 'c3';
    if (this.hw === hw) return;
    this.hw = hw; this.L = HW[hw]; this.s3 = hw === 's3';
    this.cv.width = this.L.w * this.L.px; this.cv.height = this.L.h * this.L.px;
    this.cv.dataset.hw = hw;
  }
  render() { this.draw(performance.now() / 1000); }
  // canvas transforms: whole-screen pixels, or the 160x80 stage placed at o {k, x, y}
  toScreen() { const p = this.L.px; this.g.setTransform(p, 0, 0, p, 0, 0); }
  toStage(o) { const p = this.L.px; o = o || { k: 1, x: 0, y: 0 }; this.g.setTransform(p * o.k, 0, 0, p * o.k, p * o.x, p * o.y); }
  localTm() {
    const d = this.mochiTime();
    return { h: d.getUTCHours(), m: d.getUTCMinutes(), wd: d.getUTCDay(), day: d.getUTCDate(), mon: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  }
  // Mochi's local clock (its epoch already has the time zone folded in: read it as UTC)
  mochiTime() {
    const sc = this.scene;
    const ms = sc.now ? sc.now * 1000 + (Date.now() - this.recv) : Date.now();
    return new Date(ms);
  }

  // ---------- shapes (coordinates in Mochi pixels; the canvas is scaled 4x) ----------
  box(cx, cy, hw, hh, r, c) {
    const g = this.g; g.fillStyle = c; g.beginPath();
    g.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, Math.max(0, Math.min(r, hw, hh))); g.fill();
  }
  circle(x, y, r, c) { const g = this.g; g.fillStyle = c; g.beginPath(); g.arc(x, y, Math.max(r, 0.1), 0, 7); g.fill(); }
  line(ax, ay, bx, by, r, c) {
    const g = this.g; g.strokeStyle = c; g.lineWidth = r * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  arc(cx, cy, rad, a0, a1, th, c) {
    const g = this.g; g.strokeStyle = c; g.lineWidth = th * 2; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, rad, a0 * Math.PI / 180, a1 * Math.PI / 180); g.stroke();
  }
  heart(cx, cy, size, c) {
    const r = size * 0.32;
    this.circle(cx - r * 0.85, cy - r * 0.35, r, c); this.circle(cx + r * 0.85, cy - r * 0.35, r, c);
    const g = this.g; g.fillStyle = c; g.beginPath();
    g.moveTo(cx - r * 1.75, cy - r * 0.1); g.lineTo(cx + r * 1.75, cy - r * 0.1); g.lineTo(cx, cy + r * 1.9); g.fill();
  }
  text(str, x, base, size, c, align = 'center', bold = false) {
    const g = this.g; g.fillStyle = c; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.font = `${bold ? 700 : 500} ${size}px "DejaVu Sans", Verdana, sans-serif`; g.fillText(str, x, base);
  }
  // the edge glow; on the S3 it follows the rounded screen
  edges(c, r) {
    if (this.s3) {
      const g = this.g, L = this.L; g.save(); this.toScreen();
      g.strokeStyle = c; g.lineWidth = r * 3; g.beginPath(); g.roundRect(1.5, 1.5, L.w - 3, L.h - 3, L.r - 1.5); g.stroke();
      g.restore(); return;
    }
    this.line(1, 1, W - 1, 1, r, c); this.line(W - 1, 1, W - 1, H - 1, r, c); this.line(W - 1, H - 1, 1, H - 1, r, c); this.line(1, H - 1, 1, 1, r, c); }

  draw(t) {
    const g = this.g, sc = this.scene, L = this.L;
    this.toScreen();
    g.fillStyle = '#000'; g.fillRect(0, 0, L.w, L.h);
    if (sc.mn) this.drawMenu();
    else if (sc.p) this.drawPoster(t);
    else {
      const body = BODIES[sc.b] || BODIES[0], pastel = body !== '#000000';
      if (sc.ck != null && sc.ck >= 0 && !sc.al) { if (this.s3) this.drawClockS3(t, body, pastel); else this.drawClock(t, body, pastel); }
      else { this.toStage(this.s3 ? (sc.sub ? S3_FACE_SUB : S3_FACE) : null); this.drawFace(t, body, pastel); }
      this.toScreen();
      if (sc.sl) { g.fillStyle = 'rgba(0,0,0,.66)'; g.fillRect(0, 0, L.w, L.h); }
      const br = (sc.br || 100) / 100;
      if (br < 1) { g.fillStyle = `rgba(0,0,0,${1 - br})`; g.fillRect(0, 0, L.w, L.h); }
    }
    if (L.r) this.maskCorners();
  }
  // the S3 panel's rounded glass corners
  maskCorners() {
    const g = this.g, L = this.L; this.toScreen();
    g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, L.w, L.h); g.roundRect(0, 0, L.w, L.h, L.r); g.fill('evenodd');
  }
  // the pastel body over the whole screen: rounded corners + a 2 px rim in a deeper colour
  // (firmware: Rim(), BOTTOM_R 8, RIM_W 2); on the S3 the whole portrait screen
  fillBody(c) {
    if (!this.s3) { this.box(80, 40, 80, 40, 8, deepen(c)); this.box(80, 40, 78, 38, 6, c); return; }
    const g = this.g, L = this.L; g.save(); this.toScreen();
    g.fillStyle = deepen(c); g.fillRect(0, 0, L.w, L.h);
    g.fillStyle = c; g.beginPath(); g.roundRect(3, 3, L.w - 6, L.h - 6, L.r - 3); g.fill();
    g.restore();
  }
  // the timer's progress line along the top
  timerBar(frac, c) {
    if (!this.s3) { this.line(4, 3, 4 + (W - 8) * frac, 3, 1.3, c); return; }
    const g = this.g; g.save(); this.toScreen(); this.line(44, 9, 44 + 152 * frac, 9, 1.8, c); g.restore();
  }

  drawGlow(t) {
    const s = this.scene.s;
    if (this.scene.al) { const c = Math.floor(t * 4) % 2 ? '#ff3c28' : '#ffaa00'; this.edges(c, 2); return; }
    if (s === 3) { for (let i = 0; i < 4; i++) { this.g.globalAlpha = 1; } this.edges(hue(t * 0.6), 1.6); return; }
    let target = 0, c = null;
    if (s === 2) { c = '#5ae678'; target = 0.45 + 0.35 * Math.abs(Math.sin(t * 9)); }
    else if (s === 1) { c = '#2ee6c8'; target = 0.45 + 0.4 * Math.sin(t * 3); }
    this.glow += (target - this.glow) * 0.3;
    if (!c || this.glow < 0.02) return;
    this.g.globalAlpha = this.glow / 3; this.edges(c, 3);
    this.g.globalAlpha = this.glow; this.edges(c, 1.1); this.g.globalAlpha = 1;
  }

  drawFace(t, body, pastel) {
    const sc = this.scene, now = t;
    let face = sc.f || 0;
    const talking = sc.s === 2, listening = sc.s === 1, music = !!sc.mu && (talking || sc.s === 3);  // (a song from the music server plays as a notification: s 3)
    if (sc.al) face = F.SURPRISED;
    // idle glances + blinks, like the firmware (random, not in step with Mochi)
    if (now > this.nextLook) {
      const center = Math.random() < 0.4;
      this.lookT = center ? [0, 0] : [Math.random() * 16 - 8, Math.random() * 6 - 3];
      this.nextLook = now + 1.5 + Math.random() * 3;
    }
    this.look[0] += (this.lookT[0] - this.look[0]) * 0.15; this.look[1] += (this.lookT[1] - this.look[1]) * 0.15;
    if (now > this.nextBlink + 0.16) this.nextBlink = now + 2 + Math.random() * 3;
    let blink = 1;
    if (now >= this.nextBlink) blink = Math.abs((now - this.nextBlink) / 0.16 * 2 - 1);
    let lx = this.look[0], ly = this.look[1];
    const bob = Math.round(Math.sin(t * 2));
    const lift = sc.sub && !this.s3 ? 14 : 0;  // (the S3 shows the subtitle in a bubble under the face)
    const hop = sc.al ? -Math.round(Math.abs(Math.sin(t * 8)) * 4) : 0;
    const wiggle = sc.al ? Math.round(Math.sin(t * 30) * 2) : 0;
    const cx = 80 + wiggle, ey = 34 - lift + bob + hop, ex = 34, my = 58 - lift * 17 / 14 + bob + hop;
    const k = ink(face, pastel), cut = body;
    const blushC = pastel ? '#ff7896' : PINK, tearC = pastel ? '#3c82ff' : BLUE;
    if (pastel) this.fillBody(body);
    this.drawGlow(t);
    if (sc.tm > 0) this.timerBar(Math.min(1, sc.tm / 1500), pastel ? '#e66e00' : '#ffaa00');
    const eye = (x, hw, hh, kk) => {
      const h = Math.max(hh * kk, 1.6);
      this.box(x + lx, ey + ly, hw, h, 7, k);
      if (pastel && kk > 0.6) this.circle(x + lx - hw * 0.35, ey + ly - h * 0.45, 2.6, WHITE);
    };
    const smile = (x, w) => this.arc(x, my - w * 0.9, w, 40, 140, 1.6, k);
    const talkMouth = () => {
      const o = 2.5 + 3.5 * Math.abs(Math.sin(t * 11)) * (0.6 + 0.4 * Math.abs(Math.sin(t * 3.7)));
      this.box(cx + lx * 0.4, my, 6, o, 3, k);
    };
    const blush = () => { this.box(cx - 52, ey + 16, 7, 3, 3, blushC); this.box(cx + 52, ey + 16, 7, 3, 3, blushC); };

    if (music) {  // the music look (firmware BuildFace, music branch): headphones, ^ ^, rainbow equalizer
      const bg = pastel ? body : '#fac8d4';
      if (!pastel) this.box(80, 40, 80, 40, 8, bg);
      const sway = Math.round(Math.sin(t * 2.2) * 1.5), bass = Math.abs(Math.sin(t * 4.2)) ** 3;  // (a beat; Mochi uses the real bass)
      const fx = cx + sway, fy = ey + 4, K = '#2c2838';
      const cloud = mix(bg, '#ffffff', 200 / 256);
      this.circle(16, 11, 4.5, cloud); this.circle(23, 10, 5.5, cloud); this.circle(137, 10, 5.5, cloud); this.circle(144, 11, 4.5, cloud);
      for (let q = 0; q < 2; q++) {
        const tx = q ? 150 : 10, ty = q ? 30 : 28, r = 1.5 + 1.5 * Math.abs(Math.sin(t * 2.5 + q * 1.6)), tc = mix(bg, '#ffffff', 230 / 256);
        this.line(tx - r, ty, tx + r, ty, 0.55, tc); this.line(tx, ty - r, tx, ty + r, 0.55, tc);
      }
      this.arc(fx, fy + 24, 52, 202, 338, 3, '#403650');
      for (const s2 of [-1, 1]) {
        const hx = fx + s2 * 50;
        this.box(hx, fy, 7, 12, 5, '#e85c68'); this.box(hx - s2 * 5, fy, 2.5, 9, 2, '#963c52');
        this.line(hx + s2 * 2.5, fy - 8, hx + s2 * 2.5, fy - 4, 0.7, '#ffbec4');
        for (let w = 0; w < 2; w++) {
          const wx = hx + s2 * (10 + w * 4), h = 3 + w * 2 + 2 * bass, wc = mix(bg, '#e85c68', Math.min(1, (150 + 100 * bass) / 256));
          this.line(wx, fy - h, wx + s2 * 1.8, fy, 0.6, wc); this.line(wx + s2 * 1.8, fy, wx, fy + h, 0.6, wc);
        }
      }
      for (const s2 of [-1, 1]) {
        const x = fx + s2 * 21;
        this.line(x - 8, fy + 3, x, fy - 5, 1.7, K); this.line(x, fy - 5, x + 8, fy + 3, 1.7, K);
        this.box(fx + s2 * 31, fy + 9, 5, 2.5, 2.5, '#ffaa8c');
      }
      this.circle(fx, fy + 6, 1.4, '#6e3c3c');
      const mo = 1 + 1.5 * bass;
      this.line(fx - 5, fy + 9, fx - 2.5, fy + 9 + mo, 0.7, K); this.line(fx - 2.5, fy + 9 + mo, fx, fy + 9, 0.7, K);
      this.line(fx, fy + 9, fx + 2.5, fy + 9 + mo, 0.7, K); this.line(fx + 2.5, fy + 9 + mo, fx + 5, fy + 9, 0.7, K);
      const EQ = ['#50d2e6', '#3c78f0', '#965ae6', '#dc50c8', '#eb4646', '#f59632', '#f0d73c', '#5acd5a', '#46c8a0'];
      for (let i = 0; i < 9; i++) { const h = 2 + Math.round((2 + Math.abs(Math.sin(t * (5 + i) + i)) * 9) * 1.1); this.line(56 + i * 6, 77, 56 + i * 6, 77 - h, 1.9, EQ[i]); }
      const vx = 146, vy = 66, ang = t * (3 + 6 * bass);
      this.circle(vx, vy, 9, '#1e1e26'); this.circle(vx, vy, 6.6, '#343440');
      this.line(vx + Math.cos(ang) * 4, vy + Math.sin(ang) * 4, vx + Math.cos(ang) * 8, vy + Math.sin(ang) * 8, 0.6, '#9696aa');
      this.circle(vx, vy, 3.4, hue(t * 0.05)); this.circle(vx, vy, 0.8, '#1e1e26');
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.22 + i * 0.5) % 1, nx = 14 + 5 * Math.sin(t * 2 + i * 1.7), ny = 76 - p * 60, nc = hue(0.3 + i * 0.4 + p * 0.2);
        this.circle(nx, ny, 2.4, nc); this.line(nx + 2, ny, nx + 2, ny - 7, 0.7, nc); this.line(nx + 2, ny - 7, nx + 5, ny - 5, 0.7, nc);
      }
      return;
    }
    switch (face) {
      case F.HAPPY: {
        const b = Math.abs(Math.sin(t * 5)) * 2;
        this.arc(cx - ex, ey + 8 - b, 11, 200, 340, 3, k); this.arc(cx + ex, ey + 8 - b, 11, 200, 340, 3, k);
        blush();
        if (talking) talkMouth();
        else { this.circle(cx, my - 3, 8, k); this.box(cx, my - 8, 10, 5, 0, cut); this.circle(cx, my + 2, 3, TONGUE); }
        break;
      }
      case F.LOVE: {
        const pulse = 1 + 0.12 * Math.sin(t * 9);
        this.heart(cx - ex, ey - 2, 26 * pulse, RED); this.heart(cx + ex, ey - 2, 26 * pulse, RED);
        blush(); if (talking) talkMouth(); else smile(cx, 6);
        break;
      }
      case F.SLEEPY: {
        this.line(cx - ex - 11, ey + 4, cx - ex + 11, ey + 4, 2, k); this.line(cx + ex - 11, ey + 4, cx + ex + 11, ey + 4, 2, k);
        this.circle(cx, my, 2.5 + 1.5 * Math.sin(t * 1.5), k);
        const zc = pastel ? '#785adc' : BLUE;
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.35 + i / 3) % 1, s = 3 + p * 4, zx = cx + 44 + p * 22, zy = 30 - p * 26;
          if (zy - s < 0) continue;
          this.line(zx - s, zy - s, zx + s, zy - s, 1, zc); this.line(zx + s, zy - s, zx - s, zy + s, 1, zc); this.line(zx - s, zy + s, zx + s, zy + s, 1, zc);
        }
        break;
      }
      case F.ANGRY: {
        this.box(cx - ex, ey + 2, 12, 12, 6, k); this.box(cx + ex, ey + 2, 12, 12, 6, k);
        this.line(cx - ex - 18, ey - 16, cx - ex + 16, ey - 2, 6, cut); this.line(cx + ex + 18, ey - 16, cx + ex - 16, ey - 2, 6, cut);
        if (talking) talkMouth(); else this.arc(cx, my + 7, 7, 220, 320, 1.6, k);
        break;
      }
      case F.SAD: {
        this.box(cx - ex, ey + 3, 11, 12, 6, k); this.box(cx + ex, ey + 3, 11, 12, 6, k);
        this.line(cx - ex + 18, ey - 15, cx - ex - 16, ey - 3, 6, cut); this.line(cx + ex - 18, ey - 15, cx + ex + 16, ey - 3, 6, cut);
        this.circle(cx - ex + 8, ey + 18 + ((t * 0.6) % 1) * 18, 2.5, tearC);
        if (talking) talkMouth(); else this.arc(cx, my + 7, 7, 220, 320, 1.6, k);
        break;
      }
      case F.SURPRISED: {
        this.circle(cx - ex, ey, 15, k); this.circle(cx + ex, ey, 15, k);
        if (pastel) { this.circle(cx - ex - 5, ey - 5, 3.5, WHITE); this.circle(cx + ex - 5, ey - 5, 3.5, WHITE); }
        if (talking) talkMouth(); else { this.circle(cx, my + 1, 5.5, k); this.circle(cx, my + 1, 3, cut); }
        break;
      }
      case F.THINKING: {
        lx = -7; ly = -4; eye(cx - ex, 12, 13, blink); eye(cx + ex, 12, 13, blink);
        if (talking) talkMouth(); else this.line(cx - 4, my + 1, cx + 5, my - 1, 1.6, k);
        const dots = Math.floor(t * 2.5) % 4;
        for (let i = 0; i < dots; i++) this.circle(cx + 52 + i * 7, 12 - i * 3, 2, hue(i * 0.3));
        break;
      }
      case F.WINK: {
        eye(cx - ex, 13, 15, 1); this.arc(cx + ex, ey + 8, 11, 200, 340, 3, k); blush();
        if (talking) talkMouth(); else smile(cx, 6);
        break;
      }
      case F.HUNGRY: {
        lx = 5; ly = 3; eye(cx - ex, 13, 15, blink); eye(cx + ex, 13, 15, blink);
        if (talking) talkMouth();
        else { this.box(cx, my, 3.5, 4.5, 3.5, k); const d = (t * 0.5) % 1; this.circle(cx + 6, my + 6 + d * 3, 1.4 + d, tearC); }
        const bowl = pastel ? WHITE : '#ebebeb';
        this.circle(146, 66, 10, bowl); this.box(146, 60.5, 11, 5.5, 0, body); this.box(146, 66, 11, 1.3, 0, '#e85d97');
        for (let i = 0; i < 2; i++) { const p = (t * 0.7 + i * 0.5) % 1; this.circle(141 + i * 9 + Math.sin(t * 3 + i) * 1.5, 60 - p * 12, 1.4 * (1 - p) + 0.4, bowl); }
        break;
      }
      case F.EATING: {
        this.arc(cx - ex, ey + 8, 11, 200, 340, 3, k); this.arc(cx + ex, ey + 8, 11, 200, 340, 3, k); blush();
        this.box(cx, my - 1, 7, 2 + 3 * Math.abs(Math.sin(t * 10)), 3, k);
        this.heart(132, 20 - (t % 1) * 8, 10, RED); this.heart(146, 30 - ((t + 0.5) % 1) * 8, 8, RED);
        break;
      }
      case F.LONELY: {
        lx = -3; ly = 5; eye(cx - ex, 12, 13, blink); eye(cx + ex, 12, 13, blink);
        if (talking) talkMouth(); else this.line(cx - 4, my + 2, cx + 4, my + 2, 1.4, k);
        const bub = pastel ? WHITE : '#ebebeb';
        this.box(137, 14, 19, 10, 9, bub); this.line(127, 21, 122, 28, 1.6, bub);
        const dots = Math.floor(t * 2.5) % 4;
        for (let i = 0; i < dots; i++) this.circle(129 + i * 8, 14, 2.4, '#9a6cf0');
        break;
      }
      case F.TIRED: {
        eye(cx - ex, 13, 15, 0.42 * blink); eye(cx + ex, 13, 15, 0.42 * blink);
        if (talking) talkMouth(); else this.box(cx, my + 1, 3, 3.5 + 1.5 * Math.sin(t * 1.5), 3, k);
        break;
      }
      default: {
        const grow = listening ? 1.12 : 1;
        eye(cx - ex, 13 * grow, 15 * grow, blink); eye(cx + ex, 13 * grow, 15 * grow, blink);
        if (talking) talkMouth(); else smile(cx + lx * 0.4, 6);
      }
    }
    if (sc.sub) { if (this.s3) this.drawBubble(t, body, pastel); else this.drawSubtitle(t, body, pastel); }
  }

  // word-wrap str into lines of at most maxw (canvas px in the current transform); cached per text
  wrap(str, maxw, font) {
    const key = font + '|' + maxw + '|' + str;
    if (this._wk === key) return this._wl;
    const g = this.g; g.font = font;
    const lines = []; let cur = '';
    for (const word of String(str).split(/\s+/).filter(Boolean)) {
      const tryLine = cur ? cur + ' ' + word : word;
      if (g.measureText(tryLine).width <= maxw) { cur = tryLine; continue; }
      if (cur) lines.push(cur);
      cur = '';
      for (const ch of word) {  // a word wider than the line: break it
        if (g.measureText(cur + ch).width > maxw && cur) { lines.push(cur); cur = ''; }
        cur += ch;
      }
    }
    if (cur) lines.push(cur);
    this._wk = key; this._wl = lines;
    return lines;
  }
  // S3: the subtitle in a speech bubble under the face, up to 3 lines; longer text steps one line
  // every 2.2 s (screen pixels: x 14..226, y 186..264)
  drawBubble(t, body, pastel) {
    const g = this.g; g.save(); this.toScreen();
    const x0 = 14, y0 = 186, w = 212, h = 78, fill = pastel ? mix(body, '#ffffff', 0.62) : '#1d1b26';
    g.fillStyle = fill; g.beginPath(); g.roundRect(x0, y0, w, h, 18); g.fill();
    g.beginPath(); g.moveTo(110, y0 + 1); g.lineTo(130, y0 + 1); g.lineTo(120, y0 - 9); g.fill();
    const font = '600 17px "Segoe UI", system-ui, sans-serif', lh = 22;
    const lines = this.wrap(this.scene.sub, w - 28, font);
    g.beginPath(); g.rect(x0 + 8, y0 + 6, w - 16, h - 12); g.clip();
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = pastel ? '#2c2838' : WHITE;
    const show = Math.min(3, lines.length), first = lines.length > 3 ? Math.floor((t - this.subT0) / 2.2) % (lines.length - 2) : 0;
    const top = y0 + h / 2 - (show - 1) * lh / 2;
    for (let i = 0; i < show; i++) g.fillText(lines[first + i], x0 + w / 2, top + i * lh);
    g.restore();
  }

  // the subtitle bar (LVGL on Mochi): one scrolling line along the bottom
  drawSubtitle(t, body, pastel) {
    const g = this.g, y0 = 62;
    g.save();
    if (pastel) { g.fillStyle = deepen(body); g.beginPath(); g.roundRect(0, y0, 160, 18, [0, 0, 8, 8]); g.fill(); }
    g.fillStyle = pastel ? body : '#000'; g.beginPath();
    if (pastel) g.roundRect(2, y0, 156, 16, [0, 0, 6, 6]); else g.roundRect(6, y0, 148, 18, 6);
    g.fill();
    g.beginPath(); g.rect(10, y0, 140, 18); g.clip();
    g.font = '600 12px "Segoe UI", system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = pastel ? '#2c2838' : WHITE;
    const w = g.measureText(this.scene.sub).width;
    let x = 12;
    if (w > 136) x = 12 - (((t - this.subT0) * 30) % (w + 40));
    g.fillText(this.scene.sub, x, y0 + 9);
    if (w > 136) g.fillText(this.scene.sub, x + w + 40, y0 + 9);
    g.restore();
  }

  // ---------- clock faces: the same 9 as mochi_display.h (FaceMochiTime ... FaceSeason) ----------
  drawClock(t, body, pastel) {
    const sc = this.scene;
    if (sc.ck === 10) {  // timer countdown: 7-segment digits on the body / chosen background
      let bg = body, light = pastel;
      const cb = CLOCK_BGS[sc.cb || 0];
      if (cb) { bg = cb[0]; light = !!cb[1]; this.box(80, 40, 80, 40, 8, bg); }
      else if (pastel) { this.box(80, 40, 80, 40, 8, deepen(body)); this.box(80, 40, 78, 38, 6, body); }
      const acc = light ? '#c85000' : '#ffaa00';
      const left = Math.max(0, Math.round((sc.tm || 0) - (Date.now() - this.recv) / 1000));
      this.digits(left >= 6000 ? Math.floor(left / 3600) : Math.floor(left / 60), left >= 6000 ? Math.floor(left / 60) % 60 : left % 60, acc, acc, t);
      return;
    }
    const tm = this.localTm();
    const face = sc.ck >= 0 && sc.ck < 10 ? sc.ck : 0;
    const f = [this.faceMochiTime, this.faceSky, this.faceSmart, this.faceDango, this.faceCalendar, this.faceNight,
      this.faceClimb, this.faceTea, this.faceSeason, this.faceWeather][face];
    f.call(this, tm, performance.now(), this.palette(face, sc.cb || 0));
  }
  // S3: the clock face (exactly the 160x80 one) on a card at the top, and a panel below with the
  // day, the lunar date + weather, and the next reminder (or the face's tip)
  drawClockS3(t, body, pastel) {
    const sc = this.scene, g = this.g, L = this.L, C = S3_CARD;
    const timer = sc.ck === 10, face = timer ? -1 : (sc.ck < 10 ? sc.ck : 0);
    const scenic = [1, 5, 8, 9].includes(face);  // faces with their own sky: a night-blue screen around them
    const p = face >= 0 ? this.palette(face, sc.cb || 0) : {};
    const bg = scenic ? '#1a1f3c' : p.bg || (pastel ? body : '#15151c');
    const dark = scenic || (!p.bg && !pastel);
    this.toScreen(); g.fillStyle = bg; g.fillRect(0, 0, L.w, L.h);
    g.save();
    g.beginPath(); g.roundRect(C.x, C.y, W * C.k, H * C.k, 8 * C.k); g.clip();
    this.toStage(C); this.drawClock(t, body, pastel);
    g.restore();
    this.toScreen();
    const plate = dark ? 'rgba(255,255,255,.10)' : p.plate || mix(bg, '#ffffff', 0.6);
    const ink1 = dark ? '#f2f0ff' : '#2c2838', ink2 = dark ? '#aab4ff' : p.acc || '#5f5e5a';
    this.box(120, 203, 109, 59, 18, plate);
    const tm = this.localTm(), w = this.wx();
    const f1 = '700 19px "DejaVu Sans", Verdana, sans-serif', f2 = '700 14px "DejaVu Sans", Verdana, sans-serif', mw = 200;
    if (timer) {
      this.text('⏱ Đang hẹn giờ', 120, 196, 20, ink1, 'center', true);
      this.text(this.fit(tip(tm, w), mw, f2), 120, 230, 14, ink2, 'center', true);
      return;
    }
    const l = this.lunar(tm).d;
    this.text(this.fit(`${DAYS[tm.wd]} ${tm.day}/${tm.mon}`, mw, f1), 120, 180, 19, ink1, 'center', true);
    const lun = l.day === 1 ? `Mùng 1 tháng ${l.month}` : l.day === 15 ? `Rằm tháng ${l.month}` : `Âm lịch ${l.day}/${l.month}`;
    this.text(this.fit(lun + (w ? ' · ' + this.deg(w) : ''), mw, f2), 120, 211, 14, ink2, 'center', true);
    this.text(this.fit(sc.nt || tip(tm, w), mw, f2), 120, 240, 14, ink1, 'center', true);
  }
  // each face's own colours (the approved sketches) or a pastel clock background (not black)
  palette(face, cb) {
    const P = [['#b9ecd6', '#30c67e', '#e6fbf0', '#0f6e56'], null, ['#fce6ac', '#f0a020', '#fff6d9', '#854f0b'],
      ['#fac8d4', '#ee5a7c', '#ffe6ee', '#993556'], ['#c8e2ff', '#468ce1', '#ffffff', '#185fa5'], null,
      ['#d6c6f6', '#8a5cf0', '#efe8ff', '#534ab7'], ['#eeeeee', '#bbbbbb', '#ffffff', '#5f5e5a'], null, null];
    const p = P[face] ? { bg: P[face][0], rim: P[face][1], plate: P[face][2], acc: P[face][3] } : {};
    const c = cb >= 2 && CLOCK_BGS[cb];
    if (c) { p.bg = c[0]; p.rim = deepen(c[0]); p.plate = mix(c[0], '#ffffff', 0.59); p.acc = mix(deepen(c[0]), '#000000', 0.43); }
    return p;
  }
  // one flat sky colour (firmware SkyColour / Gradient: gradients striped on the panel)
  skyColour(top, bottom) { return mix(top, bottom, 90 / 256); }
  gradient(top, bottom) { this.box(80, 40, 80, 40, 8, this.skyColour(top, bottom)); }
  // shorten with "…" until it fits maxw (firmware Fit())
  fit(str, maxw, font) {
    const g = this.g; g.font = font;
    if (g.measureText(str).width <= maxw) return str;
    const ch = [...str];
    while (ch.length) { ch.pop(); while (ch.length && ch[ch.length - 1] === ' ') ch.pop(); const t = ch.join('') + '…'; if (g.measureText(t).width <= maxw) return t; }
    return '…';
  }
  backdrop(p) { this.box(80, 40, 80, 40, 8, p.rim); this.box(80, 40, 78, 38, 6, p.bg); }
  wx() { const w = this.state && this.state.wx; return w && w.t != null ? w : null; }
  deg(w) { return Math.round(w.t) + '°'; }
  hhmm(tm) { return String(tm.h).padStart(2, '0') + ':' + String(tm.m).padStart(2, '0'); }
  dateLine(tm, withTemp) { const w = this.wx(); return DAYS_SHORT[tm.wd] + ' ' + tm.day + '/' + tm.mon + (withTemp && w ? '  ' + this.deg(w) : ''); }
  lunar(tm) {
    const key = tm.year * 400 + tm.mon * 32 + tm.day;
    if (this._lk !== key) { this._lk = key; this._l = Lunar.fromSolar(tm.day, tm.mon, tm.year); this._tet = Lunar.daysToTet(tm.day, tm.mon, tm.year); }
    return { d: this._l, tet: this._tet };
  }
  small(str, x, base, c, align = 'center', maxw = 150) {
    this.text(this.fit(str, maxw, '700 11px "DejaVu Sans", Verdana, sans-serif'), x, base, 11, c, align, true);
  }
  // the heavy clock digits (firmware mochi_dg_32b / 48b: the glyph drawn 3 times, 1 px apart)
  big(str, x, base, c, align = 'center', size = 31) {
    const g = this.g; g.fillStyle = c; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.font = `800 ${size}px "DejaVu Sans", Verdana, sans-serif`; g.fillText(str, x, base);
  }
  sleepy(tm) { return tm.h >= 22 || tm.h < 6; }
  mochiFace(x, y, s, sleepy, ms) {
    const th = Math.max(0.55, 0.85 * s), K = '#2c2838';
    if (sleepy) {
      for (const sg of [-1, 1]) { const ex = x + sg * 9 * s; this.line(ex - 4 * s, y - s, ex, y + 2 * s, th, K); this.line(ex, y + 2 * s, ex + 4 * s, y - s, th, K); }
    } else {
      const blink = ms % 4300 < 130;
      for (const sg of [-1, 1]) { const ex = x + sg * 9 * s; this.box(ex, y, 5 * s, blink ? 1.2 * s : 8 * s, 4 * s, K); if (!blink) this.circle(ex - 2 * s, y - 4 * s, 2 * s, WHITE); }
    }
    this.box(x - 17 * s, y + 8 * s, 4 * s, 2 * s, 2 * s, '#ff8fab'); this.box(x + 17 * s, y + 8 * s, 4 * s, 2 * s, 2 * s, '#ff8fab');
    this.line(x - 3 * s, y + 7.5 * s, x, y + 10 * s, th, K); this.line(x, y + 10 * s, x + 3 * s, y + 7.5 * s, th, K);
  }
  miniMochi(x, y, s, sleepy, behind, ms) {  // little pink Mochi, as the sketches
    const fill = behind === '#fac8d4' ? mix('#fac8d4', '#ffffff', 0.47) : '#fac8d4';
    this.box(x, y, 22 * s, 17 * s, 10 * s, deepen(fill)); this.box(x, y, 22 * s - 1.6, 17 * s - 1.6, 10 * s - 1.6, fill);
    this.mochiFace(x, y + s, s, sleepy, ms);
  }
  faceMochiTime(tm, ms, p) {
    this.backdrop(p);
    this.box(32, 40, 25, 30, 12, p.plate);
    this.mochiFace(32, 38, 0.85, this.sleepy(tm), ms);
    this.big(this.hhmm(tm), 107, 45, '#2c2838'); this.small(this.dateLine(tm, true), 107, 64, p.acc);
  }
  faceSky(tm, ms) {
    const h = tm.h + tm.m / 60, night = h < 5.5 || h >= 19.5, dawn = !night && h < 7, dusk = !night && h >= 17;
    const SKY = [['#7cc4ff', '#9dd3ff', '#c2e4ff', '#dff1ff'], ['#ffaa96', '#ffc0a5', '#ffd6b9', '#ffe8cd'],
      ['#6e5aaa', '#dc7896', '#ffa078', '#ffc896'], ['#121838', '#1a224a', '#222c5c', '#2a366c']];
    const b = SKY[night ? 3 : dawn ? 1 : dusk ? 2 : 0];
    this.gradient(b[0], b[3]);
    const sky = this.skyColour(b[0], b[3]), ax = 80, ay = 84, ar = 62, dots = mix(sky, '#ffffff', night ? 0.27 : 0.62);
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.12 + 0.76 * i / 6); this.circle(ax + ar * Math.cos(a), ay - ar * Math.sin(a), 0.8, dots); }
    let q = night ? ((h - 18 + 24) % 24) / 12 : (h - 6) / 12; q = Math.min(1, Math.max(0, q));
    const a = Math.PI * (1 - q), sx = ax + ar * Math.cos(a), sy = ay - ar * Math.sin(a);
    if (night) { this.circle(sx, sy, 6, '#fff3b0'); this.circle(sx + 3.5, sy - 2.5, 5.2, sky); }
    else this.circle(sx, sy, 7, '#ffd23f');
    const w = this.wx();
    if (w && w.c >= 2) {
      const cl = night ? '#7882a0' : (w.c >= 51 ? '#e1e6f0' : '#ffffff');
      const cx = sx > 80 ? 44 : 118;  // on the other side from the sun / moon
      this.circle(cx - 8, 24, 5, cl); this.circle(cx, 20, 7, cl); this.circle(cx + 9, 24, 5, cl); this.box(cx, 27, 13, 3, 3, cl);
      if (rainy(w.c)) for (let i = 0; i < 3; i++) this.line(cx - 8 + i * 8, 32, cx - 10 + i * 8, 37, 0.8, '#3c8cff');
      else if (snowy(w.c)) for (let i = 0; i < 3; i++) this.circle(cx - 8 + i * 8, 34 + (i % 2) * 3, 1.3, '#ffffff');
    }
    this.circle(28, 112, 50, night ? '#285c40' : '#7ccf6a');
    this.miniMochi(27, 63, 0.45, night, '', ms);
    this.big(this.hhmm(tm), 154, 73, night ? WHITE : '#173a5c', 'right');
    if (w) this.small(this.deg(w), 6, 77, night ? '#c8d2ff' : WHITE, 'left');
  }
  faceSmart(tm, ms, p) {
    this.backdrop(p);
    this.big(this.hhmm(tm), 8, 31, '#2c2838', 'left');
    this.box(80, 47, 73, 8, 6, p.plate); this.box(80, 67, 73, 8, 6, p.plate);
    this.small(tip(tm, this.wx()), 12, 51, p.acc, 'left', 138);
    const l = this.lunar(tm);
    this.small(this.scene.nt || `${DAYS_SHORT[tm.wd]} ${tm.day}/${tm.mon}  Âm ${l.d.day}/${l.d.month}`, 12, 71, p.acc, 'left', 138);
    this.box(140, 19, 14, 12, 7, p.plate);
    this.mochiFace(140, 18, 0.42, this.sleepy(tm), ms);
  }
  faceDango(tm, ms, p) {
    this.backdrop(p);
    this.line(7, 44, 153, 44, 1.4, '#b07a4f');
    const balls = ['#ffd6e2', '#fff8ec', '#c8f0c8', '#ffd6e2'], xs = [26, 58, 102, 134];
    const dg = [Math.floor(tm.h / 10), tm.h % 10, Math.floor(tm.m / 10), tm.m % 10];
    xs.forEach((x, i) => { this.circle(x, 40, 16, deepen(balls[i])); this.circle(x, 40, 14.4, balls[i]); this.circle(x - 6, 32, 2.6, WHITE); });
    xs.forEach((x, i) => this.big(String(dg[i]), x + 1, 51.5, '#2c2838'));
    if (Math.floor(ms / 500) % 2 === 0) { this.circle(80, 36, 2.4, '#2c2838'); this.circle(80, 48, 2.4, '#2c2838'); }
    this.small(`${DAYS[tm.wd]}, ${tm.day}/${tm.mon}`, 80, 74, p.acc);
  }
  faceCalendar(tm, ms, p) {
    this.backdrop(p);
    const red = '#e24b4a';
    this.box(31, 41, 25, 32, 6, mix(p.bg, '#000000', 0.2)); this.box(31, 40, 25, 32, 6, WHITE);
    this.box(31, 15.5, 25, 7.5, 6, red); this.box(31, 20, 25, 3, 0, red);
    this.small('Thg ' + tm.mon, 31, 20, WHITE, 'center', 48); this.big(String(tm.day), 31, 53, red);
    this.small(DAYS_SHORT[tm.wd], 31, 67, '#5f5e5a', 'center', 48);
    this.big(this.hhmm(tm), 156, 37, '#2c2838', 'right');
    const l = this.lunar(tm).d;
    this.small(l.day === 1 ? `Mùng 1 tháng ${l.month}` : l.day === 15 ? `Rằm tháng ${l.month}` : `Âm lịch ${l.day}/${l.month}`, 107, 55, red, 'center', 96);
    const w = this.wx();
    this.small(DAYS[tm.wd] + (w ? '  ' + this.deg(w) : ''), 107, 71, p.acc, 'center', 96);
  }
  faceNight(tm, ms) {
    const sky = '#141a3a';
    this.box(80, 40, 80, 40, 8, sky);
    const ST = [[12, 10], [40, 22], [70, 8], [100, 18], [150, 34], [118, 6], [20, 34], [62, 30]];
    ST.forEach(([x, y], i) => { const tw = (Math.floor(ms / 400) + i * 3) % 5 < 1 ? 0.5 : 1; this.circle(x, y, (i % 3 ? 0.8 : 1.3) * tw, i % 3 ? '#cfd6ff' : '#fff7c2'); });
    this.circle(138, 16, 8, '#fff3b0'); this.circle(142, 13, 7, sky);
    this.miniMochi(30, 57, 0.55, true, sky, ms);
    const z = Math.floor(ms / 900) % 2;
    this.small('z', 44, 45 - z, '#9fb0ff', 'left'); this.text('Z', 49, 34 - z, 17, '#9fb0ff', 'left', true);
    this.big(this.hhmm(tm), 154, 59, '#e8ebff', 'right');
    this.small(this.scene.nt || this.dateLine(tm, false), 154, 75, '#9fb0ff', 'right', 100);
  }
  faceClimb(tm, ms, p) {
    this.backdrop(p);
    this.big(this.hhmm(tm), 80, 72, '#2c2838', 'center', 46);
    const x = [30, 62, 98, 130][tm.m % 4];
    this.miniMochi(x, 25, 0.42, this.sleepy(tm), p.bg, ms);
    this.circle(x - 6, 33, 2.4, deepen('#fac8d4')); this.circle(x + 6, 33, 2.4, deepen('#fac8d4'));
    if (x < 80) this.small(this.dateLine(tm, true), 152, 14, p.acc, 'right'); else this.small(this.dateLine(tm, true), 8, 14, p.acc, 'left');
  }
  faceTea(tm, ms, p) {
    this.backdrop(p);
    const cup = '#e8d5c0';
    this.line(42, 4, 37, 40, 1.6, '#ff8fab');
    this.box(34, 44, 19, 30, 5, deepen(cup)); this.box(34, 44, 17.4, 28.4, 4, cup);
    const h = tm.h + tm.m / 60, lvl = 1 - Math.min(1, Math.max(0, (h - 6) / 16)), top = 72 - 54 * lvl;
    if (72 - top > 2) this.box(34, (top + 72) / 2, 16, (72 - top) / 2, 3, '#c79a6e');
    [[23, 68], [31, 69], [39, 68], [46, 69], [27, 63], [42, 63]].forEach(([x, y]) => this.circle(x, y, 2.6, '#3b2a20'));
    this.miniMochi(31, Math.min(56, Math.max(26, top - 2)), 0.32, this.sleepy(tm), cup, ms);
    this.big(this.hhmm(tm), 107, 38, '#2c2838');
    this.small(teaTip(tm.h), 107, 56, p.acc, 'center', 100); this.small(this.dateLine(tm, true), 107, 72, '#2c2838', 'center', 100);
  }
  faceSeason(tm, ms) {
    const l = this.lunar(tm), m = tm.mon;
    const season = (m <= 4 || (l.d.month === 12 && l.d.day >= 15)) ? 0 : m <= 7 ? 1 : m <= 10 ? 2 : 3;
    const bg = ['#ffe3ec', '#fff0be', '#ffe2c6', '#c4dcfa'][season], acc = ['#993556', '#854f0b', '#993c1d', '#185fa5'][season];
    this.box(80, 40, 80, 40, 8, deepen(bg)); this.box(80, 40, 78, 38, 6, bg);
    const wood = '#6b3a2a';
    if (season === 0 || season === 2) { this.line(0, 10, 30, 17, 1.3, wood); this.line(30, 17, 60, 11, 1.1, wood); this.line(32, 17, 40, 27, 0.9, wood); }
    if (season === 0) {
      [[10, 9], [26, 15], [44, 15], [56, 9], [38, 28]].forEach(([x, y]) => {
        for (let q = 0; q < 5; q++) { const a = q * 1.2566 - 1.5708; this.circle(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.4, '#ff7aa2'); }
        this.circle(x, y, 1.3, '#ffd23f');
      });
    } else if (season === 1) {
      this.circle(22, 18, 9, '#ffc428');
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + (Math.floor(ms / 2000) % 2) * 0.39; this.line(22 + Math.cos(a) * 12, 18 + Math.sin(a) * 12, 22 + Math.cos(a) * 15, 18 + Math.sin(a) * 15, 0.9, '#ffc428'); }
    } else if (season === 2) {
      const LC = ['#e66e28', '#c83c28', '#f0b432'];
      [[8, 11], [20, 16], [34, 13], [47, 14], [57, 9], [38, 27], [26, 21]].forEach(([x, y], i) => this.circle(x, y, 3, LC[i % 3]));
    }
    if (season === 3) {
      this.box(80, 74, 78, 6, 6, WHITE);
      this.circle(50, 70, 5.6, '#96b4dc'); this.circle(50, 70, 4.8, WHITE); this.circle(50, 62.5, 4.2, '#96b4dc'); this.circle(50, 62.5, 3.4, WHITE);
      this.circle(48.8, 61.8, 0.7, '#2c2838'); this.circle(51.2, 61.8, 0.7, '#2c2838'); this.line(50, 63.8, 52.5, 64.2, 0.6, '#ff8c28');
    }
    const n = season === 3 ? 10 : season === 1 ? 0 : 4;
    for (let i = 0; i < n; i++) {
      const x = (17 + i * 37) % 150 + 5, y = (Math.floor(ms / (season === 3 ? 90 : 140)) + i * 23) % 84 - 2;
      this.circle(x, y, season === 3 ? 1.4 : 1.6, season === 0 ? '#ff9ab8' : season === 2 ? '#e67832' : WHITE);
    }
    this.miniMochi(24, 64, 0.4, this.sleepy(tm), bg, ms);
    this.big(this.hhmm(tm), 156, 42, '#2c2838', 'right');
    const SL = ['Xuân về rồi', 'Hè rồi, uống nước nha', 'Thu sang rồi', 'Đông rồi, giữ ấm nhé'];
    this.small(l.tet <= 0 ? 'Chúc mừng năm mới!' : l.tet === 1 ? 'Mai là Tết rồi!' : l.tet > 100 ? SL[season] : `Còn ${l.tet} ngày tới Tết`, 154, 58, acc, 'right', 120);
    this.small(this.dateLine(tm, true), 154, 73, '#2c2838', 'right', 100);
  }
  faceWeather(tm, ms) {
    const w = this.wx(), code = w ? w.c : 2, night = w ? w.day === 0 : (tm.h < 6 || tm.h >= 19), t = w ? Math.round(w.t) : 20;
    const rain = rainy(code), snow = snowy(code), storm = code >= 95, fog = code === 45 || code === 48, cloudy = code >= 2;
    const [gt, gb] = night ? ['#121838', '#303c70'] : storm ? ['#464e68', '#788096'] : rain ? ['#7086a6', '#b2c0d2']
      : snow ? ['#c8d8ee', '#f0f6fc'] : fog ? ['#ced2d6', '#eceef0'] : cloudy ? ['#96bee8', '#d6e6f5'] : ['#6ebeff', '#d6eeff'];
    this.gradient(gt, gb);
    const dark = night || storm || rain;
    if (night && !cloudy) {
      [[10, 8], [30, 20], [58, 9], [44, 30], [66, 24]].forEach(([x, y], i) => this.circle(x, y, (Math.floor(ms / 400) + i * 3) % 5 < 1 ? 0.5 : 1, '#fff7c2'));
      this.circle(18, 18, 8, '#fff3b0'); this.circle(22, 15, 7, this.skyColour(gt, gb));
    } else if (!night && code <= 2) {
      const spin = (Math.floor(ms / 600) % 2) * 0.39;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + spin; this.line(18 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, 18 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, 1, '#ffc828'); }
      this.circle(18, 16, 8, '#ffc828');
    }
    if (cloudy && !fog) {
      const cl = storm ? '#5a6078' : rain ? '#96a0b2' : night ? '#6e7896' : WHITE, d = (Math.floor(ms / 120) % 20) / 10 - 1;
      this.circle(30 + d, 18, 7, cl); this.circle(41 + d, 13, 9, cl); this.circle(53 + d, 18, 7, cl); this.box(41 + d, 22, 16, 4, 4, cl);
    }
    if (fog) for (let i = 0; i < 4; i++) this.line(6 + (i % 2) * 6, 14 + i * 9, 60 + (i % 2) * 6, 14 + i * 9, 1.4, '#fafafa');
    if (rain || storm) for (let i = 0; i < 7; i++) { const x = 10 + i * 8, y = 28 + (Math.floor(ms / 25) + i * 37) % 50; this.line(x, y, x - 1.5, y + 4, 0.7, '#5096ff'); }
    if (snow) for (let i = 0; i < 8; i++) { const x = 6 + (i * 23) % 62 + Math.sin(ms / 500 + i) * 2, y = (Math.floor(ms / 70) + i * 29) % 84 - 2; this.circle(x, y, 1.3, WHITE); }
    if (storm && Math.floor(ms / 150) % 20 === 0) { this.line(44, 26, 38, 36, 1.2, '#ffe65a'); this.line(38, 36, 46, 36, 1.2, '#ffe65a'); this.line(46, 36, 40, 46, 1.2, '#ffe65a'); }
    const mx = 34, my = 62, s = 0.5;
    if (rain || storm) {
      this.line(mx + 12, my - 22, mx + 12, my - 4, 0.8, '#78503c');
      this.circle(mx + 12, my - 20, 13, '#ff6e8c'); this.box(mx + 12, my - 13, 14, 7, 0, this.skyColour(gt, gb));
    }
    this.miniMochi(mx, my, s, night || this.sleepy(tm), '', ms);
    if (snow || t < 12) this.box(mx, my + 8, 10, 2.2, 2, '#e24b4a');
    if (!night && !cloudy && t >= 28) { this.box(mx - 4.5, my, 3.6, 2.6, 1.2, '#2c2838'); this.box(mx + 4.5, my, 3.6, 2.6, 1.2, '#2c2838'); this.line(mx - 1, my - 1, mx + 1, my - 1, 0.6, '#2c2838'); }
    const ink = dark ? WHITE : '#2c2838', soft = dark ? '#d6e0ff' : '#184682';
    this.big(this.hhmm(tm), 156, 34, ink, 'right');
    if (w) {
      this.small(weatherWord(code, !night) + '  ' + this.deg(w), 154, 52, ink, 'right', 112);
      this.small(Math.round(w.mn) + '°-' + Math.round(w.mx) + '°  ' + w.h + '%', 154, 68, soft, 'right', 112);
    } else this.small('Đang lấy thời tiết', 154, 56, soft, 'right', 92);
  }
  digits(a, b, c, acc, t) {
    const seg = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F];
    const dig = (x, y, w, h, th, d) => {
      const m = d >= 0 && d <= 9 ? seg[d] : 0x40, L = x - w / 2, R = x + w / 2, T = y - h / 2, M = y, B = y + h / 2;
      if (m & 1) this.line(L, T, R, T, th, c); if (m & 2) this.line(R, T, R, M, th, c); if (m & 4) this.line(R, M, R, B, th, c);
      if (m & 8) this.line(L, B, R, B, th, c); if (m & 16) this.line(L, M, L, B, th, c); if (m & 32) this.line(L, T, L, M, th, c);
      if (m & 64) this.line(L, M, R, M, th, c);
    };
    const y = 36, w = 15, h = 30, th = 2.4;
    dig(30, y, w, h, th, Math.floor(a / 10)); dig(53, y, w, h, th, a % 10);
    dig(107, y, w, h, th, Math.floor(b / 10)); dig(130, y, w, h, th, b % 10);
    if (Math.floor(t * 2) % 2 === 0) { this.circle(80, y - 7, 2.6, c); this.circle(80, y + 7, 2.6, c); }
  }
  weatherIcon(cx, cy, code, day, pastel, body) {
    const sun = '#ffba1e', moon = pastel ? '#786eaa' : '#f5ebbe', cloud = pastel ? '#768096' : '#d6dce8', rain = '#3c8cff';
    const cloudAt = (x, y) => { this.circle(x - 8, y + 3, 7, cloud); this.circle(x + 1, y - 3, 9.5, cloud); this.circle(x + 10, y + 3, 7, cloud); this.box(x + 1, y + 6, 17, 4, 4, cloud); };
    const sunAt = (x, y, r) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.line(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3), x + Math.cos(a) * (r + 6.5), y + Math.sin(a) * (r + 6.5), 1.1, sun); } this.circle(x, y, r, sun); };
    const moonAt = (x, y, r) => { this.circle(x, y, r, moon); this.circle(x + r * 0.55, y - r * 0.4, r * 0.85, body); };
    if (code <= 1) { if (day) sunAt(cx, cy, 9); else moonAt(cx, cy, 11); }
    else if (code === 2) { if (day) sunAt(cx - 7, cy - 6, 7); else moonAt(cx - 7, cy - 6, 8); cloudAt(cx + 3, cy + 5); }
    else if (code === 45 || code === 48) { for (let i = 0; i < 3; i++) this.line(cx - 15 + i * 3, cy - 7 + i * 7, cx + 15 - i * 3, cy - 7 + i * 7, 1.6, cloud); }
    else if (code >= 51) { cloudAt(cx, cy - 5); for (let i = 0; i < 3; i++) this.line(cx - 7 + i * 7, cy + 8, cx - 9 + i * 7, cy + 15, 1.3, rain); }
    else cloudAt(cx, cy);
  }

  drawPoster(t) {
    const p = this.scene.p, g = this.g, SW = this.L.w, SH = this.L.h;
    const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
    if (p.g) {
      const gr = p.g === 2 ? g.createLinearGradient(0, 0, 0, SH) : g.createLinearGradient(0, 0, SW, 0);
      gr.addColorStop(0, hex(p.bg)); gr.addColorStop(1, hex(p.bg2)); g.fillStyle = gr;
    } else g.fillStyle = hex(p.bg);
    g.fillRect(0, 0, SW, SH);
    const size = (p.sz || 48) * (this.s3 ? 1.25 : 1);
    const font = `500 ${size * 0.92}px "DejaVu Sans", Verdana, sans-serif`;
    g.font = font; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = hex(p.fg);
    const w = g.measureText(p.t).width;
    if (w <= SW - 8) { g.textAlign = 'center'; g.fillText(p.t, SW / 2, SH / 2); return; }
    if (this.s3) {  // the tall screen: wrapped lines, centred, while they fit; scrolling otherwise
      const lines = this.wrap(p.t, SW - 24, font), lh = size * 1.12;
      if (lines.length * lh <= SH - 24) {
        g.font = font; g.textAlign = 'center'; g.fillStyle = hex(p.fg);
        lines.forEach((ln, i) => g.fillText(ln, SW / 2, SH / 2 + (i - (lines.length - 1) / 2) * lh));
        return;
      }
      g.font = font; g.fillStyle = hex(p.fg); g.textAlign = 'left';
    }
    const span = w + 48, x = SW - ((t - this.posterT0) * (p.sp || 40)) % span;
    g.fillText(p.t, x, SH / 2); g.fillText(p.t, x - span, SH / 2);
  }

  drawMenu() {
    if (this.s3) { this.text('⚙', 120, 132, 40, '#ff78aa'); this.text('Đang mở menu', 120, 172, 19, '#cdc8e1', 'center', true); return; }
    this.text('⚙', 80, 38, 22, '#ff78aa'); this.text('Đang mở menu', 80, 62, 13, '#cdc8e1', 'center', true);
  }
}
window.MochiScreen = MochiScreen;
MochiScreen.FACES = 10;  // clock faces (MochiDisplay::kClockStyles)
})();
