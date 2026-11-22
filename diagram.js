// Builds the ESP32-C3 wiring diagram from the real component photos (parts.js).
// Canvas is 1600x900 (16:9). Each photo is placed at [x, y] with a display width; pins are
// mapped from photo pixels to canvas coordinates, and wires are routed with H/V steps.
(function () {
  const P = window.MOCHI_PARTS;
  const W = 1600, H = 900;

  // where each photo goes: [x, y, display width]
  const place = {
    mic: [60, 60, 250], c3: [635, 270, 330], screen: [1180, 60, 330], amp: [80, 590, 240],
    speaker: [300, 330, 120], charger: [1260, 590, 320], battery: [1010, 778, 230], switch: [1050, 620, 150],
  };
  const pin = (part, name) => {
    const p = P[part], [x, y, w] = place[part], s = w / p.crop[2], [px, py] = p.pins[name];
    return [x + (px - p.crop[0]) * s, y + (py - p.crop[1]) * s];
  };

  const C = {
    disp: '#7a4fd0', ws: '#d23f8a', clk: '#e07b00', data: '#2f6fd6', touch: '#1d9a6a',
    v33: '#d63a3a', v5: '#a11d1d', gnd: '#4a4a4a', red: '#e0262e', black: '#222', bat: '#c2477a', na: '#8a8494',
  };

  // route: start at pin, then steps 'x123' (horizontal to x) / 'y456' (vertical to y), end at pin
  function wire(from, steps, to, color, dot = true) {
    let [x, y] = from, d = `M${x} ${y}`;
    for (const s of steps) {
      const v = +s.slice(1);
      if (s[0] === 'x') { x = v; d += ` H${v}`; } else { y = v; d += ` V${v}`; }
    }
    if (to) {
      // finish with whichever axis is still off; last step decides the order
      const last = steps.length ? steps[steps.length - 1][0] : 'y';
      if (last === 'x') d += ` V${to[1]} H${to[0]}`; else d += ` H${to[0]} V${to[1]}`;
    }
    const ends = [from, to].filter(Boolean).map(([a, b]) =>
      `<circle cx="${a}" cy="${b}" r="5.5" fill="${color}" stroke="#fff" stroke-width="2"/>`).join('');
    return `<path d="${d}" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>` +
           `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` +
           (dot ? ends : '');
  }
  const junction = (x, y, c) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="#fff" stroke-width="2"/>`;

  // small power tag next to a pin: line out to (dx, dy), then a coloured pill
  function tag(at, dx, dy, text, color, align = 'start') {
    const [x, y] = at, tx = x + dx, ty = y + dy;
    const w = text.length * 7.4 + 16;
    const rx = align === 'end' ? tx - w : align === 'middle' ? tx - w / 2 : tx;
    const line = (dx || dy) ? `<path d="M${x} ${y} L${tx} ${ty}" stroke="#fff" stroke-width="6"/><path d="M${x} ${y} L${tx} ${ty}" stroke="${color}" stroke-width="2.5"/>` : '';
    return line + `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/>` +
      `<rect x="${rx}" y="${ty - 11}" width="${w}" height="22" rx="11" fill="${color}"/>` +
      `<text x="${rx + w / 2}" y="${ty + 4.5}" text-anchor="middle" fill="#fff" font-size="12.5" font-weight="700">${text}</text>`;
  }
  const label = (x, y, text, anchor = 'start') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="15" font-weight="700" fill="#2b2533">${text}</text>`;

  function photo(part) {
    const p = P[part], [x, y, w] = place[part], [cx, cy, cw, ch] = p.crop, h = w * ch / cw;
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${cx} ${cy} ${cw} ${ch}" preserveAspectRatio="none">` +
           `<image href="${p.img}" x="0" y="0"/></svg>`;
  }

  // TTP223 touch pad (no photo sent): simple drawing of the red module
  const touch = { x: 760, y: 70, pins: { VCC: [790, 196], IO: [835, 196], GND: [880, 196] } };
  const touchSvg = `
    <rect x="${touch.x}" y="${touch.y}" width="150" height="118" rx="10" fill="#d9262c"/>
    <circle cx="835" cy="120" r="34" fill="none" stroke="#fff" stroke-width="3"/>
    <text x="835" y="125" text-anchor="middle" fill="#fff" font-size="14" font-weight="800" letter-spacing="1">TOUCH</text>
    <g fill="#e8c46a" stroke="#b08a2e" stroke-width="1.5">
      <rect x="784" y="180" width="12" height="18" rx="3"/><rect x="829" y="180" width="12" height="18" rx="3"/><rect x="874" y="180" width="12" height="18" rx="3"/></g>
    <g fill="#fff" font-size="10.5" font-weight="700" text-anchor="middle"><text x="790" y="174">VCC</text><text x="835" y="174">I/O</text><text x="880" y="174">GND</text></g>`;

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Be Vietnam Pro, Segoe UI, sans-serif" role="img" aria-label="Sơ đồ đấu dây Mochi với ảnh linh kiện thật">`;
  s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  for (const k of Object.keys(place)) s += photo(k);
  s += touchSvg;

  // ---------- names ----------
  s += label(60, 312, 'Mic INMP441');
  s += label(1180, 352, 'Màn ST7735S 0.96"');
  s += label(800, 660, 'ESP32-C3 SuperMini', 'middle');
  s += label(760, 60, 'Nút chạm TTP223');
  s += label(80, 584, 'Ampli MAX98357A');
  s += `<text x="330" y="812" font-size="12.5" fill="#6d6579">GAIN, SD: để trống</text>`;
  s += label(430, 345, 'Loa');
  s += label(1260, 582, 'Mạch sạc Type-C');
  s += label(1385, 872, 'Pin 14250 3.7V');
  s += label(1050, 612, 'Công tắc gạt');

  // ---------- display (right side): up over the top, then down onto the header ----------
  const disp = [['6', 'CS', 960, 22], ['7', 'DC', 988, 30], ['8', 'RES', 1016, 38], ['9', 'SDA', 1044, 46], ['10', 'SCL', 1072, 54]];
  for (const [g, n, lane, top] of disp) s += wire(pin('c3', g), [`x${lane}`, `y${top}`], pin('screen', n), C.disp);

  // ---------- touch pad ----------
  s += wire(pin('c3', '5'), ['x945', 'y255'], touch.pins.IO, C.touch);

  // ---------- microphone ----------
  s += wire(pin('mic', 'SD'), ['x560'], pin('c3', '4'), C.data);
  s += wire(pin('mic', 'WS'), ['x540'], pin('c3', '1'), C.ws);
  s += wire(pin('mic', 'SCK'), ['x520'], pin('c3', '2'), C.clk);

  // ---------- amplifier: down under the board, then over to the shared lanes ----------
  const [, yWs] = pin('c3', '1'), [, yClk] = pin('c3', '2');
  s += wire(pin('amp', 'LRC'), ['y890', 'x540', `y${yWs}`], null, C.ws);
  s += junction(540, yWs, C.ws);
  s += wire(pin('amp', 'BCLK'), ['y878', 'x520', `y${yClk}`], null, C.clk);
  s += junction(520, yClk, C.clk);
  s += wire(pin('amp', 'DIN'), ['y866', 'x500'], pin('c3', '3'), C.data);

  // ---------- speaker -> amp screw terminal ----------
  const [sx, sy] = pin('speaker', 'red');
  s += wire([sx - 4, sy], ['y595'], pin('amp', 'SPK-'), C.black);
  s += wire([sx + 4, sy], ['y610'], pin('amp', 'SPK+'), C.red);

  // ---------- battery -> charger -> switch ----------
  s += wire(pin('battery', '+'), ['y885'], pin('charger', 'B+'), C.red);
  s += wire(pin('battery', '-'), [], pin('charger', 'B-'), C.black);
  s += wire(pin('charger', 'OUT+'), ['x' + pin('switch', 'COM')[0]], pin('switch', 'COM'), C.bat);

  // ---------- power tags ----------
  s += tag(pin('c3', '5V'), -22, 0, '5V', C.v5, 'end');
  s += tag(pin('c3', 'G'), -22, 0, 'GND', C.gnd, 'end');
  s += tag(pin('c3', '3V3'), -22, 0, '3V3', C.v33, 'end');
  s += tag(pin('mic', 'GND'), 0, -36, 'GND', C.gnd, 'middle');
  s += tag(pin('mic', 'VDD'), 95, -28, '3V3', C.v33);
  s += tag(pin('mic', 'LR'), -18, 34, 'GND', C.gnd, 'end');
  s += tag(pin('amp', 'GND'), 0, 26, 'GND', C.gnd, 'middle');
  s += tag(pin('amp', 'VIN'), 34, 26, '5V', C.v5);
  s += tag(pin('screen', 'GND'), -72, 0, 'GND', C.gnd, 'end');
  s += tag(pin('screen', 'VCC'), -99, 26, '3V3', C.v33, 'end');
  s += tag(pin('screen', 'BLK'), 85, 0, 'trống', C.na);
  s += tag(touch.pins.VCC, 0, 34, '3V3', C.v33, 'middle');
  s += tag(touch.pins.GND, 0, 34, 'GND', C.gnd, 'middle');
  s += tag(pin('charger', 'OUT-'), 0, -60, 'GND của C3', C.gnd, 'middle');
  s += tag(pin('switch', 'A'), -24, 0, '5V của C3', C.v5, 'end');

  // pin names on the charger / switch (their photos have no readable labels)
  const small = (at, dx, dy, t) => `<text x="${at[0] + dx}" y="${at[1] + dy}" font-size="12" font-weight="700" fill="#2b2533">${t}</text>`;
  s += small(pin('charger', 'B+'), 8, -8, 'B+') + small(pin('charger', 'B-'), 10, -6, 'B−') + small(pin('charger', 'OUT+'), 10, 4, 'OUT+');
  s += small(pin('battery', '+'), -4, -14, '+') + small(pin('battery', '-'), -8, -14, '−');

  s += '</svg>';
  const host = document.getElementById('c3photo');
  if (!host) return;
  host.innerHTML = s + '<span class="zoomhint">⛶ Bấm để phóng to</span>';
  host.title = 'Bấm để phóng to / thu nhỏ';
  const toggle = (on) => { host.classList.toggle('full', on); document.body.style.overflow = on ? 'hidden' : ''; host.querySelector('.zoomhint').textContent = on ? '✕ Bấm hoặc Esc để thu nhỏ' : '⛶ Bấm để phóng to'; };
  host.addEventListener('click', () => toggle(!host.classList.contains('full')));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
})();
