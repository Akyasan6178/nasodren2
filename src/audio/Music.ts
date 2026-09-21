// @ts-nocheck
/*
 * Music.ts — GOAL-020: arka plan müziği
 *
 * Oyunun geri kalanı gibi müzik de önce PROSEDÜREL: hiçbir ses dosyası
 * olmadan da çalar. İki ayrı motor var:
 *
 *   ambient — menü, bölüm seçimi, skorlar ve zafer ekranı. Yavaş gelişen bir
 *             pad, ağır bir bas nabzı, seyrek bir ezgi. Oyuncu burada oyunun
 *             başlamasını beklerken dinliyor; acele ettirmemeli.
 *
 *   drive   — bölümlerin içi. Kick/trampet/hi-hat, 16'lık koşan bir bas ve
 *             sahneye ait sabit bir ezgi motifi. Oyun bir yarış: alanı kap,
 *             nefes açılsın. Müzik de itmeli; arkada duran bir doku burada
 *             ölü kalıyor.
 *
 * Temaya bağlanışı: ritim nefesin ve nabzın temposu, motif ise günün kesitine
 * göre karanlıktan aydınlığa açılıyor — vestibule minör ve sıkışık, sinus
 * majör ve havadar. Yine de uzun oturumda yormasın diye davul bilerek yumuşak:
 * enerji tempodan ve koşan bastan geliyor, gürültüden değil.
 *
 * assets/music/ klasörüne bir ses dosyası bırakılırsa (bkz. oradaki README)
 * prosedürel motorun yerine o dosya geçer — kod değişikliği gerekmez, tıpkı
 * assets/bg ve assets/plate yuvaları gibi.
 *
 * Ses seviyesi/kapatma bu modülün işi değil: çıkış olarak verilen düğüm
 * (müzik bus'ı) Sound tarafında kısılıyor.
 */

/* Dosya yuvası: assets/music/<ad>.<uzantı>
   Ad, hangi sahnede çalacağını söyler — menu / vestibule / meatus / sinus /
   win / day01..day10 / theme (hepsi için genel yedek). */
const MUSIC_GLOB = import.meta.glob('../../assets/music/*.{mp3,ogg,m4a,wav,webm}', { eager:true, import:'default' });
const MUSIC_FILES = {};
for(const k in MUSIC_GLOB){
  const name = k.slice(k.lastIndexOf('/')+1).replace(/\.[a-z0-9]+$/i,'').toLowerCase();
  MUSIC_FILES[name] = MUSIC_GLOB[k];
}

const mtof = m => 440 * Math.pow(2, (m-69)/12);

/* -------------------------------------------------------------------------
   SAHNELER
   key    : MIDI kök nota
   chords : köke göre yarım-ton offsetleri, ölçü başına bir akor (4 ölçü döngü)
   lead   : ezginin kullandığı pentatonik derece seti. Tonikte sabit tutuluyor:
            minör pentatonik i/VI/VII/iv üstünde, majör pentatonik I/V/vi/IV
            üstünde hep oturur, bu yüzden motifi akorla taşımak gerekmiyor.

   drive motoru için ek desenler — hepsi 16 adımlık (16'lık nota) ızgarada:
   kick/snare/stab : hangi adımlarda vuracağı
   bass            : adım -> oktav ofseti (null = sus)
   motif           : adım -> lead dizisindeki derece (null = sus)
   ------------------------------------------------------------------------- */
