// @ts-nocheck
/*
 * GameplayCore.ts
 *
 * GOAL-004 migration note:
 * Bu dosya, orijinal nasodren-volfield.html icindeki tek satir-ici <script>
 * bloğunun (window.__startGame = async function(){ ... }) MINIMUM
 * DEĞİŞİKLİKLE taşınmış halidir.
 *
 * Yapilan TEK yapisal degisiklikler:
 *   1) `window.__startGame = async function(){` -> `export async function startGame(){`
 *      (global fonksiyon atamasi yerine ES module export'u).
 *   2) Global `PIXI` nesnesi yerine `import * as PIXI from 'pixi.js'` (npm bagimliligi).
 *   3) Bu dosyanin basina `// @ts-nocheck` eklendi: orijinal kod tip-siz JS
 *      oldugu icin, "refactor yapma" kuralina uyarak hicbir tip/null-check
 *      eklenmedi; derleme (build) esbuild ile tip kontrolu yapilmadan
 *      gerceklestiriliyor (bkz. package.json build script).
 *
 * Gameplay mantigi, flood-fill algoritmasi, dusman davranislari, skor
 * sistemi, alan kapatma mantigi vs. BIREBIR AYNI birakildi. PIXI v6/v7/v8
 * uyumluluk dallanmalari (MAJOR kontrolleri) da bilerek dokunulmadan
 * korundu.
 */
import * as PIXI from 'pixi.js';
// GOAL-009 (Görsel Revizyon Sprinti 1): prosedürel dokuların yerini alan gerçek assetler.
import playerAssetUrl from '../../assets/siklament.png';   // oyuncu sprite'ı
import bossAssetUrl from '../../assets/bacteria.png';      // boss sprite'ı
import bgFlowerAssetUrl from '../../assets/siclament.png'; // arka planda açığa çıkan büyük siklamen
import minionFlagellaAssetUrl from '../../assets/minion_flagella.png'; // kind:0 minion
import minionSporeAssetUrl from '../../assets/minion_spore.png';       // kind:1 minion
import healthAssetUrl from '../../assets/health.png'; // GOAL-013: can ikonu

export async function startGame(){
"use strict";

/* =========================================================================
   0. PIXI SÜRÜM KATMANI (v6 / v7 / v8)
   ========================================================================= */
const MAJOR = parseInt(PIXI.VERSION, 10) || 7;
const BLEND_ADD = (PIXI.BLEND_MODES && PIXI.BLEND_MODES.ADD !== undefined) ? PIXI.BLEND_MODES.ADD : 'add';
function makeCanvas(w,h){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function texFromCanvas(cv){
  const t = PIXI.Texture.from(cv);
  try{
    if(MAJOR >= 8) t.source.scaleMode = 'linear';
    else t.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
  }catch(e){}
  return t;
}
function texUpdate(t){ try{ if(MAJOR>=8) t.source.update(); else t.baseTexture.update(); }catch(e){} }
/* GOAL-009: PNG asset -> PIXI texture (texFromCanvas ile aynı ölçek-modu mantığı) */
function texFromImage(img){
  const t = PIXI.Texture.from(img);
  try{
    if(MAJOR >= 8) t.source.scaleMode = 'linear';
    else t.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
  }catch(e){}
  return t;
}
function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/* =========================================================================
   1. MATEMATİK YARDIMCILARI
   ========================================================================= */
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp  = (a,b,t)=> a+(b-a)*t;
const rnd   = (a,b)=> a+Math.random()*(b-a);
const smooth = t => t*t*(3-2*t);
const sstep = (e0,e1,x)=>{ const t = clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
const hex2rgb = h => { const n = parseInt(h.slice(1),16); return [n>>16&255, n>>8&255, n&255]; };
function mixc(a,b,t){ return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]; }
function ramp(stops, t){
  t = clamp(t,0,1);
  const n = stops.length-1, f = t*n, i = Math.min(n-1, f|0);
  return mixc(stops[i], stops[i+1], f-i);
}
function valueNoise(w,h,scale,seed){
  const gw = Math.ceil(w/scale)+2, gh = Math.ceil(h/scale)+2, g = new Float32Array(gw*gh);
  let s = seed>>>0 || 1;
  for(let i=0;i<g.length;i++){ s = (s*1664525+1013904223)>>>0; g[i] = s/4294967296; }
  const out = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const fx = x/scale, fy = y/scale, ix = fx|0, iy = fy|0;
    const sx = smooth(fx-ix), sy = smooth(fy-iy);
    const a = g[iy*gw+ix], b = g[iy*gw+ix+1], c = g[(iy+1)*gw+ix], d = g[(iy+1)*gw+ix+1];
    out[y*w+x] = lerp(lerp(a,b,sx), lerp(c,d,sx), sy);
  }
  return out;
}
function fbm(w,h,base,seed,oct){
  oct = oct||3;
  const out = new Float32Array(w*h);
  let amp = .55, sc = base, norm = 0;
  for(let o=0;o<oct;o++){
    const n = valueNoise(w,h,sc,seed+o*7919);
    for(let i=0;i<out.length;i++) out[i] += n[i]*amp;
    norm += amp; amp *= .5; sc *= .42;
  }
  for(let i=0;i<out.length;i++) out[i] /= norm;
  return out;
}

/* =========================================================================
   2. YAPILANDIRMA
   Oynanış ızgarası 160x120 (hücre = mantık birimi).
   Görsel katman 3x alt-piksel (480x360) üretilip 960x720'ye doğrusal ölçekleniyor.
   ========================================================================= */
const GW = 160, GH = 120, B = 3, CS = 6;
const PFW = GW*CS, PFH = GH*CS;
const SC = 3, HW = GW*SC, HH = GH*SC;
const INTERIOR = (GW-2*B)*(GH-2*B);
const EMPTY = 0, FILL = 1, TRAIL = 2;

const PU = { SPEED:0, FREEZE:1, LASER:2, BOMB:3, DOSE:4 };
const PU_META = [
  { key:'SPEED',  label:'Sürfaktan hızı',    letter:'💨', color:'#35e0d8', dur:9  },
  { key:'FREEZE', label:'Ozmotik dondurma',  letter:'❄', color:'#8fb9ff', dur:6  },
  { key:'LASER',  label:'Siliyer aktivasyon',letter:'⚡', color:'#9ef05a', dur:10 },
  { key:'BOMB',   label:'Trigeminal refleks',letter:'💥', color:'#ff4d9d', dur:0  },
  { key:'DOSE',   label:'Doz yenilendi',     letter:'💧', color:'#ffc24a', dur:0  }
];

const LEVELS = [
  { day:1,  name:'Akut tıkanıklık',       target:.70, bossR:9,  bossSpd:15, bossN:1, fire:0.00, mini:3,  miniSpd:19, dose:75, pu:3,
    med:'Tıkanıklık zirvede. Harekete geç!',
    pal:['#150409','#5d0c18','#c2202c','#ff7a4a'] },
  { day:2,  name:'Ödem ve basınç',        target:.72, bossR:9,  bossSpd:17, bossN:1, fire:0.35, mini:4,  miniSpd:21, dose:70, pu:3,
    med:'Basınç artıyor. Sıkı dur!',
    pal:['#1a050c','#6d1020','#d12a35','#ff8a5a'] },
  { day:3,  name:'Hipereminin kırılması', target:.75, bossR:8,  bossSpd:19, bossN:1, fire:0.55, mini:5,  miniSpd:23, dose:66, pu:4,
    med:'Kızarıklık kırılıyor, nefes yakın.',
    pal:['#220711','#83182b','#e0455c','#ffa08a'] },
  { day:4,  name:'Mukus yoğunluğu',       target:.77, bossR:8,  bossSpd:21, bossN:1, fire:0.75, mini:6,  miniSpd:25, dose:62, pu:4,
    med:'Mukus koyulaştı. Sıkı temizlik!',
    pal:['#240c07','#8a3a1c','#dc7a2c','#ffc56a'] },
  { day:5,  name:'Drenajın düzenlenmesi', target:.79, bossR:7,  bossSpd:23, bossN:1, fire:0.95, mini:7,  miniSpd:27, dose:58, pu:4,
    med:'Drenaj düzeliyor, ritim tuttur.',
    pal:['#1f1806','#7d6316','#d8b433','#ffe58a'] },
  { day:6,  name:'Ostium açılımı',        target:.80, bossR:7,  bossSpd:25, bossN:1, fire:1.15, mini:8,  miniSpd:29, dose:55, pu:5,
    med:'Kanallar aralanıyor, hava sızıyor.',
    pal:['#13230c','#3f6b21','#8ec63c','#d6f58a'] },
  { day:7,  name:'Normal fonksiyon',      target:.82, bossR:10, bossSpd:26, bossN:1, fire:1.35, mini:9,  miniSpd:30, dose:52, pu:5,
    med:'Doku normale dönüyor. Devam!',
    pal:['#07211f','#16575a','#38a8a2','#9af0e2'] },
  { day:8,  name:'Koruma modu',           target:.83, bossR:7,  bossSpd:27, bossN:2, fire:1.45, mini:9,  miniSpd:31, dose:50, pu:5,
    med:'Koruma modu: günde tek doz.',
    pal:['#061c24','#125560','#33a5bb','#95e8f5'] },
  { day:9,  name:'Kronik destek',         target:.85, bossR:7,  bossSpd:29, bossN:2, fire:1.60, mini:10, miniSpd:33, dose:48, pu:5,
    med:'Direnç kırılıyor, son viraj.',
    pal:['#0a1028','#283f7c','#5f7fd0','#b9cbff'] },
  { day:10, name:'Tam havalandırma',      target:.88, bossR:9,  bossSpd:31, bossN:2, fire:1.80, mini:11, miniSpd:35, dose:46, pu:5,
    med:'Zafer yakın: tam havalandırma!',
    pal:['#0b0a26','#2d2a7a','#6f63cf','#c5b8ff'] }
];
const PLAYER_SPD = 38, PLAYER_SPD_FAST = 60, MEGA_SHARE = .12;

/* =========================================================================
   3. SES
   ========================================================================= */
const Sound = {
  ctx:null, master:null, on:true, noise:null,
  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC){ this.on = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = .5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate*2, buf = this.ctx.createBuffer(1,len,this.ctx.sampleRate), d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    this.noise = buf;
    this.ambient();
  },
  resume(){ if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  ambient(){
    const c = this.ctx, s = c.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = c.createGain(); g.gain.value = .02;
    const lfo = c.createOscillator(); lfo.frequency.value = .16;
    const lg = c.createGain(); lg.gain.value = .014;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(); lfo.start();
  },
  air(dur,f0,f1,vol,q){
    if(!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q||1.1;
    bp.frequency.setValueAtTime(f0,t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40,f1), t+dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol, t+dur*.14);
    g.gain.exponentialRampToValueAtTime(.0005, t+dur);
    s.connect(bp); bp.connect(g); g.connect(this.master);
    s.start(t); s.stop(t+dur+.05);
  },
  tone(f,dur,type,vol,to){
    if(!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator();
    o.type = type||'sine'; o.frequency.setValueAtTime(f,t);
    if(to) o.frequency.exponentialRampToValueAtTime(Math.max(20,to), t+dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol, t+.01);
    g.gain.exponentialRampToValueAtTime(.0004, t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+.05);
  },
  capture(share){
    const big = clamp(share*6,0,1);
    this.air(.42+big*.5, 420+big*380, 1500+big*1400, .3+big*.2, 1.0);
    this.tone(190+big*90,.34,'sine',.1,340+big*170);
  },
  sneeze(){ this.air(.78,2600,170,.5,.7); this.tone(140,.6,'sine',.3,36); this.tone(72,.5,'triangle',.2,28); },
  pickup(){ this.tone(660,.1,'sine',.15); setTimeout(()=>this.tone(990,.18,'sine',.13),70); },
  hit(){ this.tone(210,.45,'sawtooth',.2,52); this.air(.34,900,120,.2,.8); },
  clear(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.tone(f,.5,'sine',.13),i*110)); this.air(1.1,300,2200,.19,.9); },
  laser(){ this.tone(1400,.06,'square',.04,760); },
  ui(){ this.tone(720,.07,'sine',.08,980); },
  toggle(){ this.on = !this.on; if(this.master) this.master.gain.value = this.on?.5:0; return this.on; }
};

