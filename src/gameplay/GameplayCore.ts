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
import minionFlagellaAssetUrl from '../../assets/minion_flagella.png'; // kind:0 minion
import minionSporeAssetUrl from '../../assets/minion_spore.png';       // kind:1 minion
import healthAssetUrl from '../../assets/health.png'; // GOAL-013: can ikonu
// GOAL-020: arka plan müziği motoru (prosedürel + assets/music dosya yuvası)
import { createMusic } from '../audio/Music';
// GOAL-018: siklamen geri döndü — artık tüm bölümlerin zemininde değil, ilacın
// kendisinin konu olduğu günün (Koruma modu) bilgi görseli olarak.
import flowerAssetUrl from '../../assets/siclament.png';

/* GOAL-016: bölüm arka planları için asset yuvası.
   assets/bg/ klasörüne bırakılan her PNG otomatik bulunur; dosya adı hangi
   bölümde kullanılacağını söyler:
     day01.png ... day10.png  → o güne özel arka plan
     vestibule.png / meatus.png / sinus.png → o kesit arketipinin tamamı
   Hiç dosya yoksa oyun prosedürel arka planı çizmeye devam eder, yani sanat
   gelene kadar hiçbir şey bozulmaz. */
const BG_GLOB = import.meta.glob('../../assets/bg/*.png', { eager:true, import:'default' });

/* GOAL-018: bölüm bilgi görseli için ayrı asset yuvası. assets/plate/ içine
   bırakılan day01.png ... day10.png, o günün merkez görselinin yerine geçer —
   gerçek bir bilimsel fotoğraf/illüstrasyon gelince kod değişmeden devreye
   girsin diye. Boşken prosedürel doğal çizim kullanılır. */
const PLATE_GLOB = import.meta.glob('../../assets/plate/*.png', { eager:true, import:'default' });

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
/* GOAL-022 (revize): ızgara her cihazda AYNI — 160x120.
   Bir ara telefonlar için ızgarayı 120x160'a çevirip kesitleri o orana
   esnetmiştim; alan büyüyordu ama oyun PC'dekiyle aynı oyun olmaktan
   çıkıyordu: mesafeler uzuyor, konka/septum çıkıntıları geriliyor, kesit
   "uzamış" görünüyordu. Doğru çözüm geometriyi bozmak değil, ÇERÇEVEYİ
   düzeltmek: alanın kenarlarındaki bomboş kemik payını ekran dışında
   bırakıp boşluğun kendisini ekrana oturtmak (bkz. cavBB + layout).
   Böylece telefonda da masaüstünde de tıpatıp aynı saha oynanıyor. */
const GW = 160, GH = 120, B = 3, CS = 6;
const PFW = GW*CS, PFH = GH*CS;
const SC = 3, HW = GW*SC, HH = GH*SC;
/* GOAL-015: oyun alani artik dikdortgen degil, burun/sinus boslugu. Yuzde
   hesabi sabit INTERIOR yerine cavCount uzerinden yapiliyor (bkz. bolum 4b). */
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
/* -------------------------------------------------------------------------
   GOAL-015 — NEFES KATMANI
   Her güne bir burun/sinüs kesiti (cav), bir nefes ritmi (breath: kaç saniyede
   bir vücut nefes almayı deniyor) ve tıkalı nefesin basınç bedeli (pressGain)
   düşüyor. detail, aynı kesitin içine eklenen konka/polip çıkıntılarının
   sayısı — aynı arketip gün ilerledikçe daralıyor.
   ------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------
   GOAL-024 — ANATOMİK YOLCULUK
   Bölümler artık assets/sinuzit.png'deki koronal kesitten türüyor. Beş bölge,
   her birine iki gün; sıra tıbben de doğru olan drenaj sırası: ilaç burundan
   giriyor, önce bütün sinüslerin ortak kapısı (ostiomeatal kompleks) açılıyor,
   sonra sırayla maksiller, etmoid ve frontal boşalıyor.

   Her bölgenin iki günü sol ve sağ tarafı: aynı kesit, ikinci günde aynalanmış
   (bkz. buildCavity). Anatomik olarak doğru, oyuncu için de ezber bozuyor.
   ------------------------------------------------------------------------- */
const REGIONS = {
  nasal: { name:'Burun boşluğu', cav:'vestibule', music:'vestibule',
    about:'İlacın girdiği yer. Konkalar şişmiş, hava akımı daralmış; yolculuk buradan başlıyor.' },
  omc: { name:'Ostiomeatal kompleks', cav:'meatus', music:'meatus',
    about:'Bütün sinüslerin ortak kapısı. Burası açılmadan hiçbiri boşalmaz; bu yüzden ilk hedef.' },
  maxillary: { name:'Maksiller sinüs', cav:'maxillary', music:'meatus',
    about:'Yanak kemiğindeki en büyük boşluk. Ostiumu tavanda olduğu için yerçekimine karşı boşalır.' },
  ethmoid: { name:'Etmoid hücreler', cav:'ethmoid', music:'sinus',
    about:'Gözlerin arasındaki petek. Onlarca küçük hücre, her biri dar bir boyunla bağlı ve ayrı ayrı tıkanıyor.' },
  frontal: { name:'Frontal sinüs', cav:'frontal', music:'sinus',
    about:'Alındaki boşluk. Kanalı en uzun, ostiumu en tepede; yayın en zor durağı.' },
};
const DAY_REGION = ['nasal','nasal','omc','omc','maxillary','maxillary','ethmoid','ethmoid','frontal','frontal'];
const DAY_SIDE   = ['sol','sag','sol','sag','sol','sag','sol','sag','sol','sag'];
/* sinuzit.png üzerindeki normalize (0-1) konumlar — haritadaki iğneler */
const DAY_MAP = [[.44,.90],[.56,.90], [.43,.665],[.57,.665], [.24,.785],[.76,.785],
                 [.445,.50],[.555,.50], [.325,.165],[.675,.165]];
const DETAIL_BY_DAY = [0,1, 1,2, 1,2, 2,3, 2,3];   // hem bölgeler arasında hem bölge içinde daralıyor
/* GOAL-016: arka plan motifi, o günün konusunu anlatır. Açığa çıkan katman
   "tedavi edilmiş doku"dur; dolayısıyla tedavi yayının neresinde olduğumuzu
   göstermesi gerekir — tıkalı damarlar, boşalan mukus, çalışan siller, serbest
   hava. Oyuncu ekrana bakınca hangi aşamada olduğunu okuyabilsin diye. */
const MOTIF_BY_DAY = ['congestion','congestion','congestion','mucus','mucus',
                      'cilia','cilia','airflow','airflow','airflow'];
LEVELS.forEach((L,i) => {
  const R = REGIONS[DAY_REGION[i]];
  L.region    = DAY_REGION[i];
  L.regionName= R.name;
  L.regionAbout = R.about;
  L.side      = DAY_SIDE[i];
  L.sideName  = DAY_SIDE[i] === 'sag' ? 'SAĞ' : 'SOL';
  L.map       = DAY_MAP[i];
  L.music     = R.music;
  L.cav       = R.cav;
  L.detail    = DETAIL_BY_DAY[i];
  L.motif     = MOTIF_BY_DAY[i];
  L.breath    = 11.5 - i*0.5;      // gün 1: 11.5sn ... gün 10: 7sn
  L.pressGain = 0.15 + i*0.013;    // tıkalı nefesin basınç bedeli
});

const PLAYER_SPD = 38, PLAYER_SPD_FAST = 60, MEGA_SHARE = .12;

/* =========================================================================
   3. SES
   ========================================================================= */
/* GOAL-020: ses mimarisi.
   master
     ├── musicBus → arka plan müziği + ortam uğultusu
     └── sfxBus   → oyunun bütün efektleri
   Böylece "müziği kıs ama efektler kalsın" mümkün oluyor. Seviyeler
   localStorage'da tutuluyor; ayarlar ekranı (AYARLAR) bunları değiştiriyor. */
const AUDIO_KEY = 'nasodren_audio_v1';
const AudioPrefs = {
  master:.7, music:.6, sfx:.9, muted:false,
  load(){
    try{
      const o = JSON.parse(localStorage.getItem(AUDIO_KEY) || 'null');
      if(o && typeof o === 'object'){
        if(typeof o.master === 'number') this.master = clamp(o.master,0,1);
        if(typeof o.music  === 'number') this.music  = clamp(o.music,0,1);
        if(typeof o.sfx    === 'number') this.sfx    = clamp(o.sfx,0,1);
        this.muted = !!o.muted;
      }
    }catch(e){}
  },
  save(){
    try{ localStorage.setItem(AUDIO_KEY, JSON.stringify({
      master:this.master, music:this.music, sfx:this.sfx, muted:this.muted })); }catch(e){}
  }
};
AudioPrefs.load();

const Sound = {
  ctx:null, master:null, musicBus:null, sfxBus:null, music:null, noise:null,
  on:!AudioPrefs.muted, prefs:AudioPrefs,
  scenePend:{ name:'menu', day:0 },
  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC){ this.on = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate*2, buf = this.ctx.createBuffer(1,len,this.ctx.sampleRate), d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    this.noise = buf;
    this.ambient();
    this.music = createMusic(this.ctx, this.musicBus);
    this.music.setScene(this.scenePend.name, this.scenePend.day);
    this.apply();
  },
  resume(){ if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  /* Seviyeleri donanıma uygula. Müzik motoru tamamen kısıkken hiç çalışmasın
     diye durduruluyor — sessizce dönüp CPU yemesin. */
  apply(){
    this.on = !AudioPrefs.muted;
    if(!this.ctx) return;
    this.master.gain.value   = AudioPrefs.muted ? 0 : AudioPrefs.master;
    this.musicBus.gain.value = AudioPrefs.music;
    this.sfxBus.gain.value   = AudioPrefs.sfx;
    if(this.music){
      const want = !AudioPrefs.muted && AudioPrefs.master > .001 && AudioPrefs.music > .001;
      if(want) this.music.start(); else this.music.stop();
    }
  },
  set(which, v){
    AudioPrefs[which] = clamp(v,0,1);
    if(which !== 'muted' && AudioPrefs.muted && v > 0) AudioPrefs.muted = false;
    AudioPrefs.save();
    this.init(); this.resume(); this.apply();
  },
  /* Hangi bölümdeyiz / menüde miyiz — müzik buna göre değişiyor.
     Ses motoru henüz açılmamışsa (ilk dokunuş olmadan AudioContext kurulamaz)
     istek saklanır ve init sırasında uygulanır. */
  scene(name, day){
    this.scenePend = { name:name, day:day||0 };
    if(this.music) this.music.setScene(name, day||0);
  },
  tension(v){ if(this.music) this.music.setTension(v); },
  ambient(){
    const c = this.ctx, s = c.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = c.createGain(); g.gain.value = .02;
    const lfo = c.createOscillator(); lfo.frequency.value = .16;
    const lg = c.createGain(); lg.gain.value = .014;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.musicBus);
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
    s.connect(bp); bp.connect(g); g.connect(this.sfxBus);
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
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t+dur+.05);
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
  /* GOAL-015: nefes döngüsünün sesleri — hepsi mevcut air()/tone() ile */
  inhaleCue(){ this.air(1.0,150,540,.09,.9); },
  breathOpen(){ this.air(1.05,380,2400,.24,.8); [392,523,659].forEach((f,i)=>setTimeout(()=>this.tone(f,.4,'sine',.09),i*85)); },
  leak(){ this.air(.7,760,260,.16,2.4); this.tone(160,.3,'triangle',.07,96); },
  blocked(){ this.air(.6,250,70,.2,1.6); this.tone(86,.5,'sine',.18,40); },
  heartbeat(){ this.tone(58,.15,'sine',.15,32); setTimeout(()=>this.tone(50,.2,'sine',.10,28),175); },
  toggle(){ AudioPrefs.muted = !AudioPrefs.muted; AudioPrefs.save(); this.apply(); return this.on; }
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
/* GOAL-017: rüzgâr dokuları.
   Açılan hava yolunda akan havayı herkesin tanıyacağı bir dille göstermek
   için iki biçim: uzun sivrilen bir hız çizgisi ve ucunda kıvrım olan bir
   rüzgâr kancası. İkisi de yatay çizilip sprite döndürülerek akış yönüne
   oturtuluyor. */
