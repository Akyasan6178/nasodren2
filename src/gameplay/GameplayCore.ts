<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Nasodren — Sinüs Harekâtı</title>
<style>
  :root{
    --ink:#060d14;
    --abyss:#0a1620;
    --oxygen:#35e0d8;
    --oxygen-deep:#0e6f70;
    --cyclamen:#ff4d9d;
    --cyclamen-deep:#8e2358;
    --ember:#ff6b3d;
    --bone:#eef7f9;
    --muted:#6f92a1;
    --cut:14px;
    --face:"Roboto Condensed","Arial Narrow","Helvetica Neue","Segoe UI Semibold",system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  html,body{height:100%;overflow:hidden;background:var(--ink);touch-action:none;overscroll-behavior:none;
    font-family:var(--face);color:var(--bone);-webkit-font-smoothing:antialiased}
  #app{position:fixed;inset:0}
  canvas{position:absolute;inset:0;display:block}
  #vig{position:absolute;inset:0;z-index:2;pointer-events:none;
    background:radial-gradient(135% 110% at 50% 46%,rgba(0,0,0,0) 46%,rgba(3,8,12,.78) 100%)}

  /* ---------- HUD ---------- */
  #hud{position:absolute;left:0;right:0;top:0;z-index:3;pointer-events:none;
    padding:calc(10px + env(safe-area-inset-top)) 16px 12px;
    background:linear-gradient(180deg,rgba(6,13,20,.92) 12%,rgba(6,13,20,.55) 70%,rgba(6,13,20,0))}
  .row{display:flex;align-items:flex-end;gap:14px}
  .lbl{font-size:10px;letter-spacing:.22em;color:var(--muted);line-height:1;margin-bottom:5px;font-weight:600}
  .num{font-size:26px;line-height:.86;font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums}
  #day .num{color:var(--oxygen);text-shadow:0 0 16px rgba(53,224,216,.55)}
  #scoreBox{margin-left:auto;text-align:right}
  #scoreBox .num{color:var(--bone)}
  #stage{flex:1;min-width:0}
  #stageName{font-size:13px;letter-spacing:.19em;font-weight:600;color:var(--bone);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:7px;opacity:.9}
  .gauge{position:relative;height:4px;background:rgba(255,255,255,.08)}
  .gauge>span{position:absolute;left:0;top:0;bottom:0;width:0;
    background:linear-gradient(90deg,var(--oxygen-deep),var(--oxygen));
    box-shadow:0 0 12px rgba(53,224,216,.75);transition:width .22s cubic-bezier(.2,.8,.3,1)}
  .gauge>i{position:absolute;top:-5px;bottom:-5px;width:1px;background:var(--bone);opacity:.6}
  #pctRead{font-size:12px;letter-spacing:.12em;color:var(--muted);margin-top:7px;font-variant-numeric:tabular-nums}
  #pctRead b{color:var(--oxygen);font-weight:700}
  #pctRead.met b{color:#9df58a}

  #sub{display:flex;align-items:center;gap:16px;margin-top:11px}
  #doseWrap{width:96px}
  #dose{position:relative;height:3px;background:rgba(255,255,255,.08)}
  #dose>span{position:absolute;inset:0 auto 0 0;width:100%;
    background:linear-gradient(90deg,#7a5a12,#ffc24a);box-shadow:0 0 10px rgba(255,194,74,.5)}
  #lives{display:flex;gap:6px}
  .pip{width:9px;height:13px;background:var(--cyclamen);
    clip-path:polygon(50% 0,100% 58%,74% 100%,26% 100%,0 58%);
    box-shadow:0 0 12px rgba(255,77,157,.6)}
  .pip.off{background:rgba(255,255,255,.13);box-shadow:none}
  #buffs{display:flex;gap:7px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
  .buff{font-size:10px;letter-spacing:.14em;font-weight:600;padding:4px 9px 3px;color:var(--oxygen);
    border:1px solid rgba(53,224,216,.4);background:rgba(53,224,216,.08);white-space:nowrap;
    clip-path:polygon(0 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%)}
  .buff.warn{color:#ffb1c9;border-color:rgba(255,77,157,.45);background:rgba(255,77,157,.1)}

  #toast{position:absolute;left:50%;top:26%;transform:translate(-50%,-50%);z-index:3;pointer-events:none;
    text-align:center;opacity:0;transition:opacity .18s}
  #toast.on{opacity:1}
  #toast .t{font-size:30px;font-weight:700;letter-spacing:.1em;color:var(--cyclamen);
    text-shadow:0 0 28px rgba(255,77,157,.8),0 2px 0 rgba(0,0,0,.5)}
  #toast .s{font-size:11px;letter-spacing:.22em;color:var(--bone);opacity:.8;margin-top:8px}

  /* ---------- panolar ---------- */
  #overlay{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;padding:22px;
    background:linear-gradient(180deg,rgba(6,13,20,.9),rgba(4,9,13,.94))}
  #overlay.on{display:flex}
  .plateEdge{width:min(520px,100%);background:linear-gradient(150deg,var(--oxygen),rgba(53,224,216,.25) 45%,rgba(255,77,157,.5));
    clip-path:polygon(0 var(--cut),var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%);
    filter:drop-shadow(0 22px 48px rgba(0,0,0,.65))}
  .plate{margin:1px;padding:30px 30px 26px;background:linear-gradient(165deg,#0d1a24,#081119 60%,#0b141d);
    clip-path:polygon(0 var(--cut),var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%)}
  .kicker{font-size:10px;letter-spacing:.32em;color:var(--oxygen);font-weight:600;margin-bottom:14px}
  .title{font-size:clamp(30px,7.5vw,50px);line-height:.92;font-weight:700;letter-spacing:.01em;margin-bottom:16px}
  .title em{font-style:normal;color:var(--cyclamen);text-shadow:0 0 30px rgba(255,77,157,.6)}
  .lede{font-size:14px;line-height:1.68;color:#b7cfd6;max-width:46ch;margin-bottom:18px}
  .rule{height:1px;margin:20px 0;background:linear-gradient(90deg,rgba(53,224,216,.7),rgba(53,224,216,0))}
  .note{font-size:12.5px;line-height:1.62;color:var(--muted);border-left:2px solid var(--cyclamen-deep);
    padding-left:14px;margin-bottom:20px;max-width:46ch}
  .note b{color:var(--cyclamen);font-weight:600}
  .stats{display:flex;gap:30px;margin-bottom:22px;flex-wrap:wrap}
  .stats div span{display:block;font-size:9.5px;letter-spacing:.22em;color:var(--muted);margin-bottom:6px;font-weight:600}
  .stats div b{font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.02em}
  .keys{display:grid;grid-template-columns:auto 1fr;gap:9px 16px;font-size:12.5px;color:#9fbcc4;margin-bottom:20px}
  .keys b{color:var(--oxygen);font-weight:600;letter-spacing:.1em;font-size:11px}
  .acts{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
  .cta{padding:14px 30px 13px;font-size:13px;font-weight:700;letter-spacing:.2em;color:#04191c;
    background:linear-gradient(100deg,var(--oxygen),#7bf0e6);
    clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);
    transition:filter .15s,transform .1s}
  .cta:hover{filter:brightness(1.12)}
  .cta:active{transform:translateY(1px)}
  .ghost{padding:14px 18px 13px;font-size:12px;letter-spacing:.2em;color:var(--muted);font-weight:600}
  .ghost:hover{color:var(--bone)}
  button:focus-visible{outline:2px solid var(--cyclamen);outline-offset:3px}

  /* ---------- kontroller ---------- */
  #pad{position:absolute;inset:0;z-index:4;touch-action:none}
  #ring,#knob{position:absolute;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .12s}
  #ring{width:116px;height:116px;margin:-58px 0 0 -58px;border:1px solid rgba(53,224,216,.35);
    background:radial-gradient(circle,rgba(53,224,216,.07),transparent 68%)}
  #knob{width:40px;height:40px;margin:-20px 0 0 -20px;background:rgba(53,224,216,.42);
    box-shadow:0 0 26px rgba(53,224,216,.55)}
  #ring.on,#knob.on{opacity:1}
  #tools{position:absolute;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:5;display:flex;gap:9px}
  .tool{width:42px;height:38px;font-size:10px;letter-spacing:.14em;font-weight:600;color:var(--muted);
    border:1px solid rgba(255,255,255,.13);background:rgba(8,17,25,.7);
    clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)}
  .tool:hover{color:var(--bone);border-color:rgba(53,224,216,.4)}
  #fps{position:absolute;left:16px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:5;
    font-size:10px;letter-spacing:.16em;color:var(--muted);display:none;font-variant-numeric:tabular-nums}
  #fps.on{display:block}
  #boot{position:absolute;inset:0;z-index:9;display:grid;place-items:center;
    font-size:11px;letter-spacing:.34em;color:var(--oxygen)}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div id="app">
  <div id="boot">YÜKLENİYOR</div>
  <div id="vig"></div>

  <div id="hud">
    <div class="row">
      <div id="day"><div class="lbl">GÜN</div><div class="num">01</div></div>
      <div id="stage">
        <div id="stageName">Akut tıkanıklık</div>
        <div class="gauge"><span id="gaugeFill"></span><i id="gaugeGoal"></i></div>
        <div id="pctRead"><b>%0</b> temizlendi &nbsp;/&nbsp; hedef %70</div>
      </div>
      <div id="scoreBox"><div class="lbl">SKOR</div><div class="num" id="scoreVal">0</div></div>
    </div>
    <div id="sub">
      <div id="doseWrap"><div class="lbl">DOZ KALKANI</div><div id="dose"><span id="doseFill"></span></div></div>
      <div id="lives"></div>
      <div id="buffs"></div>
    </div>
  </div>

  <div id="toast"><div class="t"></div><div class="s"></div></div>

  <div id="pad"><div id="ring"></div><div id="knob"></div></div>
  <div id="tools">
    <button class="tool" id="btnSound" aria-label="Sesi aç veya kapat">SES</button>
    <button class="tool" id="btnPause" aria-label="Duraklat">DUR</button>
  </div>
  <div id="fps"></div>
  <div id="overlay"><div class="plateEdge"><div class="plate" id="plate"></div></div></div>
</div>

<script>
(function loadPixi(){
  const urls = [
    "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.4.2/pixi.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.3/pixi.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.6.6/pixi.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.2.6/pixi.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/browser/pixi.min.js"
  ];
  let i = 0;
  (function next(){
    if(i >= urls.length){ document.getElementById('boot').textContent = 'PIXI YÜKLENEMEDİ'; return; }
    const s = document.createElement('script');
    s.src = urls[i++];
    s.onload = () => { if(window.PIXI) window.__startGame(); else next(); };
    s.onerror = next;
    document.head.appendChild(s);
  })();
})();
</script>