/* =========================================================================
   4. PROSEDÜREL DOKULAR — hepsi yüksek çözünürlükte, dosya yok
   ========================================================================= */
function texRadial(size, stops){
  const cv = makeCanvas(size,size), c = cv.getContext('2d');
  const g = c.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  for(const s of stops) g.addColorStop(s[0], s[1]);
  c.fillStyle = g; c.fillRect(0,0,size,size);
  return texFromCanvas(cv);
}
/* GOAL-009: oyuncu ve boss artık gerçek PNG assetlerinden (bkz. texFromImage
   + loadImage, TEX nesnesi kurulumu) — eski prosedürel texPlayer()/texBoss()
   kaldırıldı. */
/* GOAL-012: minion'lar artık gerçek PNG assetlerinden (bkz. texFromImage +
   loadImage, TEX.mini kurulumu) — eski prosedürel texMinion() kaldırıldı. */
function texPowerup(meta){
  const S = 96, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const m = S/2, R = S*.38;
  c.translate(m,m);
  c.rotate(Math.PI/4);
  const g = c.createLinearGradient(-R,-R,R,R);
  g.addColorStop(0,'rgba(255,255,255,.32)');
  g.addColorStop(.45,'rgba(10,22,32,.92)');
  g.addColorStop(1,'rgba(10,22,32,.82)');
  c.fillStyle = g; c.fillRect(-R,-R,R*2,R*2);
  c.lineWidth = 3; c.strokeStyle = meta.color; c.strokeRect(-R,-R,R*2,R*2);
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.35)';
  c.strokeRect(-R+6,-R+6,(R-6)*2,(R-6)*2);
  c.rotate(-Math.PI/4);
  c.font = '38px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji","Roboto Condensed",sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = meta.color;
  c.shadowColor = meta.color; c.shadowBlur = 16;
  c.fillText(meta.letter, 0, 3);
  return texFromCanvas(cv);
}
function texGrain(){
  const S = 256, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const img = c.createImageData(S,S), d = img.data;
  for(let i=0;i<S*S;i++){
    const v = Math.random()*46;
    d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v; d[i*4+3]=255;
  }
  c.putImageData(img,0,0);
  return texFromCanvas(cv);
}

