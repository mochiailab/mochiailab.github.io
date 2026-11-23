// Mochi AI Lab: link to a Mochi over the internet (shared by nhan-chu.html and cai-dat.html).
// A tiny MQTT 3.1.1 client over WebSocket to the public broker the firmware uses
// (mochi_remote.h): topics mochiailab/v1/<CODE>/{text,cmd,state,status,ack}.
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


const BROKER = 'wss://broker.emqx.io:8084/mqtt';
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const KEY = 'mochiCode';  // the same code on every page of the site
window.MochiLink = {
  Mqtt, BROKER, CODE_RE,
  topic: (code, leaf) => 'mochiailab/v1/' + code + '/' + leaf,
  savedCode() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } },
  saveCode(code) { try { localStorage.setItem(KEY, code); } catch (e) {} },
  clientId: () => 'web-' + Math.random().toString(36).slice(2, 10),
};
})();