const SCENES = {
  /* --- ambient: menü ve zafer --- */
  menu: { mode:'ambient', key:45, bpm:60, lift:.18, leadChance:.14,
          chords:[[0,3,7,10],[8,12,15,19],[0,3,7,10],[10,14,17,21]],
          lead:[0,3,5,7,10] },
  win:  { mode:'ambient', key:50, bpm:72, lift:.85, leadChance:.30,
          chords:[[0,4,7,11],[5,9,12,16],[7,11,14,17],[0,4,7,11]],
          lead:[0,2,4,7,9] },

  /* --- drive: bölüm içi ---
     Gün ilerledikçe tempo ve yoğunluk artıyor: tıkalı ve ağır bir başlangıçtan
     açık, hızlı, havadar bir finale. */
  vestibule: { mode:'drive', key:45, bpm:116, lift:.30,
               chords:[[0,3,7],[8,12,15],[10,14,17],[5,8,12]],
               lead:[0,3,5,7,10],
               kick:  [0,6,8,14],
               snare: [4,12],
               stab:  [2,6,10,14],
               bass:  [0,null,12,0, null,0,12,null, 0,null,12,0, null,0,12,0],
               motif: [0,null,1,2, null,1,null,0, 0,null,1,3, 2,null,null,null] },

  meatus:    { mode:'drive', key:47, bpm:124, lift:.52,
               chords:[[0,3,7],[3,7,10],[10,14,17],[8,12,15]],
               lead:[0,3,5,7,10],
               kick:  [0,6,8,11],
               snare: [4,12],
               stab:  [6,10,14],
               bass:  [0,null,12,0, null,0,12,null, 0,null,12,0, null,0,12,null],
               motif: [2,null,1,0, null,2,null,3, 2,null,1,null, 0,null,0,null] },

  sinus:     { mode:'drive', key:50, bpm:132, lift:.78,
               chords:[[0,4,7],[7,11,14],[9,12,16],[5,9,12]],
               lead:[0,2,4,7,9],
               kick:  [0,4,6,8,12],
               snare: [4,12],
               stab:  [2,6,10,14],
               bass:  [0,12,null,0, 12,null,0,12, 0,12,null,0, 12,null,0,12],
               motif: [0,null,2,3, 4,null,3,2, 0,null,2,4, null,3,null,null] },
};

const LOOKAHEAD = .55;        // kaç saniye ileriyi planlıyoruz
const TICK_MS = 100;
const BARS = 4;               // her sahne 4 ölçülük bir döngü

const stepsPerBar = s => s.mode === 'drive' ? 16 : 8;
const stepLen = s => 60 / s.bpm * 4 / stepsPerBar(s);