function texWind(){
  // GOAL-019: kuyruğu uzun, başı parlak bir kuyrukluyıldız. Sprite akış yönüne
  // döndürüldüğü için baş +x tarafında: ışık önde, iz arkada kalıyor.
  const W = 384, H = 64, cv = makeCanvas(W,H), c = cv.getContext('2d');
  const g = c.createLinearGradient(0,0,W,0);
  g.addColorStop(0,   'rgba(255,255,255,0)');
  g.addColorStop(.30, 'rgba(255,255,255,.20)');
  g.addColorStop(.62, 'rgba(255,255,255,.55)');
  g.addColorStop(.84, 'rgba(255,255,255,.95)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0,H*.5);
  c.quadraticCurveTo(W*.56,H*.30, W,H*.42);
  c.lineTo(W,H*.58);
  c.quadraticCurveTo(W*.56,H*.70, 0,H*.5);
  c.closePath(); c.fill();
  const g2 = c.createRadialGradient(W*.80,H*.5,0,W*.80,H*.5,H*.45);
  g2.addColorStop(0,'rgba(255,255,255,.85)');
  g2.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle = g2;
  c.beginPath(); c.ellipse(W*.80,H*.5,W*.13,H*.28,0,0,7); c.fill();
  return texFromCanvas(cv);
}
/* GOAL-018: tıkalı işareti. Eskiden tıkanıklığı, yola çıkıp duvara çarpan
   kırmızı hava noktaları anlatıyordu; sürekli hareket ekranı yoruyordu ve
   "gidemiyor" mesajı ancak izlerseniz okunuyordu. Yerine herkesin tanıdığı
   tek bir simge: daire içinde çapraz çizgi. */
function texBlocked(){
  const S = 128, cv = makeCanvas(S,S), c = cv.getContext('2d');
  c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = 10;
  c.beginPath(); c.arc(S/2,S/2,S*.31,0,7); c.stroke();
  const r = S*.31*.72;
  c.beginPath(); c.moveTo(S/2-r,S/2-r); c.lineTo(S/2+r,S/2+r); c.stroke();
  return texFromCanvas(cv);
}
function texGust(){
  const W = 256, H = 96, cv = makeCanvas(W,H), c = cv.getContext('2d');
  c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = 9;
  c.globalAlpha = .9;
  c.beginPath();
  c.moveTo(8,H*.5);
  c.bezierCurveTo(W*.45,H*.34, W*.66,H*.30, W*.80,H*.40);
  c.bezierCurveTo(W*.95,H*.50, W*.90,H*.76, W*.72,H*.72);
  c.stroke();
  return texFromCanvas(cv);
}

/* GOAL-015: hava giriş/çıkış portlarının halkası */
function texRing(){
  const S = 128, cv = makeCanvas(S,S), c = cv.getContext('2d');
  c.strokeStyle = '#fff';
  c.lineWidth = 7; c.beginPath(); c.arc(S/2,S/2,S*.32,0,7); c.stroke();
  c.lineWidth = 2; c.globalAlpha = .55;
  c.beginPath(); c.arc(S/2,S/2,S*.45,0,7); c.stroke();
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
/* ---- gün konusunu anlatan motifler (GOAL-016) ----
   Hepsi açığa çıkan dokunun ÜSTÜNE, kısık alfayla biniyor: bilgi taşısın ama
   ödül görüntüsünü boğmasın. k = kendi grubu içindeki ilerleme (0 = başı). */
function motifCongestion(c,k){          // gün 1-3: şişmiş damarlar, ödem
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  const n = Math.round(76 - k*38);
  for(let i=0;i<n;i++){
    let x = rnd(0,HW), y = rnd(0,HH), a = rnd(0,7);
    c.strokeStyle = 'rgba(198,54,76,'+(.17-k*.07).toFixed(3)+')';
    c.lineWidth = rnd(2,7)*(1-k*.4);
    c.beginPath(); c.moveTo(x,y);
    const seg = 3 + (Math.random()*4|0);
    for(let s=0;s<seg;s++){ a += rnd(-.75,.75); x += Math.cos(a)*rnd(16,42); y += Math.sin(a)*rnd(16,42); c.lineTo(x,y); }
    c.stroke();
  }
  const m = Math.round(22 - k*12);
  for(let i=0;i<m;i++){
    const x = rnd(0,HW), y = rnd(0,HH), r = rnd(26,82);
    const g = c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(184,44,64,'+(.13-k*.05).toFixed(3)+')');
    g.addColorStop(1,'rgba(184,44,64,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,7); c.fill();
  }
  c.restore();
}
function motifMucus(c,k){               // gün 4-5: aşağı süzülen mukus telleri
  c.save(); c.lineCap = 'round';
  const n = Math.round(48 - k*18);
  for(let i=0;i<n;i++){
    const x = rnd(0,HW), y0 = rnd(-40,HH*.55), len = rnd(60,190)*(1-k*.28), w = rnd(3,11);
    const g = c.createLinearGradient(x,y0,x,y0+len);
    g.addColorStop(0,'rgba(210,194,120,0)');
    g.addColorStop(.35,'rgba(204,186,116,'+(.21-k*.09).toFixed(3)+')');
    g.addColorStop(1,'rgba(148,148,90,0)');
    c.strokeStyle = g; c.lineWidth = w;
    c.beginPath(); c.moveTo(x,y0);
    c.quadraticCurveTo(x+rnd(-24,24), y0+len*.5, x+rnd(-16,16), y0+len);
    c.stroke();
    c.fillStyle = 'rgba(226,212,142,'+(.15-k*.06).toFixed(3)+')';
    c.beginPath(); c.ellipse(x+rnd(-14,14), y0+len, w*.7, w*1.15, 0,0,7); c.fill();
  }
  c.restore();
}
function motifCilia(c,k){               // gün 6-7: çalışan siller, açılan ostiumlar
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  const rows = 7;
  for(let r=0;r<rows;r++){
    const y = (r+.5)/rows*HH;
    for(let x=6;x<HW;x+=9){
      const ph = Math.sin(x*.06 + r*1.3)*10;
      c.strokeStyle = 'rgba(118,234,220,'+(.10+k*.06).toFixed(3)+')';
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x, y+8);
      c.quadraticCurveTo(x+ph*.6, y, x+ph, y-12);
      c.stroke();
    }
  }
  for(let i=0;i<5;i++){
    const x = rnd(HW*.15,HW*.85), y = rnd(HH*.18,HH*.82), r = rnd(22,60);
    c.strokeStyle = 'rgba(150,248,232,'+(.09+k*.05).toFixed(3)+')';
    c.lineWidth = 2.5; c.beginPath(); c.arc(x,y,r,0,7); c.stroke();
    c.lineWidth = 1;   c.beginPath(); c.arc(x,y,r*1.25,0,7); c.stroke();
  }
  c.restore();
}
function motifAirflow(c,k){             // gün 8-10: serbest hava akımı
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for(let i=0;i<26;i++){
    const y0 = rnd(0,HH), x0 = rnd(-60,HW*.4);
    const g = c.createLinearGradient(x0,y0,x0+HW*.8,y0);
    g.addColorStop(0,'rgba(140,240,240,0)');
    g.addColorStop(.5,'rgba(162,248,244,'+(.11+k*.07).toFixed(3)+')');
    g.addColorStop(1,'rgba(140,240,240,0)');
    c.strokeStyle = g; c.lineWidth = rnd(1.5,5);
    c.beginPath(); c.moveTo(x0,y0);
    c.bezierCurveTo(x0+HW*.25, y0+rnd(-50,50), x0+HW*.55, y0+rnd(-50,50), x0+HW*.8, y0+rnd(-40,40));
    c.stroke();
  }
  for(let i=0;i<70;i++){
    const x = rnd(0,HW), y = rnd(0,HH), r = rnd(2,9);
    c.strokeStyle = 'rgba(190,255,250,'+(.12+k*.08).toFixed(3)+')';
    c.lineWidth = 1; c.beginPath(); c.arc(x,y,r,0,7); c.stroke();
  }
  c.restore();
}
const MOTIFS = { congestion:motifCongestion, mucus:motifMucus, cilia:motifCilia, airflow:motifAirflow };

/* Havanın geçmesi gereken kanal, dokuya işlenmiş bir parıltı olarak.
   Sadece temizlediğin yerde görünür — yani doğru yeri açtıkça "kanal"
   kendini gösterir, yanlış yeri açtığında görünmez. Sessiz bir pusula. */
function paintDuct(c){
  if(cavRoute.length < 2) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round'; c.lineJoin = 'round';
  const passes = [[34,'rgba(64,214,222,.045)'],[18,'rgba(120,240,238,.065)'],[7,'rgba(206,255,252,.085)']];
  for(const [w,col] of passes){
    c.lineWidth = w; c.strokeStyle = col;
    c.beginPath();
    for(let i=0;i<cavRoute.length;i+=3){
      const cel = cavRoute[i], x = ((cel%GW)+.5)*SC, y = (((cel/GW)|0)+.5)*SC;
      if(i === 0) c.moveTo(x,y); else c.lineTo(x,y);
    }
    c.stroke();
  }
  c.restore();
}

/* =========================================================================
   BİLGİ LEVHASI (GOAL-017)

   Siklamen çiçeğinin yerini alan katman. Her gün, o günün mekanizmasını
   anlatan bir şema açığa çıkıyor: tıkalı geçit, ödem basıncı, daralan
   damarlar, koyu mukus, drenaj, açılan ostium, silyer taşıma, doz kalkanı,
   kronik destek, tam havalandırma.

   Hepsi aynı dili konuşuyor — ince ışıklı çizgi, günün paletinden tek vurgu
   rengi, altında kısa başlık — ki oyuncu hangi görsel olursa olsun onu "şema"
   olarak tanısın. Çizim -110..110 x -78..78 aralığında, merkezi taşınmış bir
   koordinat sisteminde yapılıyor.
   ========================================================================= */
function plateDrop(c,x,y,r){
  c.beginPath(); c.moveTo(x, y-r*1.7);
  c.bezierCurveTo(x+r*1.1, y-r*.2, x+r, y+r, x, y+r);
  c.bezierCurveTo(x-r, y+r, x-r*1.1, y-r*.2, x, y-r*1.7);
  c.closePath();
}
/* Düzgün daire yerine hafifçe bozulmuş, organik bir kapalı şekil. */
function bioBlob(c,x,y,r,wob,seed){
  const N = 10, pts = [];
  for(let i=0;i<N;i++){
    const a = i/N*Math.PI*2;
    const rr = r*(1 + Math.sin(a*3+seed)*wob*.5 + Math.cos(a*2-seed*1.7)*wob*.5);
    pts.push([x+Math.cos(a)*rr, y+Math.sin(a)*rr]);
  }
  c.beginPath();
  c.moveTo((pts[N-1][0]+pts[0][0])/2, (pts[N-1][1]+pts[0][1])/2);
  for(let i=0;i<N;i++){
    const p = pts[i], q = pts[(i+1)%N];
    c.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2);
  }
  c.closePath();
}
function bioFill(c,x,y,r,c0,c1){
  const g = c.createRadialGradient(x-r*.3,y-r*.35,r*.1,x,y,r*1.15);
  g.addColorStop(0,c0); g.addColorStop(1,c1);
  c.fillStyle = g;
}
/* Dallanan damar — gerçek kılcal ağlar gibi her dalda incelerek. */
function vessel(c,x,y,a,len,w,depth){
  if(depth <= 0 || w < .7) return;
  const x2 = x+Math.cos(a)*len, y2 = y+Math.sin(a)*len;
  c.lineWidth = w;
  c.beginPath(); c.moveTo(x,y);
  c.quadraticCurveTo(x+Math.cos(a+.35)*len*.55, y+Math.sin(a+.35)*len*.55, x2, y2);
  c.stroke();
  vessel(c,x2,y2,a-rnd(.22,.62),len*.74,w*.68,depth-1);
  vessel(c,x2,y2,a+rnd(.22,.62),len*.74,w*.68,depth-1);
}
/* Silyalı yüzey: metakronal dalga hâlinde eğilen sil dizisi. */
function ciliaRow(c,y,amp,step,len,col,alpha){
  c.strokeStyle = col; c.globalAlpha = alpha; c.lineWidth = 2; c.lineCap = 'round';
  for(let x=-106;x<=106;x+=step){
    const b = Math.sin(x*.055)*amp;
    c.beginPath(); c.moveTo(x,y);
    c.quadraticCurveTo(x+b*.55, y-len*.55, x+b, y-len);
    c.stroke();
  }
  c.globalAlpha = 1;
}
/* Sıralı silindirik epitel hücreleri, çekirdekleriyle. */
function epithelium(c,y,h,col0,col1){
  for(let x=-108;x<106;x+=18){
    const g = c.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,col0); g.addColorStop(1,col1);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x+2,y+4); c.quadraticCurveTo(x+9,y-3, x+16,y+4);
    c.lineTo(x+16,y+h); c.lineTo(x+2,y+h);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(12,26,32,.5)';
    c.beginPath(); c.ellipse(x+9, y+h*.62, 3.6, 5, 0,0,7); c.fill();
  }
}
/* Hazır görseli levha kutusuna sığdırıp ortalar. */
function drawPlateImage(c, img){
  const s = Math.min(236/img.width, 176/img.height);
  const w = img.width*s, h = img.height*s;
  c.drawImage(img, -w/2, -h/2, w, h);
}

/* Günün konusunu doğal/bilimsel diliyle gösteren merkez görselleri.
   Şema oku, çarpı işareti, grafik ekseni yok: hepsi dokunun, hücrenin,
   damarın kendi biçimi. Çizim -110..110 x -78..78 aralığında. */
