// Bosque en Guerra - servidor (Node + WebSockets). El servidor decide: ítems, daño, vida y tiempos.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const W = 2400, H = 1600, CX = 1200, CY = 800, AR = 210;
const SPAWNS = [[200, 200], [2200, 200], [200, 1400], [2200, 1400]];
const WEAP_DMG = [8, 12, 18, 26, 34];        // Palo, Daga, Espada, Hacha, Martillo
const ARM_RED = [0.15, 0.28, 0.42, 0.58];    // Escudo, Cuero, Bronce, Hierro
const GEAR_MS = 30000, ITEM_RESPAWN_MS = 45000, ATK_CD = 450, RANGE = 75, MAX_PLAYERS = 8;

// Mundo generado con semilla fija (igual para todos)
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r = rng(20261014), trees = [], items = [];
const nearSpawn = (x, y) => SPAWNS.some(s => Math.hypot(x - s[0], y - s[1]) < 130);
while (trees.length < 140) { const x = r() * W, y = r() * H; if (Math.hypot(x - CX, y - CY) > AR + 40 && !nearSpawn(x, y)) trees.push([Math.round(x), Math.round(y)]); }
while (items.length < 52) {
  const x = 60 + r() * (W - 120), y = 60 + r() * (H - 120);
  if (Math.hypot(x - CX, y - CY) < AR + 60 || nearSpawn(x, y)) continue;
  const w = items.length % 5 < 3, q = r();
  const l = w ? (q < .3 ? 0 : q < .55 ? 1 : q < .75 ? 2 : q < .9 ? 3 : 4) : (q < .35 ? 0 : q < .65 ? 1 : q < .87 ? 2 : 3);
  items.push({ id: items.length, x: Math.round(x), y: Math.round(y), w, l, tk: 0, by: 0 });
}

const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.end('ok'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
const wss = new WebSocketServer({ server, maxPayload: 1024 });

const players = new Map();
let nextId = 1;
const num = v => typeof v === 'number' && isFinite(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inArena = p => Math.hypot(p.x - CX, p.y - CY) < AR;
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const broadcast = o => { const s = JSON.stringify(o); for (const p of players.values()) if (p.joined && p.ws.readyState === 1) p.ws.send(s); };

function release(p) { for (const it of items) if (it.by === p.id) { it.tk = 0; it.by = 0; } }

function pickup(p, now) {
  for (const it of items) {
    if (it.tk || Math.hypot(it.x - p.x, it.y - p.y) > 26) continue;
    if (it.w) { if (it.l <= p.w) continue; p.w = it.l; p.wU = now + GEAR_MS; }
    else { if (it.l <= p.a) continue; p.a = it.l; p.aU = now + GEAR_MS; }
    it.tk = now; it.by = p.id;
  }
}

function attack(p, now) {
  if (p.dead || now - p.lastAtk < ATK_CD) return;
  p.lastAtk = now; p.atk++;
  if (!inArena(p)) return;
  for (const q of players.values()) {
    if (q === p || !q.joined || q.dead || !inArena(q)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > RANGE) continue;
    const dmg = Math.round((p.w >= 0 ? WEAP_DMG[p.w] : 5) * (1 - (q.a >= 0 ? ARM_RED[q.a] : 0)));
    q.hp -= dmg;
    broadcast({ t: 'ev', k: 'hit', id: q.id, by: p.id, d: dmg, kx: (q.x - p.x) / (d || 1), ky: (q.y - p.y) / (d || 1) });
    if (q.hp <= 0) {
      q.hp = 0; q.d++; p.k++; q.dead = now; q.w = -1; q.a = -1; release(q);
      broadcast({ t: 'ev', k: 'kill', id: q.id, by: p.id });
    }
  }
}

wss.on('connection', ws => {
  if (players.size >= MAX_PLAYERS) { ws.close(); return; }
  const id = nextId++, sp = SPAWNS[id % 4];
  const p = { id, ws, name: 'Jugador', hue: Math.floor(Math.random() * 360), x: sp[0], y: sp[1], sp, f: 1, hp: 100,
              w: -1, a: -1, wU: 0, aU: 0, k: 0, d: 0, atk: 0, lastAtk: 0, dead: 0, joined: false };
  players.set(id, p);
  send(ws, { t: 'init', id, x: p.x, y: p.y, trees, items: items.map(i => [i.x, i.y, i.w ? 1 : 0, i.l]) });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const now = Date.now();
    if (m.t === 'join') { p.name = String(m.name || 'Jugador').slice(0, 12); p.joined = true; }
    else if (!p.joined) return;
    else if (m.t === 'p' && !p.dead && num(m.x) && num(m.y)) { p.x = clamp(m.x, 14, W - 14); p.y = clamp(m.y, 14, H - 14); p.f = m.f < 0 ? -1 : 1; pickup(p, now); }
    else if (m.t === 'a') attack(p, now);
  });
  ws.on('close', () => { release(p); players.delete(id); });
  ws.on('error', () => {});
});

setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (p.w >= 0 && now > p.wU) p.w = -1;
    if (p.a >= 0 && now > p.aU) p.a = -1;
    if (p.dead && now - p.dead > 1800) {
      p.dead = 0; p.hp = 100; p.x = p.sp[0]; p.y = p.sp[1];
      broadcast({ t: 'ev', k: 'spawn', id: p.id, x: p.x, y: p.y });
    }
  }
  for (const it of items) if (it.tk && now - it.tk > ITEM_RESPAWN_MS) { it.tk = 0; it.by = 0; }
  const list = [];
  for (const p of players.values()) if (p.joined) list.push([p.id, p.name, p.hue, Math.round(p.x), Math.round(p.y), p.f, p.hp, p.w, p.a, p.k, p.d, p.atk,
    p.w >= 0 ? Math.ceil((p.wU - now) / 1000) : 0, p.a >= 0 ? Math.ceil((p.aU - now) / 1000) : 0]);
  broadcast({ t: 's', p: list, ti: items.filter(i => i.tk).map(i => i.id) });
}, 50);

server.listen(PORT, () => console.log('Bosque en Guerra escuchando en el puerto ' + PORT));
