// Mochi AI Lab: a live mirror of Mochi's 160x80 screen, drawn in a <canvas> with the same shapes
// as the firmware's renderer (mochi_display.h: BuildFace, DrawDigits, DrawAnalog, the poster).
// Mochi sends what is on screen on the sealed "scene" topic (face, colour, clock, subtitle,
// poster, sleep, chat state); the small animations (blinks, glances, bobbing, talking) run here.
//   const scr = new MochiScreen(canvasElement); scr.setScene(sceneJson); scr.setState(stateJson);
(function () {
const W = 160, H = 80;
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
function hue(h) { h -= Math.floor(h); return `hsl(${Math.round(h * 360)} 100% 50%)`; }

class MochiScreen {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    canvas.width = W * 4; canvas.height = H * 4;  // drawn at 4x, so it stays sharp when scaled
    this.scene = { f: 0, b: 0, s: 0 }; this.state = null; this.recv = 0;
    this.look = [0, 0]; this.lookT = [0, 0]; this.nextLook = 0; this.nextBlink = 0;
    this.glow = 0; this.posterT0 = 0; this.subT0 = 0;
    const loop = (t) => { this.draw(t / 1000); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  setScene(sc) {
    const prev = this.scene;
    this.scene = sc || {}; this.recv = Date.now();
    if (!prev.p || !sc.p || prev.p.t !== sc.p.t) this.posterT0 = performance.now() / 1000;
    if (prev.sub !== sc.sub) this.subT0 = performance.now() / 1000;
  }
  setState(st) { this.state = st; }
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
  edges(c, r) { this.line(1, 1, W - 1, 1, r, c); this.line(W - 1, 1, W - 1, H - 1, r, c); this.line(W - 1, H - 1, 1, H - 1, r, c); this.line(1, H - 1, 1, 1, r, c); }

  draw(t) {
    const g = this.g, sc = this.scene;
    g.setTransform(4, 0, 0, 4, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (sc.mn) { this.drawMenu(); return; }
    if (sc.p) { this.drawPoster(t); return; }
    const body = BODIES[sc.b] || BODIES[0], pastel = body !== '#000000';
    if (sc.ck != null && sc.ck >= 0 && !sc.al) this.drawClock(t, body, pastel);
    else this.drawFace(t, body, pastel);
    if (sc.sl) { g.fillStyle = 'rgba(0,0,0,.66)'; g.fillRect(0, 0, W, H); }
    const br = (sc.br || 100) / 100;
    if (br < 1) { g.fillStyle = `rgba(0,0,0,${1 - br})`; g.fillRect(0, 0, W, H); }
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
    const talking = sc.s === 2, listening = sc.s === 1, music = !!sc.mu && talking;
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
    const lift = sc.sub ? 14 : 0;
    const hop = sc.al ? -Math.round(Math.abs(Math.sin(t * 8)) * 4) : 0;
    const wiggle = sc.al ? Math.round(Math.sin(t * 30) * 2) : 0;
    const cx = 80 + wiggle, ey = 34 - lift + bob + hop, ex = 34, my = 58 - lift * 17 / 14 + bob + hop;
    const k = ink(face, pastel), cut = body;
    const blushC = pastel ? '#ff7896' : PINK, tearC = pastel ? '#3c82ff' : BLUE;
    if (pastel) {
      // the whole screen, rounded corners, 2 px rim in a deeper colour (firmware: Rim(), BOTTOM_R 8, RIM_W 2)
      this.box(80, 40, 80, 40, 8, deepen(body));
      this.box(80, 40, 78, 38, 6, body);
    }
    this.drawGlow(t);
    if (sc.tm > 0) this.line(4, 3, 4 + (W - 8) * Math.min(1, sc.tm / 1500), 3, 1.3, pastel ? '#e66e00' : '#ffaa00');
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

    if (music) {
      const sway = Math.round(Math.sin(t * 2.2) * 2);
      this.arc(cx - ex + sway, ey + 8, 11, 200, 340, 3, k); this.arc(cx + ex + sway, ey + 8, 11, 200, 340, 3, k);
      blush(); this.box(cx + sway * 0.5, my - 3, 4, 2 + Math.abs(Math.sin(t * 8)) * 3, 3, k);
      for (let i = 0; i < 9; i++) { const h = 2 + Math.abs(Math.sin(t * (5 + i) + i)) * 9; this.line(cx - 24 + i * 6, 77, cx - 24 + i * 6, 77 - h, 1.6, hue(i / 9 + t * 0.15)); }
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.22 + i * 0.25) % 1, side = i % 2 ? 1 : -1;
        const nx = 80 + side * (62 + 6 * Math.sin(t * 2 + i * 1.7)), ny = 74 - p * 78;
        if (ny < 10) continue;
        const nc = hue(i * 0.27 + p * 0.4);
        this.circle(nx, ny, 2.6, nc); this.line(nx + 2.2, ny, nx + 2.2, ny - 8, 0.8, nc); this.line(nx + 2.2, ny - 8, nx + 5.5, ny - 5, 0.8, nc);
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
    if (sc.sub) this.drawSubtitle(t, body, pastel);
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

  drawClock(t, body, pastel) {
    const sc = this.scene;
    let bg = body, light = pastel;
    const cb = CLOCK_BGS[sc.cb || 0];
    if (cb) { bg = cb[0]; light = !!cb[1]; }
    this.g.fillStyle = bg; this.g.fillRect(0, 0, W, H);
    const k = light ? '#2c2838' : WHITE, acc = light ? '#c85000' : '#ffaa00';
    const d = this.mochiTime();
    const hh = d.getUTCHours(), mm = d.getUTCMinutes();
    if (sc.ck === 10) {  // timer countdown
      const left = Math.max(0, Math.round((sc.tm || 0) - (Date.now() - this.recv) / 1000));
      this.digits(left >= 6000 ? Math.floor(left / 3600) : Math.floor(left / 60), left >= 6000 ? Math.floor(left / 60) % 60 : left % 60, acc, acc, t);
      return;
    }
    if (sc.ck === 1) {  // analog
      const cx = 80, cy = 40, r = 35;
      this.circle(cx, cy, r, k); this.circle(cx, cy, r - 1.6, bg);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, inn = i % 3 === 0 ? r - 8 : r - 5;
        this.line(cx + Math.sin(a) * inn, cy - Math.cos(a) * inn, cx + Math.sin(a) * (r - 3.5), cy - Math.cos(a) * (r - 3.5), i % 3 === 0 ? 1.1 : 0.6, k);
      }
      const sec = d.getUTCSeconds(), min = mm + sec / 60, hr = (hh % 12) + min / 60;
      const hand = (turns, len, th, c) => { const a = turns * 2 * Math.PI; this.line(cx - Math.sin(a) * 3, cy + Math.cos(a) * 3, cx + Math.sin(a) * len, cy - Math.cos(a) * len, th, c); };
      hand(hr / 12, 18, 2.1, k); hand(min / 60, 26, 1.5, k); hand(sec / 60, 29, 0.6, acc); this.circle(cx, cy, 2.4, acc);
      this.text(DAYS_SHORT[d.getUTCDay()], 22, 34, 20, k); this.text(String(d.getUTCDate()), 22, 58, 20, acc);
      const wx = this.state && this.state.wx;
      if (wx && wx.t != null) this.text(Math.round(wx.t) + '°', 139, 46, 20, k);
      return;
    }
    if (sc.ck === 2) {  // big digits + date
      this.text(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 80, 47, 46, k);
      this.text(`${DAYS[d.getUTCDay()]}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}`, 80, 72, 17, acc);
      return;
    }
    if (sc.ck === 3) {  // time + weather
      this.text(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 108, 33, 30, k);
      const wx = this.state && this.state.wx;
      this.weatherIcon(32, 36, wx && wx.c != null ? wx.c : 3, !wx || wx.day !== 0, light, bg);
      if (wx && wx.t != null) {
        this.text(`${Math.round(wx.t)}°  ${wx.h}%`, 108, 57, 17, acc);
        this.text(`${Math.round(wx.mn)}° - ${Math.round(wx.mx)}°`, 108, 76, 17, k);
      } else this.text('Đang lấy...', 108, 60, 15, acc);
      return;
    }
    // 7-segment with a seconds bar
    const sec = d.getUTCSeconds();
    this.line(30, 64, 130, 64, 1, light ? '#b9a8a0' : '#6a5a30');
    if (sec > 0) this.line(30, 64, 30 + 100 * sec / 59, 64, 1.4, acc);
    this.digits(hh, mm, k, acc, t);
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
    const p = this.scene.p, g = this.g;
    const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
    if (p.g) {
      const gr = p.g === 2 ? g.createLinearGradient(0, 0, 0, H) : g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, hex(p.bg)); gr.addColorStop(1, hex(p.bg2)); g.fillStyle = gr;
    } else g.fillStyle = hex(p.bg);
    g.fillRect(0, 0, W, H);
    const size = p.sz || 48;
    g.font = `500 ${size * 0.92}px "DejaVu Sans", Verdana, sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = hex(p.fg);
    const w = g.measureText(p.t).width;
    if (w <= W - 8) { g.textAlign = 'center'; g.fillText(p.t, W / 2, H / 2); return; }
    const span = w + 48, x = W - ((t - this.posterT0) * (p.sp || 40)) % span;
    g.fillText(p.t, x, H / 2); g.fillText(p.t, x - span, H / 2);
  }

  drawMenu() {
    this.text('⚙', 80, 38, 22, '#ff78aa'); this.text('Đang mở menu', 80, 62, 13, '#cdc8e1', 'center', true);
  }
}
window.MochiScreen = MochiScreen;
})();