<script>
window.__startGame = async function(){
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
   Görsel katman 4x alt-piksel (640x480) üretilip 960x720'ye doğrusal ölçekleniyor.
   ========================================================================= */
const GW = 160, GH = 120, B = 3, CS = 6;
const PFW = GW*CS, PFH = GH*CS;
const SC = 4, HW = GW*SC, HH = GH*SC;
const INTERIOR = (GW-2*B)*(GH-2*B);
const EMPTY = 0, FILL = 1, TRAIL = 2;

const PU = { SPEED:0, FREEZE:1, LASER:2, BOMB:3, DOSE:4 };
const PU_META = [
  { key:'SPEED',  label:'Sürfaktan hızı',    letter:'S', color:'#35e0d8', dur:9  },
  { key:'FREEZE', label:'Ozmotik dondurma',  letter:'T', color:'#8fb9ff', dur:6  },
  { key:'LASER',  label:'Siliyer aktivasyon',letter:'L', color:'#9ef05a', dur:10 },
  { key:'BOMB',   label:'Trigeminal refleks',letter:'C', color:'#ff4d9d', dur:0  },
  { key:'DOSE',   label:'Doz yenilendi',     letter:'P', color:'#ffc24a', dur:0  }
];

const LEVELS = [
  { day:1,  name:'Akut tıkanıklık',       target:.70, bossR:9,  bossSpd:15, bossN:1, fire:0.00, mini:3,  miniSpd:19, dose:75, pu:3,
    med:'İlk uygulamadan <b>2-3 dakika</b> sonra yoğun mukopürülan drenaj başlar.',
    pal:['#2a0812','#8b1626','#e03744','#ff9a6e'] },
  { day:2,  name:'Ödem ve basınç',        target:.72, bossR:9,  bossSpd:17, bossN:1, fire:0.35, mini:4,  miniSpd:21, dose:70, pu:3,
    med:'Saponinler hücre zarındaki <b>yüzey gerilimini</b> düşürür; hücre içi sıvı dışarı çekilir.',
    pal:['#310a17','#9a1c2f','#ec4350','#ffa77c'] },
  { day:3,  name:'Hipereminin kırılması', target:.75, bossR:8,  bossSpd:19, bossN:1, fire:0.55, mini:5,  miniSpd:23, dose:66, pu:4,
    med:'Doku ödemi belirgin azalır; <b>yüz ve orbital ağrı</b> çekilmeye başlar.',
    pal:['#3b0f1e','#a8253c','#f45c72','#ffbda6'] },
  { day:4,  name:'Mukus yoğunluğu',       target:.77, bossR:8,  bossSpd:21, bossN:1, fire:0.75, mini:6,  miniSpd:25, dose:62, pu:4,
    med:'Kalın pıhtılar siliyer hareketi engeller. İçeri hapsettiklerin temizlenir.',
    pal:['#361509','#a34c1f','#ec8c33','#ffd489'] },
  { day:5,  name:'Drenajın düzenlenmesi', target:.79, bossR:7,  bossSpd:23, bossN:1, fire:0.95, mini:7,  miniSpd:27, dose:58, pu:4,
    med:'5. günde salgının <b>pürülan bileşeni</b> kaybolur, drenaj standardize olur.',
    pal:['#312709','#9c7d19','#ecc53c','#fff2a6'] },
  { day:6,  name:'Ostium açılımı',        target:.80, bossR:7,  bossSpd:25, bossN:1, fire:1.15, mini:8,  miniSpd:29, dose:55, pu:5,
    med:'Sinüsleri burun boşluğuna bağlayan kanallar açılmaya başlar.',
    pal:['#1c3411','#528a28','#a3db47','#e2fba6'] },
  { day:7,  name:'Normal fonksiyon',      target:.82, bossR:10, bossSpd:26, bossN:1, fire:1.35, mini:9,  miniSpd:30, dose:52, pu:5,
    med:'Hastaların <b>%90</b>’ında normal mukoza fonksiyonu geri döner.',
    pal:['#0c302e','#1d7276','#45c0b6','#b0f7e9'] },
  { day:8,  name:'Koruma modu',           target:.83, bossR:7,  bossSpd:27, bossN:2, fire:1.45, mini:9,  miniSpd:31, dose:50, pu:5,
    med:'Günde tek doz, <b>24 saatlik</b> drenaj desteği sağlar.',
    pal:['#0a2c37','#186e7d','#3dbdd4','#a9eefa'] },
  { day:9,  name:'Kronik destek',         target:.85, bossR:7,  bossSpd:29, bossN:2, fire:1.60, mini:10, miniSpd:33, dose:48, pu:5,
    med:'Anatomik anomalilere (polipler) rağmen boşlukların havalandırılması hedeflenir.',
    pal:['#121c3c','#33519c','#7092e4','#c9d9ff'] },
  { day:10, name:'Tam havalandırma',      target:.88, bossR:9,  bossSpd:31, bossN:2, fire:1.80, mini:11, miniSpd:35, dose:46, pu:5,
    med:'Kür tamamlandı: ostiumlar açık, siliyer temizlik aktif, enfeksiyon odağı yok.',
    pal:['#151338','#3c379c','#8073e2','#d5cbff'] }
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
   4. PROSEDÜREL DOKULAR — HI-BIT KATMANI
   Piksel ızgarası yok: her yüzey önce yükseklik + albedo + parlaklık
   tamponlarına yazılır, sonra sahte normal haritasından lambert difüz,
   blinn spekülar, kenar ışığı ve temas gölgesi ile boyanır.
   ========================================================================= */
const LX = -0.44, LY = -0.76, LZ = 0.48;          /* sahne ışığı (sol-üst-ön) */
const _hx = LX, _hy = LY, _hz = LZ + 1, _hl = 1/Math.hypot(_hx,_hy,_hz);
const HNX = _hx*_hl, HNY = _hy*_hl, HNZ = _hz*_hl;
let _dif = 0, _spc = 0;

/* yükseklik alanından normal türet -> difüz + spekülar (scratch değişkenlere) */
function shade(H, w, h, i, x, y, k, shiny){
  const xm = x>0 ? i-1 : i, xp = x<w-1 ? i+1 : i;
  const ym = y>0 ? i-w : i, yp = y<h-1 ? i+w : i;
  const gx = (H[xp]-H[xm])*k, gy = (H[yp]-H[ym])*k;
  const inv = 1/Math.sqrt(gx*gx + gy*gy + 1);
  const nx = -gx*inv, ny = -gy*inv, nz = inv;
  _dif = nx*LX + ny*LY + nz*LZ;
  _spc = shiny ? Math.pow(Math.max(nx*HNX + ny*HNY + nz*HNZ, 0), shiny) : 0;
}
function sampleF(f,w,h,x,y){
  x = clamp(x,0,w-1.002); y = clamp(y,0,h-1.002);
  const ix = x|0, iy = y|0, tx = x-ix, ty = y-iy, r0 = iy*w, r1 = r0+w;
  const a = f[r0+ix], b = f[r0+ix+1], c = f[r1+ix], e = f[r1+ix+1];
  const t0 = a+(b-a)*tx, t1 = c+(e-c)*tx;
  return t0 + (t1-t0)*ty;
}
/* alan çarpıtma: gürültüyü kendi gürültüsüyle iteleyip organikleştirir */
function warpField(w,h,base,seed,oct,amp){
  const src = fbm(w,h,base,seed,oct);
  const qx = fbm(w,h,base*1.9,seed+1301,2), qy = fbm(w,h,base*1.9,seed+7717,2);
  const out = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i = y*w+x;
    out[i] = sampleF(src,w,h, x+(qx[i]-.5)*amp, y+(qy[i]-.5)*amp);
  }
  return out;
}

function texRadial(size, stops){
  const cv = makeCanvas(size,size), c = cv.getContext('2d');
  const g = c.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  for(const s of stops) g.addColorStop(s[0], s[1]);
  c.fillStyle = g; c.fillRect(0,0,size,size);
  return texFromCanvas(cv);
}
/* yumuşak uçlu kapsül — iz çizgisi keskin dikdörtgen yerine bunu kullanır */
function texCapsule(){
  const W = 64, H = 16, cv = makeCanvas(W,H), c = cv.getContext('2d');
  const g = c.createLinearGradient(0,0,0,H);
  g.addColorStop(0,   'rgba(255,255,255,0)');
  g.addColorStop(.30, 'rgba(255,255,255,.72)');
  g.addColorStop(.5,  'rgba(255,255,255,1)');
  g.addColorStop(.70, 'rgba(255,255,255,.72)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0,0,W,H);
  return texFromCanvas(cv);
}
/* hacimli sis — parçacıklar için */
function texSmoke(){
  const S = 128, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const img = c.createImageData(S,S), d = img.data, m = (S-1)/2;
  const n = fbm(S,S,26,3301,3);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i = y*S+x, q = Math.hypot(x-m,y-m)/m;
    const a = clamp((1-q)*1.18 - .22, 0, 1) * (.42 + n[i]*.92);
    d[i*4] = d[i*4+1] = d[i*4+2] = 255;
    d[i*4+3] = clamp(a,0,1)*255;
  }
  c.putImageData(img,0,0);
  return texFromCanvas(cv);
}

/* ---- oyuncu: siklamen çiçeği — beş yaprak, ipeksi spekülar ---- */
function texPlayer(){
  const S = 256, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const img = c.createImageData(S,S), d = img.data, m = (S-1)/2, R = m*.90;
  const H = new Float32Array(S*S), A = new Float32Array(S*S),
        Q = new Float32Array(S*S), Lb = new Float32Array(S*S);
  const nz = fbm(S,S,24,6161,2);
  const petal = [hex2rgb('#2e0519'),hex2rgb('#6d1147'),hex2rgb('#c22579'),
                 hex2rgb('#ff5aa8'),hex2rgb('#ffa6d3'),hex2rgb('#ffe4f1')];
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i = y*S+x, dx = x-m, dy = y-m, dist = Math.hypot(dx,dy);
    const a = Math.atan2(dy,dx);
    const k = (a+Math.PI)/(Math.PI*2)*5;
    let u = (k - Math.floor(k))*2 - 1;
    u += Math.sin(u*Math.PI)*.12;
    const lobe = Math.max(Math.cos(clamp(u,-1,1)*Math.PI*.5), 0);
    const r = R*(.28 + .72*Math.pow(lobe,.46))*(1 + (nz[i]-.5)*.05);
    const edge = sstep(r, r-3.2, dist);
    if(edge <= 0) continue;
    const q = clamp(dist/r,0,1);
    const ridge = Math.pow(lobe,1.35)*(1 - q*.5);
    const vein  = Math.sin(u*Math.PI*3.1 + q*3.4)*.5 + .5;
    H[i] = ridge + vein*.09*lobe + (1-q)*.34 + nz[i]*.04;
    A[i] = edge; Q[i] = q; Lb[i] = lobe;
  }
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i = y*S+x; if(A[i] <= 0) continue;
    const q = Q[i];
    shade(H,S,S,i,x,y, 26, 46);
    let t = .20 + _dif*.44 + (1-q)*.34;
    t += sstep(.70,1,q)*.26;
    t += Math.max(-(y-m)/R,0)*.06;
    let col = ramp(petal, clamp(t,0,1));
    col = mixc(col, [255,246,252], clamp(_spc,0,1)*.55);
    col = mixc(col, hex2rgb('#ff8ec6'), Math.pow(1-Lb[i],3)*.30);
    if(q < .38){
      const kk = sstep(.38,.04,q);
      col = mixc(col, hex2rgb('#fff6d8'), kk*.80);
      col = mixc(col, [255,255,255], Math.pow(kk,4)*.9);
    }
    d[i*4] = col[0]; d[i*4+1] = col[1]; d[i*4+2] = col[2]; d[i*4+3] = 255*A[i];
  }
  c.putImageData(img,0,0);
  return texFromCanvas(cv);
}