/* ---- açığa çıkan resim: sağlıklı doku + siklamen ---- */
const bgCanvas = makeCanvas(HW,HH);
function paintHealthy(L){
  const c = bgCanvas.getContext('2d');
  const img = c.createImageData(HW,HH), d = img.data;
  const warm = L.day >= 7;
  // GOAL-013 (madde 8): reveal edilen doku çok parlak/doygun maviydi, çiçeğin
  // ortaya çıkışını değersizleştiriyordu — tonlar koyultuldu/yumuşatıldı.
  const air = [hex2rgb('#030d12'), hex2rgb('#082530'), hex2rgb(warm?'#0d4b4e':'#0b3c40'),
               hex2rgb(warm?'#156863':'#12564f'), hex2rgb('#3d8f88')];
  const n1 = fbm(HW,HH,60,1777,3), n2 = fbm(HW,HH,14,5051,2);
  const fx = HW*.5, fy = HH*.44, FR = HH*.30;
  for(let y=0;y<HH;y++) for(let x=0;x<HW;x++){
    const i = y*HW+x;
    // doku zemini: derinlik + ışık huzmesi (GOAL-009: ortam dokusu aynı kaldı,
    // sadece prosedürel çiçek/yaprak/sap deseni kaldırıldı — bkz. drawImage aşağıda)
    const vig = clamp(1 - Math.hypot((x/HW-.5)*1.5,(y/HH-.5)*1.6), 0, 1);
    const shaft = sstep(.25,.9, Math.sin((x*.55 + y*1.15)/HW*3.1)*.5+.5);
    let t = clamp(.10 + n1[i]*.48 + vig*.36 + shaft*.10 + (1-y/HH)*.12, 0, 1);
    let col = ramp(air, t);
    col = mixc(col, [180,255,250], n2[i]*n2[i]*.05);
    d[i*4]=col[0]; d[i*4+1]=col[1]; d[i*4+2]=col[2]; d[i*4+3]=255;
  }
  c.putImageData(img,0,0);
  // hava kabarcıkları
  c.globalCompositeOperation = 'lighter';
  for(let k=0;k<90;k++){
    const x = rnd(0,HW), y = rnd(0,HH), r = rnd(3,26);
    const g = c.createRadialGradient(x,y,0,x,y,r);
    const al = rnd(.05,.16);
    g.addColorStop(0,'rgba(150,240,235,'+al+')');
    g.addColorStop(1,'rgba(150,240,235,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,7); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  // GOAL-009: prosedürel çiçek yerine gerçek siklamen asseti — flood-fill
  // reveal mekanizması (rasterRegion/dzTex) bu katmanın ÜSTÜNE bindiği için
  // hiç dokunulmadı, sadece altta açığa çıkan görsel değişti.
  const FS = FR * 2.3;
  c.drawImage(bgFlowerImg, fx - FS/2, fy - FS/2, FS, FS);
}

/* ---- hastalıklı doku rengi (alfa ayrı hesaplanır) ---- */
const tissueRGB = new Uint8ClampedArray(HW*HH*3);
function paintTissue(L){
  const cols = L.pal.map(hex2rgb);
  const stops = [cols[0], cols[1], cols[2], cols[3]];
  const n1 = fbm(HW,HH,42,L.day*977+31,3);
  const n2 = fbm(HW,HH,11,L.day*613+7,3);
  for(let y=0;y<HH;y++) for(let x=0;x<HW;x++){
    const i = y*HW+x;
    const core = clamp(1 - Math.hypot((x/HW-.5)*1.9,(y/HH-.5)*1.9), 0, 1);
    const ridged = Math.pow(1-Math.abs(n2[i]*2-1), 2.4);      // damar filamentleri
    let t = clamp(n1[i]*.72 + core*.34 - .12, 0, 1);
    let col = ramp(stops, t);
    col = mixc(col, cols[3], ridged*.55*(.35+core*.65));       // parlayan damarlar
    const crev = Math.pow(n1[i], 3)*.5;                        // koyu yarıklar
    col = mixc(col, cols[0], crev);
    tissueRGB[i*3]=col[0]; tissueRGB[i*3+1]=col[1]; tissueRGB[i*3+2]=col[2];
  }
}

/* =========================================================================
   5. IZGARA + ALAN KAPATMA (değişmeyen, doğrulanmış çekirdek)
   ========================================================================= */
const cells   = new Uint8Array(GW*GH);
const markBuf = new Uint8Array(GW*GH);
function resetGrid(){
  cells.fill(EMPTY);
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++)
    if(x<B||y<B||x>=GW-B||y>=GH-B) cells[y*GW+x] = FILL;
}
function scanRow(stack,lx,rx,y){
  const row = y*GW; let added = false;
  for(let i=lx;i<=rx;i++){
    const ok = cells[row+i] === EMPTY && !markBuf[row+i];
    if(ok && !added){ stack.push(i,y); added = true; }
    else if(!ok) added = false;
  }
}
function spanFill(sx,sy){
  sx|=0; sy|=0;
  if(sx<0||sy<0||sx>=GW||sy>=GH) return;
  if(cells[sy*GW+sx] !== EMPTY || markBuf[sy*GW+sx]) return;
  const stack = [sx,sy];
  while(stack.length){
    const y = stack.pop(), x = stack.pop(), row = y*GW;
    if(cells[row+x] !== EMPTY || markBuf[row+x]) continue;
    let lx = x, rx = x;
    while(lx>0    && cells[row+lx-1]===EMPTY && !markBuf[row+lx-1]) lx--;
    while(rx<GW-1 && cells[row+rx+1]===EMPTY && !markBuf[row+rx+1]) rx++;
    for(let i=lx;i<=rx;i++) markBuf[row+i] = 1;
    if(y>0)    scanRow(stack,lx,rx,y-1);
    if(y<GH-1) scanRow(stack,lx,rx,y+1);
  }
}

/* =========================================================================
   6. SAHNE
   ========================================================================= */
const app = await (async () => {
  const opts = { background:0x060d14, antialias:true, powerPreference:'high-performance',
    resolution: Math.min(window.devicePixelRatio||1, 2), autoDensity:true,
    width: window.innerWidth, height: window.innerHeight };
  if(MAJOR >= 8){ const a = new PIXI.Application(); await a.init(opts); return a; }
  return new PIXI.Application(opts);
})();
const view = (MAJOR>=8) ? app.canvas : app.view;
document.getElementById('app').insertBefore(view, document.getElementById('vig'));

/* GOAL-009: gerçek assetler — PIXI kurulumundan hemen sonra, TEX nesnesinden
   önce yükleniyor ki texFromImage() çağrıldığında görsel hazır olsun. */
const [playerImg, bossImg, bgFlowerImg, minionFlagellaImg, minionSporeImg] = await Promise.all([
  loadImage(playerAssetUrl), loadImage(bossAssetUrl), loadImage(bgFlowerAssetUrl),
  loadImage(minionFlagellaAssetUrl), loadImage(minionSporeAssetUrl)
]);
const PLAYER_AR = playerImg.height / playerImg.width; // en-boy oranı korunsun diye
// GOAL-012: minion assetleri kare olmayabilir; her tür için ayrı en-boy oranı
const MINI_AR = [minionFlagellaImg.height / minionFlagellaImg.width, minionSporeImg.height / minionSporeImg.width];

const bootEl = document.getElementById('boot'); if(bootEl) bootEl.remove();

const root = new PIXI.Container(), shakeRoot = new PIXI.Container();
shakeRoot.addChild(root); app.stage.addChild(shakeRoot);
const layerBG = new PIXI.Container(), layerRim = new PIXI.Container(),
      layerEnt = new PIXI.Container(), layerTrail = new PIXI.Container(),
      layerLight = new PIXI.Container(), layerGrain = new PIXI.Container();
root.addChild(layerBG, layerRim, layerEnt, layerTrail, layerLight, layerGrain);

const bgTex = texFromCanvas(bgCanvas);
const bgSprite = new PIXI.Sprite(bgTex);
bgSprite.width = PFW; bgSprite.height = PFH;
layerBG.addChild(bgSprite);

/* hastalıklı doku: 480x360 RGBA, alfa ızgaradan bilineer türetiliyor */
const dzCanvas = makeCanvas(HW,HH), dzCtx = dzCanvas.getContext('2d');
const dzImg = dzCtx.createImageData(HW,HH);
const dzTex = texFromCanvas(dzCanvas);
const dzSprite = new PIXI.Sprite(dzTex);
dzSprite.width = PFW; dzSprite.height = PFH;
layerBG.addChild(dzSprite);

/* sınır ışıması: alfa geçişinin tepe noktasından türetilen ince bant */
const rimCanvas = makeCanvas(HW,HH), rimCtx = rimCanvas.getContext('2d');
const rimImg = rimCtx.createImageData(HW,HH);
const rimTex = texFromCanvas(rimCanvas);
const rimCore = new PIXI.Sprite(rimTex);
rimCore.width = PFW; rimCore.height = PFH; rimCore.blendMode = BLEND_ADD; rimCore.alpha = .95;
const rimBloom = new PIXI.Sprite(rimTex);
rimBloom.anchor.set(.5); rimBloom.x = PFW/2; rimBloom.y = PFH/2;
rimBloom.width = PFW*1.012; rimBloom.height = PFH*1.016;
rimBloom.blendMode = BLEND_ADD; rimBloom.alpha = .32;
layerRim.addChild(rimBloom, rimCore);

/* alfa + kenar bandını tek geçişte hesapla (yalnızca değişen bölge) */
function rasterRegion(cx0, cy0, cx1, cy1){
  const x0 = clamp((cx0-1)*SC, 0, HW), x1 = clamp((cx1+2)*SC, 0, HW);
  const y0 = clamp((cy0-1)*SC, 0, HH), y1 = clamp((cy1+2)*SC, 0, HH);
  const dd = dzImg.data, rd = rimImg.data;
  for(let py=y0;py<y1;py++){
    const gy = (py+.5)/SC - .5;
    const iy = Math.floor(gy), ty = gy-iy;
    const ya = clamp(iy,0,GH-1)*GW, yb = clamp(iy+1,0,GH-1)*GW;
    for(let px=x0;px<x1;px++){
      const gx = (px+.5)/SC - .5;
      const ix = Math.floor(gx), tx = gx-ix;
      const xa = clamp(ix,0,GW-1), xb = clamp(ix+1,0,GW-1);
      const a = cells[ya+xa]===FILL?0:1, b = cells[ya+xb]===FILL?0:1;
      const c = cells[yb+xa]===FILL?0:1, e = cells[yb+xb]===FILL?0:1;
      const top = a+(b-a)*tx, bot = c+(e-c)*tx;
      const v = top+(bot-top)*ty;
      const i = py*HW+px;
      dd[i*4]   = tissueRGB[i*3];
      dd[i*4+1] = tissueRGB[i*3+1];
      dd[i*4+2] = tissueRGB[i*3+2];
      dd[i*4+3] = v*255;
      const rim = 4*v*(1-v);
      rd[i*4] = 190; rd[i*4+1] = 255; rd[i*4+2] = 250;
      rd[i*4+3] = rim*rim*255;
    }
  }
  const w = x1-x0, h = y1-y0;
  if(w > 0 && h > 0){
    dzCtx.putImageData(dzImg, 0,0, x0,y0,w,h);
    rimCtx.putImageData(rimImg, 0,0, x0,y0,w,h);
    texUpdate(dzTex); texUpdate(rimTex);
  }
}

const TEX = {
  glow:   texRadial(256, [[0,'rgba(255,255,255,1)'],[.28,'rgba(255,255,255,.45)'],[1,'rgba(255,255,255,0)']]),
  spark:  texRadial(64,  [[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']]),
  player: texFromImage(playerImg),
  boss:   texFromImage(bossImg),
  mini:   [texFromImage(minionFlagellaImg), texFromImage(minionSporeImg)],
  pu:     PU_META.map(texPowerup),
  grain:  texGrain()
};

const grainSprite = new PIXI.Sprite(TEX.grain);
grainSprite.width = PFW*1.2; grainSprite.height = PFH*1.2;
grainSprite.blendMode = BLEND_ADD; grainSprite.alpha = .055;
layerGrain.addChild(grainSprite);

const playerLight = new PIXI.Sprite(TEX.glow);
playerLight.anchor.set(.5); playerLight.width = playerLight.height = 250;
playerLight.blendMode = BLEND_ADD; playerLight.tint = 0xff6fb0; playerLight.alpha = .2;
layerLight.addChild(playerLight);

const playerGlow = new PIXI.Sprite(TEX.glow);
playerGlow.anchor.set(.5); playerGlow.width = playerGlow.height = 96;
playerGlow.blendMode = BLEND_ADD; playerGlow.tint = 0xff87c0; playerGlow.alpha = .5;
const playerSprite = new PIXI.Sprite(TEX.player);
playerSprite.anchor.set(.5);
playerSprite.width = 34; playerSprite.height = 34 * PLAYER_AR; // GOAL-009: gerçek PNG en-boy oranı + okunabilirlik için hafif büyütme (30->34)
layerEnt.addChild(playerGlow, playerSprite);

function pool(container, make, n){
  const a = [];
  for(let i=0;i<n;i++){ const s = make(); s.visible = false; container.addChild(s); a.push(s); }
  return a;
}
const trailCore = pool(layerTrail, ()=>{ const s = new PIXI.Sprite(PIXI.Texture.WHITE);
  s.anchor.set(.5); s.tint = 0xdafffb; return s; }, 300);
const trailGlow = pool(layerTrail, ()=>{ const s = new PIXI.Sprite(PIXI.Texture.WHITE);
  s.anchor.set(.5); s.tint = 0x35e0d8; s.alpha = .3; s.blendMode = BLEND_ADD; return s; }, 300);
const particles = [];
const partSprites = pool(layerEnt, ()=>{ const s = new PIXI.Sprite(TEX.spark);
  s.anchor.set(.5); s.blendMode = BLEND_ADD; return s; }, 300);

/* GOAL-009: uçan skor yazıları — particles[]/partSprites ile birebir aynı
   havuz+yaşam-döngüsü deseni, sadece kıvılcım yerine sayı dokusu çiziyor. */
const scorePops = [];
const scorePopPool = pool(layerEnt, ()=>{ const s = new PIXI.Sprite(TEX.spark);
  s.anchor.set(.5); return s; }, 6);
function spawnScorePopup(gx, gy, amount){
  if(amount <= 0) return;
  const cv = makeCanvas(220,64), c = cv.getContext('2d');
  c.font = '700 34px "Roboto Condensed","Arial Narrow",Helvetica,sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#35e0d8'; c.shadowBlur = 14;
  c.fillStyle = '#eaffFb';
  c.fillText('+'+Math.round(amount).toLocaleString('tr-TR'), 110, 32);
  scorePops.push({ x:gx, y:gy, life:1.1, dur:1.1, tex:texFromCanvas(cv) });
}
function updateScorePops(dt){
  for(let i=scorePops.length-1;i>=0;i--){
    const p = scorePops[i];
    p.life -= dt;
    if(p.life <= 0){ p.tex.destroy(true); scorePops.splice(i,1); }
  }
  for(let i=0;i<scorePopPool.length;i++){
    const s = scorePopPool[i], p = scorePops[i];
    if(!p){ s.visible = false; continue; }
    s.visible = true; s.texture = p.tex;
    const k = 1 - p.life/p.dur;
    s.x = p.x*CS; s.y = p.y*CS - k*46;
    s.width = 150; s.height = 44;
    s.alpha = clamp(p.life/(p.dur*.4), 0, 1);
  }
}

/* =========================================================================
   7. OYUN DURUMU
   ========================================================================= */
const G = {
  state:'title', levelIdx:0, level:LEVELS[0],
  score:0, lives:3,
  px:GW>>1, py:GH-B, frac:0, dir:0, lastDir:0,
  drawing:false, trail:[], corners:[], startCell:0,
  filled:0, pct:0, dose:60, doseMax:60,
  invuln:0, buffs:{},
  bosses:[], minions:[], bullets:[], shots:[], pus:[],
  shake:0, laserCd:0, time:0
};
const DIRV = {0:[0,0],1:[1,0],2:[-1,0],3:[0,-1],4:[0,1]};
const OPP  = {1:2,2:1,3:4,4:3};

/* =========================================================================
   8. ARAYÜZ (DOM)
   ========================================================================= */
const $ = id => document.getElementById(id);
const UI = {
  day:$('day').querySelector('.num'), name:$('stageName'),
  fill:$('gaugeFill'), goal:$('gaugeGoal'), pct:$('pctRead'),
  score:$('scoreVal'), dose:$('doseFill'), lives:$('lives'), buffs:$('buffs'),
  toast:$('toast'), toastT:$('toast').querySelector('.t'), toastS:$('toast').querySelector('.s'),
  overlay:$('overlay'), plate:$('plate'), fps:$('fps'),
  menuScreen:$('menuScreen'), menuContent:$('menuContent')
};
let toastTimer = 0;
function toast(main, sub){
  UI.toastT.textContent = main;
  UI.toastS.textContent = sub || '';
  UI.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> UI.toast.classList.remove('on'), 1500);
}
let doseAlertState = 'ok'; // GOAL-013 (madde 7): eşik geçişlerinde tek seferlik uyarı için
function syncHUD(){
  const L = G.level;
  UI.day.textContent = String(L.day).padStart(2,'0');
  UI.name.textContent = L.name;
  UI.fill.style.width = (G.pct*100).toFixed(1)+'%';
  UI.goal.style.left = (L.target*100)+'%';
  const met = G.pct >= L.target;
  UI.pct.className = met ? 'met' : '';
  UI.pct.innerHTML = '<b>%'+Math.floor(G.pct*100)+'</b> temizlendi &nbsp;/&nbsp; hedef %'+Math.round(L.target*100);
  UI.score.textContent = G.score.toLocaleString('tr-TR');
  const dr = clamp(G.dose/G.doseMax,0,1);
  UI.dose.style.width = (dr*100)+'%';
  UI.dose.style.background = dr < .25
    ? 'linear-gradient(90deg,#7a1620,#ff4d6d)'
    : 'linear-gradient(90deg,#7a5a12,#ffc24a)';
  UI.dose.style.boxShadow = dr < .25 ? '0 0 12px rgba(255,77,109,.7)' : '0 0 10px rgba(255,194,74,.5)';
  // GOAL-013 (madde 7): doz kalkanını "rastgele bir çubuk" olmaktan çıkarıp
  // eşik geçişlerinde fark edilir uyarı vermek — mevcut doz mekaniği değişmedi.
  const doseWrapEl = document.getElementById('doseWrap');
  const newDoseState = dr <= .15 ? 'critical' : dr < .30 ? 'warn' : 'ok';
  if(doseWrapEl){
    doseWrapEl.classList.toggle('critical', newDoseState === 'critical');
    doseWrapEl.classList.toggle('warn', newDoseState === 'warn');
  }
  if(G.state === 'play' && newDoseState !== doseAlertState){
    if(newDoseState === 'critical') toast('KALKAN KRİTİK', 'Doz bitmek üzere!');
    else if(newDoseState === 'warn') toast('Kalkan zayıflıyor', 'Doz %30 altında');
  }
  doseAlertState = newDoseState;
  let lv = '';
  for(let i=0;i<3;i++) lv += '<img class="heart'+(i<G.lives?'':' off')+'" src="'+healthAssetUrl+'" alt="can">';
  UI.lives.innerHTML = lv;
  let bf = '';
  for(const k in G.buffs){
    const m = PU_META.find(p=>p.key===k);
    bf += '<div class="buff">'+m.letter+' '+Math.ceil(G.buffs[k])+'s</div>';
  }
  if(G.dose <= 0) bf += '<div class="buff warn">Kalkan düştü</div>';
  UI.buffs.innerHTML = bf;
}
function showPanel(html){ UI.plate.innerHTML = html; UI.overlay.classList.add('on');
  const b = UI.plate.querySelector('button[data-a]'); if(b) setTimeout(()=>b.focus(), 30); }
function hidePanel(){ UI.overlay.classList.remove('on'); }
UI.overlay.addEventListener('click', e=>{
  const b = e.target.closest('button[data-a]'); if(!b) return;
  Sound.init(); Sound.resume(); Sound.ui();
  doAction(b.dataset.a);
});

/* GOAL-014: gerçek tam ekran menü sistemi — ana menü/bölümler/yüksek skorlar
   artık küçük bir kart olarak oyunun ÜSTÜNE binmiyor, ayrı ve opak bir
   "uygulama ekranı" olarak açılıyor (bkz. #menuScreen, index.html). Pause
   bilinçli olarak bunun dışında bırakıldı — o zaten oyunun üstüne binen,
   duraklatılmış oyunu gösteren bir ekran olmalı. */
function showMenuScreen(html){
  hidePanel(); // olası açık overlay (pause vb.) ile çakışmasın
  UI.menuContent.innerHTML = html;
  UI.menuScreen.classList.add('on');
  const b = UI.menuContent.querySelector('button[data-a]'); if(b) setTimeout(()=>b.focus(), 30);
}
function hideMenuScreen(){ UI.menuScreen.classList.remove('on'); }
UI.menuScreen.addEventListener('click', e=>{
  const b = e.target.closest('button[data-a]'); if(!b) return;
  Sound.init(); Sound.resume(); Sound.ui();
  doAction(b.dataset.a);
});

/* =========================================================================
   8b. YÜKSEK SKORLAR (GOAL-013, madde 3) — sadece localStorage, backend yok
   ========================================================================= */
const HS_KEY = 'nasodren_highscores_v1';
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function loadHighScores(){
  try{
    const raw = localStorage.getItem(HS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}
function saveHighScore(name, score){
  const list = loadHighScores();
  list.push({ name, score, day:G.level.day });
  list.sort((a,b)=>b.score-a.score);
  list.length = Math.min(list.length, 10);
  try{ localStorage.setItem(HS_KEY, JSON.stringify(list)); }catch(e){}
  return list;
}
function showHighScores(fromGameOver){
  const list = loadHighScores();
  const rows = list.length
    ? list.map((r,i)=>'<div class="hsRow"><span class="hsRank">'+(i+1)+'</span><span class="hsName">'+escapeHtml(r.name)+'</span><span class="hsScore">'+r.score.toLocaleString('tr-TR')+'</span></div>').join('')
    : '<p class="lede">Henüz skor yok. İlk sen ol!</p>';
  // GOAL-014: ayrı, tam ekran "Yüksek Skorlar" ekranı — ister ana menüden
  // ister oyun-bitti isim girişinden sonra ulaşılsın, aynı ekran.
  showMenuScreen(
    `<div class="menuBrand"><div class="kicker">YÜKSEK SKORLAR</div><div class="title">En İyi Tedaviler</div></div>
     <div class="hsList">${rows}</div>
     <div class="menuStack">
       ${fromGameOver ? '<button class="menuBtn primary" data-a="restart">YENİDEN OYNA</button>' : ''}
       <button class="menuBtn ghost" data-a="mainmenu">◀ ANA MENÜ</button>
     </div>`);
}
function showGameOverNameEntry(){
  showPanel(
    `<div class="kicker">TEDAVİ YARIM KALDI</div>
     <div class="title">Gün ${G.level.day}</div>
     <div class="stats">
       <div><span>SKOR</span><b>${G.score.toLocaleString('tr-TR')}</b></div>
       <div><span>TEMİZLENEN</span><b>%${Math.floor(G.pct*100)}</b></div>
     </div>
     <p class="lede">Skorunu yüksek skor listesine kaydetmek için adını yaz.</p>
     <div class="acts">
       <input id="nameInput" class="nameInput" maxlength="12" placeholder="ADIN">
       <button class="cta" data-a="submitscore">KAYDET</button>
     </div>`);
  setTimeout(()=>{
    const inp = document.getElementById('nameInput');
    if(!inp) return;
    inp.focus();
    inp.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); doAction('submitscore'); } });
  }, 40);
}
function showMainMenu(){
  G.state = 'title';
  // GOAL-014 (madde 1): ana menü artık ayrı, tam ekran bir uygulama ekranı —
  // dikey OYNA / BÖLÜMLER / YÜKSEK SKORLAR / SES yapısı.
  showMenuScreen(
    `<div class="menuBrand">
       <div class="kicker">NASODREN &nbsp;·&nbsp; SİKLAMEN EKSTRESİ</div>
       <div class="title">Sinüsleri <em>geri kazan</em>.</div>
     </div>
     <div class="menuStack">
       <button class="menuBtn primary" data-a="start">OYNA</button>
       <button class="menuBtn" data-a="levels">BÖLÜMLER</button>
       <button class="menuBtn" data-a="scores">YÜKSEK SKORLAR</button>
       <button class="menuBtn ghost" data-a="togglesound">${Sound.on ? 'SES: AÇIK' : 'SES: KAPALI'}</button>
     </div>`);
}
function showLevelSelect(){
  // GOAL-014 (madde 2): ayrı "Bölümler" ekranı — kilit sistemi yok, her gün
  // doğrudan başlatılabilir. Gameplay/level tasarımına dokunulmadı, sadece
  // hangi G.levelIdx ile başlanacağını seçtiriyor.
  const cards = LEVELS.map((L,i) =>
    `<button class="levelBtn" data-a="pick-${i}">
       <span class="levelDay">GÜN ${String(L.day).padStart(2,'0')}</span>
       <span class="levelName">${L.name}</span>
     </button>`).join('');
  showMenuScreen(
    `<div class="menuBrand"><div class="kicker">BÖLÜMLER</div><div class="title">Gün Seç</div></div>
     <div class="levelGrid">${cards}</div>
     <div class="menuStack menuBack">
       <button class="menuBtn ghost" data-a="mainmenu">◀ ANA MENÜ</button>
     </div>`);
}

function doAction(a){
  if(a === 'start' || a === 'restart'){ hideMenuScreen(); G.levelIdx = 0; G.score = 0; G.lives = 3; introLevel(); }
  else if(a === 'go') startLevel();
  else if(a === 'next'){ G.levelIdx++; introLevel(); }
  else if(a === 'retry') startLevel();
  else if(a === 'resume'){ hidePanel(); G.state = 'play'; }
  else if(a === 'mainmenu') showMainMenu();
  else if(a === 'levels') showLevelSelect();
  else if(a === 'scores') showHighScores(false);
  else if(a === 'togglesound'){ Sound.toggle(); showMainMenu(); }
  else if(a.indexOf('pick-') === 0){
    const idx = parseInt(a.slice(5), 10);
    if(!isNaN(idx) && LEVELS[idx]){ hideMenuScreen(); G.levelIdx = idx; G.score = 0; G.lives = 3; introLevel(); }
  }
  else if(a === 'submitscore'){
    const inp = document.getElementById('nameInput');
    const name = inp ? inp.value.trim() : '';
    if(!name){ if(inp){ inp.classList.remove('errorShake'); void inp.offsetWidth; inp.classList.add('errorShake'); inp.focus(); } return; }
    saveHighScore(name.slice(0,12), G.score);
    showHighScores(true);
  }
}
$('btnSound').onclick = () => {
  Sound.init(); Sound.resume();
  const on = Sound.toggle();
  $('btnSound').textContent = on ? 'SES' : 'SUS';
  $('btnSound').style.color = on ? '' : 'rgba(255,255,255,.25)';
};
$('btnPause').onclick = () => togglePause();
function togglePause(){
  if(G.state === 'play'){
    G.state = 'paused';
    // GOAL-014 (madde 4): yatay buton sırası yerine dikey, büyük, gerçek
    // oyun-menüsü hissi veren .menuStack/.menuBtn (ana menüyle aynı bileşen).
    showPanel(
      `<div class="kicker">DURAKLATILDI</div>
       <div class="title">Gün ${G.level.day}</div>
       <p class="lede">${G.level.name} · alanın %${Math.floor(G.pct*100)}’i temizlendi, hedef %${Math.round(G.level.target*100)}.</p>
       <div class="menuStack">
         <button class="menuBtn primary" data-a="resume">DEVAM ET</button>
         <button class="menuBtn" data-a="restart">YENİDEN BAŞLAT</button>
         <button class="menuBtn ghost" data-a="mainmenu">ANA MENÜ</button>
       </div>`);
  } else if(G.state === 'paused'){ hidePanel(); G.state = 'play'; }
}

/* =========================================================================
   9. GİRDİ
   ========================================================================= */
const keys = {};
addEventListener('keydown', e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if(e.key==='p'||e.key==='P'||e.key==='Escape') togglePause();
  if(e.key==='f'||e.key==='F') UI.fps.classList.toggle('on');
});
addEventListener('keyup', e=>{ keys[e.key] = false; });

