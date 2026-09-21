# Arka plan müziği

Bu klasör boşken oyun **prosedürel müzik** çalar: `src/audio/Music.ts` içinde
iki motor var ve hiçbir dosya koymadan da müzik duyulur.

- **ambient** — menü, bölüm seçimi, skorlar, bölüm brifingi ve zafer ekranı.
  Yavaş pad, ağır bas, seyrek ezgi. Beklerken dinlenen katman.
- **drive** — bölümlerin içi. Kick/trampet/hi-hat, 16'lık koşan bas ve
  kesite ait sabit bir ezgi motifi. Gün ilerledikçe tempo artıyor
  (vestibule 116, meatus 124, sinus 132 BPM).

Buraya bir ses dosyası bırakılırsa prosedürel motorun **yerine** o çalar —
kod değişikliği gerekmez, tıpkı `assets/bg` ve `assets/plate` yuvaları gibi.
Dosyayı koy, `npm run dev`'i yeniden başlat, yeter.

## Dosya adlandırma

| Dosya adı | Nerede çalar |
|---|---|
| `day01.mp3` … `day10.mp3` | Yalnızca o günde |
| `vestibule.mp3` | Gün 1-3 |
| `meatus.mp3` | Gün 4-7 |
| `sinus.mp3` | Gün 8-10 |
| `menu.mp3` | Ana menü, bölüm seçimi, yüksek skorlar, bölüm brifingi, oyun sonu |
| `win.mp3` | Kür tamamlandı ekranı |
| `theme.mp3` | Yukarıdakilerin hiçbiri yoksa her yerde |

Öncelik sırası: önce `dayNN`, yoksa sahne adı (`vestibule`/`menu`/…), o da
yoksa `theme`, hiçbiri yoksa prosedürel motor.

Desteklenen uzantılar: `.mp3`, `.ogg`, `.m4a`, `.wav`, `.webm`. Mobil dahil her
yerde çalışması için `.mp3` en güvenlisi.

## Ne olmalı

Parça **kesintisiz döngüye** girecek şekilde hazırlanmalı (baş ve son aynı
noktada buluşsun); oyun `loop` ile çalıyor, arada sessizlik olursa duyulur.

Üslup, prosedürel sürümün izlediği yayla aynı olmalı: gün ilerledikçe
karanlık ve sıkışıktan berrak ve havadara.

**Menü parçası** (`menu`, `win`) sakin ve beklemeye uygun olmalı; **bölüm
parçaları** (`vestibule`/`meatus`/`sinus`/`dayNN`) ise ritimli ve iten. Yine
de uzun oturumda dinleneceği için enerji tempodan ve bastan gelmeli, davulun
gürültüsünden değil — oyuncu 20 dakika sonra da kapatmak istemesin.

Ses seviyesi: parçayı **-14 LUFS civarında** ve tepe değeri -1 dBTP'yi
aşmayacak şekilde ver. Oyun içi seviye ayarı (AYARLAR → MÜZİK) bunun üstüne
biniyor; dosya baştan yüksekse efektleri bastırır.

## Dosya boyutu

Tüm klasör derlemeye giriyor, yani her megabayt açılış süresine ekleniyor.
Parça başına **2 MB altı** hedeflenmeli (128 kbps mono/stereo mp3, 2-3
dakikalık döngü rahat sığar).