/* ---- topak alanı: üst üste binen küreler -> organik kütle ---- */
function blobField(S, seeds){
  const F = new Float32Array(S*S);
  for(const b of seeds){
    const x0 = Math.max(0,(b.x-b.r)|0), x1 = Math.min(S,(b.x+b.r+1)|0);
    const y0 = Math.max(0,(b.y-b.r)|0), y1 = Math.min(S,(b.y+b.r+1)|0);
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
      const dx = (x-b.x)/b.r, dy = (y-b.y)/b.r;
      const q = dx*dx + dy*dy;
      if(q < 1){ const v = 1-q; F[y*S+x] += v*v*b.w; }
    }
  }
  return F;
}
/* ---- boss: assets/bacteria.png + hi-bit ışık geçişi ----
   Çizim olduğu gibi korunur; üstüne sahne ışığıyla (sol-üst) uyumlu bir
   kontur, kenar ışığı, sağ-alta iç gölge ve ıslak spekülar eklenir ki
   karakter boyanmış gibi dursun, yapıştırılmış gibi değil.                */
function silhouette(img, S, pad, color){
  const cv = makeCanvas(S,S), c = cv.getContext('2d');
  c.drawImage(img, pad, pad, S-pad*2, S-pad*2);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color; c.fillRect(0,0,S,S);
  return cv;
}
function texBossImage(img){
  const S = 448, pad = S*.10, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const body = silhouette(img, S, pad, '#ffffff');

  /* 1 — dışa taşan hastalık ışıması */
  c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(S/2,S/2,S*.26,S/2,S/2,S*.50);
  halo.addColorStop(0,   'rgba(150,240,90,.30)');
  halo.addColorStop(.55, 'rgba(120,215,70,.13)');
  halo.addColorStop(1,   'rgba(120,215,70,0)');
  c.fillStyle = halo; c.fillRect(0,0,S,S);
  c.globalCompositeOperation = 'source-over';

  /* 2 — koyu kontur: karakteri kaynayan zeminden ayırır */
  const ring = silhouette(img, S, pad, '#07240b');
  c.globalAlpha = .55;
  for(let k=0;k<12;k++){
    const a = k/12*Math.PI*2;
    c.drawImage(ring, Math.cos(a)*5, Math.sin(a)*5);
  }
  c.globalAlpha = 1;

  /* 3 — çizimin kendisi */
  c.drawImage(img, pad, pad, S-pad*2, S-pad*2);

  /* 4 — sağ-alt iç gölge: gövdeye hacim verir */
  const occ = silhouette(img, S, pad, '#0c2a12');
  const occC = occ.getContext('2d');
  occC.globalCompositeOperation = 'destination-out';
  occC.drawImage(body, -11, -14);
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = .46; c.drawImage(occ, 0, 0); c.globalAlpha = 1;

  /* 5 — sol-üst kenar ışığı: sahne ışığıyla aynı yönden */
  const rim = silhouette(img, S, pad, '#dcffd0');
  const rimC = rim.getContext('2d');
  rimC.globalCompositeOperation = 'destination-out';
  rimC.drawImage(body, 6, 9);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = .40; c.drawImage(rim, 0, 0); c.globalAlpha = 1;

  /* 6 — ıslak spekülar: sol üstte tek yumuşak parıltı */
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const sp = c.createRadialGradient(S*.36,S*.30,0,S*.36,S*.30,S*.26);
  sp.addColorStop(0,  'rgba(255,255,255,.34)');
  sp.addColorStop(.5, 'rgba(230,255,220,.10)');
  sp.addColorStop(1,  'rgba(230,255,220,0)');
  c.fillStyle = sp; c.fillRect(0,0,S,S);
  c.restore();
  c.globalCompositeOperation = 'source-over';
  return texFromCanvas(cv);
}

/* ---- boss yedeği: görsel yüklenemezse prosedürel iltihap kütlesi ---- */
function texBossProc(){
  const S = 384, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const img = c.createImageData(S,S), d = img.data, m = (S-1)/2, R = m*.92;
  const seeds = [{x:m, y:m, r:R*.78, w:1.15}];
  const pust = [];
  for(let k=0;k<8;k++){
    const a = k/8*Math.PI*2 + .35, dist = R*(.34 + (k%3)*.09);
    const rr = R*(.30 + ((k*7)%5)*.035);
    const bx = m + Math.cos(a)*dist, by = m + Math.sin(a)*dist;
    seeds.push({x:bx, y:by, r:rr, w:.78});
    if(k%2 === 0) pust.push({x: m + Math.cos(a)*dist*1.06, y: m + Math.sin(a)*dist*1.06, r: rr*.34});
  }
  const F = blobField(S, seeds);
  const grain = fbm(S,S,34,4242,3);
  const H = new Float32Array(S*S), A = new Float32Array(S*S),
        P = new Float32Array(S*S), Q = new Float32Array(S*S);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i = y*S+x;
    const f = F[i] + (grain[i]-.5)*.10;
    const e = sstep(.44, .62, f);
    if(e <= 0) continue;
    A[i] = e;
    H[i] = f*.85 + (grain[i]-.5)*.14;
    Q[i] = clamp((f-.44)/.75, 0, 1);            /* 0 = kenar, 1 = kütlenin göbeği */
  }
  for(const p of pust){                          /* püstül başları */
    const x0 = Math.max(0,(p.x-p.r)|0), x1 = Math.min(S,(p.x+p.r+1)|0);
    const y0 = Math.max(0,(p.y-p.r)|0), y1 = Math.min(S,(p.y+p.r+1)|0);
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
      const i = y*S+x; if(A[i] <= 0) continue;
      const q = Math.hypot(x-p.x,y-p.y)/p.r;
      if(q >= 1) continue;
      const v = (1-q*q);
      P[i] = Math.max(P[i], v);
      H[i] += v*v*.55;
    }
  }
  const cols = [hex2rgb('#170309'),hex2rgb('#44070f'),hex2rgb('#82121c'),
                hex2rgb('#bd2620'),hex2rgb('#e85a2c'),hex2rgb('#ffb072')];
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i = y*S+x; if(A[i] <= 0) continue;
    const q = Q[i];
    shade(H,S,S,i,x,y, 40, 26);
    const t = .06 + Math.max(_dif,0)*.52 + q*.30;
    let col = ramp(cols, clamp(t,0,1));
    col = mixc(col, hex2rgb('#ffd3a4'), clamp(_spc,0,1)*.62);            /* ıslak parlama */
    col = mixc(col, hex2rgb('#2c0308'), Math.pow(1-q,1.6)*.55);          /* loplar arası yarık */
    if(P[i] > 0){                                                        /* pürülan baş */
      const pv = P[i];
      col = mixc(col, hex2rgb('#f8d878'), sstep(.25,.85,pv)*.72);
      col = mixc(col, hex2rgb('#fffbe4'), Math.pow(clamp(pv,0,1),3)*.65);
    }
    col = mixc(col, hex2rgb('#ff7a3a'), sstep(.30,.02,q)*.30);           /* kenar sıcaklığı */
    col = mixc(col, hex2rgb('#180207'), sstep(.14,0,q)*.65);             /* dış kontur */
    d[i*4] = col[0]; d[i*4+1] = col[1]; d[i*4+2] = col[2]; d[i*4+3] = 255*A[i];
  }
  c.putImageData(img,0,0);
  return texFromCanvas(cv);
}

/* ---- minyonlar: 0 = kirpikli bakteri, 1 = topaklı mukus pıhtısı ---- */
function texMinion(kind){
  const S = 160, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const img = c.createImageData(S,S), d = img.data, m = (S-1)/2;
  const H = new Float32Array(S*S), A = new Float32Array(S*S), Q = new Float32Array(S*S);
  const n = warpField(S,S,58,kind?771:313,2,18);
  const cols = kind
    ? [hex2rgb('#2a1a04'),hex2rgb('#6d4a0d'),hex2rgb('#bf9522'),hex2rgb('#efd264'),hex2rgb('#fff7d4')]
    : [hex2rgb('#0b2207'),hex2rgb('#2c5c13'),hex2rgb('#6cb52c'),hex2rgb('#c6f57e'),hex2rgb('#f2ffd6')];
  if(kind === 1){
    const R = m*.80;
    const seeds = [{x:m, y:m, r:R*.62, w:1.1}];
    for(let k=0;k<4;k++){
      const a = k/4*Math.PI*2 + .6;
      seeds.push({x:m+Math.cos(a)*R*.34, y:m+Math.sin(a)*R*.30, r:R*(.34+ (k%2)*.07), w:.8});
    }
    const F = blobField(S, seeds);
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      const i = y*S+x;
      const f = F[i] + (n[i]-.5)*.12;
      const e = sstep(.44,.60,f);
      if(e <= 0) continue;
      A[i] = e; H[i] = f*.9 + (n[i]-.5)*.12;
      Q[i] = 1 - clamp((f-.44)/.7, 0, 1);
    }
  } else {
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      const i = y*S+x, dx = x-m, dy = y-m;
      const dist = Math.hypot(dx/1.32, dy), r = m*.56;
      const edge = sstep(r, r-3, dist);
      if(edge <= 0) continue;
      const q = clamp(dist/r,0,1);
      H[i] = (1-q*q)*1.1 + (n[i]-.5)*.30;
      A[i] = edge; Q[i] = q;
    }
  }
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i = y*S+x; if(A[i] <= 0) continue;
    const q = Q[i];
    shade(H,S,S,i,x,y, kind?32:18, 34);
    const t = .14 + Math.max(_dif,0)*.50 + (1-q)*.34;
    let col = ramp(cols, clamp(t,0,1));
    col = mixc(col, [255,255,255], clamp(_spc,0,1)*.5);
    if(q > .74) col = mixc(col, cols[4], sstep(.74,.96,q)*.40);
    if(q > .93) col = mixc(col, cols[0], sstep(.93,1,q)*.55);
    if(kind === 0 && q < .34) col = mixc(col, hex2rgb('#eaffc0'), sstep(.34,.05,q)*.5);
    d[i*4] = col[0]; d[i*4+1] = col[1]; d[i*4+2] = col[2]; d[i*4+3] = 255*A[i];
  }
  c.putImageData(img,0,0);
  if(kind === 0){
    c.lineCap = 'round';
    for(let k=0;k<14;k++){
      const a = k/14*Math.PI*2, wav = Math.sin(k*2.1)*.30;
      const x0 = m+Math.cos(a)*m*.50, y0 = m+Math.sin(a)*m*.40;
      const x1 = m+Math.cos(a+wav)*m*.86, y1 = m+Math.sin(a+wav)*m*.74;
      const mx = (x0+x1)/2 - wav*10, my = (y0+y1)/2;
      c.strokeStyle = 'rgba(120,200,70,.55)'; c.lineWidth = 4.5;
      c.beginPath(); c.moveTo(x0,y0); c.quadraticCurveTo(mx,my,x1,y1); c.stroke();
      c.strokeStyle = 'rgba(214,255,160,.85)'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(x0,y0); c.quadraticCurveTo(mx,my,x1,y1); c.stroke();
    }
  }
  return texFromCanvas(cv);
}