const pad = $('pad'), ring = $('ring'), knob = $('knob');
let touchId = null, ox = 0, oy = 0, tdir = 0;
function padDir(cx,cy){
  let dx = cx-ox, dy = cy-oy;
  const dist = Math.hypot(dx,dy);
  if(dist > 50){ const k = (dist-50)/dist; ox += dx*k; oy += dy*k; dx = cx-ox; dy = cy-oy; }
  knob.style.left = (ox+dx*.85)+'px'; knob.style.top = (oy+dy*.85)+'px';
  if(Math.hypot(dx,dy) < 13) return tdir;
  return Math.abs(dx) > Math.abs(dy)*1.15 ? (dx>0?1:2) : (dy>0?4:3);
}
function startStick(cx,cy){
  ox = cx; oy = cy;
  ring.style.left = ox+'px'; ring.style.top = oy+'px';
  knob.style.left = ox+'px'; knob.style.top = oy+'px';
  ring.classList.add('on'); knob.classList.add('on');
}
function endStick(){ touchId = null; tdir = 0; ring.classList.remove('on'); knob.classList.remove('on'); }
pad.addEventListener('touchstart', e=>{
  Sound.init(); Sound.resume();
  if(touchId !== null){ e.preventDefault(); return; }
  const t = e.changedTouches[0];
  touchId = t.identifier; startStick(t.clientX, t.clientY);
  e.preventDefault();
}, {passive:false});
pad.addEventListener('touchmove', e=>{
  for(const t of e.changedTouches) if(t.identifier === touchId) tdir = padDir(t.clientX,t.clientY);
  e.preventDefault();
}, {passive:false});
function endTouch(e){ for(const t of e.changedTouches) if(t.identifier === touchId) endStick(); }
pad.addEventListener('touchend', endTouch);
pad.addEventListener('touchcancel', endTouch);
pad.addEventListener('pointerdown', e=>{
  if(e.pointerType !== 'mouse') return;
  Sound.init(); Sound.resume();
  touchId = 'm'; startStick(e.clientX, e.clientY);
});
addEventListener('pointermove', e=>{ if(touchId === 'm') tdir = padDir(e.clientX,e.clientY); });
addEventListener('pointerup', ()=>{ if(touchId === 'm') endStick(); });
function readInput(){
  if(keys.ArrowRight||keys.d||keys.D) return 1;
  if(keys.ArrowLeft ||keys.a||keys.A) return 2;
  if(keys.ArrowUp   ||keys.w||keys.W) return 3;
  if(keys.ArrowDown ||keys.s||keys.S) return 4;
  return tdir;
}

