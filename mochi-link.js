// Mochi AI Lab: link to a Mochi over the internet (shared by nhan-chu.html and cai-dat.html).
// A tiny MQTT 3.1.1 client over WebSocket to the public broker the firmware uses
// (mochi_remote.h), and the end-to-end encryption on top: the broker only sees sealed data.
(function () {
const enc = new TextEncoder(), dec = new TextDecoder();
// ---------- tiny MQTT 3.1.1 client over WebSocket (CONNECT, SUBSCRIBE, PUBLISH qos 0, PING) ----------
function mqttStr(s) { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function mqttPacket(type, body) {
  const len = []; let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
  return new Uint8Array([type, ...len, ...body]);
}
class Mqtt {
  constructor(url, clientId, onMessage, onState) {
    this.url = url; this.clientId = clientId; this.onMessage = onMessage; this.onState = onState;
    this.buf = new Uint8Array(0); this.pid = 1; this.ready = false;
  }
  open() {
    this.ws = new WebSocket(this.url, 'mqtt');
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.ws.send(mqttPacket(0x10, [...mqttStr('MQTT'), 4, 0x02, 0, 60, ...mqttStr(this.clientId)]));
    this.ws.onmessage = (e) => this.feed(new Uint8Array(e.data));
    this.ws.onclose = () => { this.ready = false; clearInterval(this.ping); this.onState('closed'); };
  }
  close() {
    if (this.ws) {
      try { this.ws.send(new Uint8Array([0xE0, 0])); } catch (e) {}
      this.ws.onclose = null; this.ws.close();
    }
    clearInterval(this.ping); this.ready = false;
  }
  subscribe(topic) {
    const id = this.pid++ & 0xffff;
    this.ws.send(mqttPacket(0x82, [id >> 8, id & 255, ...mqttStr(topic), 0]));
  }
  publish(topic, payload) {
    if (!this.ready) return false;
    this.ws.send(mqttPacket(0x30, [...mqttStr(topic), ...enc.encode(payload)]));
    return true;
  }
  feed(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
    for (;;) {
      if (this.buf.length < 2) return;
      let mul = 1, len = 0, i = 1, d;
      do { if (i >= this.buf.length) return; d = this.buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (this.buf.length < i + len) return;
      const type = this.buf[0], body = this.buf.slice(i, i + len);
      this.buf = this.buf.slice(i + len);
      if ((type & 0xf0) === 0x20) {                 // CONNACK
        if (body[1] === 0) {
          this.ready = true;
          this.ping = setInterval(() => { try { this.ws.send(new Uint8Array([0xC0, 0])); } catch (e) {} }, 30000);
          this.onState('ready');
        } else this.onState('refused');
      } else if ((type & 0xf0) === 0x30) {          // PUBLISH
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.slice(2, 2 + tl));
        let p = 2 + tl; if (type & 0x06) p += 2;    // packet id when qos > 0
        this.onMessage(topic, dec.decode(body.slice(p)));
      }
    }
  }
}


// ---------- end-to-end encryption (same scheme as the firmware, mochi_remote.h) ----------
// key (12 letters/digits) -> PBKDF2 -> topic id + AES-256-GCM key; payload = base64(nonce|ct|tag),
// the topic leaf as associated data; messages to Mochi start with "<sid>|<unix ms>|" (replay guard:
// sid is the session id of Mochi's current start, read from its sealed state).
const KEY_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;
const normKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const prettyKey = (s) => normKey(s).slice(0, 12).replace(/(.{4})(?=.)/g, '$1-');
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKeys(key) {
  const subtle = crypto.subtle;
  const pw = await subtle.importKey('raw', enc.encode(key), 'PBKDF2', false, ['deriveBits']);
  const master = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('mochiailab-v2'), iterations: 2000 }, pw, 256);
  const mk = await subtle.importKey('raw', master, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const id = new Uint8Array(await subtle.sign('HMAC', mk, enc.encode('topic')));
  const aesRaw = await subtle.sign('HMAC', mk, enc.encode('aes'));
  const aes = await subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const hex = [...id.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { base: 'mochiailab/v2/' + hex + '/', aes };
}
async function seal(aes, leaf, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(leaf) }, aes, enc.encode(text)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64(out);
}
async function unseal(aes, leaf, payload) {
  const raw = unb64(payload);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: enc.encode(leaf) }, aes, raw.slice(12));
  return dec.decode(pt);
}