const PLATES = [
  /* 1 — Kanla dolu kılcal damar ağı */
  function(c){
    const g = c.createRadialGradient(0,0,10,0,0,120);
    g.addColorStop(0,'rgba(190,40,58,.30)'); g.addColorStop(1,'rgba(190,40,58,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0,0,120,0,7); c.fill();
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(206,52,70,.85)';
    vessel(c,-108,22,-.18,46,11,5);
    vessel(c,108,-30,Math.PI+.22,44,10,5);
    vessel(c,-18,84,-1.35,42,9,4);
    c.strokeStyle = 'rgba(255,152,152,.45)';
    vessel(c,-104,26,-.2,40,4,4);
    c.fillStyle = 'rgba(236,96,104,.5)';
    for(let i=0;i<26;i++){ const x = rnd(-100,100), y = rnd(-70,70);
      c.beginPath(); c.ellipse(x,y,5,3.4,rnd(0,3),0,7); c.fill(); }
  },
  /* 2 — Sıvı tutmuş, şişmiş mukoza hücreleri */
  function(c){
    c.fillStyle = 'rgba(120,190,205,.12)';
    c.beginPath(); c.arc(0,0,114,0,7); c.fill();
    for(let i=0;i<11;i++){
      const a = i/11*Math.PI*2 + .3, d = i < 4 ? 26 : 68;
      const x = Math.cos(a)*d, y = Math.sin(a)*d*.72, r = 25 + (i%3)*6;
      bioFill(c,x,y,r,'rgba(178,216,224,.44)','rgba(58,110,126,.30)');
      bioBlob(c,x,y,r,.16,i*1.7); c.fill();
      c.strokeStyle = 'rgba(200,234,240,.35)'; c.lineWidth = 1.6;
      bioBlob(c,x,y,r,.16,i*1.7); c.stroke();
      c.fillStyle = 'rgba(18,46,56,.45)';
      c.beginPath(); c.ellipse(x+r*.1,y+r*.05,r*.22,r*.18,0,0,7); c.fill();
    }
    c.fillStyle = 'rgba(150,226,236,.16)';
    for(let i=0;i<18;i++){ const x = rnd(-104,104), y = rnd(-70,70);
      c.beginPath(); c.arc(x,y,rnd(3,9),0,7); c.fill(); }
  },
  /* 3 — Ortasından daralan (kasılan) damarlar */
  function(c){
    for(let i=0;i<4;i++){
      const y = -48 + i*32, w0 = 15 - i*1.6, w1 = 4;
      const g = c.createLinearGradient(-110,0,110,0);
      g.addColorStop(0,'rgba(196,60,78,.62)');
      g.addColorStop(.5,'rgba(206,112,122,.42)');
      g.addColorStop(1,'rgba(190,152,152,.28)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-110,y-w0);
      c.bezierCurveTo(-30,y-w0, -18,y-w1, 0,y-w1);
      c.bezierCurveTo(30,y-w1, 50,y-w1*1.2, 110,y-w1*1.3);
      c.lineTo(110,y+w1*1.3);
      c.bezierCurveTo(50,y+w1*1.2, 30,y+w1, 0,y+w1);
      c.bezierCurveTo(-18,y+w1, -30,y+w0, -110,y+w0);
      c.closePath(); c.fill();
    }
  },
  /* 4 — Goblet hücreleri ve üstünde koyulaşmış mukus örtüsü */
  function(c){
    epithelium(c, 30, 48, 'rgba(150,196,200,.5)', 'rgba(46,92,102,.5)');
    for(let i=0;i<4;i++){
      const x = -76 + i*50;
      c.fillStyle = 'rgba(214,190,116,.6)';
      c.beginPath();
      c.moveTo(x-4,30); c.quadraticCurveTo(x-13,44, x-9,70);
      c.lineTo(x+9,70); c.quadraticCurveTo(x+13,44, x+4,30);
      c.closePath(); c.fill();
    }
    const g = c.createLinearGradient(0,-40,0,30);
    g.addColorStop(0,'rgba(206,182,102,.10)'); g.addColorStop(1,'rgba(196,168,88,.48)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-110,30);
    for(let x=-110;x<=110;x+=10) c.lineTo(x, -6 + Math.sin(x*.05)*10);
    c.lineTo(110,30); c.closePath(); c.fill();
    c.fillStyle = 'rgba(224,204,138,.55)';
    for(let i=0;i<5;i++){ plateDrop(c, -84+i*42, -30-((i%2)*14), 11); c.fill(); }
  },
  /* 5 — Katmanlar hâlinde süzülen mukus */
  function(c){
    for(let i=0;i<3;i++){
      const y = -34 + i*34, al = .26 - i*.05;
      const g = c.createLinearGradient(-110,y,110,y);
      g.addColorStop(0,'rgba(190,200,120,0)');
      g.addColorStop(.35,'rgba(198,206,132,'+al.toFixed(2)+')');
      g.addColorStop(1,'rgba(150,196,180,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-110,y);
      for(let x=-110;x<=110;x+=10) c.lineTo(x, y + Math.sin(x*.045+i)*9);
      for(let x=110;x>=-110;x-=10) c.lineTo(x, y + 20 + Math.sin(x*.045+i)*9);
      c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(214,224,160,.5)';
    for(let i=0;i<7;i++){ plateDrop(c, -92+i*31, -52+(i%3)*40, 8); c.fill(); }
    c.strokeStyle = 'rgba(220,235,200,.22)'; c.lineWidth = 2; c.lineCap = 'round';
    for(let i=0;i<5;i++){ const y = -60+i*30;
      c.beginPath(); c.moveTo(-100,y);
      c.bezierCurveTo(-30,y+8, 30,y-8, 100,y+4); c.stroke(); }
  },
  /* 6 — Dokunun ortasında açılmış ostium ağzı */
  function(c){
    const g0 = c.createRadialGradient(0,0,26,0,0,106);
    g0.addColorStop(0,'rgba(190,120,118,.40)'); g0.addColorStop(1,'rgba(90,50,56,0)');
    c.fillStyle = g0; bioBlob(c,0,0,98,.10,1.2); c.fill();
    const g1 = c.createRadialGradient(0,0,2,0,0,44);
    g1.addColorStop(0,'rgba(4,12,16,.92)');
    g1.addColorStop(.7,'rgba(10,30,38,.72)');
    g1.addColorStop(1,'rgba(30,70,78,.22)');
    c.fillStyle = g1; bioBlob(c,0,0,42,.14,3.4); c.fill();
    c.strokeStyle = 'rgba(226,196,190,.5)'; c.lineWidth = 3;
    bioBlob(c,0,0,44,.14,3.4); c.stroke();
    const g2 = c.createRadialGradient(0,0,0,0,0,30);
    g2.addColorStop(0,'rgba(150,240,236,.28)'); g2.addColorStop(1,'rgba(150,240,236,0)');
    c.fillStyle = g2; c.beginPath(); c.arc(0,0,30,0,7); c.fill();
  },
  /* 7 — Çalışan silyalı epitel yüzeyi */
  function(c){
    epithelium(c, 22, 56, 'rgba(158,206,206,.55)', 'rgba(40,92,100,.55)');
    ciliaRow(c, 22, 15, 7, 40, 'rgba(146,238,226,.75)', .75);
    ciliaRow(c, 24, 12, 11, 30, 'rgba(210,255,248,.5)', .5);
    const g = c.createLinearGradient(0,-44,0,-12);
    g.addColorStop(0,'rgba(190,240,236,.02)'); g.addColorStop(1,'rgba(190,240,236,.20)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-110,-12);
    for(let x=-110;x<=110;x+=10) c.lineTo(x, -34 + Math.sin(x*.05)*5);
    c.lineTo(110,-12); c.closePath(); c.fill();
  },
  /* 8 — İlacın kendisi: siklamen (Cyclamen europaeum) */
  function(c){ drawPlateImage(c, flowerImg); },
  /* 9 — Sağlıklı mukoza kesiti: bazal tabaka, epitel, sil, ince mukus filmi */
  function(c){
    const gb = c.createLinearGradient(0,44,0,78);
    gb.addColorStop(0,'rgba(120,86,92,.55)'); gb.addColorStop(1,'rgba(60,40,46,.30)');
    c.fillStyle = gb; c.fillRect(-110,44,220,34);
    epithelium(c, 4, 44, 'rgba(172,216,212,.6)', 'rgba(48,104,108,.6)');
    ciliaRow(c, 4, 10, 8, 26, 'rgba(160,240,228,.6)', .6);
    const g = c.createLinearGradient(0,-38,0,-18);
    g.addColorStop(0,'rgba(200,246,244,.03)'); g.addColorStop(1,'rgba(200,246,244,.22)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-110,-18);
    for(let x=-110;x<=110;x+=10) c.lineTo(x, -36 + Math.sin(x*.045)*4);
    c.lineTo(110,-18); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(198,110,118,.35)'; c.lineCap = 'round';
    vessel(c,-92,70,-.35,24,4,3);
    vessel(c,72,72,Math.PI+.4,22,4,3);
  },
  /* 10 — Havayla dolmuş, ışık alan sinüs boşluğu */
  function(c){
    const gw = c.createLinearGradient(0,-80,0,80);
    gw.addColorStop(0,'rgba(150,110,108,.40)');
    gw.addColorStop(.5,'rgba(150,110,108,0)');
    gw.addColorStop(1,'rgba(150,110,108,.40)');
    c.fillStyle = gw; c.fillRect(-110,-80,220,160);
    const gl = c.createRadialGradient(-20,-10,6,0,0,114);
    gl.addColorStop(0,'rgba(180,250,244,.30)'); gl.addColorStop(1,'rgba(180,250,244,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(0,0,114,0,7); c.fill();
    c.strokeStyle = 'rgba(196,250,244,.35)'; c.lineWidth = 2.4; c.lineCap = 'round';
    for(let i=0;i<5;i++){ const y = -44+i*22;
      c.beginPath(); c.moveTo(-102,y);
      c.bezierCurveTo(-30,y-10, 30,y+10, 102,y-4); c.stroke(); }
    c.strokeStyle = 'rgba(216,255,250,.35)'; c.lineWidth = 1.4;
    for(let i=0;i<24;i++){ const x = rnd(-100,100), y = rnd(-66,66);
      c.beginPath(); c.arc(x,y,rnd(3,9),0,7); c.stroke(); }
  }
];
const PLATE_CAPS = ['KILCAL DAMARLAR DOLU','ÖDEMLİ MUKOZA','DAMARLAR DARALIYOR',
  'KOYU MUKUS TABAKASI','MUKUS AKIŞI','OSTIUM AÇIKLIĞI','SİLYALI EPİTEL',
  'SİKLAMEN EKSTRESİ','SAĞLIKLI MUKOZA','HAVALANAN SİNÜS'];

/* GOAL-019: levha önce kendi saydam tuvaline çiziliyor. Bunun iki faydası var:
   dokunun üstüne iki geçişle (normal + toplamalı) basılıp belirginleşebiliyor,
   ve aynı tuval bölüm girişindeki önizleme görseli olarak yeniden
   kullanılabiliyor — oyuncu günün görselini temizlemeyi beklemeden görüyor. */
const PLATE_W = 300, PLATE_H = 240;
const plateCv = makeCanvas(PLATE_W, PLATE_H), plateCtx = plateCv.getContext('2d');
function renderPlateLayer(L){
  const c = plateCtx;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,PLATE_W,PLATE_H);
  const custom = plateAssetImgs['day'+String(L.day).padStart(2,'0')];
  const plate = PLATES[L.day-1];
  if(!custom && !plate) return false;
  c.save();
  c.translate(PLATE_W/2, PLATE_H/2);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = 1;
  if(custom) drawPlateImage(c, custom); else plate(c);
  c.restore();
  return true;
}
/* Bölüm giriş panelinde gösterilecek önizleme (koyu zeminli PNG veri-URL'i). */
function plateThumbURL(L){
  if(!renderPlateLayer(L)) return '';
  const cv = makeCanvas(PLATE_W, PLATE_H), c = cv.getContext('2d');
  const g = c.createRadialGradient(PLATE_W/2,PLATE_H/2,0,PLATE_W/2,PLATE_H/2,PLATE_W*.55);
  g.addColorStop(0,'#0d1f28'); g.addColorStop(1,'#050c12');
  c.fillStyle = g; c.fillRect(0,0,PLATE_W,PLATE_H);
  c.drawImage(plateCv,0,0);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .45;
  c.drawImage(plateCv,0,0);
  try{ return cv.toDataURL('image/png'); }catch(e){ return ''; }
}

function paintPlate(c, L){
  const cap = PLATE_CAPS[L.day-1];
  if(!renderPlateLayer(L)) return;
  c.save();
  c.translate(plateX*SC, plateY*SC);
  c.scale(plateScale, plateScale);
  // görselin dokudan ayrılması için arkasına yumuşak bir koyuluk
  const bg = c.createRadialGradient(0,0,0,0,0,136);
  bg.addColorStop(0,'rgba(3,9,13,.62)');
  bg.addColorStop(.7,'rgba(3,9,13,.34)');
  bg.addColorStop(1,'rgba(3,9,13,0)');
  c.fillStyle = bg; c.beginPath(); c.arc(0,0,136,0,7); c.fill();

  // iki geçiş: normal basım + toplamalı parlaklık — doku üstünde silinmesin
  c.drawImage(plateCv, -PLATE_W/2, -PLATE_H/2);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = .5;
  c.drawImage(plateCv, -PLATE_W/2, -PLATE_H/2);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.restore();

  // Başlık bilerek ölçeğin DIŞINDA: dar kesitlerde şema küçülüyor ama yazının
  // da küçülmesi onu okunmaz yapardı — bilgi levhasının bilgisi yazıda.
  c.save();
  c.translate(plateX*SC, plateY*SC);
  c.globalAlpha = .85;
  c.font = '700 ' + Math.max(13, Math.round(17*plateScale)) + 'px "Segoe UI","Noto Sans",Helvetica,Arial,sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#eafcff';
  c.shadowColor = 'rgba(0,0,0,.95)'; c.shadowBlur = 9;
  c.fillText(cap, 0, 104*plateScale + 10);
  c.restore();
}

/* assets/bg/ içinden gelen hazır arka planı alanı kaplayacak şekilde basar. */
function drawCover(c, img){
  const s = Math.max(HW/img.width, HH/img.height);
  const w = img.width*s, h = img.height*s;
  c.drawImage(img, (HW-w)/2, (HH-h)/2, w, h);
}

function paintHealthy(L){
  const c = bgCanvas.getContext('2d');
  const img = c.createImageData(HW,HH), d = img.data;
  // GOAL-016: tedavi yayı — açığa çıkan doku gün ilerledikçe koyu/morarmış
  // tondan oksijenli turkuaza doğru açılıyor. Arka plan tek başına "kaçıncı
  // gündeyiz" sorusuna cevap veriyor.
  const arc = (L.day-1)/9;
  const dim    = ['#030d12','#101d24','#27282e','#3a3138','#6a5f63'].map(hex2rgb);
  const bright = ['#04121a','#0a3040','#0f5e63','#1b8079','#6fd8c8'].map(hex2rgb);
  const air = dim.map((c0,i)=> mixc(c0, bright[i], arc));
  const n1 = fbm(HW,HH,60,1777,3), n2 = fbm(HW,HH,14,5051,2);
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
  // GOAL-016: bölüme özel hazır arka plan varsa prosedürel zeminin yerine geçer
  const custom = bgAssetImgs['day'+String(L.day).padStart(2,'0')] || bgAssetImgs[L.cav];
  if(custom) drawCover(c, custom);
  else {
    const motif = MOTIFS[L.motif];
    if(motif){
      // GOAL-019: tek geçişte motif fark edilmeyecek kadar sönük kalıyordu;
      // ikinci geçiş yoğunluğu artırıyor (rastgele yerleşimli motiflerde daha
      // çok öğe, deterministik olanlarda daha belirgin çizgi).
      // k: kendi grubu içindeki ilerleme — aynı motif gün geçtikçe sönümleniyor
      const first = MOTIF_BY_DAY.indexOf(L.motif), last = MOTIF_BY_DAY.lastIndexOf(L.motif);
      const span = Math.max(1, last-first);
      const k = clamp((L.day-1-first)/span, 0, 1);
      motif(c, k); motif(c, k);
    }
  }
  paintDuct(c);

  // GOAL-017: siklamenin yerini günün mekanizmasını anlatan bilgi levhası aldı
  paintPlate(c, L);
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
   4b. BURUN BOŞLUĞU (GOAL-015)

   Oyun alanı artık dikdörtgen değil. Her gün, burnun/sinüslerin bir koronal
   kesiti açılıyor: içi = oynanabilir mukoza (cavity=1), dışı = kemik/kıkırdak
   duvar (kalıcı FILL — oyuncunun üstünde yürüdüğü güvenli zemin).

   Şekiller canvas ile, ızgara biriminde çiziliyor; beyaz = boşluk, siyah =
   duvar. Yeni bir kesit eklemek birkaç satırlık path işi.

   Her kesitin iki portu var:
     in  — burun deliği (hava girişi; oyuncunun da başlangıç noktası)
     out — ostium / nazofarenks (hava çıkışı)
   Nefes mekaniği bu iki port arasında TEMİZLENMİŞ hücrelerden geçen bir yol
   arıyor (bkz. computeAirway). Yani hedef yüzdesi "ne kadar temizledin"i,
   hava yolu "doğru yeri mi temizledin"i ölçüyor.
   ========================================================================= */
const cavity  = new Uint8Array(GW*GH);   // 1 = oynanabilir boşluk
const cavSoft = new Float32Array(HW*HH); // görsel duvar için yumuşatılmış maske
let cavCount = 0, cavCX = GW/2, cavCY = GH/2;
const PORTC = { in:{x:GW>>1,y:GH-8,r:5}, out:{x:GW>>1,y:8,r:5} };
const portOutMask = new Uint8Array(GW*GH);
let portIn = [], portOut = [], airBaseD = 1;

const CAVITY = {
  /* -------------------------------------------------------------------------
     GOAL-025 — KESİTLER assets/sinuzit.png'DEN ÇİZİLDİ
     Görseldeki kırmızı tuğlalar (eski oyunun blokları) yok sayıldı; yalnızca
     boşlukların dış hatları alındı. Her bölüm artık o bölgenin gerçek kanal
     biçimi: oyuncu tahtaya bakınca burnun neresinde olduğunu tanıyor.

     Ortak kurgu: HAVA GİRİŞİ (in) her zaman altta, burun pasajında; OSTIUM
     ÇIKIŞI (out) o bölgenin gerçekte boşaldığı yerde. Yüzde hedefi bölgeyi
     temizlemeyi, hava yolu doğru kanalı açmayı ölçüyor.

     Ölçü birimi ızgara hücresi (160x120). Parçalar birbirine DEĞMEK değil
     BİNMEK zorunda: teğet geçen iki parça ızgaraya düşerken kopuyor ve
     sealUnreachable() kopan odayı mühürlüyor.
     ------------------------------------------------------------------------- */

  /* Gün 1-2 — BURUN BOŞLUĞU. Görselin alt ortası: septumun iki yanındaki
     dikey pasajlar, yanlardan içeri şişmiş konkalar. Tuzaksız giriş bölümü,
     oyuncu nefes mekaniğini burada öğreniyor. */
  vestibule:{
    in:{x:80,y:106,r:5}, out:{x:56,y:24,r:5},
    paint(c,d){
      c.beginPath();                                    // boşluğun dış hattı
      c.moveTo(50,10);
      c.bezierCurveTo(66,6, 94,6, 110,10);
      c.bezierCurveTo(124,30, 132,62, 132,92);
      c.bezierCurveTo(126,108, 104,114, 80,114);
      c.bezierCurveTo(56,114, 34,108, 28,92);
      c.bezierCurveTo(28,62, 36,30, 50,10);
      c.closePath(); c.fill();
      c.fillStyle = '#000';
      c.fillRect(75,4,10,92);                           // septum — iki pasajı ayırır
      c.beginPath(); c.ellipse(30,76,19,9,-.18,0,7); c.fill();   // sol alt konka
      c.beginPath(); c.ellipse(130,76,19,9,.18,0,7); c.fill();   // sağ alt konka
      if(d >= 1){                                       // orta konkalar
        c.beginPath(); c.ellipse(33,46,16,7,-.15,0,7); c.fill();
        c.beginPath(); c.ellipse(127,46,16,7,.15,0,7); c.fill();
      }
      if(d >= 2){ c.fillRect(75,96,10,7); }             // septum biraz daha iner
      c.fillStyle = '#fff';
    }
  },

  /* Gün 3-4 — OSTİOMEATAL KOMPLEKS. Görselde burun pasajı ile maksiller ve
     etmoid ağızlarının buluştuğu dar kavşak. Dikey ana kanal, yandan gelen
     maksiller ostium kolu, yukarı-yana giden etmoid infundibulum ve kanala
     sarkan orta konka. Alan kolay, hava yolu zor: asıl gerilim burada. */
  meatus:{
    in:{x:80,y:106,r:5}, out:{x:80,y:16,r:5},
    paint(c,d){
      c.fillRect(66,8,28,104);                          // orta meatus — ana kanal
      c.fillRect(26,64,44,12);                          // maksiller ostium koridoru
      c.beginPath(); c.ellipse(26,70,16,20,0,0,7); c.fill();     // maksiller ağzı
      c.fillRect(90,30,36,11);                          // etmoid infundibulum
      c.beginPath(); c.ellipse(128,36,16,17,0,0,7); c.fill();    // etmoid hücresi
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(64,46,14,16,0,0,7); c.fill();     // orta konka
      if(d >= 1){ c.beginPath(); c.ellipse(96,82,13,15,0,0,7); c.fill(); }
      if(d >= 2){ c.beginPath(); c.ellipse(26,70,8,9,0,0,7); c.fill(); }
      if(d >= 3){ c.beginPath(); c.ellipse(128,36,8,8,0,0,7); c.fill(); }
      c.fillStyle = '#fff';
    }
  },

  /* Gün 5-6 — MAKSİLLER SİNÜS. Görselin altındaki büyük yanak boşluğu: ucu
     dışa bakan yuvarlak üçgen, sağında burun pasajı, ikisini bağlayan dar
     ostium. Ostium tavanda olduğu için oda yerçekimine karşı boşalır —
     oyunda da odayı almak ayrı, kanalı açmak ayrı iş. */
  maxillary:{
    in:{x:118,y:106,r:5}, out:{x:46,y:50,r:5},
    paint(c,d){
      c.beginPath();                                    // yanak boşluğu
      c.moveTo(96,34);
      c.bezierCurveTo(70,32, 38,38, 22,54);
      c.bezierCurveTo(12,64, 14,76, 26,86);
      c.bezierCurveTo(44,100, 72,106, 96,100);
      c.closePath(); c.fill();
      c.fillRect(104,8,28,104);                         // burun pasajı
      c.fillRect(92,40,16,12);                          // ostium koridoru
      c.fillStyle = '#000';
      if(d >= 1){ c.beginPath(); c.ellipse(44,78,12,13,0,0,7); c.fill(); }  // odada polip
      if(d >= 2){ c.beginPath(); c.ellipse(104,74,12,14,0,0,7); c.fill(); } // pasajı daraltan konka
      if(d >= 3){ c.beginPath(); c.ellipse(76,94,14,10,0,0,7); c.fill(); }
      c.fillStyle = '#fff';
    }
  },

  /* Gün 7-8 — ETMOİD HÜCRELER. Görselde gözlerin arasındaki petek: merkez
     burun pasajının iki yanında, yukarıdan aşağı küçülen üçer hava hücresi,
     her biri kanala yalnızca dar bir boyunla bağlı. Yüzde hücreleri tek tek
     almayı, hava yolu ise merkez kanalı ister — iki ayrı rota. */
  ethmoid:{
    in:{x:80,y:106,r:5}, out:{x:80,y:14,r:5},
    paint(c,d){
      c.fillRect(70,8,20,104);                          // merkez burun pasajı
      const cells = [[42,30,21,17],[45,62,18,14],[48,90,14,11],
                     [118,30,21,17],[115,62,18,14],[112,90,14,11]];
      for(const q of cells){ c.beginPath(); c.ellipse(q[0],q[1],q[2],q[3],0,0,7); c.fill(); }
      c.fillRect(58,26,14,8); c.fillRect(59,58,13,7); c.fillRect(58,87,14,6);   // sol boyunlar
      c.fillRect(88,26,14,8); c.fillRect(88,58,13,7); c.fillRect(88,87,14,6);   // sağ boyunlar
      c.fillStyle = '#000';
      if(d >= 1){ c.beginPath(); c.ellipse(42,30,10,8,0,0,7); c.fill(); }
      if(d >= 2){ c.beginPath(); c.ellipse(118,30,10,8,0,0,7); c.fill(); }
      // Kanalı daraltan raflar — bilerek yarım, hava yolu hiç kapanmasın
      if(d >= 2){ c.fillRect(70,44,12,6); }
      if(d >= 3){ c.fillRect(78,74,12,6); }
      c.fillStyle = '#fff';
    }
  },

  /* Gün 9-10 — FRONTAL SİNÜS. Görselin en üstündeki iki kanat: tabanı orta
     hatta, ucu dışa-aşağı süpüren virgül biçimi. Ortada onları aşağı bağlayan
     uzun ve dar frontal resess, altta orta meatus ağzı. Yayın en zoru:
     ostium en tepede, kanal en uzun. */
  frontal:{
    in:{x:80,y:106,r:5}, out:{x:46,y:28,r:5},
    paint(c,d){
      c.beginPath();                                    // sol frontal kanat
      c.moveTo(84,10);
      c.bezierCurveTo(58,8, 30,18, 18,38);
      c.bezierCurveTo(12,50, 18,60, 30,58);
      c.bezierCurveTo(50,54, 70,40, 84,26);
      c.closePath(); c.fill();
      c.beginPath();                                    // sağ frontal kanat
      c.moveTo(76,10);
      c.bezierCurveTo(102,8, 130,18, 142,38);
      c.bezierCurveTo(148,50, 142,60, 130,58);
      c.bezierCurveTo(110,54, 90,40, 76,26);
      c.closePath(); c.fill();
      c.fillRect(70,12,20,84);                          // frontal resess
      c.beginPath(); c.ellipse(80,100,26,13,0,0,7); c.fill();    // orta meatus ağzı
      c.fillStyle = '#000';
      c.fillRect(78,4,5,22);                            // sinüsler arası septum:
      // görselde iki frontal sinüs orta hatta ince bir kemikle ayrılıyor. Resessin
      // üstünü ikiye bölüyor ama iki şerit de açık kalıyor.
      if(d >= 1){ c.beginPath(); c.ellipse(70,50,8,12,0,0,7); c.fill(); }
      if(d >= 2){ c.beginPath(); c.ellipse(90,72,8,12,0,0,7); c.fill(); }
      if(d >= 3){ c.beginPath(); c.ellipse(34,46,11,9,0,0,7); c.fill(); }
      c.fillStyle = '#fff';
    }
  }
};
const shapeCv = makeCanvas(HW,HH), shapeCtx = shapeCv.getContext('2d');

/* Boşluğa ulaşılamayan cepleri duvara çevirir. Şekiller elle çizildiği için
   bir oda yanlışlıkla mühürlenirse alan hedefi imkânsız hale gelirdi; bu ağ
   onu sessizce kapatır, bölüm her zaman tamamlanabilir kalır. */
function sealUnreachable(){
  const seen = new Uint8Array(GW*GH), q = new Int32Array(GW*GH);
  let qh = 0, qt = 0, seed = -1;
  const si = PORTC.in.y*GW + PORTC.in.x;
  if(cavity[si]) seed = si;
  else for(let i=cavity.length-1;i>=0;i--) if(cavity[i]){ seed = i; break; }
  if(seed < 0) return;
  PORTC.in.x = seed % GW; PORTC.in.y = (seed/GW)|0;
  seen[seed] = 1; q[qt++] = seed;
  while(qh < qt){
    const i = q[qh++], x = i%GW, y = (i/GW)|0;
    if(x>0    && cavity[i-1]  && !seen[i-1] ){ seen[i-1]  = 1; q[qt++] = i-1; }
    if(x<GW-1 && cavity[i+1]  && !seen[i+1] ){ seen[i+1]  = 1; q[qt++] = i+1; }
    if(y>0    && cavity[i-GW] && !seen[i-GW]){ seen[i-GW] = 1; q[qt++] = i-GW; }
    if(y<GH-1 && cavity[i+GW] && !seen[i+GW]){ seen[i+GW] = 1; q[qt++] = i+GW; }
  }
  for(let i=0;i<cavity.length;i++) if(cavity[i] && !seen[i]) cavity[i] = 0;
}

function collectPort(p, arr, mask){
  for(let y=p.y-p.r;y<=p.y+p.r;y++) for(let x=p.x-p.r;x<=p.x+p.r;x++){
    if(x<0||y<0||x>=GW||y>=GH) continue;
    const dx = x-p.x, dy = y-p.y;
    if(dx*dx+dy*dy > p.r*p.r) continue;
    const i = y*GW+x;
    if(!cavity[i]) continue;
    arr.push(i); if(mask) mask[i] = 1;
  }
}
function buildPorts(){
  portIn = []; portOut = []; portOutMask.fill(0);
  collectPort(PORTC.in, portIn, null);
  collectPort(PORTC.out, portOut, portOutMask);
  if(!portOut.length){                     // güvenlik ağı: en üstteki boşluğa taşı
    for(let i=0;i<cavity.length;i++) if(cavity[i]){ PORTC.out.x = i%GW; PORTC.out.y = (i/GW)|0; break; }
    collectPort(PORTC.out, portOut, portOutMask);
  }
  if(!portIn.length) collectPort(PORTC.in, portIn, null);
  airBaseD = Math.max(1, Math.hypot(PORTC.in.x-PORTC.out.x, PORTC.in.y-PORTC.out.y));
}

/* GOAL-016: burun deliğinden ostiuma, boşluk içinden geçen EN KISA yol.
   Temizlenmiş hücrelere değil, kesitin kendisine bakar — yani "havanın
   geçmesi gereken yer" hiç değişmeyen bir gerçek. Hem arka plana kanal
   parıltısı olarak boyanıyor hem de oyun içi yol göstergesi bunu izliyor. */
let cavRoute = [];
function buildRoute(){
  cavRoute = [];
  const from = new Int32Array(GW*GH).fill(-2), q = new Int32Array(GW*GH);
  let qh = 0, qt = 0;
  const si = PORTC.in.y*GW + PORTC.in.x;
  if(!cavity[si]) return;
  from[si] = -1; q[qt++] = si;
  while(qh < qt){
    const i = q[qh++], x = i%GW, y = (i/GW)|0;
    let n;
    n = i-1;  if(x>0    && cavity[n] && from[n]===-2){ from[n]=i; q[qt++]=n; }
    n = i+1;  if(x<GW-1 && cavity[n] && from[n]===-2){ from[n]=i; q[qt++]=n; }
    n = i-GW; if(y>0    && cavity[n] && from[n]===-2){ from[n]=i; q[qt++]=n; }
    n = i+GW; if(y<GH-1 && cavity[n] && from[n]===-2){ from[n]=i; q[qt++]=n; }
  }
  let goal = PORTC.out.y*GW + PORTC.out.x;
  if(from[goal] === -2){                       // port merkezi duvara denk geldiyse
    let bd = Infinity;
    for(let k=0;k<portOut.length;k++){
      const c2 = portOut[k];
      if(from[c2] === -2) continue;
      const dx = (c2%GW)-PORTC.out.x, dy = ((c2/GW)|0)-PORTC.out.y, d = dx*dx+dy*dy;
      if(d < bd){ bd = d; goal = c2; }
    }
    if(from[goal] === -2) return;
  }
  for(let i=goal;i>=0;i=from[i]){ cavRoute.push(i); if(cavRoute.length > GW*GH) break; }
  cavRoute.reverse();
}

function buildCavity(L){
  const spec = CAVITY[L.cav] || CAVITY.vestibule;
  const c = shapeCtx;
  c.setTransform(1,0,0,1,0,0);
  c.fillStyle = '#000'; c.fillRect(0,0,HW,HH);
  // GOAL-024: bölgenin sağ tarafı — aynı kesit yatayda aynalanıyor.
  const mir = L.side === 'sag';
  if(mir) c.setTransform(-SC,0,0,SC,GW*SC,0);
  else    c.setTransform(SC,0,0,SC,0,0);   // buradan sonrası ızgara birimi
  c.fillStyle = '#fff';
  spec.paint(c, L.detail|0);
  c.setTransform(1,0,0,1,0,0);
  const raw = c.getImageData(0,0,HW,HH).data;

  // yumuşatılmış maske — duvar dokusunun kenarı tırtıklı olmasın
  const edgePx = B*SC;
  for(let y=0;y<HH;y++) for(let x=0;x<HW;x++){
    if(x<edgePx||y<edgePx||x>=HW-edgePx||y>=HH-edgePx){ cavSoft[y*HW+x] = 0; continue; }
    let s = 0, n = 0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const px = x+dx, py = y+dy;
      if(px<0||py<0||px>=HW||py>=HH) continue;
      s += raw[(py*HW+px)*4]; n++;
    }
    cavSoft[y*HW+x] = s/n/255;
  }

  cavity.fill(0);
  for(let y=B;y<GH-B;y++) for(let x=B;x<GW-B;x++){
    const px = Math.min(HW-1, ((x+.5)*SC)|0), py = Math.min(HH-1, ((y+.5)*SC)|0);
    if(raw[(py*HW+px)*4] > 127) cavity[y*GW+x] = 1;
  }
  const mx = v => mir ? GW - v : v;        // portlar da aynalanıyor
  PORTC.in  = { x:mx(spec.in.x),  y:spec.in.y,  r:spec.in.r  };
  PORTC.out = { x:mx(spec.out.x), y:spec.out.y, r:spec.out.r };
  sealUnreachable();
  buildPorts();
  buildRoute();

  cavCount = 0;
  let sx = 0, sy = 0, bx0 = GW, by0 = GH, bx1 = 0, by1 = 0;
  for(let i=0;i<cavity.length;i++) if(cavity[i]){
    cavCount++;
    const x = i%GW, y = (i/GW)|0;
    sx += x; sy += y;
    if(x<bx0) bx0 = x; if(x>bx1) bx1 = x;
    if(y<by0) by0 = y; if(y>by1) by1 = y;
  }
  if(cavCount){
    cavCX = sx/cavCount; cavCY = sy/cavCount;
    /* GOAL-022 (revize): kesitin gerçekte kapladığı kutu. Alan 160x120 ama
       boşluk çoğu kesitte 120x110 civarında; aradaki fark solda ve sağda
       bomboş kemik. Çerçeveyi bu kutuya göre kurunca telefonda saha ekranın
       enini doldurabiliyor, artan kemik ekran dışında kalıyor. */
    cavBB = { x0:bx0, y0:by0, x1:bx1+1, y1:by1+1 };
  }
  fitPlate();
  layout();          // yeni kesit yeni çerçeve istiyor
}

/* Boşluk içinde, çevresi de boşluk olan rastgele bir hücre — düşman/powerup
   doğumları duvarın içine düşmesin diye. */
/* GOAL-017: bilgi levhasının oturacağı en açık nokta.
   Siklamen sabit merkeze basılıyordu ve dar pasajlı kesitlerde yarısı kemiğin
   arkasında kalıyordu. Levha bilgi taşıdığı için okunaklı olmak zorunda:
   birkaç ölçekte tarayıp levha kutusunun en çok boşluğa denk geldiği yeri
   seçiyoruz, hiçbiri tam sığmazsa en büyük kapsamı veren küçük ölçeğe düşüyoruz. */
let plateX = GW/2, plateY = GH/2, plateScale = 1;
/* Boşluğun sınırlayıcı kutusu (ızgara birimi, x1/y1 dışlayıcı) */
let cavBB = { x0:0, y0:0, x1:GW, y1:GH };
/* Saha içi yazı/etiketlerin ölçek çarpanı: saha küçüldükçe büyüyorlar ki
   telefonda "HAVA GİRİŞİ" gibi bilgiler okunaklı kalsın (bkz. layout). */
let uiScale = 1;
/* Ekranda gercekten gorunen saha dikdortgeni (saha pikseli). Kadraj kemik
   payini kirptigi icin kenara yakin etiketler disarida kalabiliyor. */
let frame = { x0:0, y0:0, x1:GW*CS, y1:GH*CS };
function fitPlate(){
  // GOAL-022: kutu ızgara genişliğine göre; dar (dikey) ızgarada 74 hücre
  // boşluğa hiç sığmıyordu.
  const BW = Math.min(74, Math.round(GW*.46)), BH = Math.round(BW*54/74);
  let fallback = null;
  for(const sc of [1, .78, .6, .46]){
    const bw = BW*sc, bh = BH*sc;
    let best = null;
    for(let y=B+bh/2; y<GH-B-bh/2; y+=2) for(let x=B+bw/2; x<GW-B-bw/2; x+=2){
      let hit = 0, n = 0;
      for(let sy=-bh/2; sy<=bh/2; sy+=bh/6) for(let sx=-bw/2; sx<=bw/2; sx+=bw/8){
        const px = Math.round(x+sx), py = Math.round(y+sy);
        n++; if(cavity[py*GW+px]) hit++;
      }
      // kapsam birinci ölçüt; eşitlikte boşluğun ağırlık merkezine yakın olan
      const score = hit/n - Math.hypot(x-cavCX, y-cavCY)*.0015;
      if(!best || score > best.score) best = { x:x, y:y, score:score, cover:hit/n, sc:sc };
    }
    if(!fallback || best.cover > fallback.cover) fallback = best;
    if(best.cover >= .92){ plateX = best.x; plateY = best.y; plateScale = sc; return; }
  }
  plateX = fallback.x; plateY = fallback.y; plateScale = fallback.sc;
}

function randomCavityCell(pad){
  pad = pad|0;
  for(let tries=0;tries<500;tries++){
    const x = (B+2+Math.random()*(GW-2*B-4))|0, y = (B+2+Math.random()*(GH-2*B-4))|0;
    const i = y*GW+x;
    if(!cavity[i]) continue;
    let ok = true;
    for(let dy=-pad;dy<=pad && ok;dy++) for(let dx=-pad;dx<=pad;dx++){
      const px = x+dx, py = y+dy;
      if(px<0||py<0||px>=GW||py>=GH||!cavity[py*GW+px]){ ok = false; break; }
    }
    if(ok) return { x:x, y:y, i:i };
  }
  return { x:PORTC.in.x, y:PORTC.in.y, i:PORTC.in.y*GW+PORTC.in.x };
}

/* Oyuncunun başlangıcı: burun deliğinin hemen altındaki duvar (kalıcı FILL). */
function playerStart(){
  const p = PORTC.in;
  for(let y=p.y;y<GH;y++) if(!cavity[y*GW+p.x]) return { x:p.x, y:y };
  return { x:GW>>1, y:GH-B };
}

/* ---- kemik/kıkırdak duvar dokusu ---- */
const wallCanvas = makeCanvas(HW,HH), wallCtx = wallCanvas.getContext('2d');
function paintWalls(L){
  const img = wallCtx.createImageData(HW,HH), d = img.data;
  const n1 = fbm(HW,HH,34,L.day*331+17,3), n2 = fbm(HW,HH,9,L.day*197+5,2);
  const bone = [hex2rgb('#120b10'), hex2rgb('#2c1a20'), hex2rgb('#4a2f36'), hex2rgb('#785654')];
  for(let i=0;i<HW*HH;i++){
    const v = cavSoft[i];
    const a = 1 - sstep(.34,.62,v);
    if(a <= .004) continue;                       // boşluk: tamamen şeffaf
    const edge = sstep(.06,.52,v);                // boşluğa yakın iç yüzey
    const t = clamp(n1[i]*.52 + n2[i]*.20 + edge*.40, 0, 1);
    let col = ramp(bone, t);
    col = mixc(col, [206,132,130], edge*edge*.46);// mukoza altı sıcaklık
    d[i*4] = col[0]; d[i*4+1] = col[1]; d[i*4+2] = col[2];
    d[i*4+3] = Math.min(255, a*255);
  }
  wallCtx.putImageData(img,0,0);
}

/* =========================================================================
   5. IZGARA + ALAN KAPATMA (değişmeyen, doğrulanmış çekirdek)
   ========================================================================= */
const cells   = new Uint8Array(GW*GH);
const markBuf = new Uint8Array(GW*GH);
function resetGrid(){
  // GOAL-015: kenar bandının yanı sıra boşluk dışındaki her hücre de kalıcı
  // FILL — yani kemik duvar. Oyuncu üstünde yürür, düşman içine giremez.
  cells.fill(EMPTY);
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){
    const i = y*GW+x;
    if(x<B||y<B||x>=GW-B||y>=GH-B || !cavity[i]) cells[i] = FILL;
  }
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
const [playerImg, bossImg, flowerImg, minionFlagellaImg, minionSporeImg] = await Promise.all([
  loadImage(playerAssetUrl), loadImage(bossAssetUrl), loadImage(flowerAssetUrl),
  loadImage(minionFlagellaAssetUrl), loadImage(minionSporeAssetUrl)
]);
/* GOAL-016: varsa bölüm arka planları (yoksa boş kalır) */
const bgAssetImgs = {}, plateAssetImgs = {};
async function loadGlob(glob, into){
  await Promise.all(Object.keys(glob).map(async k => {
    const name = k.slice(k.lastIndexOf('/')+1).replace(/\.png$/i,'').toLowerCase();
    try{ into[name] = await loadImage(glob[k]); }catch(e){}
  }));
}
await loadGlob(BG_GLOB, bgAssetImgs);
await loadGlob(PLATE_GLOB, plateAssetImgs);

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

/* GOAL-015: kemik/kıkırdak duvar — doku katmanının üstünde, boşluğun dışını
   kapatıyor. Izgara mantığında burası zaten kalıcı FILL olduğu için reveal
   makinesine (rasterRegion/dzTex) hiç dokunulmadı; sadece üstü örtülüyor. */
const wallTex = texFromCanvas(wallCanvas);
const wallSprite = new PIXI.Sprite(wallTex);
wallSprite.width = PFW; wallSprite.height = PFH;
layerBG.addChild(wallSprite);

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
  ring:   texRing(),
  wind:   texWind(),
  gust:   texGust(),
  blocked:texBlocked(),
  grain:  texGrain()
};

const grainSprite = new PIXI.Sprite(TEX.grain);
grainSprite.width = PFW*1.2; grainSprite.height = PFH*1.2;
grainSprite.blendMode = BLEND_ADD; grainSprite.alpha = .055;
layerGrain.addChild(grainSprite);

/* GOAL-015: portlar her zaman görünür — oyuncunun "nereyi nereye bağlayacağım"
   sorusuna bakışta cevap veren tek işaret bunlar. */
function makePortFX(tint){
  const g = new PIXI.Sprite(TEX.glow);
  g.anchor.set(.5); g.blendMode = BLEND_ADD; g.tint = tint; g.alpha = .2;
  const r = new PIXI.Sprite(TEX.ring);
  r.anchor.set(.5); r.blendMode = BLEND_ADD; r.tint = tint; r.alpha = .6;
  layerLight.addChild(g, r);
  return { g:g, r:r };
}

const portInFX  = makePortFX(0x7fe4ff);   // burun deliği — hava girişi
const portOutFX = makePortFX(0x9ef05a);   // ostium — hava çıkışı

/* Hava yolunun durumunu sahada gösteren parçalar:
     blockRing — havanın takıldığı noktadaki "tıkalı" simgesi
     portLabel — ilk günlerde portların ne olduğunu yazan etiketler
   GOAL-019: kanal kapalıyken sahada hareketli hiçbir işaret yok. Yürüyen
   noktalar da, duvara çarpan hava da kaldırıldı; kalıcı bir olumsuz durumu
   tekrar eden hareketle anlatmak yorucu oluyordu. Hareket artık yalnızca
   akan havaya ait, yani ekranda bir şey kıpırdıyorsa hava geçiyor demek. */
const blockRing = new PIXI.Sprite(TEX.blocked);
blockRing.anchor.set(.5); blockRing.blendMode = BLEND_ADD; blockRing.tint = 0xff6a72;
const blockGlow = new PIXI.Sprite(TEX.glow);
blockGlow.anchor.set(.5); blockGlow.blendMode = BLEND_ADD; blockGlow.tint = 0xff4d6d; blockGlow.alpha = .25;
layerLight.addChild(blockGlow, blockRing);

/* GOAL-019: kanal AÇILDIKTAN sonra rota boyunca yanan yumuşak ışık.
   Kanal kapalıyken sahada hiç hareketli nokta yok — tıkanıklığı tek simge ve
   HUD çubuğu anlatıyor, ekran sakin kalıyor. Kanal açılınca bu ışık zinciri
   yanıyor ve üzerinden bir parlaklık dalgası geçiyor; büyük ve iç içe geçtiği
   için nokta dizisi değil, ışıyan bir boru gibi okunuyor. */
const channelGlow = pool(layerLight, ()=>{ const s = new PIXI.Sprite(TEX.glow);
  s.anchor.set(.5); s.blendMode = BLEND_ADD; s.tint = 0x6fe8e0; return s; }, 34);

function texLabel(text){
  const cv = makeCanvas(320,54), c = cv.getContext('2d');
  c.font = '700 24px "Segoe UI","Noto Sans",Helvetica,Arial,sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = 8;
  c.fillStyle = '#eafcff';
  c.fillText(text, 160, 27);
  return texFromCanvas(cv);
}
function makeLabel(text){
  const s = new PIXI.Sprite(texLabel(text));
  s.anchor.set(.5); s.width = 150; s.height = 25;
  layerLight.addChild(s);
  return s;
}
const labelIn  = makeLabel('HAVA GİRİŞİ');
const labelOut = makeLabel('OSTIUM ÇIKIŞI');

/* Nefes geçtiğinde tüm alanı yalayan kısa turkuaz dalga — "geçti" anının
   basınç kızarmasıyla aynı güçte bir karşılığı olsun diye. */
const breathWave = new PIXI.Sprite(TEX.glow);
breathWave.anchor.set(.5); breathWave.x = PFW/2; breathWave.y = PFH/2;
breathWave.blendMode = BLEND_ADD; breathWave.tint = 0x7ff0e6; breathWave.alpha = 0;
layerLight.addChild(breathWave);

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

/* =========================================================================
   6b. HAVA AKIŞI (GOAL-015)

   Temizlenen hücreler açılmış hava yoludur. Her nefes denemesinde burun
   deliğinden (portIn) başlayıp yalnızca TEMİZLENMİŞ boşluk hücreleri üzerinden
   yayılan bir genişlik-öncelikli arama yapıyoruz:
     - ostiuma (portOut) ulaşırsa nefes geçiyor,
     - ulaşamazsa nereye kadar geldiğini (reach) ölçüp oradan geri dönüyoruz.
   reach sürekli bir değer olduğu için HUD "%62 hava yolu" diyebiliyor ve
   kısmi ilerleme de ödüllendirilebiliyor — "hava gitmeye çalışıyor ama
   gidemiyor" hissi tam olarak bu.
   ========================================================================= */
const airSeen = new Uint8Array(GW*GH);
const airFrom = new Int32Array(GW*GH);
const airQ    = new Int32Array(GW*GH);
let airway = { reach:0, open:false, path:[], front:0 };

function computeAirway(){
  airSeen.fill(0);
  let qh = 0, qt = 0;
  for(let k=0;k<portIn.length;k++){
    const i = portIn[k];
    if(cells[i] === FILL && !airSeen[i]){ airSeen[i] = 1; airFrom[i] = -1; airQ[qt++] = i; }
  }
  let best = -1, bestD = Infinity, open = false;
  const ox = PORTC.out.x, oy = PORTC.out.y;
  while(qh < qt){
    const i = airQ[qh++], x = i%GW, y = (i/GW)|0;
    const dx = x-ox, dy = y-oy, d = Math.sqrt(dx*dx+dy*dy);
    if(d < bestD){ bestD = d; best = i; }
    if(portOutMask[i]) open = true;
    let n;
    n = i-1;  if(x>0    && !airSeen[n] && cavity[n] && cells[n]===FILL){ airSeen[n]=1; airFrom[n]=i; airQ[qt++]=n; }
    n = i+1;  if(x<GW-1 && !airSeen[n] && cavity[n] && cells[n]===FILL){ airSeen[n]=1; airFrom[n]=i; airQ[qt++]=n; }
    n = i-GW; if(y>0    && !airSeen[n] && cavity[n] && cells[n]===FILL){ airSeen[n]=1; airFrom[n]=i; airQ[qt++]=n; }
    n = i+GW; if(y<GH-1 && !airSeen[n] && cavity[n] && cells[n]===FILL){ airSeen[n]=1; airFrom[n]=i; airQ[qt++]=n; }
  }
  const path = [];
  if(best >= 0){
    for(let i=best;i>=0;i=airFrom[i]){ path.push(i); if(path.length > GW*GH) break; }
    path.reverse();
  }
  airway.open  = open;
  airway.reach = best < 0 ? 0 : clamp(1 - bestD/airBaseD, 0, 1);
  if(open) airway.reach = 1;
  airway.path  = path;
  // GOAL-016: havanın takıldığı nokta. Hiç temizlenmemişse burun deliğinin
  // kendisi — yani gösterge hep bir yeri işaret eder, hiç boş kalmaz.
  airway.front = best >= 0 ? best : (PORTC.in.y*GW + PORTC.in.x);
  return airway;
}

const airPuffs = [];
const airPool = pool(layerLight, ()=>{ const s = new PIXI.Sprite(TEX.spark);
  s.anchor.set(.5); s.blendMode = BLEND_ADD; return s; }, 56);
function spawnAirFlow(path, ok, count){
  // GOAL-018: yalnızca açık kanalda akış çizilir. Tıkalıyken hava yola çıkıp
  // duvara çarpmıyor; tıkanıklığı simge ve gösterge anlatıyor.
  if(!ok) return;
  if(!path || path.length < 2) return;
  const n = count || clamp((path.length/7)|0, 6, 22);
  for(let k=0;k<n;k++){
    // GOAL-019: her şerit kendi genliğinde dalgalanarak ilerliyor; ince hızlı
    // teller ile geniş yumuşak parıltılar karışınca akış katmanlı görünüyor.
    const thin = Math.random() < .5;
    airPuffs.push({
      p:path, u:-k*.05, spd:(thin?.24:.17)+Math.random()*.08, ok:ok,
      lane0:rnd(-3.2,3.2),        // temel şerit
      weave:rnd(.7,2.3),          // dalgalanma genliği
      wfreq:rnd(1.1,2.7),         // dalgalanma sıklığı
      wph:rnd(0,6.28),
      len:thin ? rnd(46,84) : rnd(30,58),
      thin:thin,
      gust:Math.random() < .16
    });
  }
}
function updateAirFlow(dt){
  for(let i=airPuffs.length-1;i>=0;i--){
    const a = airPuffs[i];
    a.u += a.spd*dt;
    if(a.u >= 1){
      const c = a.p[a.p.length-1];
      burst(c%GW, (c/GW)|0, 2, 0x9ff0ec, .5);   // ostiumdan dışarı kaçan hava
      G.portFlare = 1;
      airPuffs.splice(i,1);
    }
  }
  for(let i=0;i<airPool.length;i++){
    const s = airPool[i], a = airPuffs[i];
    if(!a || a.u <= 0){ s.visible = false; continue; }
    const u = clamp(a.u,0,1), last = a.p.length-1;
    const j  = Math.min(last, (u*last)|0);
    const c  = a.p[j];
    // akışın o noktadaki yönü — şerit bu yöne dönecek
    const c2 = a.p[Math.min(last, j+4)];
    const ang = Math.atan2(((c2/GW)|0)-((c/GW)|0), (c2%GW)-(c%GW));
    const px = ((c%GW)+.5)*CS, py = (((c/GW)|0)+.5)*CS;
    // şerit kendi ekseninde dalgalanıyor — düz paralel hatlar yerine örgü
    const lane = a.lane0 + Math.sin(u*Math.PI*2*a.wfreq + a.wph)*a.weave;
    // girişte yumuşak beliriş, çıkışta sönüş
    const env = clamp(u/.14,0,1) * clamp((1-u)/.22,0,1);
    s.visible = true;
    s.rotation = ang;
    s.x = px + Math.cos(ang+Math.PI/2)*lane*CS;
    s.y = py + Math.sin(ang+Math.PI/2)*lane*CS;
    if(a.gust){
      s.texture = TEX.gust;
      s.width = a.len*.8; s.height = a.len*.30;
      s.tint = 0xd6fffa; s.alpha = .42*env;
    } else if(a.thin){
      s.texture = TEX.wind;
      s.width = a.len*(.6+env*.4); s.height = 5;
      s.tint = 0xeafffc; s.alpha = .55*env;
    } else {
      s.texture = TEX.wind;
      s.width = a.len*(.6+env*.4); s.height = 15;
      s.tint = 0x8fe4ee; s.alpha = .30*env;
    }
  }
}

/* GOAL-009: uçan skor yazıları — particles[]/partSprites ile birebir aynı
   havuz+yaşam-döngüsü deseni, sadece kıvılcım yerine sayı dokusu çiziyor. */
const scorePops = [];
const scorePopPool = pool(layerEnt, ()=>{ const s = new PIXI.Sprite(TEX.spark);
  s.anchor.set(.5); return s; }, 6);
function spawnScorePopup(gx, gy, amount){
  if(amount <= 0) return;
  const cv = makeCanvas(220,64), c = cv.getContext('2d');
  c.font = '700 34px "Segoe UI","Noto Sans",Helvetica,Arial,sans-serif';
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
    s.x = p.x*CS; s.y = p.y*CS - k*46*uiScale;
    s.width = 150*uiScale; s.height = 44*uiScale;
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
  shake:0, laserCd:0, time:0,
  // GOAL-015: nefes döngüsü ve basınç
  pressure:0, breathT:10, breathStreak:0, breathCue:false, beatT:0, airwayWasOpen:false,
  airAmbT:0, portFlare:0, breathFlash:0, blockFlash:0
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
  menuScreen:$('menuScreen'), menuContent:$('menuContent'),
  // GOAL-015
  press:$('pressFill'), pressWrap:$('pressWrap'),
  airway:$('airway'), airPct:$('airPct'), breathBar:$('breathBar'),
  airFill:$('airFill'), airMark:$('airMark'),
  // GOAL-021: her göstergenin yanında artık sayısal değer de var
  doseVal:$('doseVal'), pressVal:$('pressVal'), breathVal:$('breathVal'),
  veil:$('pressVeil'),
  hint:$('touchHint'),         // GOAL-022: dokunmatik kontrol ipucu
  hudInner:$('hudInner')       // GOAL-023: eni tahtanın enine bağlanıyor
};
/* İpucu bir kez sürükledikten sonra bir daha gösterilmiyor. */
const HINT_KEY = 'nasodren_touchhint_v1';
let hintSeen = false;
try{ hintSeen = localStorage.getItem(HINT_KEY) === '1'; }catch(e){}
function showTouchHint(on){
  UI.hint.classList.toggle('on', !!on && !hintSeen);
}
function retireTouchHint(){
  if(hintSeen) return;
  hintSeen = true;
  try{ localStorage.setItem(HINT_KEY,'1'); }catch(e){}
  UI.hint.classList.remove('on');
}
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
  // GOAL-024: HUD basligi artik gunun temasi degil BOLGE — oyun sirasinda
  // asil gereken bilgi nerede oldugumuz; gunun adi brifingde ve haritada zaten
  // duruyor. Genis ekranda ikisi birden siga.
  UI.name.innerHTML = '<b>'+escapeHtml(L.regionName)+'</b><i>· '+L.sideName+'</i>'
    + '<u>'+escapeHtml(L.name)+'</u>';
  UI.fill.style.width = (G.pct*100).toFixed(1)+'%';
  UI.goal.style.left = (L.target*100)+'%';
  const met = G.pct >= L.target && airway.open;   // GOAL-015: iki koşul birden
  UI.pct.className = met ? 'met' : '';
  // GOAL-021: hedef ve uyarı artık serbest metin değil, ayrı okunur rozetler
  UI.pct.innerHTML = '<b>%'+Math.floor(G.pct*100)+'</b> temizlendi'
    + '<span class="tag">hedef %'+Math.round(L.target*100)+'</span>'
    + (G.pct >= L.target && !airway.open ? '<span class="tag warn">hava yolu kapalı</span>' : '');
  UI.score.textContent = G.score.toLocaleString('tr-TR');
  const dr = clamp(G.dose/G.doseMax,0,1);
  UI.dose.style.width = (dr*100)+'%';
  UI.doseVal.textContent = '%'+Math.round(dr*100);
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
  if(G.pressure >= .7) bf += '<div class="buff warn">Basınç kritik</div>';
  UI.buffs.innerHTML = bf;

  // GOAL-015: basınç çubuğu + hava yolu rozeti + nefes geri sayımı
  const pr = clamp(G.pressure,0,1);
  Sound.tension(pr);   // GOAL-020: basınç arttıkça müzik hafifçe parlıyor
  UI.press.style.width = (pr*100).toFixed(1)+'%';
  UI.pressVal.textContent = '%'+Math.round(pr*100);
  UI.pressWrap.classList.toggle('high', pr >= .6);
  const ar = clamp(airway.reach,0,1);
  UI.airFill.style.width = (ar*100).toFixed(1)+'%';
  UI.airMark.style.left  = (ar*100).toFixed(1)+'%';
  UI.airPct.textContent = airway.open ? 'AÇIK' : '%'+Math.round(ar*100);
  UI.airway.classList.toggle('open', airway.open);
  UI.airway.classList.toggle('partial', !airway.open && airway.reach >= .5);
  UI.breathBar.style.width = (clamp(G.breathT/Math.max(1,G.level.breath),0,1)*100).toFixed(1)+'%';
  UI.breathVal.textContent = Math.max(0,Math.ceil(G.breathT))+'s';
}
function showPanel(html){ UI.hint.classList.remove('on'); UI.plate.innerHTML = html; UI.overlay.classList.add('on');
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
  UI.hint.classList.remove('on');
  hidePanel(); // olası açık overlay (pause vb.) ile çakışmasın
  UI.menuContent.innerHTML = html;
  UI.menuScreen.classList.add('on');
  const b = UI.menuContent.querySelector('button[data-a]'); if(b) setTimeout(()=>b.focus(), 30);
}
function hideMenuScreen(){ UI.menuScreen.classList.remove('on'); }
/* GOAL-020: ses kaydırıcıları. Ayarlar ekranı iki ayrı kapta (duraklatma
   paneli / tam ekran menü) doğabildiği için ikisinde de delegasyonla
   dinleniyor; değer anında uygulanıp localStorage'a yazılıyor. */
function onVolInput(e){
  const el = e.target.closest ? e.target.closest('input[data-vol]') : null;
  if(!el) return;
  const key = el.dataset.vol, v = (parseInt(el.value,10)||0)/100;
  Sound.set(key, v);
  const read = document.getElementById('vol-'+key+'-read');
  if(read) read.textContent = '%'+Math.round(v*100);
  syncSoundBtn();
}
/* Kaydırıcıyı bırakınca kısa bir örnek ses — kaç desibel olduğunu duymadan
   ayarlamak zor. */
function onVolChange(e){
  const el = e.target.closest ? e.target.closest('input[data-vol]') : null;
  if(!el) return;
  if(el.dataset.vol !== 'music') Sound.pickup();
}
UI.overlay.addEventListener('input', onVolInput);
UI.menuScreen.addEventListener('input', onVolInput);
UI.overlay.addEventListener('change', onVolChange);
UI.menuScreen.addEventListener('change', onVolChange);
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
  Sound.scene('menu');   // GOAL-020
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
  Sound.scene('menu');   // GOAL-020
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
       <button class="menuBtn" data-a="settings">AYARLAR</button>
     </div>`);
}
/* GOAL-025: assets/sinuzit.png artık bir arayüz öğesi değil, kesitlerin
   TASARIM KAYNAĞI (bkz. CAVITY). Oyuncu bölgeyi haritadan değil tahtanın
   kendi biçiminden tanıyor; brifingde de adı ve bir cümlelik künyesi duruyor. */
function regionRowHTML(L){
  return '<p class="note"><b>'+escapeHtml(L.regionName.toUpperCase())+' &nbsp;·&nbsp; '+L.sideName+
    '</b><br>'+escapeHtml(L.regionAbout)+'</p>';
}
function showLevelSelect(){
  // GOAL-014 (madde 2): kilit sistemi yok, her gün doğrudan başlatılabilir.
  // GOAL-025: bölge adı kartın başlığı; hangi bölümün hangi sinüste geçtiği
  // listeden okunuyor.
  const cards = LEVELS.map((L,i) =>
    `<button class="levelBtn" data-a="pick-${i}">
       <span class="levelDay">GÜN ${String(L.day).padStart(2,'0')} · ${L.sideName}</span>
       <span class="levelName">${L.regionName}</span>
       <span class="levelName" style="color:var(--muted);font-weight:500">${L.name}</span>
     </button>`).join('');
  showMenuScreen(
    `<div class="menuBrand"><div class="kicker">BÖLÜMLER</div><div class="title">Gün Seç</div></div>
     <div class="levelGrid">${cards}</div>
     <div class="menuStack menuBack">
       <button class="menuBtn ghost" data-a="mainmenu">◀ ANA MENÜ</button>
     </div>`);
}

/* =========================================================================
   8c. SES AYARLARI (GOAL-020)
   Müzik ve efekt seviyeleri ayrı ayrı; hem ana menüden hem duraklatma
   ekranından açılıyor, çünkü "şu müziği biraz kıs" isteği çoğu zaman oyunun
   tam ortasında geliyor ve bunun için oyundan çıkmak gerekmemeli.
   ========================================================================= */
let settingsFrom = 'main';
function volRow(key, label, val){
  const pct = Math.round(val*100);
  return `<div class="volRow">
       <div class="volHead"><span>${label}</span><b id="vol-${key}-read">%${pct}</b></div>
       <input class="volSlider" type="range" min="0" max="100" step="1" value="${pct}"
              data-vol="${key}" aria-label="${label} seviyesi">
     </div>`;
}
function settingsBody(){
  return `<div class="volList">
       ${volRow('master','ANA SES',   AudioPrefs.master)}
       ${volRow('music', 'MÜZİK',     AudioPrefs.music)}
       ${volRow('sfx',   'EFEKTLER',  AudioPrefs.sfx)}
     </div>
     <div class="menuStack">
       <button class="menuBtn ghost" data-a="togglesound">${AudioPrefs.muted ? 'SESİ AÇ' : 'SESİ KAPAT'}</button>
       <button class="menuBtn" data-a="settingsback">◀ GERİ</button>
     </div>`;
}
function showSettings(from){
  settingsFrom = (from === 'pause') ? 'pause' : 'main';
  if(settingsFrom === 'pause'){
    // Duraklatma üstünden açıldığında oyun ekranı arkada kalsın diye panel.
    showPanel(`<div class="kicker">AYARLAR</div><div class="title">Ses</div>${settingsBody()}`);
  } else {
    showMenuScreen(
      `<div class="menuBrand"><div class="kicker">AYARLAR</div><div class="title">Ses</div></div>
       ${settingsBody()}`);
  }
}
/* Alt köşedeki hızlı sus düğmesinin görünümü, ayarlar ekranıyla senkron kalsın */
function syncSoundBtn(){
  const b = $('btnSound');
  b.textContent = Sound.on ? 'SES' : 'SUS';
  b.style.color = Sound.on ? '' : 'rgba(255,255,255,.25)';
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
  else if(a === 'settings')      showSettings('main');
  else if(a === 'settingspause')  showSettings('pause');
  else if(a === 'settingsback'){  if(settingsFrom === 'pause') showPausePanel(); else showMainMenu(); }
  else if(a === 'togglesound'){   Sound.toggle(); syncSoundBtn(); showSettings(settingsFrom); }
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
  Sound.toggle();
  syncSoundBtn();
};
syncSoundBtn();   // GOAL-020: kayıtlı ayar (localStorage) açılışta yansısın
$('btnPause').onclick = () => togglePause();
// GOAL-014 (madde 4): yatay buton sırası yerine dikey, büyük, gerçek
// oyun-menüsü hissi veren .menuStack/.menuBtn (ana menüyle aynı bileşen).
// GOAL-020: ayarlardan geri dönebilmek için ayrı fonksiyon.
function showPausePanel(){
  showPanel(
    `<div class="kicker">DURAKLATILDI</div>
     <div class="title">Gün ${G.level.day}</div>
     <p class="lede">${G.level.name} · alanın %${Math.floor(G.pct*100)}’i temizlendi, hedef %${Math.round(G.level.target*100)}.</p>
     <div class="menuStack">
       <button class="menuBtn primary" data-a="resume">DEVAM ET</button>
       <button class="menuBtn" data-a="settingspause">AYARLAR</button>
       <button class="menuBtn" data-a="restart">YENİDEN BAŞLAT</button>
       <button class="menuBtn ghost" data-a="mainmenu">ANA MENÜ</button>
     </div>`);
}
function togglePause(){
  if(G.state === 'play'){ G.state = 'paused'; showPausePanel(); }
  else if(G.state === 'paused'){ hidePanel(); G.state = 'play'; }
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
  retireTouchHint();           // GOAL-022
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
  // GOAL-015: sabit merkez yerine gerçekten boşluk olan, çevresi de açık bir hücre
  const c0 = randomCavityCell(Math.ceil(L.bossR*.7));
  return { x:c0.x, y:c0.y,
           vx:Math.cos(a+1)*L.bossSpd, vy:Math.sin(a+1)*L.bossSpd,
           r:L.bossR, spd:L.bossSpd, t:rnd(0,6), fireT:rnd(1,3), s:s, g:g };
}
function spawnMinion(L){
  const a = rnd(0,7), d = rnd(GH*.12, GH*.4), kind = Math.random()<.55?0:1;
  const s = new PIXI.Sprite(TEX.mini[kind]);
  s.anchor.set(.5); s.width = 30; s.height = 30 * MINI_AR[kind]; // GOAL-012: en-boy oranı korunuyor, görünür boyut hissi (30) aynı
  layerEnt.addChild(s);
  const c0 = randomCavityCell(3);   // GOAL-015
  return { x:c0.x, y:c0.y,
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
  buildCavity(L);                        // GOAL-015: önce kesit, sonra boyalar
  paintHealthy(L); texUpdate(bgTex);
  paintTissue(L);
  paintWalls(L); texUpdate(wallTex);
  preparedIdx = idx;
}
function startLevel(){
  const L = LEVELS[G.levelIdx];
  G.level = L;
  // GOAL-015: ızgara artık kesite bağlı olduğu için prepareLevel resetGrid'den ÖNCE
  clearEntities(); prepareLevel(G.levelIdx); resetGrid();
  rasterRegion(0,0,GW,GH);
  G.filled=0; G.pct=0; G.drawing=false; G.trail=[]; G.corners=[];
  const st = playerStart();
  G.dir=0; G.frac=0; G.lastDir=0; G.px=st.x; G.py=st.y; G.startCell=G.py*GW+G.px;
  G.pressure=0; G.breathT=L.breath; G.breathStreak=0; G.breathCue=false; G.beatT=0;
  G.airwayWasOpen=false;
  airPuffs.length = 0;
  G.airAmbT = 0; G.portFlare = 0; G.breathFlash = 0; G.blockFlash = 0;
  UI.airway.classList.remove('soon');
  computeAirway();
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
    const pc = randomCavityCell(1);   // GOAL-015
    G.pus.push({ x:pc.x, y:pc.y, k:k, s:s, g:g, t:rnd(0,6) });
  }
  hidePanel();
  G.state = 'play';
  Sound.scene(L.music, L.day); // GOAL-020/024: bölgenin ritimli müziği
  showTouchHint(isTouch);      // GOAL-022: ilk sürüklemeye kadar
  syncHUD();
}
function introLevel(){
  if(G.levelIdx >= LEVELS.length){ winGame(); return; }
  hideMenuScreen(); // GOAL-014: tam ekran menüden (ana menü/bölümler) geliniyorsa kapat
  const L = LEVELS[G.levelIdx];
  G.state = 'intro';
  // GOAL-020: brifing ekrani sakin menu muzigiyle okunsun; ritim BASLA'ya
  // basinca girsin (bkz. startLevel) — bolumun basladigi an duyulsun diye.
  Sound.scene('menu');
  // GOAL-013 (madde 2): uzun tıbbi paragraflar kaldırıldı — tek kısa çengel
  // cümle (L.med, artık 3-6 kelime) + hedef yüzdesi, 2 saniyede okunabilir.
  // GOAL-019: günün bilgi görseli artık bölüm girişinde de gösteriliyor.
  // Sahada ancak temizledikçe açığa çıktığı için oyuncu onu hiç görmeden
  // günü bitirebiliyordu; asıl bilgilendirme anı burası.
  const thumb = plateThumbURL(L);
  const cap = PLATE_CAPS[L.day-1] || '';
  showPanel(
    `<div class="kicker">GÜN ${String(L.day).padStart(2,'0')} &nbsp;·&nbsp; HEDEF %${Math.round(L.target*100)}</div>
     <div class="title">${L.name}</div>
     ${regionRowHTML(L)}
     ${thumb ? `<div class="plateShot"><img src="${thumb}" alt="">
        <div><b>${cap}</b><p>${L.med}</p></div></div>` : `<p class="note">${L.med}</p>`}
     <p class="lede">Alanın <b>%${Math.round(L.target*100)}</b>'ini temizle <b>ve</b>
        mavi halkadan (burun deliği) yeşil halkaya (ostium) kesintisiz bir kanal aç.
        Her <b>${L.breath.toFixed(0)} saniyede</b> bir nefes denemesi olacak: kanal
        kapalıysa basınç yükselir ve ekran kızarır.</p>
     <div class="acts"><button class="cta" data-a="go">BAŞLA</button></div>`);
}
function winGame(){
  G.state = 'won';
  Sound.scene('win');   // GOAL-020
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
    if(x>=B && y>=B && x<GW-B && y<GH-B && cavity[i]) gain++;   // GOAL-015
  }
  rasterRegion(minX, minY, maxX, maxY);

  let f = 0;
  for(let y=B;y<GH-B;y++){ const row = y*GW; for(let x=B;x<GW-B;x++){ const i = row+x;
    if(cavity[i] && cells[i]===FILL) f++; } }
  G.filled = f;
  const prev = G.pct;
  G.pct = f/Math.max(1,cavCount);   // GOAL-015: payda artık boşluk hücre sayısı
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

  /* GOAL-015: her kapanıştan sonra kanalı yeniden ölç. Hücreler sadece burada
     değiştiği için bu tek nokta yeterli — hava yolu rozeti anında tepki
     veriyor, yani "kanalı bağladım" anı oyuncuya hemen geri bildiriliyor. */
  const wasOpen = G.airwayWasOpen;
  computeAirway();
  G.airwayWasOpen = airway.open;
  if(airway.open && !wasOpen){
    G.score += 1200;
    spawnAirFlow(airway.path, true);
    G.breathFlash = 1;
    spawnScorePopup(PORTC.out.x, PORTC.out.y, 1200);
    toast('HAVA YOLU AÇILDI', 'BURUN DELİĞİ ↔ OSTIUM BAĞLANDI · +1200');
    Sound.breathOpen();
    G.pressure = Math.max(0, G.pressure - .25);
  }

  if(G.pct >= G.level.target){
    if(airway.open) levelClear();
    // Alan hedefi dolduğu halde gün bitmiyorsa sebebini her kapanışta söyle:
    // sessiz kalmak, oyuncunun "bozuldu mu?" diye düşündüğü en kötü an olurdu.
    else toast('HEDEF TAMAM', 'HAVA YOLU %'+Math.round(airway.reach*100)+' — YEŞİL HALKAYA BAĞLAN');
  }
  syncHUD();
}
/* =========================================================================
   12b. NEFES DÖNGÜSÜ (GOAL-015)

   Vücut belirli aralıklarla nefes almayı deniyor. Üç sonuç var:
     AÇIK    — kanal tam: büyük puan, seri bonusu, basınç düşer, doz tazelenir
     SIZINTI — hava yolun yarısından fazlasını geçti: küçük puan, az basınç
     TIKALI  — hava duvara çarptı: basınç zıplar, ekran sarsılır

   Basınç ekranı kızartan tek değişken. Tavana vurduğunda oyuncuyu öldürmüyor;
   bunun yerine hapşırma tetikleniyor. Ölüm spirali yerine gösterişli bir
   tahliye: basınç boşalıyor ama havadaki çizgin dağılıyor.
   ========================================================================= */
function doBreath(){
  const L = G.level;
  G.breathT = L.breath; G.breathCue = false;
  UI.airway.classList.remove('soon');
  computeAirway();
  if(airway.open){
    G.breathStreak++;
    const gain = 700 + G.breathStreak*350;
    G.score += gain;
    G.pressure = Math.max(0, G.pressure - .42);
    G.dose = clamp(G.dose + G.doseMax*.22, 0, G.doseMax);
    spawnAirFlow(airway.path, true);
    G.breathFlash = 1;
    spawnScorePopup(PORTC.out.x, PORTC.out.y, gain);
    toast('NEFES GEÇTİ', G.breathStreak > 1
      ? G.breathStreak+'. TEMİZ NEFES · +'+gain
      : 'HAVA YOLU AÇIK · +'+gain);
    Sound.breathOpen();
  } else if(airway.reach >= .5){
    G.breathStreak = 0;
    G.score += 150;
    G.pressure = clamp(G.pressure + L.pressGain*.45, 0, 1);
    G.blockFlash = 1;
    toast('SIZINTI', 'HAVA %'+Math.round(airway.reach*100)+' İLERLEDİ');
    Sound.leak(); G.shake = Math.max(G.shake, 4);
  } else {
    G.breathStreak = 0;
    G.pressure = clamp(G.pressure + L.pressGain, 0, 1);
    G.blockFlash = 1;
    toast('TIKALI', 'BASINÇ ARTIYOR');
    Sound.blocked(); G.shake = Math.max(G.shake, 7);
  }
  if(G.pressure >= .999) sneezeRelease();
  syncHUD();
}

function sneezeRelease(){
  G.pressure = .3; G.shake = 22;
  Sound.sneeze();
  for(const b of G.bullets) b.s.destroy();
  G.bullets = [];
  for(const m of G.minions){                 // düşmanlar dağılır, ölmez
    const c = randomCavityCell(3);
    burst(m.x, m.y, 8, 0xffb0d2, .8);
    m.x = c.x; m.y = c.y;
  }
  if(G.drawing){                             // havadaki çizgi kaybolur (ölüm yok)
    for(const i of G.trail) cells[i] = EMPTY;
    G.trail = []; G.corners = []; G.drawing = false;
    G.dir = 0; G.frac = 0; G.lastDir = 0;
    if(cells[G.startCell] === FILL){ G.px = G.startCell % GW; G.py = (G.startCell/GW)|0; }
    else { const st = playerStart(); G.px = st.x; G.py = st.y; G.startCell = st.y*GW+st.x; }
  }
  G.dose = Math.max(0, G.dose - G.doseMax*.2);
  G.invuln = Math.max(G.invuln, 1.2);
  toast('HAPŞUU!', 'BASINÇ BOŞALDI · ÇİZGİN DAĞILDI');
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
  const breathBonus = G.breathStreak*600;   // GOAL-015: kesintisiz nefes serisi
  G.score += Math.max(0,bonus) + breathBonus;
  Sound.clear();
  const last = G.levelIdx >= LEVELS.length-1;
  showPanel(
    `<div class="kicker">GÜN ${String(G.level.day).padStart(2,'0')} TAMAMLANDI</div>
     <div class="title">%${Math.floor(G.pct*100)} <em>temizlendi</em></div>
     <p class="note">${G.level.med}</p>
     <div class="stats">
       <div><span>ALAN BONUSU</span><b>${Math.max(0,bonus).toLocaleString('tr-TR')}</b></div>
       <div><span>NEFES SERİSİ</span><b>${G.breathStreak}</b></div>
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
  // GOAL-015: geçersiz başlangıçta sabit alt-orta yerine burun deliğinin dibi
  if(cells[G.startCell] !== FILL){ const st = playerStart(); G.px = st.x; G.py = st.y; }
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
  // GOAL-015: kesit geometrisi yüzünden bir düşman duvarın içinde kalırsa
  // (dar koridor + yüksek hız) boşluğun merkezine doğru nazikçe geri itilir.
  const ci = clamp(Math.round(e.y),0,GH-1)*GW + clamp(Math.round(e.x),0,GW-1);
  if(!cavity[ci]){
    const a = Math.atan2(cavCY-e.y, cavCX-e.x), sp = Math.hypot(e.vx,e.vy) || e.spd;
    e.vx = Math.cos(a)*sp; e.vy = Math.sin(a)*sp;
    e.x += e.vx*dt*1.6; e.y += e.vy*dt*1.6;
    return;
  }
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
  // GOAL-015: basınç yükseldikçe doku öfkeleniyor — tıkanıklığın ikinci bedeli
  const rage = 1 + G.pressure*.35;
  for(const b of G.bosses){
    moveEnemy(b, dt*rage, 1.1); b.t += dt;
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
    moveEnemy(m, dt*rage, .35);
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

  /* GOAL-015: portlar ve basınç perdesi */
  {
    const pi = PORTC.in, po = PORTC.out, bp = 1 + Math.sin(t*2.4)*.10;
    portInFX.g.x = portInFX.r.x = (pi.x+.5)*CS;
    portInFX.g.y = portInFX.r.y = (pi.y+.5)*CS;
    // nefes denemesi yaklaşırken giriş halkası belirgin şekilde nefes alır
    portInFX.r.width = portInFX.r.height = pi.r*2.8*CS*bp*(G.breathCue ? 1.18 : 1);
    portInFX.g.width = portInFX.g.height = pi.r*4.6*CS;
    portInFX.g.alpha = .16 + Math.sin(t*2.4)*.05;
    portOutFX.g.x = portOutFX.r.x = (po.x+.5)*CS;
    portOutFX.g.y = portOutFX.r.y = (po.y+.5)*CS;
    portOutFX.r.width = portOutFX.r.height = po.r*2.8*CS*(2-bp);
    portOutFX.r.alpha = airway.open ? .72 + Math.sin(t*5.2)*.2 + G.portFlare*.5 : .34;
    portOutFX.g.width = portOutFX.g.height = po.r*4.6*CS;
    portOutFX.g.alpha = (.14 + Math.sin(t*2.9)*.05) * (airway.open ? 1.8 : 1);
  }
  /* GOAL-016: tıkanma işaretçisi + yol göstergesi */
  {
    const open = airway.open;
    const fx2 = ((airway.front%GW)+.5)*CS, fy2 = (((airway.front/GW)|0)+.5)*CS;
    blockRing.visible = blockGlow.visible = !open;
    if(!open){
      // sakin bir nefes ritmi; nefes denemesi olduğunda bir kez büyüyüp söner
      const pulse = 1 + Math.sin(t*1.9)*.07 + G.blockFlash*.55;
      blockRing.x = blockGlow.x = fx2; blockRing.y = blockGlow.y = fy2;
      blockRing.width = blockRing.height = 44*pulse;
      blockRing.alpha = .52 + Math.sin(t*1.9)*.10 + G.blockFlash*.4;
      blockGlow.width = blockGlow.height = 110 + G.blockFlash*70;
      blockGlow.alpha = .14 + G.blockFlash*.22;
    }
    if(G.blockFlash > 0) G.blockFlash = Math.max(0, G.blockFlash - dt*1.8);
    const len = cavRoute.length;
    const N = channelGlow.length;
    for(let i=0;i<N;i++){
      const s = channelGlow[i];
      if(!open || len < 8){ s.visible = false; continue; }
      const cel = cavRoute[Math.round(i/(N-1)*(len-1))];
      const u = i/(N-1);
      const w = .5 + .5*Math.sin(u*6.2 - t*2.1);   // boru boyunca geçen parlaklık
      s.visible = true;
      s.x = ((cel%GW)+.5)*CS; s.y = (((cel/GW)|0)+.5)*CS;
      s.width = s.height = 26 + w*12;
      s.alpha = .07 + w*.08;
    }
  }
  /* port etiketleri — öğretme dönemi bitince geri çekiliyor */
  {
    const a0 = G.level.day <= 3 ? .8 : .3;
    // GOAL-022 (revize): etiketler ekranda sabit boyda kalsın diye uiScale ile
    labelIn.width  = 150*uiScale; labelIn.height  = 25*uiScale;
    labelOut.width = 150*uiScale; labelOut.height = 25*uiScale;
    // kadrajin disina tasmasinlar: yaridan az kalan etiket okunmuyor
    const lhw = labelIn.width/2 + 4;
    labelIn.x  = clamp((PORTC.in.x+.5)*CS,  frame.x0+lhw, frame.x1-lhw);
    labelOut.x = clamp((PORTC.out.x+.5)*CS, frame.x0+lhw, frame.x1-lhw);
    labelIn.y  = (PORTC.in.y+.5)*CS  + PORTC.in.r*CS  + 16*uiScale;
    labelOut.y = (PORTC.out.y+.5)*CS - PORTC.out.r*CS - 16*uiScale;
    labelIn.alpha = a0;
    labelOut.alpha = airway.open ? a0 : a0 * (.7 + Math.sin(t*3.2)*.3);
  }
  /* nefes geçti dalgası */
  if(G.breathFlash > 0){
    G.breathFlash = Math.max(0, G.breathFlash - dt*1.6);
    breathWave.alpha = G.breathFlash*.30;
    breathWave.width = PFW*(1.1 + (1-G.breathFlash)*.5);
    breathWave.height = PFH*(1.3 + (1-G.breathFlash)*.5);
  } else breathWave.alpha = 0;
  if(G.portFlare > 0) G.portFlare = Math.max(0, G.portFlare - dt*2.4);

  if(UI.veil){
    // nabız: basınç yükseldikçe hem koyulaşıyor hem hızlanıyor
    const beat = .84 + Math.sin(t*(4.0 + G.pressure*3.4))*.16;
    UI.veil.style.opacity = (clamp(G.pressure,0,1)*.85*beat).toFixed(3);
  }

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
function layout(pass){
  const w = window.innerWidth, h = window.innerHeight;
  app.renderer.resize(w,h);
  const hudEl = document.getElementById('hud');
  const top = (hudEl ? hudEl.offsetHeight : 110) + 8;
  const bottom = isTouch ? 74 : 44;
  // GOAL-022: dokunmatikte yan boşluk daraltıldı — telefonda her piksel alan.
  const availW = w - (isTouch ? 12 : 24), availH = Math.max(60, h - top - bottom);

  /* GOAL-022 (revize): tüm alanı değil, boşluğun kutusunu + ince bir kemik
     payını çerçeveliyoruz. Ölçek her iki eksende de aynı, yani hiçbir şey
     esnemiyor; sadece kadraj sıkılaşıyor. */
  const M = 4;                                   // kemik payı, ızgara birimi
  const fx0 = Math.max(0, cavBB.x0 - M), fx1 = Math.min(GW, cavBB.x1 + M);
  const fy0 = Math.max(0, cavBB.y0 - M), fy1 = Math.min(GH, cavBB.y1 + M);
  const fw = Math.max(1, (fx1-fx0)*CS), fh = Math.max(1, (fy1-fy0)*CS);
  const s = Math.min(availW/fw, availH/fh);
  root.scale.set(s);
  root.x = w/2 - (fx0+fx1)/2*CS*s;
  // Telefonda kadrajı yukarı yaslıyoruz: altta kalan bant baş parmağın
  // oynadığı yer. Masaüstünde ortalı.
  // Dokunmatikte kadraj merkezin biraz üstünde: altta kalan bant baş parmağın
  // oynadığı yer. Masaüstünde tam ortalı.
  const slack = availH - fh*s;
  // Dokunmatikte saha HUD'un hemen altina demirliyor (en fazla 56px bosluk):
  // genis/alcak kesitlerde ortalama, sahayi ekranin ortasinda yuzer birakiyordu.
  // Ust bant oyun, alt bant parmak -- klasik mobil arcade yerlesimi.
  const bias = isTouch ? Math.min(slack*.42, 56) : slack/2;
  root.y = top + bias + fh*s/2 - (fy0+fy1)/2*CS*s;

  /* Saha içi etiketler saha ile birlikte küçülüyor; telefonda 7 piksellik
     yazıya dönüşüyorlardı. Ekrandaki boyutları sabit kalsın diye ters
     ölçekliyoruz. */
  uiScale = clamp(.85/Math.max(.0001,s), 1, 2.6);
  frame = { x0:fx0*CS, y0:fy0*CS, x1:fx1*CS, y1:fy1*CS };

  /* Toast (pembe uyarı yazısı) artık ekranın %26'sına değil sahanın üst
     bandına oturuyor. Sabit yüzde, telefonda yazıyı HUD'un altına sokup
     yarısını görünmez kılıyordu. */
  const fieldTop = root.y + fy0*CS*s, fieldH = fh*s;
  const toastY = Math.max(top + 26, fieldTop + Math.min(fieldH*.2, 96));
  UI.toast.style.top = toastY + 'px';

  /* Kontrol ipucu sahanın hemen altında; sığmıyorsa hiç gösterilmiyor. */
  const hintTop = fieldTop + fieldH + 16;
  UI.hint.style.top = hintTop + 'px';
  UI.hint.style.visibility = (hintTop + 74 < h - bottom + 40) ? 'visible' : 'hidden';

  /* GOAL-023: HUD'un eni tahtanın enine eşitleniyor. Sabit genişlikte HUD,
     dar tahtanın üstünde metrelerce boş çubuk bırakıyordu; şimdi gösterge
     şeridi tam tahtanın üstüne oturuyor. Genişlik değişimi HUD'un
     yüksekliğini oynatırsa (nadir) tek seferlik ikinci geçişle düzeltiyoruz. */
  UI.hudInner.style.maxWidth = clamp(Math.min(PFW*s, w - (isTouch ? 24 : 32)), 320, 1120) + 'px';
  if(!pass && hudEl && Math.abs(hudEl.offsetHeight + 8 - top) > 1) layout(1);
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
    // GOAL-015: basınç dozu daha hızlı yakıyor
    G.dose = Math.max(0, G.dose - dt*(1 + G.pressure*.8));
    G.pressure = Math.max(0, G.pressure - dt*.012);   // çok yavaş kendiliğinden düşüş
    G.breathT -= dt;
    if(G.breathT <= 1.3 && !G.breathCue){
      G.breathCue = true; Sound.inhaleCue(); UI.airway.classList.add('soon');
    }
    if(G.breathT <= 0) doBreath();
    // GOAL-016: hava sadece nefes anında değil, sürekli akmaya çalışıyor.
    // Tıkalıyken her birkaç saniyede bir duvara çarpıp geri tepişini görmek,
    // "neresi tıkalı" sorusunun en doğrudan cevabı.
    G.airAmbT -= dt;
    if(G.airAmbT <= 0 && airway.open){
      // yavaşlayan şeritler ekranda daha uzun kaldığı için doğum aralığı arttı
      G.airAmbT = .42;
      if(airway.open) spawnAirFlow(airway.path, true, 3);
    }
    if(G.pressure > .45){
      G.beatT -= dt;
      if(G.beatT <= 0){ G.beatT = lerp(1.25,.5,G.pressure); Sound.heartbeat(); }
    }
    let buffChanged = false;
    for(const k in G.buffs){ G.buffs[k] -= dt; if(G.buffs[k] <= 0){ delete G.buffs[k]; buffChanged = true; } }
    movePlayer(dt);
    updateEnemies(dt);
    updateParticles(dt);
    updateAirFlow(dt);
    updateScorePops(dt);
    if(buffChanged || Math.floor(G.time*4) !== Math.floor((G.time-dt)*4)) syncHUD();
  } else {
    updateParticles(dt*.4);
    updateAirFlow(dt*.4);
    updateScorePops(dt*.4);
  }
  render(dt);
});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    if(G.state === 'play') togglePause();
    // GOAL-020: arka plandayken müzik de sussun (mobilde zaten beklenen davranış)
    if(Sound.ctx && Sound.ctx.state === 'running'){ try{ Sound.ctx.suspend(); }catch(e){} }
  } else Sound.resume();
});

/* =========================================================================
   18. AÇILIŞ — başlık ekranının arkasında canlı oyun alanı
   ========================================================================= */
buildCavity(LEVELS[0]);                     // GOAL-015
resetGrid();
paintHealthy(LEVELS[0]); texUpdate(bgTex);
paintTissue(LEVELS[0]);
paintWalls(LEVELS[0]); texUpdate(wallTex);
rasterRegion(0,0,GW,GH);
computeAirway();
layout();
syncHUD();
// GOAL-013 (madde 1): eski büyük tanıtım paneli yerine sade ana menü —
// oyuncu OYNA / YÜKSEK SKORLAR / SES tek noktadan seçiyor.
showMainMenu();

};