/* =========================================================================
   10. SEVİYE KURULUMU
   ========================================================================= */
function spawnBoss(L, idx){
  const a = idx*Math.PI + rnd(0,1);
  const s = new PIXI.Sprite(TEX.boss); s.anchor.set(.5);
  const g = new PIXI.Sprite(TEX.glow);
  g.anchor.set(.5); g.blendMode = BLEND_ADD; g.tint = 0xff5a2c; g.alpha = .4;
  layerEnt.addChild(g, s);
  return { x:GW/2+Math.cos(a)*GW*.16, y:GH/2+Math.sin(a)*GH*.16,
           vx:Math.cos(a+1)*L.bossSpd, vy:Math.sin(a+1)*L.bossSpd,
           r:L.bossR, spd:L.bossSpd, t:rnd(0,6), fireT:rnd(1,3), s:s, g:g };
}
function spawnMinion(L){
  const a = rnd(0,7), d = rnd(GH*.12, GH*.4), kind = Math.random()<.55?0:1;
  const s = new PIXI.Sprite(TEX.mini[kind]);
  s.anchor.set(.5); s.width = 30; s.height = 30 * MINI_AR[kind]; // GOAL-012: en-boy oranı korunuyor, görünür boyut hissi (30) aynı
  layerEnt.addChild(s);
  return { x:clamp(GW/2+Math.cos(a)*d*1.4, B+4, GW-B-4), y:clamp(GH/2+Math.sin(a)*d, B+4, GH-B-4),
           vx:Math.cos(a*2.3)*L.miniSpd, vy:Math.sin(a*1.7)*L.miniSpd,
           r:2.4, kind:kind, spin:rnd(-1.6,1.6), s:s };
}
function clearEntities(){
  for(const b of G.bosses){ b.s.destroy(); b.g.destroy(); }
  for(const m of G.minions) m.s.destroy();
  for(const b of G.bullets) b.s.destroy();
  for(const s of G.shots) s.s.destroy();
  for(const p of G.pus){ p.s.destroy(); p.g.destroy(); }
  G.bosses=[]; G.minions=[]; G.bullets=[]; G.shots=[]; G.pus=[];
}
let preparedIdx = -1;
function prepareLevel(idx){
  if(preparedIdx === idx) return;
  const L = LEVELS[idx];
  paintHealthy(L); texUpdate(bgTex);
  paintTissue(L);
  preparedIdx = idx;
}
function startLevel(){
  const L = LEVELS[G.levelIdx];
  G.level = L;
  clearEntities(); resetGrid();
  prepareLevel(G.levelIdx);
  rasterRegion(0,0,GW,GH);
  G.filled=0; G.pct=0; G.drawing=false; G.trail=[]; G.corners=[];
  G.dir=0; G.frac=0; G.lastDir=0; G.px=GW>>1; G.py=GH-B; G.startCell=G.py*GW+G.px;
  G.doseMax=L.dose; G.dose=L.dose; G.buffs={}; G.invuln=1.2; G.shake=0;
  particles.length = 0;
  for(let i=0;i<L.bossN;i++) G.bosses.push(spawnBoss(L,i));
  for(let i=0;i<L.mini;i++)  G.minions.push(spawnMinion(L));
  const kinds = [PU.SPEED,PU.FREEZE,PU.LASER,PU.BOMB,PU.DOSE];
  for(let i=0;i<L.pu;i++){
    const k = kinds[i%kinds.length];
    const s = new PIXI.Sprite(TEX.pu[k]); s.anchor.set(.5); s.width = s.height = 34;
    const g = new PIXI.Sprite(TEX.glow);
    g.anchor.set(.5); g.width = g.height = 80; g.blendMode = BLEND_ADD; g.alpha = .3;
    g.tint = parseInt(PU_META[k].color.slice(1),16);
    layerEnt.addChild(g, s);
    G.pus.push({ x:(B+6+Math.random()*(GW-2*B-12))|0, y:(B+6+Math.random()*(GH-2*B-12))|0,
                 k:k, s:s, g:g, t:rnd(0,6) });
  }
  hidePanel();
  G.state = 'play';
  syncHUD();
}
function introLevel(){
  if(G.levelIdx >= LEVELS.length){ winGame(); return; }
  hideMenuScreen(); // GOAL-014: tam ekran menüden (ana menü/bölümler) geliniyorsa kapat
  const L = LEVELS[G.levelIdx];
  G.state = 'intro';
  // GOAL-013 (madde 2): uzun tıbbi paragraflar kaldırıldı — tek kısa çengel
  // cümle (L.med, artık 3-6 kelime) + hedef yüzdesi, 2 saniyede okunabilir.
  showPanel(
    `<div class="kicker">GÜN ${String(L.day).padStart(2,'0')} &nbsp;·&nbsp; HEDEF %${Math.round(L.target*100)}</div>
     <div class="title">${L.name}</div>
     <p class="note">${L.med}</p>
     <div class="acts"><button class="cta" data-a="go">BAŞLA</button></div>`);
}
function winGame(){
  G.state = 'won';
  showPanel(
    `<div class="kicker">KÜR TAMAMLANDI</div>
     <div class="title">Sinüsler <em>açık</em>.</div>
     <p class="lede">Tutulan mukus tamamen kalktı, ostiumlar açıldı, siliyer temizlik yeniden çalışıyor.</p>
     <div class="stats">
       <div><span>TOPLAM SKOR</span><b>${G.score.toLocaleString('tr-TR')}</b></div>
       <div><span>KALAN CAN</span><b>${G.lives}</b></div>
     </div>
     <div class="acts"><button class="cta" data-a="restart">YENİDEN OYNA</button></div>`);
  Sound.clear();
}