// A link to one Mochi: onMessage(leaf, text) with leaf 'status' | 'state' | 'ack' (decrypted),
// onState('ready' | 'closed' | 'refused' | 'nocrypto'). send(leaf, text) returns false when not ready.
class Link {
  constructor(key, onMessage, onState) {
    this.key = key; this.onMessage = onMessage; this.onState = onState; this.mq = null; this.k = null;
  }
  get connected() { return !!(this.mq && this.mq.ready && this.k); }  // to the broker
  get ready() { return !!(this.mq && this.mq.ready && this.k && this.sid); }  // sid: Mochi's state arrived
  async open() {
    if (!window.crypto || !crypto.subtle) { this.onState('nocrypto'); return; }
    this.k = await deriveKeys(this.key);
    if (this.closed) return;
    this.mq = new Mqtt(BROKER, 'web-' + Math.random().toString(36).slice(2, 10), (tp, payload) => this.got(tp, payload), (st) => {
      if (st === 'ready') ['status', 'state', 'ack'].forEach((l) => this.mq.subscribe(this.k.base + l));
      this.onState(st);
    });
    this.mq.open();
  }
  async got(tp, payload) {
    const leaf = tp.slice(tp.lastIndexOf('/') + 1);
    if (leaf === 'status') { this.onMessage(leaf, payload); return; }
    if (!payload) return;
    let text;
    try { text = await unseal(this.k.aes, leaf, payload); } catch (e) { return; }  // not sealed with this key
    if (leaf === 'state') { try { this.sid = JSON.parse(text).sid || this.sid; } catch (e) {} }
    this.onMessage(leaf, text);
  }
  send(leaf, text) {
    if (!this.ready) return false;
    seal(this.k.aes, leaf, this.sid + '|' + Date.now() + '|' + text).then((p) => this.mq && this.mq.publish(this.k.base + leaf, p));
    return true;
  }
  close() { this.closed = true; if (this.mq) this.mq.close(); this.mq = null; }
}

// Firmware before 2026.11.24-7 (6-letter code, plain topics mochiailab/v1/<CODE>/...): only used
// to read its state and send it the "update" command, which installs the encrypted firmware.
const OLD_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
class OldLink {
  constructor(code, onMessage, onState) {
    this.base = 'mochiailab/v1/' + code + '/'; this.onMessage = onMessage; this.onState = onState; this.mq = null;
  }
  get connected() { return !!(this.mq && this.mq.ready); }
  get ready() { return this.connected; }
  open() {
    this.mq = new Mqtt(BROKER, 'web-' + Math.random().toString(36).slice(2, 10), (tp, payload) => {
      this.onMessage(tp.slice(tp.lastIndexOf('/') + 1), payload);
    }, (st) => {
      if (st === 'ready') ['status', 'state'].forEach((l) => this.mq.subscribe(this.base + l));
      this.onState(st);
    });
    this.mq.open();
  }
  update() { return this.ready && this.mq.publish(this.base + 'cmd', JSON.stringify({ cmd: 'update' })); }
  close() { if (this.mq) this.mq.close(); this.mq = null; }
}


const BROKER = 'wss://broker.emqx.io:8084/mqtt';
const KEY = 'mochiKey';     // the same key on every page of the site
const OLD_KEY = 'mochiCode';  // the old 6-letter code, kept until a new key is saved
// "Ghi nhớ mã trên máy này" (checkbox #remember): on = localStorage, off = this tab only
function store(remember) { try { return remember ? localStorage : sessionStorage; } catch (e) { return null; } }
function getItem(st, k) { try { return st ? st.getItem(k) || '' : ''; } catch (e) { return ''; } }
// Mochi's body colours, same order and RGB as kBodies in mochi_display.h ("color" in the state)
const BODY_COLORS = [
  { name: 'Hồng phấn', hex: '#fac8d4' }, { name: 'Bạc hà', hex: '#baecd4' }, { name: 'Vàng kem', hex: '#fce6ac' },
  { name: 'Tím', hex: '#d6c6f6' }, { name: 'Trắng', hex: '#eeeeee' }, { name: 'Đen', hex: '#000000', dark: true },
];
window.MochiLink = {
  Link, OldLink, KEY_RE, OLD_CODE_RE, normKey, prettyKey, BODY_COLORS,
  savedCode() { return getItem(store(false), KEY) || getItem(store(true), KEY) || getItem(store(true), OLD_KEY); },
  saveCode(code) {
    const box = document.getElementById('remember');
    const remember = !box || box.checked;
    try {
      if (OLD_CODE_RE.test(code)) { localStorage.setItem(OLD_KEY, code); return; }
      if (remember) { localStorage.setItem(KEY, code); sessionStorage.removeItem(KEY); }
      else { sessionStorage.setItem(KEY, code); localStorage.removeItem(KEY); }
      localStorage.removeItem(OLD_KEY);
    } catch (e) {}
  },
  // the "remember" checkbox: ticked unless the key lives only in this tab; unticking forgets it
  rememberBox() {
    const box = document.getElementById('remember');
    if (!box) return;
    box.checked = !(getItem(store(false), KEY) && !getItem(store(true), KEY));
    box.addEventListener('change', () => {
      const k = getItem(store(false), KEY) || getItem(store(true), KEY);
      try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
      if (k) store(box.checked).setItem(KEY, k);
    });
  },
  // the key box: shown in capitals while typing (CSS only: rewriting the value moved the caret
  // and mangled the key on phones), tidied to ABCD-EFGH-JKMN once typing stops
  keyInput(el) {
    this.rememberBox();
    el.style.textTransform = 'uppercase';
    el.addEventListener('blur', () => { if (KEY_RE.test(normKey(el.value))) el.value = prettyKey(el.value); });
  },
};
})();
