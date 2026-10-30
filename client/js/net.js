// Dünne WebSocket-Hülle. Der Server ist derselbe, der die Seite ausliefert (also location.host).
export class Net {
  constructor() {
    this.ws = null;
    this.id = 0;
    this.handlers = new Map();
    this.connected = false;
  }
  connect(name) {
    return new Promise((resolve, reject) => {
      if (this.connected) return resolve();
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error('Zeitüberschreitung')), 5000);
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') {
          this.id = m.id; this.connected = true;
          clearTimeout(timer);
          this.send({ t: 'hello', name });
          resolve();
        }
        const h = this.handlers.get(m.t);
        if (h) for (const fn of h) fn(m);
        const all = this.handlers.get('*');
        if (all) for (const fn of all) fn(m);
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Keine Verbindung zum Server')); };
      ws.onclose = () => {
        this.connected = false;
        const h = this.handlers.get('close');
        if (h) for (const fn of h) fn({});
      };
    });
  }
  on(t, fn) { if (!this.handlers.has(t)) this.handlers.set(t, new Set()); this.handlers.get(t).add(fn); return () => this.handlers.get(t).delete(fn); }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
}
export const net = new Net();