/* =========================================================================
   11. OYUNCU HAREKETİ
   ========================================================================= */
function markTrail(i){ cells[i] = TRAIL; G.trail.push(i); }
function stepPlayer(){
  const dv = DIRV[G.dir], dx = dv[0], dy = dv[1];
  const nx = G.px+dx, ny = G.py+dy;
  if(nx<0||ny<0||nx>=GW||ny>=GH){ G.dir = 0; return; }
  const ni = ny*GW+nx, c = cells[ni];
  if(G.drawing){
    if(c === TRAIL){ die(); return; }
    G.px = nx; G.py = ny;
    if(c === FILL) closeTrail(); else markTrail(ni);
  } else {
    G.px = nx; G.py = ny;
    if(c === EMPTY){
      G.drawing = true;
      G.startCell = (ny-dy)*GW + (nx-dx);
      G.corners = [{x:nx-dx, y:ny-dy}];
      markTrail(ni);
    }
  }
}
function movePlayer(dt){
  const want = readInput();
  if(want){
    if(G.dir === 0){
      // GOAL-013 (madde 9): yön girdisi kısa süreliğine bırakılıp tam ters yöne
      // basıldığında (G.dir sıfıra düştüğü an "rev" kontrolü atlanıyordu) oyuncu
      // kendi tazeçizdiği TRAIL hücresine adım atıp anında ölüyordu. Aşağıdaki
      // "else if" dalındaki ile AYNI ters-yön engeli burada da uygulanıyor;
      // gerçek öz-kesişim/kesişme ölümlerine (stepPlayer içindeki TRAIL
      // kontrolü) hiç dokunulmadı.
      const revFromRelease = G.drawing && want === OPP[G.lastDir];
      if(!revFromRelease){
        if(G.drawing && G.corners.length){
          const lc = G.corners[G.corners.length-1];
          if(lc.x !== G.px || lc.y !== G.py) G.corners.push({x:G.px, y:G.py});
        }
        G.dir = want; G.frac = 0; G.lastDir = want;
      }
    } else if(want !== G.dir){
      const rev = want === OPP[G.dir];
      if(!(rev && G.drawing)){
        if(G.frac > .5) stepPlayer();
        G.frac = 0;
        if(G.drawing && G.corners.length) G.corners.push({x:G.px, y:G.py});
        G.dir = want; G.lastDir = want;
      }
    }
  } else { G.dir = 0; G.frac = 0; }
  if(!G.dir) return;
  const spd = G.buffs.SPEED ? PLAYER_SPD_FAST : PLAYER_SPD;
  G.frac += spd*dt;
  let guard = 0;
  while(G.frac >= 1 && guard++ < 8){
    G.frac -= 1; stepPlayer();
    if(!G.dir || G.state !== 'play'){ G.frac = 0; break; }
  }
}

/* =========================================================================
   12. ALAN KAPATMA
   ========================================================================= */