/* ---- güçlendirme: fasetli cam ampul ---- */
function texPowerup(meta){
  const S = 128, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const m = S/2, R = S*.40;
  const hex = (rad)=>{ c.beginPath();
    for(let k=0;k<6;k++){ const a = -Math.PI/2 + k*Math.PI/3;
      const X = m+Math.cos(a)*rad, Y = m+Math.sin(a)*rad;
      if(k) c.lineTo(X,Y); else c.moveTo(X,Y); }
    c.closePath(); };
  const halo = c.createRadialGradient(m,m,R*.4,m,m,R*1.5);
  halo.addColorStop(0, meta.color+'55'); halo.addColorStop(1, meta.color+'00');
  c.fillStyle = halo; c.fillRect(0,0,S,S);
  hex(R);
  const body = c.createLinearGradient(m-R,m-R,m+R*.6,m+R);
  body.addColorStop(0,  'rgba(232,252,255,.34)');
  body.addColorStop(.38,'rgba(11,26,38,.94)');
  body.addColorStop(1,  'rgba(6,16,24,.98)');
  c.fillStyle = body; c.fill();
  const inner = c.createRadialGradient(m,m+R*.18,0,m,m,R);
  inner.addColorStop(0, meta.color+'88'); inner.addColorStop(.7, meta.color+'1e');
  inner.addColorStop(1, meta.color+'00');
  c.fillStyle = inner; hex(R); c.fill();
  c.lineJoin = 'round';
  hex(R); c.lineWidth = 3.4; c.strokeStyle = meta.color; c.stroke();
  hex(R); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  hex(R*.72); c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.18)'; c.stroke();
  c.save(); hex(R*.98); c.clip();
  const gl = c.createLinearGradient(m-R,m-R,m,m+R*.2);
  gl.addColorStop(0,'rgba(255,255,255,.42)'); gl.addColorStop(.55,'rgba(255,255,255,.05)');
  gl.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle = gl; c.fillRect(0,0,S,S);
  c.restore();
  c.font = '700 48px "Roboto Condensed","Arial Narrow",Helvetica,sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(meta.letter, m, m+4);
  c.shadowColor = meta.color; c.shadowBlur = 20;
  c.fillStyle = '#ffffff'; c.fillText(meta.letter, m, m+2);
  c.shadowBlur = 0;
  return texFromCanvas(cv);
}
function texGrain(){
  const S = 256, cv = makeCanvas(S,S), c = cv.getContext('2d');
  const img = c.createImageData(S,S), d = img.data;
  for(let i=0;i<S*S;i++){
    const v = 110 + (Math.random()-.5)*52;
    d[i*4]=v*.92; d[i*4+1]=v; d[i*4+2]=v*1.05; d[i*4+3]=255;
  }
  c.putImageData(img,0,0);
  return texFromCanvas(cv);
}

/* =========================================================================
   Açığa çıkan resim: sağlıklı mukoza + siklamen.
   Önce yükseklik / albedo / parlaklık / maske tamponları doldurulur,
   sonra tek geçişte ışıklandırılır — düz boyama yerine hacimli resim.
   ========================================================================= */
const bgCanvas = makeCanvas(HW,HH);
const HGT = new Float32Array(HW*HH);
const ALB = new Float32Array(HW*HH*3);
const GLS = new Float32Array(HW*HH);
const OCC = new Float32Array(HW*HH);
const MSK = new Uint8Array(HW*HH);