export function createMusic(ctx, destination){
  /* --- sabit sinyal zinciri ---------------------------------------------
     genGain : prosedürel motorun çıkışı
     fileGain: assets/music'ten gelen hazır parçanın çıkışı
     İkisi arasında geçiş crossfade ile; ikisi birden asla tam açık olmaz.
     Prosedürel çıkışta hafif bir kompresör: davul girince pad'i biraz geri
     itsin, tepe değerler oyun efektlerinin önüne geçmesin diye. */
  const genGain  = ctx.createGain();  genGain.gain.value = 0;
  const fileGain = ctx.createGain();  fileGain.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  try{
    comp.threshold.value = -12; comp.knee.value = 18;
    comp.ratio.value = 3; comp.attack.value = .008; comp.release.value = .2;
  }catch(e){}
  genGain.connect(comp); comp.connect(destination);
  fileGain.connect(destination);

  /* Ezgiye derinlik veren kısa yankı — geri beslemesi düşük ki tekrarlar
     birikip çamura dönmesin. Gecikme süresi tempoyla birlikte ayarlanıyor. */
  const echo = ctx.createDelay(1.5);
  const echoFb = ctx.createGain(); echoFb.gain.value = .26;
  const echoLp = ctx.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 2200;
  const echoOut = ctx.createGain(); echoOut.gain.value = .3;
  echo.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(echo);
  echoLp.connect(echoOut);   // echoOut aşağıdaki voice bus'ına bağlanıyor

  /* Davul ve tickler için gürültü tamponu */
  const nlen = Math.floor(ctx.sampleRate * .6);
  const noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
  { const d = noiseBuf.getChannelData(0); for(let i=0;i<nlen;i++) d[i] = Math.random()*2-1; }

  let scene = SCENES.menu, sceneName = 'menu', sceneDay = 0;
  let running = false, timer = 0, nextTime = 0, step = 0, tension = 0;
  let fileEl = null, fileSrcNode = null, fileKey = '';

  /* Çalan her nota bu ara bus'a bağlanıyor. Sahne değiştiğinde bus emekliye
     ayrılıp yerine yenisi geliyor: böylece eski sahnenin uzun pad'leri ve
     planlayıcının önceden kuyruğa koyduğu notaları anında sönüyor, yeni parça
     beklemeden girebiliyor. Eskiden sahne geçişi ölçü başını beklediği için
     menüden oyuna geçiş 4-5 saniye geç duyuluyordu. */
  let voice = newVoiceBus(false);
  echoOut.connect(voice);

  function newVoiceBus(fadeIn){
    const g = ctx.createGain(), t = ctx.currentTime;
    g.gain.setValueAtTime(fadeIn ? .0001 : 1, t);
    if(fadeIn) g.gain.linearRampToValueAtTime(1, t + .18);
    g.connect(genGain);
    return g;
  }
  function retireVoice(g){
    const t = ctx.currentTime;
    try{ echoOut.disconnect(g); }catch(e){}
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(.0001, t + .22);
    setTimeout(()=>{ try{ g.disconnect(); }catch(e){} }, 900);
  }
  function swapVoice(fadeIn){
    retireVoice(voice);
    voice = newVoiceBus(fadeIn);
    echoOut.connect(voice);
  }
  /* Sahneyi beklemeden değiştir: eski bus sönerken yenisi hemen başlıyor. */
  function switchNow(s){
    swapVoice(true);
    scene = s; step = 0;
    nextTime = ctx.currentTime + .12;
  }

  function noise(t, dur, type, freq, q, vol){
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0002, t + dur);
    s.connect(f); f.connect(g); g.connect(voice);
    s.start(t); s.stop(t + dur + .02);
  }

  /* ---------- ambient motoru (menü / zafer) ---------- */

  function pad(t, notes, dur, vol){
    /* Akoru tutan katman. Uzun atak + uzun bırakma; üstündeki alçak geçiren
       filtre basınçla (tension) biraz açılıyor, yani oyun sıkıştıkça müzik de
       hafifçe parlıyor. Bilerek "hafifçe": ani bir değişim dikkat dağıtır. */
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420 + scene.lift*520 + tension*380, t);
    lp.Q.value = .6;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || .065, t + dur*.42);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    lp.connect(g); g.connect(voice);
    for(const n of notes){
      for(const det of [-5, 5]){
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = mtof(scene.key + n) * Math.pow(2, det/1200);
        o.connect(lp); o.start(t); o.stop(t + dur + .1);
      }
    }
  }

  function subBass(t, note){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(mtof(scene.key + note - 12), t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.12, t + .04);
    g.gain.exponentialRampToValueAtTime(.0001, t + .58);
    o.connect(g); g.connect(voice);
    o.start(t); o.stop(t + .65);
  }

  function pluck(t, note){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(mtof(scene.key + note + 24), t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.055, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + .5);
    o.connect(g); g.connect(voice); g.connect(echo);
    o.start(t); o.stop(t + .55);
  }

  function stepAmbient(t, stepDur, bar, inBar, chord){
    if(inBar === 0){
      pad(t, chord, stepDur * 8 * 1.06);
      subBass(t, chord[0]);
    }
    if(inBar === 4) subBass(t, chord[0] + (bar % 2 ? 7 : 0));
    if(inBar !== 0 && Math.random() < scene.leadChance + tension*.12){
      const set = scene.lead;
      pluck(t, set[(Math.random()*set.length)|0] + (Math.random() < .3 ? 12 : 0));
    }
  }

  /* ---------- drive motoru (bölüm içi) ---------- */

  function kick(t){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(132, t);
    o.frequency.exponentialRampToValueAtTime(43, t + .085);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.25, t + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t + .3);
    o.connect(g); g.connect(voice);
    o.start(t); o.stop(t + .34);
    noise(t, .03, 'highpass', 2200, .7, .038);   // vuruşun "tık"ı
  }

  function snare(t, vol){
    const v = vol || .1;
    noise(t, .14, 'bandpass', 1900, .9, v);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(196, t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(v*.5, t + .005);
    g.gain.exponentialRampToValueAtTime(.0001, t + .11);
    o.connect(g); g.connect(voice);
    o.start(t); o.stop(t + .14);
  }

  function hat(t, open, vol){ noise(t, open ? .14 : .035, 'highpass', 7200, .8, vol); }

  /* Koşan bas: testere dalga + hızla kapanan filtre. Enerjinin çoğu buradan
     geliyor, davuldan değil — böylece uzun oturumda yormuyor. */
  function driveBass(t, note, dur){
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
    lp.frequency.setValueAtTime(900 + tension*900, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + dur*.9);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(scene.key + note - 12), t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.135, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur*.95);
    o.connect(lp); lp.connect(g); g.connect(voice);
    o.start(t); o.stop(t + dur);
  }

  /* Ters vuruşlardaki kısa akor vuruşu — grooveu ayakta tutan şey. */
  function stab(t, notes, dur){
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1500 + scene.lift*1400 + tension*700, t);
    lp.Q.value = .8;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.044, t + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    lp.connect(g); g.connect(voice);
    for(const n of notes){
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(scene.key + n + 12);
      o.connect(lp); o.start(t); o.stop(t + dur + .02);
    }
  }

  /* Ezgi: rastgele değil, sahneye ait sabit bir motif — oyuncu bir bölümü
     oynarken parçayı tanısın diye. */
  function motifNote(t, note, dur){
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 2600 + tension*1200;
    o.type = 'square';
    o.frequency.setValueAtTime(mtof(scene.key + note + 24), t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.04, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(voice); g.connect(echo);
    o.start(t); o.stop(t + dur + .02);
  }

  function stepDrive(t, stepDur, bar, inBar, chord){
    const root = chord[0];

    /* Ölçü başında akoru tutan ince bir zemin — davulun altında boşluk kalmasın */
    if(inBar === 0) pad(t, chord, stepDur * 16 * 1.02, .032);

    if(scene.kick.indexOf(inBar) >= 0) kick(t);
    if(scene.snare.indexOf(inBar) >= 0) snare(t);
    /* Son ölçünün kuyruğunda küçük bir geçiş — döngü dikişsiz duyulsun */
    if(bar === BARS-1 && inBar >= 14) snare(t, .055);

    /* Hi-hat: 8'liklerde sabit, gerilim arttıkça aradaki 16'lıklar da giriyor */
    if(inBar % 2 === 0) hat(t, inBar === 14, inBar % 4 === 0 ? .022 : .014);
    else if(tension > .35 && Math.random() < tension) hat(t, false, .009);

    const b = scene.bass[inBar];
    if(b !== null && b !== undefined) driveBass(t, root + b, stepDur * 1.8);

    if(scene.stab.indexOf(inBar) >= 0) stab(t, chord, stepDur * 1.6);

    /* Motif ilk ölçüde susuyor: akor ve groove nefes alsın, sonra girsin. */
    if(bar > 0){
      const m = scene.motif[inBar];
      if(m !== null && m !== undefined)
        motifNote(t, scene.lead[m] + (bar === 2 ? 12 : 0), stepDur * 1.7);
    }
  }

  /* ---------- zamanlayıcı ---------- */

  function playStep(t, stepDur){
    const spb = stepsPerBar(scene);
    const inBar = step % spb;
    const bar = Math.floor(step / spb) % BARS;
    const chord = scene.chords[bar % scene.chords.length];
    if(scene.mode === 'drive') stepDrive(t, stepDur, bar, inBar, chord);
    else stepAmbient(t, stepDur, bar, inBar, chord);
  }

  function schedule(){
    if(!running) return;
    while(nextTime < ctx.currentTime + LOOKAHEAD){
      if(nextTime < ctx.currentTime) nextTime = ctx.currentTime + .05;
      playStep(nextTime, stepLen(scene));
      nextTime += stepLen(scene);   // sahne değişmiş olabilir: yeniden oku
      step++;
      echo.delayTime.value = stepLen(scene) * (scene.mode === 'drive' ? 3 : 1.5);
    }
  }

  /* ---------- hazır dosya ---------- */

  function fileFor(name, day){
    const tries = [];
    if(day) tries.push('day' + String(day).padStart(2,'0'));
    tries.push(name, 'theme');
    for(const t of tries) if(MUSIC_FILES[t]) return { key:t, url:MUSIC_FILES[t] };
    return null;
  }

  function playFile(f){
    if(fileKey === f.key && fileEl && !fileEl.paused){ ramp(fileGain, 1); return; }
    fileKey = f.key;
    if(!fileEl){
      fileEl = new Audio();
      fileEl.loop = true;
      fileEl.crossOrigin = 'anonymous';
      fileEl.preload = 'auto';
      try{
        fileSrcNode = ctx.createMediaElementSource(fileEl);
        fileSrcNode.connect(fileGain);
      }catch(e){ /* MediaElementSource yoksa dosya yolu devre dışı kalır */ }
    }
    fileEl.src = f.url;
    fileGain.gain.cancelScheduledValues(ctx.currentTime);
    fileGain.gain.setValueAtTime(0, ctx.currentTime);
    const p = fileEl.play();
    if(p && p.catch) p.catch(()=>{});
    ramp(fileGain, 1);
  }

  function stopFile(){
    if(!fileEl) return;
    ramp(fileGain, 0);
    const el = fileEl;
    setTimeout(()=>{ if(fileGain.gain.value < .02) el.pause(); }, 900);
  }

  function ramp(node, to, secs){
    const t = ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(to, t + (secs || .8));
  }

  /* ---------- dışa açılan yüz ---------- */

  const api = {
    /* Hangi bölümde/menüde olduğumuzu söyler; müzik ona göre değişir.
       name: menu | vestibule | meatus | sinus | win, day: 1..10 (opsiyonel) */
    setScene(name, day){
      const s = SCENES[name] || SCENES.menu;
      sceneDay = day || 0;
      const f = fileFor(name, sceneDay);
      if(f){
        if(running){ playFile(f); ramp(genGain, 0); }
        sceneName = name; scene = s;
        api.usingFile = true;
        return;
      }
      api.usingFile = false;
      stopFile();
      if(sceneName === name){ if(running) ramp(genGain, 1, .3); return; }
      sceneName = name;
      if(!running){ scene = s; step = 0; return; }
      switchNow(s);                // bekleme yok: geçiş duyulur duyulmaz olsun
      ramp(genGain, 1, .3);
    },
    start(){
      if(running) return;
      running = true;
      const f = fileFor(sceneName, sceneDay);
      if(f){ playFile(f); genGain.gain.value = 0; return; }
      swapVoice(true);             // durdurulmuş motorun eski kuyruğu kalmasın
      step = 0;
      nextTime = ctx.currentTime + .12;
      ramp(genGain, 1, scene.mode === 'drive' ? .5 : 1.6);
      schedule();
      timer = setInterval(schedule, TICK_MS);
    },
    stop(){
      running = false;
      if(timer){ clearInterval(timer); timer = 0; }
      ramp(genGain, 0, .6);
      stopFile();
    },
    /* Basınç/gerilim 0..1 — müziği biraz açar, ritmi biraz sıklaştırır. */
    setTension(v){ tension = v < 0 ? 0 : (v > 1 ? 1 : v); },
    get running(){ return running; },
    usingFile: false,
  };
  return api;
}