function closeTrail(){
  const newCells = [];
  for(const i of G.trail){ cells[i] = FILL; newCells.push(i); }
  markBuf.fill(0);
  for(const b of G.bosses){
    spanFill(Math.round(b.x), Math.round(b.y));
    for(let a=0;a<8;a++){
      const an = a/8*Math.PI*2;
      spanFill(Math.round(b.x+Math.cos(an)*b.r*.7), Math.round(b.y+Math.sin(an)*b.r*.7));
    }
  }
  for(let i=0;i<cells.length;i++) if(cells[i]===EMPTY && !markBuf[i]){ cells[i]=FILL; newCells.push(i); }

  let gain = 0, minX = GW, minY = GH, maxX = 0, maxY = 0;
  for(const i of newCells){
    const x = i%GW, y = (i/GW)|0;
    if(x<minX) minX = x; if(x>maxX) maxX = x;
    if(y<minY) minY = y; if(y>maxY) maxY = y;
    if(x>=B && y>=B && x<GW-B && y<GH-B) gain++;
  }
  rasterRegion(minX, minY, maxX, maxY);

  let f = 0;
  for(let y=B;y<GH-B;y++){ const row = y*GW; for(let x=B;x<GW-B;x++) if(cells[row+x]===FILL) f++; }
  G.filled = f;
  const prev = G.pct;
  G.pct = f/INTERIOR;
  const share = G.pct - prev;

  for(let k=G.minions.length-1;k>=0;k--){
    const m = G.minions[k];
    if(cells[Math.round(m.y)*GW + Math.round(m.x)] === FILL){
      burst(m.x, m.y, 20, m.kind ? 0xffe08a : 0xb7f27a);
      m.s.destroy(); G.minions.splice(k,1); G.score += 250;
    }
  }
  for(let k=G.pus.length-1;k>=0;k--){
    const p = G.pus[k];
    if(!p.collected && cells[p.y*GW+p.x] === FILL){
      grabPowerup(p);
      p.collected = true; p.collectT = 0; // GOAL-009: hemen yok etmek yerine render() içinde büyüyüp sönsün
    }
  }
  const ns = Math.min(110, 14 + ((gain/32)|0));
  for(let n=0;n<ns;n++){
    const i = newCells[(Math.random()*newCells.length)|0];
    burst(i%GW, (i/GW)|0, 1, 0x9ff0ec, .7);
  }
  const areaScore = Math.round(gain*1.2);
  G.score += areaScore;
  G.dose = clamp(G.dose + share*G.doseMax*2.2, 0, G.doseMax);
  Sound.capture(share);
  G.shake = Math.min(7, share*40);
  let popupScore = areaScore;
  if(share >= MEGA_SHARE){
    G.score += 1500;
    popupScore += 1500;
    toast('MÜKEMMEL', 'TEK HAMLEDE %'+Math.round(share*100)+' · +1500');
  } else if(share >= 0.03){
    toast('BÜYÜK TEMİZLİK', '+%'+Math.round(share*100)+' alan');
  } else if(share > 0){
    toast('GÜZEL', '+%'+(share*100).toFixed(1)+' alan');
  }
  spawnScorePopup((minX+maxX)/2, (minY+maxY)/2, popupScore);

  G.drawing = false; G.trail = []; G.corners = [];
  G.startCell = G.py*GW+G.px;
  if(G.pct >= G.level.target) levelClear();
  syncHUD();
}
function grabPowerup(p){
  const m = PU_META[p.k];
  Sound.pickup(); G.score += 400;
  burst(p.x, p.y, 16, parseInt(m.color.slice(1),16), 1);
  if(p.k === PU.BOMB){
    for(let k=G.minions.length-1;k>=0;k--){
      const mm = G.minions[k];
      burst(mm.x, mm.y, 26, 0xffb0d2);
      mm.s.destroy(); G.minions.splice(k,1); G.score += 200;
    }
    for(const b of G.bullets) b.s.destroy();
    G.bullets = []; G.shake = 16;
    Sound.sneeze();
    toast('Hapşuu!', 'TRİGEMİNAL REFLEKS · EKRAN TEMİZLENDİ');
  } else if(p.k === PU.DOSE){
    G.dose = G.doseMax; toast(m.label, '24 SAATLİK KORUMA');
  } else {
    G.buffs[m.key] = m.dur; toast(m.label, 'AKTİF · '+m.dur+' SANİYE');
  }
  syncHUD();
}
function levelClear(){
  G.state = 'clear';
  const bonus = Math.round((G.pct-G.level.target)*10000) + G.lives*500;
  G.score += Math.max(0,bonus);
  Sound.clear();
  const last = G.levelIdx >= LEVELS.length-1;
  showPanel(
    `<div class="kicker">GÜN ${String(G.level.day).padStart(2,'0')} TAMAMLANDI</div>
     <div class="title">%${Math.floor(G.pct*100)} <em>temizlendi</em></div>
     <p class="note">${G.level.med}</p>
     <div class="stats">
       <div><span>ALAN BONUSU</span><b>${Math.max(0,bonus).toLocaleString('tr-TR')}</b></div>
       <div><span>TOPLAM SKOR</span><b>${G.score.toLocaleString('tr-TR')}</b></div>
     </div>
     <div class="acts"><button class="cta" data-a="next">${last?'SON GÜNE GEÇ':'ERTESİ GÜN'}</button></div>`);
}
function die(){
  if(G.invuln > 0) return;
  G.lives--; Sound.hit(); G.shake = 14;
  burst(G.px, G.py, 46, 0xff5f8f);
  for(const i of G.trail) cells[i] = EMPTY;
  G.trail=[]; G.corners=[]; G.drawing=false; G.dir=0; G.frac=0; G.lastDir=0;
  G.px = G.startCell % GW; G.py = (G.startCell/GW)|0;
  if(cells[G.startCell] !== FILL){ G.px = GW>>1; G.py = GH-B; }
  G.invuln = 1.8;
  G.dose = Math.max(G.dose, G.doseMax*.35);
  syncHUD();
  if(G.lives <= 0){
    G.state = 'over';
    // GOAL-013 (madde 3): oyun gerçekten sona eriyor — devam etmeden önce
    // zorunlu isim girişi + localStorage'a skor kaydı isteniyor.
    showGameOverNameEntry();
    G.lives = 3;
  }
}

/* =========================================================================
   13. PARÇACIKLAR
   ========================================================================= */
function burst(cx, cy, n, tint, scale){
  for(let i=0;i<n && particles.length < partSprites.length;i++){
    const a = rnd(0,7), sp = rnd(5,30);
    particles.push({ x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      life:rnd(.35,1), size:rnd(7,22)*(scale||1), tint:tint });
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vx *= .93; p.vy = p.vy*.93 + 6*dt;
    p.life -= dt;
    if(p.life <= 0) particles.splice(i,1);
  }
  for(let i=0;i<partSprites.length;i++){
    const s = partSprites[i], p = particles[i];
    if(!p){ s.visible = false; continue; }
    s.visible = true;
    s.x = p.x*CS; s.y = p.y*CS;
    s.width = s.height = p.size * clamp(p.life/.6,.25,1.4);
    s.alpha = clamp(p.life*1.5,0,.85);
    s.tint = p.tint;
  }
}

/* =========================================================================
   14. DÜŞMANLAR
   ========================================================================= */
function solid(x,y){
  x|=0; y|=0;
  if(x<0||y<0||x>=GW||y>=GH) return true;
  return cells[y*GW+x] === FILL;
}
function moveEnemy(e, dt, wobble){
  if(G.buffs.FREEZE) return;
  let nx = e.x+e.vx*dt, ny = e.y+e.vy*dt;
  if(solid(nx + Math.sign(e.vx)*e.r, e.y)){ e.vx = -e.vx; nx = e.x; }
  if(solid(e.x, ny + Math.sign(e.vy)*e.r)){ e.vy = -e.vy; ny = e.y; }
  e.x = clamp(nx, B+e.r*.4, GW-B-e.r*.4);
  e.y = clamp(ny, B+e.r*.4, GH-B-e.r*.4);
  if(wobble){
    const a = Math.atan2(e.vy,e.vx) + rnd(-wobble,wobble)*dt;
    const sp = Math.hypot(e.vx,e.vy) || e.spd;
    e.vx = Math.cos(a)*sp; e.vy = Math.sin(a)*sp;
  }
}
function hitsTrail(e){
  if(!G.trail.length) return false;
  const x0 = Math.max(0,Math.floor(e.x-e.r)), x1 = Math.min(GW-1,Math.ceil(e.x+e.r));
  const y0 = Math.max(0,Math.floor(e.y-e.r)), y1 = Math.min(GH-1,Math.ceil(e.y+e.r));
  const r2 = e.r*e.r;
  for(let y=y0;y<=y1;y++){
    const row = y*GW;
    for(let x=x0;x<=x1;x++){
      if(cells[row+x] !== TRAIL) continue;
      const dx = x-e.x, dy = y-e.y;
      if(dx*dx+dy*dy <= r2) return true;
    }
  }
  return false;
}
function vulnerable(){ return G.invuln <= 0 && (G.drawing || G.dose <= 0); }
function updateEnemies(dt){
  const L = G.level;
  for(const b of G.bosses){
    moveEnemy(b, dt, 1.1); b.t += dt;
    if(L.fire > 0 && !G.buffs.FREEZE){
      b.fireT -= dt;
      if(b.fireT <= 0){
        b.fireT = 1/L.fire*rnd(.7,1.4);
        const a = Math.atan2(G.py-b.y, G.px-b.x) + rnd(-.35,.35);
        const s = new PIXI.Sprite(TEX.spark);
        s.anchor.set(.5); s.width = s.height = 22; s.tint = 0xff7a52; s.blendMode = BLEND_ADD;
        layerEnt.addChild(s);
        G.bullets.push({ x:b.x, y:b.y, vx:Math.cos(a)*34, vy:Math.sin(a)*34, life:6, s:s });
      }
    }
    if(hitsTrail(b)) die();
    const dx = b.x-G.px, dy = b.y-G.py;
    if(vulnerable() && dx*dx+dy*dy < (b.r+1.6)*(b.r+1.6)) die();
  }
  for(const m of G.minions){
    moveEnemy(m, dt, .35);
    if(hitsTrail(m)) die();
    const dx = m.x-G.px, dy = m.y-G.py;
    if(vulnerable() && dx*dx+dy*dy < (m.r+1.4)*(m.r+1.4)) die();
  }
  for(let i=G.bullets.length-1;i>=0;i--){
    const b = G.bullets[i];
    if(!G.buffs.FREEZE){ b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt; }
    const inSafe = solid(b.x,b.y);
    if(b.life<=0 || b.x<0 || b.y<0 || b.x>GW || b.y>GH || (inSafe && G.dose>0)){
      b.s.destroy(); G.bullets.splice(i,1); continue;
    }
    if(cells[Math.round(b.y)*GW+Math.round(b.x)] === TRAIL){ die(); b.s.destroy(); G.bullets.splice(i,1); continue; }
    const dx = b.x-G.px, dy = b.y-G.py;
    if(vulnerable() && dx*dx+dy*dy < 4){ die(); b.s.destroy(); G.bullets.splice(i,1); }
  }
  if(G.buffs.LASER){
    G.laserCd -= dt;
    if(G.laserCd <= 0 && G.dir){
      G.laserCd = .16;
      const dv = DIRV[G.dir];
      const s = new PIXI.Sprite(TEX.spark);
      s.anchor.set(.5); s.width = s.height = 14; s.tint = 0xc6ff8f; s.blendMode = BLEND_ADD;
      layerEnt.addChild(s);
      G.shots.push({ x:G.px, y:G.py, vx:dv[0]*72, vy:dv[1]*72, life:1.6, s:s });
      Sound.laser();
    }
  }
  for(let i=G.shots.length-1;i>=0;i--){
    const sh = G.shots[i];
    sh.x += sh.vx*dt; sh.y += sh.vy*dt; sh.life -= dt;
    let hit = false;
    for(let k=G.minions.length-1;k>=0;k--){
      const m = G.minions[k];
      const dx = m.x-sh.x, dy = m.y-sh.y;
      if(dx*dx+dy*dy < (m.r+1)*(m.r+1)){
        burst(m.x,m.y,18,0xb7f27a);
        m.s.destroy(); G.minions.splice(k,1); G.score += 300; hit = true; break;
      }
    }
    if(hit || sh.life<=0 || sh.x<0 || sh.y<0 || sh.x>GW || sh.y>GH){ sh.s.destroy(); G.shots.splice(i,1); }
  }
}