function putAlb(i, col, k){
  const j = i*3;
  ALB[j]   += (col[0]-ALB[j])*k;
  ALB[j+1] += (col[1]-ALB[j+1])*k;
  ALB[j+2] += (col[2]-ALB[j+2])*k;
}
function paintHealthy(L){
  const c = bgCanvas.getContext('2d');
  const img = c.createImageData(HW,HH), d = img.data;
  const warm = L.day >= 7;
  HGT.fill(0); GLS.fill(0); OCC.fill(0); MSK.fill(0);
  /* albedolar ışıksız orta tonlardır; aralığı aydınlatma üretir */
  const muc = [hex2rgb('#0c2c39'), hex2rgb('#135464'), hex2rgb(warm?'#1d8283':'#18809a'),
               hex2rgb(warm?'#36bdad':'#31aec4'), hex2rgb(warm?'#79ecd4':'#74e1f0')];
  const leafC = [hex2rgb('#0b2f22'),hex2rgb('#1a6440'),hex2rgb('#39a668'),hex2rgb('#86dfa6')];
  /* Mukoza geniş ve yumuşak dalgalanır. İnce gürültüyü yükseklik alanına
     karıştırmak yüzeyi buruşuk folyoya çeviriyordu; ince detay artık yalnız
     albedoda ve zayıf bir parlaklık modülasyonunda yaşıyor — uzun oyunda
     göz yormayan, sakin bir zemin. */
  const relief = warpField(HW,HH,108,1777,3,24);
  const micro  = fbm(HW,HH,27,5051,2);
  const caps   = fbm(HW,HH,9,8231,2);              /* ince kılcal ağı */

  /* --- 1. geçiş: yüzey tanımı --- */
  for(let y=0;y<HH;y++) for(let x=0;x<HW;x++){
    const i = y*HW+x;
    const core = clamp(1 - Math.hypot((x/HW-.5)*1.5,(y/HH-.5)*1.55), 0, 1);
    HGT[i] = relief[i]*.94 + micro[i]*.05;
    GLS[i] = .19 + micro[i]*.15;
    const t = clamp(relief[i]*.54 + micro[i]*.14 + core*.42 - .10, 0, 1);
    const j = i*3, col = ramp(muc, t);
    ALB[j] = col[0]; ALB[j+1] = col[1]; ALB[j+2] = col[2];
  }
  /* --- siklamen (Cyclamen persicum) ---
     Gerçek bitkinin iki imzası var: kalp biçimli, kertikli kenarlı, gümüş
     nakışlı yaprak rozeti; ve sapın tepesinde öne kıvrılan çiçekler —
     boğaz aşağı bakar, beş taçyaprak boğazdan yukarı devrilip aynı yöne
     burkulur (badminton topu silueti). Aşağıdaki geometri bunu kurar. */
  const PX = HW*.5, PY = HH*.76, LR = HH*.160;
  const marble = fbm(HW,HH,26,4517,2);
  const silver = hex2rgb('#d8eede');
  const stemC  = hex2rgb('#27673f');
  const stemLt = hex2rgb('#58a86c');
  const petalC = [hex2rgb('#3d0524'),hex2rgb('#8c0f52'),hex2rgb('#cf2a83'),
                  hex2rgb('#ff62ad'),hex2rgb('#ffb2d8'),hex2rgb('#ffe6f2')];

  /* ---- yaprak rozeti ---- */
  /* arkadan öne sıralı: her yaprak bir öncekinin üstüne biner */
  const LEAF_A = [-.16, 1.16, .02, .98, .22, .78, .42, .60];
  for(let k=0;k<LEAF_A.length;k++){
    const ang = Math.PI*LEAF_A[k];
    const lr  = LR*(.74 + Math.sin(k*2.1)*.11);
    const cxp = PX + Math.cos(ang)*LR*1.44, cyp = PY + Math.sin(ang)*LR*.60 + LR*.02;
    /* sapın yaprağa bağlandığı nokta: damarlar buradan yelpaze gibi açılır */
    const ax = cxp - Math.cos(ang)*lr*.82, ay = cyp - Math.sin(ang)*lr*.60;
    const x0 = Math.max(0,(cxp-lr*1.6)|0), x1 = Math.min(HW,(cxp+lr*1.6)|0);
    const y0 = Math.max(0,(cyp-lr*1.5)|0), y1 = Math.min(HH,(cyp+lr*1.5)|0);
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
      const i = y*HW+x;
      const dx = x-cxp, dy = (y-cyp)*1.16;            /* yatık bakış: dikeyde hafif basık */
      const dd = Math.hypot(dx,dy);
      let tt = Math.atan2(dy,dx) - ang;
      while(tt < -Math.PI) tt += Math.PI*2;
      while(tt >  Math.PI) tt -= Math.PI*2;
      const at = Math.abs(tt);
      /* Kalp (kordat) siluet: dışa bakan sivri uç, tabanda iki dolgun lop ve
         aralarında sapa inen derin kertik. Üç terim bunu doğrudan kurar —
         yuvarlak gövdeyi kertikle ısırmak amip siluetleri üretiyordu. */
      let rr = lr*(.70 + .30*Math.cos(tt));                            /* uca sivrilen gövde */
      rr += lr*.30*Math.exp(-Math.pow((at-2.10)/.55,2));               /* taban lopları */
      rr -= lr*.20*Math.exp(-Math.pow((at-Math.PI)/.50,2));            /* kertik */
      rr *= 1 + .022*Math.sin(tt*6 + k*1.7);                           /* hafif kertikli kenar */
      if(rr <= 1) continue;
      const e = sstep(rr, rr-2.2, dd);
      if(e <= 0) continue;
      const lq = clamp(dd/rr,0,1);
      /* gümüş nakış: kenara paralel at nalı bant; merkez ve kenar yeşil kalır */
      let mb = 1 - Math.pow((lq-.62)/.15, 2);
      mb = mb > 0 ? mb*(.12 + marble[i]*1.20)*sstep(3.0,1.8,at) : 0;
      /* damarlar: sap dibinden yelpaze */
      const va = Math.atan2((y-ay)*1.16, x-ax) - ang;
      const vn = Math.pow(Math.abs(Math.sin(va*4.2)), 10);
      let col = ramp(leafC, clamp(.22 + (1-lq)*.34 + marble[i]*.16, 0, 1));
      col = mixc(col, silver, clamp(mb,0,1)*.58);
      col = mixc(col, leafC[3], vn*.34);
      /* koyu kenar: bitişik yapraklar tek yeşil kütleye karışmasın */
      col = mixc(col, leafC[0], sstep(.86,1,lq)*.66);
      putAlb(i, col, e);
      /* Yükseklik biriktirilmez, bir platoya oturtulur: üst üste binen yapraklar
         yoksa uçurum gibi eğimler üretip tek bir karnabahar kütlesine dönüşüyor.
         Her yaprak kendi katında durur, sınırda yalnız ince bir basamak kalır. */
      const lh = .52 + k*.022 + (1-lq)*.09;
      if(lh > HGT[i]) HGT[i] += (lh-HGT[i])*e;
      GLS[i] += (.10-GLS[i])*e*.7;
      if(e > .5) MSK[i] = 1;
    }
  }

  /* ---- tek taçyaprak: boğazdan çıkıp yukarı devrilen burkuk dil ---- */
  function petal(ex, ey, dir, len, wid, bend, dark){
    const reach = len + wid + 3;
    const x0 = Math.max(0,(ex-reach)|0), x1 = Math.min(HW,(ex+reach)|0);
    const y0 = Math.max(0,(ey-reach)|0), y1 = Math.min(HH,(ey+reach)|0);
    const bw = x1-x0, bh = y1-y0;
    if(bw <= 0 || bh <= 0) return;
    const COV = new Float32Array(bw*bh),
          LQ = new Float32Array(bw*bh), SG = new Float32Array(bw*bh);
    const nx = -Math.sin(dir), ny = Math.cos(dir);     /* eksenin dikeyi */
    const N = 64;
    for(let s=0;s<=N;s++){
      const t = s/N;
      const sw = Math.sin(t*Math.PI)*bend;             /* burkulma */
      const cax = ex + Math.cos(dir)*len*t + nx*sw;
      const cay = ey + Math.sin(dir)*len*t + ny*sw;
      /* dipte dar, üst ortada geniş, uçta yuvarlak */
      const rad = wid*Math.pow(Math.sin(Math.PI*clamp(t*.86+.10,0,1)), .58);
      if(rad <= .4) continue;
      const px0 = Math.max(x0,(cax-rad)|0), px1 = Math.min(x1,(cax+rad+2)|0);
      const py0 = Math.max(y0,(cay-rad)|0), py1 = Math.min(y1,(cay+rad+2)|0);
      for(let y=py0;y<py1;y++) for(let x=px0;x<px1;x++){
        const dxp = x-cax, dyp = y-cay, dd = Math.hypot(dxp,dyp);
        const e = sstep(rad, rad-1.7, dd);
        if(e <= 0) continue;
        const j = (y-y0)*bw + (x-x0);
        if(e > COV[j]){ COV[j] = e; LQ[j] = clamp(dd/rad,0,1); SG[j] = (dxp*nx + dyp*ny)/rad; }
      }
    }
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
      const j = (y-y0)*bw + (x-x0), e = COV[j];
      if(e <= 0) continue;
      /* eksen boyu konum damgalardan değil, doğrudan izdüşümden okunur:
         damga indeksi basamaklı olduğu için taçyapraklara enine bant düşürüyordu */
      const tp = clamp(((x-ex)*Math.cos(dir) + (y-ey)*Math.sin(dir))/len, 0, 1);
      const i = y*HW+x, lq = LQ[j];
      /* boydan boya birkaç yumuşak damar — dantel dokusuna kaçmayacak kadar seyrek */
      const vein = Math.pow(Math.abs(Math.sin(SG[j]*2.3)), 10);
      /* dipte koyu boğaz, uca doğru açılan pembe */
      let col = ramp(petalC, clamp((.09 + tp*.64 + (1-lq)*.15 + vein*.05)*dark, 0, 1));
      col = mixc(col, petalC[5], sstep(.74,1,tp)*.24);
      col = mixc(col, petalC[0], sstep(.84,1,lq)*.48);
      putAlb(i, col, e);
      const ph = .92 + tp*.10 - lq*.07;              /* taçyapraklar en üst katta */
      if(ph > HGT[i]) HGT[i] += (ph-HGT[i])*e;
      GLS[i] += (.20-GLS[i])*e*.8;
      if(e > .5) MSK[i] = 1;
    }
  }
  /* kübik bezier */
  const bez = (P,t)=>{
    const it = 1-t, a = it*it*it, b = 3*it*it*t, c = 3*it*t*t, d = t*t*t;
    return [a*P[0]+b*P[2]+c*P[4]+d*P[6], a*P[1]+b*P[3]+c*P[5]+d*P[7]];
  };
  /* sap: tepede öne kıvrılıp boğaza inen boyun */
  function stem(P, r0, r1){
    for(let s=0;s<=340;s++){
      const t = s/340, p = bez(P,t), rad = r0 + (r1-r0)*t;
      const x0 = Math.max(0,(p[0]-rad)|0), x1 = Math.min(HW,(p[0]+rad+1)|0);
      const y0 = Math.max(0,(p[1]-rad)|0), y1 = Math.min(HH,(p[1]+rad+1)|0);
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
        const i = y*HW+x, dxp = x-p[0], dyp = y-p[1];
        const e = sstep(rad, rad-1.3, Math.hypot(dxp,dyp));
        if(e <= 0) continue;
        const lit = clamp(.5 - dxp/rad*.45 - dyp/rad*.30, 0, 1);
        putAlb(i, mixc(stemC, stemLt, lit*.65), e);
        if(HGT[i] < .84) HGT[i] += (.84-HGT[i])*e;   /* saplar yaprakların üstünde */
        GLS[i] += (.16-GLS[i])*e*.7;
        if(e > .5) MSK[i] = 1;
      }
    }
  }
  /* boğaz: taçyaprakların devrildiği koyu ağız ve soluk burun */
  function throat(ex, ey, fr){
    const R = fr*.40;
    const x0 = Math.max(0,(ex-R)|0), x1 = Math.min(HW,(ex+R+1)|0);
    const y0 = Math.max(0,(ey-R)|0), y1 = Math.min(HH,(ey+R+1)|0);
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
      const i = y*HW+x;
      const te = sstep(fr*.34, fr*.13, Math.hypot(x-ex,(y-ey)*1.12));
      if(te > 0){ putAlb(i, petalC[0], te*.88); HGT[i] += te*.14; if(te > .5) MSK[i] = 1; }
      const ne = sstep(fr*.17, fr*.05, Math.hypot(x-ex,(y-ey-fr*.13)*1.25));
      if(ne > 0) putAlb(i, mixc(petalC[1], hex2rgb('#ffdcec'), .40), ne*.70);
    }
  }

  /* ---- çiçekler: arkadakiler önce, koyu; öndekiler sonra, parlak ---- */
  const PET_A = [-2.62, -2.09, -1.5708, -1.05, -0.52];
  const PET_D = [.80, .92, 1, .92, .80];
  const PET_O = [0, 4, 1, 3, 2];
  const FLW = [
    {dx:-LR*1.30, h:LR*1.68, fr:LR*.41, rot:-.34},
    {dx: LR*1.32, h:LR*1.50, fr:LR*.39, rot: .40},
    {dx:-LR*.46,  h:LR*2.52, fr:LR*.52, rot:-.13},
    {dx: LR*.58,  h:LR*2.12, fr:LR*.47, rot: .18}
  ];
  for(const F of FLW){
    const ex = PX + F.dx, ey = PY - F.h, sgn = F.dx >= 0 ? 1 : -1;
    stem([ PX + F.dx*.10, PY,
           PX + F.dx*.32, PY - F.h*.58,
           ex + sgn*F.fr*1.00, ey - F.fr*.82,
           ex, ey ], 3.4, 1.9);
    for(const k of PET_O){
      const mid = 1 - Math.abs(k-2)/2;
      petal(ex, ey, PET_A[k] + F.rot,
            F.fr*(1.22 + mid*.56), F.fr*(.26 + mid*.12), -F.fr*.26, PET_D[k]);
    }
    throat(ex, ey, F.fr);
  }
  /* açmamış tomurcuk: aynı boyun, aşağı sarkan kapalı üç yaprak */
  {
    const bx = PX + LR*.06, by = PY - LR*2.92, fr = LR*.21;
    stem([ PX, PY, PX - LR*.30, PY - LR*1.7, bx - fr*1.5, by - fr*1.1, bx, by ], 3.0, 1.7);
    for(const a of [1.34, 1.5708, 1.80]) petal(bx, by, a, fr*1.9, fr*.52, -fr*.18, .86);
  }

  /* --- temas gölgesi: bitki, mukozanın üzerine sağ-alta gölge düşürür --- */
  const ox = 9, oy = 12;
  for(let y=0;y<HH-oy;y++) for(let x=0;x<HW-ox;x++){
    if(MSK[y*HW+x]) OCC[(y+oy)*HW + x+ox] = 1;
  }

  /* --- 2. geçiş: aydınlatma --- */
  for(let y=0;y<HH;y++) for(let x=0;x<HW;x++){
    const i = y*HW+x, j = i*3;
    shade(HGT,HW,HH,i,x,y, 22, 18);
    const vig = clamp(1 - Math.hypot((x/HW-.5)*1.36,(y/HH-.5)*1.44)*1.05, 0, 1);
    const shaft = sstep(.25,.95, Math.sin((x*.5 + y*1.25)/HW*3.4)*.5+.5);
    let lum = .58 + Math.max(_dif,0)*.66;          /* taban yüksek, kontrast ılımlı */
    lum *= .89 + vig*.22;                          /* derinlik / vinyet */
    lum *= 1 + shaft*.10;
    if(!MSK[i] && OCC[i] > 0) lum *= .70;          /* bitkinin gölgesi */
    const sp = clamp(_spc,0,1)*GLS[i];
    let r = ALB[j]*lum + sp*225;
    let g = ALB[j+1]*lum + sp*246;
    let b = ALB[j+2]*lum + sp*255;
    /* siklamen kılcalları: temizlenmiş dokunun palete bağlı olmayan imzası */
    if(!MSK[i]){
      const cap = Math.pow(1-Math.abs(caps[i]*2-1), 13) * (.35 + lum*.8);
      r += (255-r)*cap*.20; g += (120-g)*cap*.17; b += (172-b)*cap*.17;
    }
    /* atmosferik derinlik: uzak/karanlık bölgeler maviye kaçar */
    const fog = (1-vig)*.13;
    r += (28-r)*fog; g += (72-g)*fog; b += (96-b)*fog;
    d[i*4]   = r < 0 ? 0 : (r > 255 ? 255 : r);
    d[i*4+1] = g < 0 ? 0 : (g > 255 ? 255 : g);
    d[i*4+2] = b < 0 ? 0 : (b > 255 ? 255 : b);
    d[i*4+3] = 255;
  }
  c.putImageData(img,0,0);
  /* hacimli ışık huzmeleri */
  c.globalCompositeOperation = 'lighter';
  for(let k=0;k<6;k++){
    const sx = rnd(-HW*.2, HW*1.1), w = rnd(HW*.05, HW*.16);
    const g = c.createLinearGradient(sx, 0, sx + HW*.28, HH);
    g.addColorStop(0,  'rgba(150,235,232,.085)');
    g.addColorStop(.5, 'rgba(110,210,220,.038)');
    g.addColorStop(1,  'rgba(110,210,220,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(sx,0); c.lineTo(sx+w,0); c.lineTo(sx+w+HW*.30,HH); c.lineTo(sx+HW*.30,HH);
    c.closePath(); c.fill();
  }
  /* kabarcıklar: kenar ışığı + spekülar nokta */
  for(let k=0;k<64;k++){
    const x = rnd(0,HW), y = rnd(0,HH), r = rnd(4,26), al = rnd(.04,.13);
    const g = c.createRadialGradient(x,y,r*.1,x,y,r);
    g.addColorStop(0,   'rgba(170,245,240,'+(al*.45)+')');
    g.addColorStop(.72, 'rgba(140,235,232,'+(al*.3)+')');
    g.addColorStop(.92, 'rgba(215,255,252,'+al+')');
    g.addColorStop(1,   'rgba(140,235,232,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,7); c.fill();
    c.fillStyle = 'rgba(255,255,255,'+(al*1.4)+')';
    c.beginPath(); c.arc(x-r*.3, y-r*.34, r*.15, 0, 7); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}

/* ---- hastalıklı doku rengi (alfa rasterRegion'da hesaplanır) ---- */
const tissueRGB = new Uint8ClampedArray(HW*HH*3);
let RIM_OUT = [255,150,90];
function paintTissue(L){
  const cols = L.pal.map(hex2rgb);
  const stops = [cols[0], cols[0], cols[1], cols[2], cols[3]];
  /* Kabuk oyunun ilk dakikalarında ekranın tamamını kaplıyor: iltihaplı ve
     doygun kalmalı ama yüksek frekanslı olmamalı, yoksa göz sürekli gürültü
     tarar. Kabartma iri, gölge yumuşak, damarlar seyrek. */
  const relief = warpField(HW,HH,96,L.day*977+31,3,26);
  const patch  = fbm(HW,HH,150,L.day*311+53,2);     /* iri ton dalgalanması */
  const ridged = fbm(HW,HH,22,L.day*613+7,3);
  RIM_OUT = cols[3];
  for(let y=0;y<HH;y++) for(let x=0;x<HW;x++){
    const i = y*HW+x;
    shade(relief,HW,HH,i,x,y, 18, 20);
    const core = clamp(1 - Math.hypot((x/HW-.5)*1.85,(y/HH-.5)*1.85), 0, 1);
    const vein = Math.pow(1-Math.abs(ridged[i]*2-1), 3.4);
    const t = clamp(relief[i]*.34 + patch[i]*.32 + Math.max(_dif,0)*.36 + core*.22, 0, 1);
    let col = ramp(stops, t);
    col = mixc(col, cols[3], vein*.34*(.30+core*.70)*(.4+patch[i]*.9));
    col = mixc(col, [255,236,214], clamp(_spc,0,1)*.24);
    col = mixc(col, cols[0], Math.pow(1-relief[i],2.4)*.38);
    const dk = .88 + Math.max(_dif,0)*.22;            /* kabuk mat kalir ama bogulmaz */
    tissueRGB[i*3]=col[0]*dk; tissueRGB[i*3+1]=col[1]*dk; tissueRGB[i*3+2]=col[2]*dk;
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
   6. SAHNE — katmanlı hi-bit kompozisyon
   zemin > kabuk (bevel + düşen gölge) > kenar ışığı + kromatik saçak >
   varlıklar > iz > ışıklar > hacimsel sis > tanecik > vinyet
   ========================================================================= */
const COARSE_FX = matchMedia('(pointer:coarse)').matches;
const app = await (async () => {
  const opts = { background:0x0d2839, antialias:true, powerPreference:'high-performance',
    resolution: Math.min(window.devicePixelRatio||1, COARSE_FX ? 1.75 : 2), autoDensity:true,
    width: window.innerWidth, height: window.innerHeight };
  if(MAJOR >= 8){ const a = new PIXI.Application(); await a.init(opts); return a; }
  return new PIXI.Application(opts);
})();
const view = (MAJOR>=8) ? app.canvas : app.view;
document.getElementById('app').insertBefore(view, document.getElementById('vig'));
const bootEl = document.getElementById('boot'); if(bootEl) bootEl.remove();
const BLEND_MUL = (PIXI.BLEND_MODES && PIXI.BLEND_MODES.MULTIPLY !== undefined)
  ? PIXI.BLEND_MODES.MULTIPLY : 'multiply';

const root = new PIXI.Container(), shakeRoot = new PIXI.Container();
shakeRoot.addChild(root); app.stage.addChild(shakeRoot);
const layerBG = new PIXI.Container(), layerRim = new PIXI.Container(),
      layerEnt = new PIXI.Container(), layerTrail = new PIXI.Container(),
      layerLight = new PIXI.Container(), layerHaze = new PIXI.Container(),
      layerGrain = new PIXI.Container();
root.addChild(layerBG, layerRim, layerEnt, layerTrail, layerLight, layerHaze, layerGrain);

const bgTex = texFromCanvas(bgCanvas);
const bgSprite = new PIXI.Sprite(bgTex);
bgSprite.anchor.set(.5); bgSprite.x = PFW/2; bgSprite.y = PFH/2;
bgSprite.width = PFW; bgSprite.height = PFH;
layerBG.addChild(bgSprite);

/* hastalıklı kabuk: RGBA tampon, alfa + bevel + düşen gölge ızgaradan türetilir */
const dzCanvas = makeCanvas(HW,HH), dzCtx = dzCanvas.getContext('2d');
const dzImg = dzCtx.createImageData(HW,HH);
const dzTex = texFromCanvas(dzCanvas);
const dzSprite = new PIXI.Sprite(dzTex);
dzSprite.width = PFW; dzSprite.height = PFH;
layerBG.addChild(dzSprite);

/* sınır ışıması: dar sıcak çekirdek + geniş renkli taşma */
const rimCanvas = makeCanvas(HW,HH), rimCtx = rimCanvas.getContext('2d');
const rimImg = rimCtx.createImageData(HW,HH);
const rimTex = texFromCanvas(rimCanvas);
const rimCore = new PIXI.Sprite(rimTex);
rimCore.width = PFW; rimCore.height = PFH; rimCore.blendMode = BLEND_ADD; rimCore.alpha = .95;
const rimBloom = new PIXI.Sprite(rimTex);
rimBloom.anchor.set(.5); rimBloom.x = PFW/2; rimBloom.y = PFH/2;
rimBloom.width = PFW*1.014; rimBloom.height = PFH*1.019;
rimBloom.blendMode = BLEND_ADD; rimBloom.alpha = .30;
/* kromatik saçak — bloom'un bir piksel kaymış siklamen kopyası */
const rimChroma = new PIXI.Sprite(rimTex);
rimChroma.anchor.set(.5); rimChroma.x = PFW/2 + 1.5; rimChroma.y = PFH/2 + 1;
rimChroma.width = PFW*1.006; rimChroma.height = PFH*1.008;
rimChroma.blendMode = BLEND_ADD; rimChroma.alpha = COARSE_FX ? .10 : .16; rimChroma.tint = 0xff6fb4;
layerRim.addChild(rimBloom, rimChroma, rimCore);

/* kenarı ızgara merdiveninden kurtaran organik çarpıtma alanı (hücre birimi) */
const EW_AMP = 0.58;
function edgeWarp(seed){
  const f = fbm(HW,HH,20,seed,2);
  for(let i=0;i<f.length;i++) f[i] = (f[i]-.5)*2*EW_AMP;
  return f;
}
const ewX = edgeWarp(20101), ewY = edgeWarp(60607);

function coverAt(gx,gy){
  const ix = Math.floor(gx), tx = gx-ix, iy = Math.floor(gy), ty = gy-iy;
  const ya = clamp(iy,0,GH-1)*GW, yb = clamp(iy+1,0,GH-1)*GW;
  const xa = clamp(ix,0,GW-1), xb = clamp(ix+1,0,GW-1);
  const a = cells[ya+xa]===FILL?0:1, b = cells[ya+xb]===FILL?0:1;
  const c = cells[yb+xa]===FILL?0:1, e = cells[yb+xb]===FILL?0:1;
  const top = a+(b-a)*tx, bot = c+(e-c)*tx;
  return top+(bot-top)*ty;
}
/* alfa, bevel, düşen gölge ve çift tonlu kenar bandını tek geçişte üret */
function rasterRegion(cx0, cy0, cx1, cy1){
  const x0 = clamp((cx0-2)*SC, 0, HW), x1 = clamp((cx1+3)*SC, 0, HW);
  const y0 = clamp((cy0-2)*SC, 0, HH), y1 = clamp((cy1+3)*SC, 0, HH);
  const dd = dzImg.data, rd = rimImg.data;
  const ro0 = RIM_OUT[0], ro1 = RIM_OUT[1], ro2 = RIM_OUT[2];
  for(let py=y0;py<y1;py++){
    const gy0 = (py+.5)/SC - .5;
    for(let px=x0;px<x1;px++){
      const i = py*HW+px;
      const gx = (px+.5)/SC - .5 + ewX[i], gy = gy0 + ewY[i];
      const v = coverAt(gx,gy);
      const vs = v*v*(3-2*v);
      /* ışık sol-üstten: kabuk sağ-alta gölge düşürür */
      const vh = coverAt(gx+1.55, gy+2.05);
      const shadow = vh*vh*(3-2*vh) - vs;
      /* sınırın hemen içinde aydınlanan kabuk sırtı */
      let cb = 1 - (vs-.72)*(vs-.72)*25;
      if(cb < 0) cb = 0; else cb = cb*cb*.42;
      let r = tissueRGB[i*3], g = tissueRGB[i*3+1], b = tissueRGB[i*3+2];
      if(cb > 0){ r += (255-r)*cb; g += (226-g)*cb; b += (196-b)*cb; }
      let a = vs;
      if(shadow > 0){
        const aS = shadow*(1-vs)*.80;
        a += aS;
        if(a > 1) a = 1;
        const w = aS/(a || 1);
        r += (4-r)*w; g += (11-g)*w; b += (18-b)*w;
      }
      dd[i*4] = r; dd[i*4+1] = g; dd[i*4+2] = b; dd[i*4+3] = a*255;
      /* kenar bandı */
      const band = 4*vs*(1-vs), b2 = band*band, b4 = b2*b2;
      const ca = b4*b2*band, ba = b2*.5;
      const tot = ca + ba + 1e-6;
      rd[i*4]   = (158*ca + ro0*ba)/tot;
      rd[i*4+1] = (244*ca + ro1*ba)/tot;
      rd[i*4+2] = (255*ca + ro2*ba)/tot;
      const ra = ca*212 + ba*150;
      rd[i*4+3] = ra > 255 ? 255 : ra;
    }
  }
  const w = x1-x0, h = y1-y0;
  if(w > 0 && h > 0){
    dzCtx.putImageData(dzImg, 0,0, x0,y0,w,h);
    rimCtx.putImageData(rimImg, 0,0, x0,y0,w,h);
    texUpdate(dzTex); texUpdate(rimTex);
  }
}

/* gömülü bakteri çizimi; yüklenemezse prosedürel kütleye düşülür */
const bacteriaImg = await new Promise(res=>{
  if(!window.BACTERIA_PNG) return res(null);
  const im = new Image();
  im.onload = ()=> res(im);
  im.onerror = ()=> res(null);
  im.src = window.BACTERIA_PNG;
});
/* çizimde gövde dokunun ~%48'i, dikenler ~%76'sı kadar yer kaplıyor:
   dikenlerin ucu çarpışma çemberinin hemen dışına düşsün diye büyütülür */
const BOSS_ART = bacteriaImg ? 1.50 : 1.0;

const TEX = {
  glow:   texRadial(256, [[0,'rgba(255,255,255,1)'],[.28,'rgba(255,255,255,.45)'],[1,'rgba(255,255,255,0)']]),
  ring:   texRadial(256, [[0,'rgba(255,255,255,0)'],[.42,'rgba(255,255,255,.10)'],
                          [.62,'rgba(255,255,255,.55)'],[.78,'rgba(255,255,255,.14)'],
                          [1,'rgba(255,255,255,0)']]),
  spark:  texRadial(64,  [[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']]),
  haze:   texRadial(512, [[0,'rgba(255,255,255,.55)'],[.5,'rgba(255,255,255,.18)'],[1,'rgba(255,255,255,0)']]),
  capsule:texCapsule(),
  smoke:  texSmoke(),
  player: texPlayer(),
  boss:   bacteriaImg ? texBossImage(bacteriaImg) : texBossProc(),
  mini:   [texMinion(0), texMinion(1)],
  pu:     PU_META.map(texPowerup),
  grain:  texGrain()
};

/* hacimsel sis — sahnede yavaşça sürüklenir */
const haze = [];
for(let k=0;k<(COARSE_FX?1:2);k++){
  const s = new PIXI.Sprite(TEX.haze);
  s.anchor.set(.5); s.width = s.height = PFH*(1.1 + k*.45);
  s.blendMode = BLEND_ADD; s.alpha = .05 - k*.012;
  s.tint = k ? 0x6fd8f0 : 0xff86c2;
  layerHaze.addChild(s); haze.push(s);
}

const grainSprite = new PIXI.Sprite(TEX.grain);
grainSprite.width = PFW*1.25; grainSprite.height = PFH*1.25;
grainSprite.blendMode = BLEND_ADD; grainSprite.alpha = COARSE_FX ? .014 : .020;
layerGrain.addChild(grainSprite);

/* sinematik vinyet — oyun alanının kendi köşe karartması */
const vigSprite = new PIXI.Sprite(texRadial(256, [
  [0,'rgba(255,255,255,1)'],[.6,'rgba(240,246,250,1)'],
  [.85,'rgba(222,232,240,1)'],[1,'rgba(188,203,216,1)']]));
vigSprite.width = PFW; vigSprite.height = PFH;
vigSprite.blendMode = BLEND_MUL; vigSprite.alpha = .44;
layerGrain.addChild(vigSprite);

const playerLight = new PIXI.Sprite(TEX.glow);
playerLight.anchor.set(.5); playerLight.width = playerLight.height = 260;
playerLight.blendMode = BLEND_ADD; playerLight.tint = 0xff6fb0; playerLight.alpha = .2;
layerLight.addChild(playerLight);

const playerShadow = new PIXI.Sprite(TEX.glow);
playerShadow.anchor.set(.5); playerShadow.width = playerShadow.height = 46;
playerShadow.tint = 0x000000; playerShadow.alpha = .38;
const playerGlow = new PIXI.Sprite(TEX.glow);
playerGlow.anchor.set(.5); playerGlow.width = playerGlow.height = 104;
playerGlow.blendMode = BLEND_ADD; playerGlow.tint = 0xff87c0; playerGlow.alpha = .5;
const playerSprite = new PIXI.Sprite(TEX.player);
playerSprite.anchor.set(.5); playerSprite.width = playerSprite.height = 32;
layerEnt.addChild(playerShadow, playerGlow, playerSprite);

function pool(container, make, n){
  const a = [];
  for(let i=0;i<n;i++){ const s = make(); s.visible = false; container.addChild(s); a.push(s); }
  return a;
}
const trailCore = pool(layerTrail, ()=>{ const s = new PIXI.Sprite(TEX.capsule);
  s.anchor.set(.5); s.tint = 0xeafffd; return s; }, 300);
const trailGlow = pool(layerTrail, ()=>{ const s = new PIXI.Sprite(TEX.capsule);
  s.anchor.set(.5); s.tint = 0x35e0d8; s.alpha = .34; s.blendMode = BLEND_ADD; return s; }, 300);
const particles = [];
const partSprites = pool(layerEnt, ()=>{ const s = new PIXI.Sprite(TEX.smoke);
  s.anchor.set(.5); s.blendMode = BLEND_ADD; return s; }, 300);

/* =========================================================================
   7. OYUN DURUMU
   ========================================================================= */
const G = {
  state:'title', levelIdx:0, level:LEVELS[0],
  score:0, lives:3,
  px:GW>>1, py:GH-B, frac:0, dir:0,
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
  overlay:$('overlay'), plate:$('plate'), fps:$('fps'), hint:$('hint')
};
if(UI.hint) UI.hint.textContent = COARSE_FX ? 'PARMAĞINI EKRANDA SÜRÜKLE' : 'OK TUŞLARI  ·  WASD';
function hideHint(){ if(UI.hint) UI.hint.classList.add('off'); }
let toastTimer = 0;
function toast(main, sub){
  UI.toastT.textContent = main;
  UI.toastS.textContent = sub || '';
  UI.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> UI.toast.classList.remove('on'), 1500);
}
function syncHUD(){
  const L = G.level;
  UI.day.textContent = String(L.day).padStart(2,'0');
  UI.name.textContent = L.name;
  UI.fill.style.width = (G.pct*100).toFixed(1)+'%';
  UI.goal.style.left = (L.target*100)+'%';
  const met = G.pct >= L.target;
  UI.pct.className = met ? 'met' : '';
  UI.pct.innerHTML = '<b>%'+Math.floor(G.pct*100)+'</b> temizlendi<i>|</i>hedef %'+Math.round(L.target*100);
  UI.score.textContent = G.score.toLocaleString('tr-TR');
  const dr = clamp(G.dose/G.doseMax,0,1);
  UI.dose.style.width = (dr*100)+'%';
  UI.dose.style.background = dr < .25
    ? 'linear-gradient(90deg,#8e2030,#ff5f7a)'
    : 'linear-gradient(90deg,#a97a16,#ffbb4d)';
  UI.dose.style.boxShadow = dr < .25 ? '0 0 10px rgba(255,95,122,.55)' : 'none';
  let lv = '';
  for(let i=0;i<3;i++) lv += '<div class="pip'+(i<G.lives?'':' off')+'"></div>';
  UI.lives.innerHTML = lv;
  let bf = '';
  for(const k in G.buffs){
    const m = PU_META.find(p=>p.key===k);
    bf += '<div class="buff">'+m.label+' · '+Math.ceil(G.buffs[k])+'s</div>';
  }
  if(G.dose <= 0) bf += '<div class="buff warn">Kalkan düştü</div>';
  UI.buffs.innerHTML = bf;
}
function dayStrip(idx){
  let h = '<div class=days>';
  for(let i=0;i<LEVELS.length;i++)
    h += '<i class="'+(i<idx ? 'done' : (i===idx ? 'now' : ''))+'"></i>';
  return h + '<b>' + Math.min(idx+1,LEVELS.length) + '/' + LEVELS.length + ' GÜN</b></div>';
}
function showPanel(html){ UI.plate.innerHTML = html; UI.overlay.classList.add('on');
  const b = UI.plate.querySelector('button[data-a]'); if(b) setTimeout(()=>b.focus(), 30); }
function hidePanel(){ UI.overlay.classList.remove('on'); }
UI.overlay.addEventListener('click', e=>{
  const b = e.target.closest('button[data-a]'); if(!b) return;
  Sound.init(); Sound.resume(); Sound.ui();
  doAction(b.dataset.a);
});
function doAction(a){
  if(a === 'start' || a === 'restart'){ G.levelIdx = 0; G.score = 0; G.lives = 3; introLevel(); }
  else if(a === 'go') startLevel();
  else if(a === 'next'){ G.levelIdx++; introLevel(); }
  else if(a === 'retry') startLevel();
  else if(a === 'resume'){ hidePanel(); G.state = 'play'; }
}
$('btnSound').onclick = () => {
  Sound.init(); Sound.resume();
  const on = Sound.toggle();
  $('btnSound').textContent = on ? 'SES' : 'SUS';
  $('btnSound').classList.toggle('off', !on);
};
$('btnPause').onclick = () => togglePause();
function togglePause(){
  if(G.state === 'play'){
    G.state = 'paused';
    showPanel(
      `<div class="kicker">DURAKLATILDI</div>
       <div class="title">Gün ${G.level.day}</div>
       <p class="lede">${G.level.name} · alanın %${Math.floor(G.pct*100)}’i temizlendi, hedef %${Math.round(G.level.target*100)}.</p>
       <div class="acts"><button class="cta" data-a="resume">DEVAM ET</button>
       <button class="ghost" data-a="restart">BAŞA DÖN</button></div>`);
  } else if(G.state === 'paused'){ hidePanel(); G.state = 'play'; }
}

/* =========================================================================
   9. GİRDİ
   ========================================================================= */
const keys = {};
addEventListener('keydown', e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key] = true; hideHint();
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
  hideHint();
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
  const g = new PIXI.Sprite(TEX.ring);
  g.anchor.set(.5); g.blendMode = BLEND_ADD; g.tint = 0x8ce84a; g.alpha = .4;
  layerEnt.addChild(g, s);
  return { x:GW/2+Math.cos(a)*GW*.16, y:GH/2+Math.sin(a)*GH*.16,
           vx:Math.cos(a+1)*L.bossSpd, vy:Math.sin(a+1)*L.bossSpd,
           r:L.bossR, spd:L.bossSpd, t:rnd(0,6), fireT:rnd(1,3), s:s, g:g };
}
function spawnMinion(L){
  const a = rnd(0,7), d = rnd(GH*.12, GH*.4), kind = Math.random()<.55?0:1;
  const s = new PIXI.Sprite(TEX.mini[kind]);
  s.anchor.set(.5); s.width = s.height = 34;
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
  G.dir=0; G.frac=0; G.px=GW>>1; G.py=GH-B; G.startCell=G.py*GW+G.px;
  G.doseMax=L.dose; G.dose=L.dose; G.buffs={}; G.invuln=1.2; G.shake=0;
  particles.length = 0;
  for(let i=0;i<L.bossN;i++) G.bosses.push(spawnBoss(L,i));
  for(let i=0;i<L.mini;i++)  G.minions.push(spawnMinion(L));
  const kinds = [PU.SPEED,PU.FREEZE,PU.LASER,PU.BOMB,PU.DOSE];
  for(let i=0;i<L.pu;i++){
    const k = kinds[i%kinds.length];
    const s = new PIXI.Sprite(TEX.pu[k]); s.anchor.set(.5); s.width = s.height = 38;
    const g = new PIXI.Sprite(TEX.glow);
    g.anchor.set(.5); g.width = g.height = 92; g.blendMode = BLEND_ADD; g.alpha = .3;
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
  const L = LEVELS[G.levelIdx];
  G.state = 'intro';
  setTimeout(()=> prepareLevel(G.levelIdx), 80);
  showPanel(
    `<div class="kicker">10 GÜNLÜK KÜR &nbsp;·&nbsp; GÜN ${String(L.day).padStart(2,'0')}</div>
     <div class="title">${L.name}</div>
     ${dayStrip(G.levelIdx)}
     <p class="note">${L.med}</p>
     <p class="lede">Alanın <b style="color:var(--aqua)">%${Math.round(L.target*100)}</b>’ini sağlıklı dokuya çevir.
        İltihap odağının bulunduğu bölge kapanmaz — onu köşeye sıkıştır.</p>
     <div class="acts"><button class="cta" data-a="go">DOZU UYGULA</button></div>`);
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
      if(G.drawing && G.corners.length){
        const lc = G.corners[G.corners.length-1];
        if(lc.x !== G.px || lc.y !== G.py) G.corners.push({x:G.px, y:G.py});
      }
      G.dir = want; G.frac = 0;
    } else if(want !== G.dir){
      const rev = want === OPP[G.dir];
      if(!(rev && G.drawing)){
        if(G.frac > .5) stepPlayer();
        G.frac = 0;
        if(G.drawing && G.corners.length) G.corners.push({x:G.px, y:G.py});
        G.dir = want;
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
    if(cells[p.y*GW+p.x] === FILL){ grabPowerup(p); p.s.destroy(); p.g.destroy(); G.pus.splice(k,1); }
  }
  const ns = Math.min(110, 14 + ((gain/32)|0));
  for(let n=0;n<ns;n++){
    const i = newCells[(Math.random()*newCells.length)|0];
    burst(i%GW, (i/GW)|0, 1, 0x9ff0ec, .7);
  }
  G.score += Math.round(gain*1.2);
  G.dose = clamp(G.dose + share*G.doseMax*2.2, 0, G.doseMax);
  Sound.capture(share);
  G.shake = Math.min(7, share*40);
  if(share >= MEGA_SHARE){
    G.score += 1500;
    toast('Mega drenaj', 'TEK HAMLEDE %'+Math.round(share*100)+' · +1500');
  }

  G.drawing = false; G.trail = []; G.corners = [];
  G.startCell = G.py*GW+G.px;
  if(G.pct >= G.level.target) levelClear();
  syncHUD();
}
function grabPowerup(p){
  const m = PU_META[p.k];
  Sound.pickup(); G.score += 400;
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
     ${dayStrip(G.levelIdx+1)}
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
  G.trail=[]; G.corners=[]; G.drawing=false; G.dir=0; G.frac=0;
  G.px = G.startCell % GW; G.py = (G.startCell/GW)|0;
  if(cells[G.startCell] !== FILL){ G.px = GW>>1; G.py = GH-B; }
  G.invuln = 1.8;
  G.dose = Math.max(G.dose, G.doseMax*.35);
  syncHUD();
  if(G.lives <= 0){
    G.state = 'over';
    showPanel(
      `<div class="kicker">TEDAVİ YARIM KALDI</div>
       <div class="title">Gün ${G.level.day}</div>
       <p class="lede">Enfeksiyon odağı alanı geri aldı. Kür kesintiye uğradığında semptomlar döner.</p>
       <div class="stats">
         <div><span>SKOR</span><b>${G.score.toLocaleString('tr-TR')}</b></div>
         <div><span>TEMİZLENEN</span><b>%${Math.floor(G.pct*100)}</b></div>
       </div>
       <div class="acts"><button class="cta" data-a="retry">GÜNÜ TEKRARLA</button>
       <button class="ghost" data-a="restart">1. GÜNDEN BAŞLA</button></div>`);
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
      life:rnd(.35,1), size:rnd(10,28)*(scale||1), tint:tint });
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
      const vert = a.x === b.x;
      const len = Math.max((vert ? Math.abs(b.y-a.y) : Math.abs(b.x-a.x))*CS, 3.5);
      s.visible = g.visible = true;
      s.x = g.x = ((a.x+b.x)/2 + .5)*CS;
      s.y = g.y = ((a.y+b.y)/2 + .5)*CS;
      s.rotation = g.rotation = vert ? Math.PI/2 : 0;
      s.width = len + 2.5; s.height = 4.2;
      g.width = len + 10;  g.height = 17;
    }
  }
  for(let i=n;i<trailCore.length;i++){
    if(!trailCore[i].visible) break;
    trailCore[i].visible = false; trailGlow[i].visible = false;
  }
}
let grainT = 0;
function render(dt){
  G.time += dt;
  const t = G.time;

  const dv = DIRV[G.dir];
  const pxp = (G.px + dv[0]*G.frac + .5)*CS, pyp = (G.py + dv[1]*G.frac + .5)*CS;
  playerSprite.x = playerGlow.x = playerLight.x = pxp;
  playerSprite.y = playerGlow.y = playerLight.y = pyp;
  playerShadow.x = pxp + 5; playerShadow.y = pyp + 7;
  playerSprite.rotation = Math.sin(t*1.1)*.10;
  /* dokunulmazlık yanıp sönmesi: strobos değil, yumuşak nabız */
  const blink = G.invuln > 0 ? .48 + Math.sin(t*16)*.32 : 1;
  playerSprite.alpha = blink;
  playerShadow.alpha = .34*blink;
  playerSprite.width = playerSprite.height = 32 + Math.sin(t*4.2)*1.5;
  playerGlow.alpha = (.32 + Math.sin(t*4.2)*.12) * blink * (G.drawing ? 1.5 : 1);
  playerGlow.width = playerGlow.height = 104 + Math.sin(t*4.2)*13;
  playerLight.alpha = (.14 + Math.sin(t*2.1)*.03) * (G.drawing ? 1.6 : 1);

  for(const b of G.bosses){
    /* karakterin yüzü var: dönmez, nefes alıp yalpalar */
    const pulse = 1 + Math.sin(b.t*2.1)*.045;
    const squash = Math.sin(b.t*2.1 + 1.1)*.055;
    const D = b.r*2*CS*BOSS_ART;
    b.s.x = b.g.x = b.x*CS; b.s.y = b.g.y = b.y*CS;
    b.s.width  = D*pulse*(1+squash);
    b.s.height = D*pulse*(1-squash);
    b.s.rotation = Math.sin(b.t*1.15)*.11 + Math.sin(b.t*.47)*.05;
    b.g.rotation -= dt*.21;                       /* ters dönen akkor halka */
    b.g.width = b.g.height = b.r*3.6*CS*pulse;
    b.g.alpha = .30 + Math.sin(b.t*2.7)*.12;
  }
  for(const m of G.minions){
    m.s.x = m.x*CS; m.s.y = m.y*CS;
    m.s.rotation += m.spin*dt;
  }
  for(const b of G.bullets){ b.s.x = b.x*CS; b.s.y = b.y*CS; }
  for(const s of G.shots){ s.s.x = s.x*CS; s.s.y = s.y*CS; }
  for(const p of G.pus){
    p.t += dt;
    const yy = (p.y+.5)*CS + Math.sin(p.t*2.1)*3.5;
    p.s.x = p.g.x = (p.x+.5)*CS; p.s.y = p.g.y = yy;
    p.s.rotation = Math.sin(p.t*1.3)*.14;
    const vis = cells[p.y*GW+p.x] === EMPTY;
    p.s.visible = p.g.visible = vis;
    p.g.alpha = .24 + Math.sin(p.t*3.4)*.11;
  }
  drawTrail();

  /* ---- atmosfer ---- */
  const breath = 1 + Math.sin(t*.42)*.006;
  bgSprite.width  = PFW*breath;
  bgSprite.height = PFH*breath;
  bgSprite.x = PFW/2 - (pxp - PFW/2)*.014;         /* ince derinlik kayması */
  bgSprite.y = PFH/2 - (pyp - PFH/2)*.014;
  const warmth = .5 + Math.sin(t*.9)*.5;           /* kabuğun nabzı */
  dzSprite.tint = 0xff0000 | ((255 - (warmth*10|0)) << 8) | (255 - (warmth*20|0));
  rimCore.alpha = .88 + Math.sin(t*2.3)*.09;
  rimBloom.alpha = .27 + Math.sin(t*1.7)*.05;
  rimChroma.x = PFW/2 + Math.sin(t*.8)*1.8;
  for(let k=0;k<haze.length;k++){
    const s = haze[k], ph = t*(.05 + k*.028);
    s.x = PFW*(.5 + Math.sin(ph + k*2.1)*.26);
    s.y = PFH*(.5 + Math.cos(ph*1.27 + k*1.4)*.24);
  }
  /* tanecik her karede zıplarsa tüm ekran 60 Hz titrer ve uzun oturumda
     gözü yorar; saniyede ~7 kez kaydırmak dokuyu verir, titremeyi vermez */
  if(t - grainT > .14){ grainT = t;
    grainSprite.x = -rnd(0, PFW*.2);
    grainSprite.y = -rnd(0, PFH*.2);
  }

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
  const portrait = h > w;
  /* dokunmatik dikeyde: tahta yukarı, alt yarısı başparmak alanı olarak kalsın */
  const bottom = isTouch ? (portrait ? 28 : 62) : 54;
  const availW = w - (isTouch ? 12 : 24), availH = Math.max(60, h - top - bottom);
  const s = Math.min(availW/PFW, availH/PFH);
  root.scale.set(s);
  root.x = (w - PFW*s)/2;
  root.y = (isTouch && portrait) ? top + 4 : top + (availH - PFH*s)/2;
}
addEventListener('resize', layout);
addEventListener('orientationchange', ()=> setTimeout(layout,180));
if(window.visualViewport) visualViewport.addEventListener('resize', ()=> setTimeout(layout,60));

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
    if(buffChanged || Math.floor(G.time*4) !== Math.floor((G.time-dt)*4)) syncHUD();
  } else {
    updateParticles(dt*.4);
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
showPanel(
  `<div class="kicker">NASODREN &nbsp;·&nbsp; SİKLAMEN EKSTRESİ</div>
   <div class="title">Sinüsleri <em>geri kazan</em>.</div>
   <p class="lede">Bir siklamen damlasısın. Tıkalı sinüs boşluğuna girip çizgiyle alan kapatıyorsun;
      kapattığın her bölge mukustan arınıp oksijenli sağlıklı dokuya dönüşüyor.</p>
   <div class="keys">
     <b>OK / WASD</b><span>hareket</span>
     <b>DOKUNMATİK</b><span>ekranda parmağını sürükle</span>
     <b>P</b><span>duraklat &nbsp;·&nbsp; F fps</span>
   </div>
   <p class="note">Çizgi çizerken hem sen hem arkanda bıraktığın iz savunmasız.
      Güvenli bölgede beklemek <b>doz kalkanını</b> eritir; kalkan bitince ağrı dalgaları seni orada da vurur.</p>
   <div class="acts"><button class="cta" data-a="start">TEDAVİYE BAŞLA</button></div>`);

};
