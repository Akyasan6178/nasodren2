/*
 * DENGE TESTİ (GOAL-037)
 * Oyunu bir test oyuncusuyla hızlandırılmış oynatıp her günün zorluğunu ölçer.
 * DAY_TUNE (src/gameplay/GameplayCore.ts) bu araçla ayarlandı; bir değer
 * değişirse eğri yeniden ölçülmeli.
 *
 * Kullanım:
 *   npm run dev -- --port 5199            (ayrı bir terminalde)
 *   npm i --no-save playwright-core       (bir kez)
 *   node tools/denge-testi.mjs [deneme=8] [günler=1,2,...,8] [temkin=1] [ayar.json]
 *
 * Tarayıcı: CHROME ortam değişkeni (varsayılan Windows Chrome yolu), adres: GAME_URL.
 * ayar.json verilirse (8 elemanlı dizi) o günlerin DAY_TUNE değerlerini kodu
 * değiştirmeden geçersiz kılar — yeni değer denemek için.
 *
 * Test oyuncusu klasik bir Volfield oyuncusu gibi davranır: kenardan içeri I,
 * L ya da U biçimli kesimler planlar, düşmanın kesime yetişme süresine göre
 * riski tartar, güvenli kesim yoksa kenar boyunca yer değiştirir. Kesimin
 * ortasında kaçmaz, yani ortalama bir insandan biraz beceriksizdir; mutlak
 * sayılar değil günler arası EĞRİ anlamlıdır. Çıktı her gün için: kazanma
 * oranı (üç canla), kazanılan denemelerde süre (oyun saniyesi), ortalama ölüm.
 * Yalnızca geliştirme modundaki window.__nd kancasıyla çalışır.
 */
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { console.error('playwright-core bulunamadı: npm i --no-save playwright-core'); process.exit(1); }
import fs from 'fs';
const N = +(process.argv[2] || 8);
const DAYS = (process.argv[3] || '1,2,3,4,5,6,7,8').split(',').map(Number);
const CAUTION = +(process.argv[4] || 1);
const TUNE = process.argv[5] ? JSON.parse(fs.readFileSync(process.argv[5],"utf8")) : null;
const b = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
page.on('pageerror', e => console.log('PAGEERR', String(e)));
await page.goto(process.env.GAME_URL || 'http://localhost:5199/');
await page.waitForFunction(() => window.__nd && document.querySelector('button[data-a="start"]'));
const results = [];
for (const day of DAYS) {
  const runs = [];
  for (let r = 0; r < N; r++) {
    const res = await page.evaluate(({ idx, seed, CAUTION, TUNE }) => {
      const H = window.__nd, G = H.G, GW = H.GW, GH = H.GH, cells = H.cells, cavity = H.cavity;
      const EMPTY = H.EMPTY, FILL = H.FILL;
      let rs = seed * 9301 + 49297; const rnd = () => (rs = (rs * 9301 + 49297) % 233280) / 233280;
      if (TUNE) Object.assign(H.LEVELS[idx], TUNE[idx]);
      H.begin(idx);
      const DV = { 1:[1,0], 2:[-1,0], 3:[0,-1], 4:[0,1] };
      const onEdge = i => { const x = i%GW, y = (i/GW)|0;
        for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) { const xx=x+dx, yy=y+dy;
          if (xx<0||yy<0||xx>=GW||yy>=GH) continue; if (cells[yy*GW+xx] === EMPTY) return true; } return false; };
      const enemies = () => {
        const e = [];
        for (const bo of G.bosses) e.push({ x:bo.x, y:bo.y, r:bo.r, v:bo.spd*1.2 });
        for (const m of G.minions) e.push({ x:m.x, y:m.y, r:m.r, v:Math.hypot(m.vx,m.vy)*1.2 + 1 });
        for (const bl of G.bullets) e.push({ x:bl.x, y:bl.y, r:1, v:36 });
        return e;
      };
      // aday kesim: yön dizisi; hücre hücre yürüyüp FILL'e çarpınca kapanır
      function simulate(sx, sy, segs){
        const path = []; let x = sx, y = sy;
        for (let si=0; si<segs.length; si++) {
          const [d, n] = segs[si], last = si === segs.length-1;
          for (let k=0; k<(last ? 60 : n); k++) {
            x += DV[d][0]; y += DV[d][1];
            if (x<0||y<0||x>=GW||y>=GH) return null;
            const c = cells[y*GW+x];
            if (c === FILL) return (path.length ? { path, end:[x,y] } : null);
            if (c !== EMPTY) return null;
            if (path.some(p => p[0]===x && p[1]===y)) return null;
            path.push([x,y]);
          }
        }
        return null;
      }
      function gainOf(path){
        const m = new Uint8Array(GW*GH);
        for (const [x,y] of path) m[y*GW+x] = 1;
        const seen = new Uint8Array(GW*GH), q = [];
        for (const bo of G.bosses) { const i = Math.round(bo.y)*GW + Math.round(bo.x); if (cells[i]===EMPTY && !m[i]) { seen[i]=1; q.push(i); } }
        while (q.length) { const i = q.pop(), x = i%GW, y = (i/GW)|0;
          for (const n of [x>0?i-1:-1, x<GW-1?i+1:-1, y>0?i-GW:-1, y<GH-1?i+GW:-1])
            if (n>=0 && !seen[n] && !m[n] && cells[n]===EMPTY) { seen[n]=1; q.push(n); } }
        let g = path.length;
        for (let i=0;i<cells.length;i++) if (cells[i]===EMPTY && !seen[i] && !m[i] && cavity[i]) g++;
        return g;
      }
      function risk(path){
        const spd = H.PLAYER_SPD, E = enemies(); let worst = 99;
        path.forEach(([x,y], k) => {
          const tHere = k / spd, tLeft = (path.length - k) / spd;   // bu hücre ne kadar süre açık kalacak
          for (const e of E) {
            const d = Math.hypot(e.x - x, e.y - y) - e.r - 1.5;
            const tReach = Math.max(0, d) / e.v;
            worst = Math.min(worst, tReach - (tLeft + .35*CAUTION));
          }
        });
        return worst;   // < 0: düşman çizgiye kesim bitmeden ulaşabilir
      }
      function planCut(){
        const sx = G.px, sy = G.py, best = [];
        for (const d of [1,2,3,4]) {
          const nx = sx+DV[d][0], ny = sy+DV[d][1];
          if (nx<0||ny<0||nx>=GW||ny>=GH || cells[ny*GW+nx] !== EMPTY) continue;
          const perp = d<3 ? [3,4] : [1,2], back = {1:2,2:1,3:4,4:3}[d];
          const cands = [[[d,99]]];
          for (const a of [3,6,10,15,22]) for (const p of perp) {
            cands.push([[d,a],[p,99]]);
            for (const c of [3,6,10,16,24]) cands.push([[d,a],[p,c],[back,99]]);
          }
          for (const segs of cands) {
            const sim = simulate(sx, sy, segs); if (!sim || sim.path.length > 70) continue;
            const rk = risk(sim.path); if (rk < 0) continue;
            const g = gainOf(sim.path);
            best.push({ segs, sim, g, score: g / (sim.path.length + 8) * Math.min(1, .4 + rk*.3) });
          }
        }
        best.sort((a,b) => b.score - a.score);
        return best[0] || null;
      }
      function planWalk(){
        // kenar üstünde BFS: rastgele ama düşmanlardan uzak bir kenar hücresine
        const s0 = G.py*GW+G.px, prev = new Int32Array(GW*GH).fill(-2), q = [s0]; prev[s0] = -1;
        const E = enemies(), opts = [];
        while (q.length) { const i = q.shift(), x = i%GW, y = (i/GW)|0;
          let dmin = 99; for (const e of E) dmin = Math.min(dmin, Math.hypot(e.x-x, e.y-y) - e.r);
          opts.push({ i, dmin });
          for (const n of [x>0?i-1:-1, x<GW-1?i+1:-1, y>0?i-GW:-1, y<GH-1?i+GW:-1])
            if (n>=0 && prev[n]===-2 && cells[n]===FILL && onEdge(n)) { prev[n]=i; q.push(n); } }
        opts.sort((a,b) => (b.dmin + rnd()*25) - (a.dmin + rnd()*25));
        let t = opts[0] && opts[0].i !== s0 ? opts[0].i : (opts[1] ? opts[1].i : s0);
        const way = []; while (t >= 0 && t !== s0) { way.push([t%GW, (t/GW)|0]); t = prev[t]; }
        return way.reverse().slice(0, 40);
      }
      const dt = 1/30; let t = 0, deaths = 0, lives = G.lives, plan = null, walk = null, stuck = 0, cuts = 0;
      while (t < 300) {
        if (G.state === 'clear') return { ok:true, t, deaths, cuts, pct:G.pct };
        if (G.state !== 'play') return { ok:false, t, deaths, cuts, pct:G.pct };
        if (G.lives < lives) { deaths++; lives = G.lives; plan = null; walk = null; }
        let dir = 0;
        if (plan) {
          // plan: yön bölümleri; oyuncu konumuna göre sıradaki yönü bul
          const seg = plan.segs[plan.si];
          dir = seg[0];
          if (plan.si < plan.segs.length-1 && plan.k >= seg[1]) { plan.si++; plan.k = 0; dir = plan.segs[plan.si][0]; }
          const before = G.py*GW+G.px;
          H.setDir(dir); H.step(dt); t += dt;
          if (G.py*GW+G.px !== before) plan.k++;
          if (!G.drawing && plan.k > 0 && (G.py*GW+G.px) !== plan.start) { plan = null; cuts++; }
          if (++stuck > 900) { plan = null; stuck = 0; }
          continue;
        }
        stuck = 0;
        const c = planCut();
        if (c) { plan = { segs:c.segs, si:0, k:0, start:G.py*GW+G.px }; walk = null; continue; }
        if (!walk || !walk.length) walk = planWalk();
        const w = walk[0];
        if (w) {
          dir = w[0] > G.px ? 1 : w[0] < G.px ? 2 : w[1] > G.py ? 4 : 3;
          H.setDir(dir); H.step(dt); t += dt;
          if (G.px === w[0] && G.py === w[1]) walk.shift();
          else if (Math.random() < .02) walk = null;
        } else { H.setDir(0); H.step(dt); t += dt; }
      }
      return { ok:false, t, deaths, cuts, pct:G.pct, timeout:true };
    }, { idx: day-1, seed: r+1, CAUTION, TUNE });
    runs.push(res);
  }
  const ok = runs.filter(r => r.ok);
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
  const row = { day, win: ok.length + '/' + N, tWin: +avg(ok.map(r=>r.t)).toFixed(0),
    deaths: +avg(runs.map(r=>r.deaths)).toFixed(2), pctLost: +avg(runs.filter(r=>!r.ok).map(r=>r.pct)).toFixed(2),
    timeouts: runs.filter(r=>r.timeout).length };
  results.push(row); console.log(JSON.stringify(row));
}
await b.close();