/* =========================================================================
   15. ÇİZİM
   ========================================================================= */
function drawTrail(){
  let n = 0;
  if(G.drawing && G.corners.length){
    const pts = G.corners.concat([{x:G.px, y:G.py}]);
    for(let i=0;i<pts.length-1 && n<trailCore.length;i++){
      const a = pts[i], b = pts[i+1];
      if(a.x === b.x && a.y === b.y) continue;
      const s = trailCore[n], g = trailGlow[n]; n++;
      const mx = ((a.x+b.x)/2 + .5)*CS, my = ((a.y+b.y)/2 + .5)*CS;
      const w = Math.abs(b.x-a.x)*CS, h = Math.abs(b.y-a.y)*CS;
      s.visible = g.visible = true;
      s.x = g.x = mx; s.y = g.y = my;
      s.width  = Math.max(w, 3); s.height = Math.max(h, 3);
      g.width  = w > h ? w : 14;  g.height = h > w ? h : 14;
    }
  }
  for(let i=n;i<trailCore.length;i++){
    if(!trailCore[i].visible) break;
    trailCore[i].visible = false; trailGlow[i].visible = false;
  }
}
function render(dt){
  G.time += dt;
  const t = G.time;

  const dv = DIRV[G.dir];
  const pxp = (G.px + dv[0]*G.frac + .5)*CS, pyp = (G.py + dv[1]*G.frac + .5)*CS;
  playerSprite.x = playerGlow.x = playerLight.x = pxp;
  playerSprite.y = playerGlow.y = playerLight.y = pyp;
  playerSprite.rotation = Math.sin(t*1.1)*.10;
  const blink = G.invuln > 0 ? (Math.sin(t*30) > 0 ? .25 : 1) : 1;
  playerSprite.alpha = blink;
  { const pw = 34 + Math.sin(t*4.2)*1.4; playerSprite.width = pw; playerSprite.height = pw * PLAYER_AR; }
  playerGlow.alpha = (.34 + Math.sin(t*4.2)*.12) * blink * (G.drawing ? 1.5 : 1);
  playerGlow.width = playerGlow.height = 96 + Math.sin(t*4.2)*12;
  playerLight.alpha = (.14 + Math.sin(t*2.1)*.03) * (G.drawing ? 1.6 : 1);

  for(const b of G.bosses){
    const pulse = 1 + Math.sin(b.t*2.1)*.045;
    b.s.x = b.g.x = b.x*CS; b.s.y = b.g.y = b.y*CS;
    b.s.width = b.s.height = b.r*2*CS*pulse;
    b.s.rotation += dt*.13;
    b.g.width = b.g.height = b.r*3.3*CS*pulse;
    b.g.alpha = .28 + Math.sin(b.t*2.7)*.1;
  }
  for(const m of G.minions){
    m.s.x = m.x*CS; m.s.y = m.y*CS;
    m.s.rotation += m.spin*dt;
  }
  for(const b of G.bullets){ b.s.x = b.x*CS; b.s.y = b.y*CS; }
  for(const s of G.shots){ s.s.x = s.x*CS; s.s.y = s.y*CS; }
  for(let i=G.pus.length-1;i>=0;i--){
    const p = G.pus[i];
    p.t += dt;
    if(p.collected){
      // GOAL-009: toplama anı — ikon büyür + glow artar + söner, sonra temizlenir
      p.collectT += dt;
      const k = clamp(p.collectT/0.35, 0, 1);
      p.s.x = p.g.x = (p.x+.5)*CS; p.s.y = p.g.y = (p.y+.5)*CS;
      p.s.visible = p.g.visible = true;
      p.s.width = p.s.height = 34 * (1 + k*0.9);
      p.g.width = p.g.height = 80 * (1 + k*1.4);
      p.s.alpha = p.g.alpha = 1 - k;
      if(p.collectT >= 0.35){ p.s.destroy(); p.g.destroy(); G.pus.splice(i,1); }
      continue;
    }
    const yy = (p.y+.5)*CS + Math.sin(p.t*2.1)*3.5;
    p.s.x = p.g.x = (p.x+.5)*CS; p.s.y = p.g.y = yy;
    p.s.rotation = Math.sin(p.t*1.3)*.14;
    const vis = cells[p.y*GW+p.x] === EMPTY;
    p.s.visible = p.g.visible = vis;
    p.g.alpha = .22 + Math.sin(p.t*3.4)*.1;
  }
  drawTrail();

  grainSprite.x = -rnd(0, PFW*.18);
  grainSprite.y = -rnd(0, PFH*.18);

  if(G.shake > 0){
    G.shake = Math.max(0, G.shake - dt*26);
    shakeRoot.x = rnd(-G.shake, G.shake);
    shakeRoot.y = rnd(-G.shake, G.shake);
  } else { shakeRoot.x = 0; shakeRoot.y = 0; }
}

/* =========================================================================
   16. YERLEŞİM
   ========================================================================= */
const isTouch = matchMedia('(pointer:coarse)').matches;
function layout(){
  const w = window.innerWidth, h = window.innerHeight;
  app.renderer.resize(w,h);
  const hudEl = document.getElementById('hud');
  const top = (hudEl ? hudEl.offsetHeight : 110) + 8;
  const bottom = isTouch ? 74 : 54;
  const availW = w - 24, availH = Math.max(60, h - top - bottom);
  const s = Math.min(availW/PFW, availH/PFH);
  root.scale.set(s);
  root.x = (w - PFW*s)/2;
  root.y = top + (availH - PFH*s)/2;
}
addEventListener('resize', layout);
addEventListener('orientationchange', ()=> setTimeout(layout,180));

/* =========================================================================
   17. ANA DÖNGÜ
   ========================================================================= */
let last = performance.now(), fpsAcc = 0, fpsN = 0;
app.ticker.add(()=>{
  const now = performance.now();
  let dt = (now-last)/1000; last = now;
  if(dt > 1/20) dt = 1/20;

  fpsAcc += dt; fpsN++;
  if(fpsAcc >= .5){ UI.fps.textContent = Math.round(fpsN/fpsAcc)+' FPS · PIXI '+PIXI.VERSION; fpsAcc = 0; fpsN = 0; }

  if(G.state === 'play'){
    if(G.invuln > 0) G.invuln -= dt;
    G.dose = Math.max(0, G.dose - dt);
    let buffChanged = false;
    for(const k in G.buffs){ G.buffs[k] -= dt; if(G.buffs[k] <= 0){ delete G.buffs[k]; buffChanged = true; } }
    movePlayer(dt);
    updateEnemies(dt);
    updateParticles(dt);
    updateScorePops(dt);
    if(buffChanged || Math.floor(G.time*4) !== Math.floor((G.time-dt)*4)) syncHUD();
  } else {
    updateParticles(dt*.4);
    updateScorePops(dt*.4);
  }
  render(dt);
});
document.addEventListener('visibilitychange', ()=>{ if(document.hidden && G.state === 'play') togglePause(); });

/* =========================================================================
   18. AÇILIŞ — başlık ekranının arkasında canlı oyun alanı
   ========================================================================= */
resetGrid();
paintHealthy(LEVELS[0]); texUpdate(bgTex);
paintTissue(LEVELS[0]);
rasterRegion(0,0,GW,GH);
layout();
syncHUD();
// GOAL-013 (madde 1): eski büyük tanıtım paneli yerine sade ana menü —
// oyuncu OYNA / YÜKSEK SKORLAR / SES tek noktadan seçiyor.
showMainMenu();

};
