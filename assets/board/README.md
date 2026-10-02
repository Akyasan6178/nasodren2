# Bölüm haritaları

Bu klasöre bırakılan PNG'lerdeki kızarık boşluk, o günün **oyun tahtası** olur.
Oyun görseli otomatik bulur; kod değişikliği gerekmez — dosyayı koy, `npm run dev`
yeniden başlat, yeter. Görseli olmayan günler anatomi çiziminden (`sinuzit.jfif`'ten
izlenen konturlar) kurulmaya devam eder.

## Dosya adlandırma

| Dosya adı | Nerede kullanılır |
|---|---|
| `day01.png` … `day08.png` | Yalnızca o günde |
| `nasal_sol.png` / `nasal_sag.png` | Gün 1 / Gün 2 — Burun boşluğu |
| `maxillary_sol.png` / `maxillary_sag.png` | Gün 3 / Gün 4 — Maksiller sinüs |
| `ethmoid_sol.png` / `ethmoid_sag.png` | Gün 5 / Gün 6 — Etmoid sinüs |
| `frontal_sol.png` / `frontal_sag.png` | Gün 7 / Gün 8 — Frontal sinüs |

Öncelik: önce `dayNN.png`, yoksa bölge + taraf. `sol` ekranın solundaki taraf
(orta hat biçimin sağında), `sag` sağdaki.

Şu an dolu olanlar: maksiller (sol/sağ) ve frontal (sol/sağ).

`bölge_taraf.png` adlı görseller yalnızca tahtayı değil, giriş sahnesindeki
**yüz haritasını** da değiştirir: sinüs haritada da görseldeki biçimle, eski
çizimin yerinde ve aynı büyüklükte çizilir. `dayNN.png` yalnızca o günün
tahtasını değiştirir, haritaya dokunmaz.

## Görsel nasıl okunuyor

- Zemin koyu ve mavimsi, boşluk kızarık olmalı: kırmızının maviyi geçtiği
  pikseller boşluk sayılıyor. Boşluğun kenarındaki ışık çizgisi de dahil.
- En büyük kızarık parça tutuluyor; zemindeki soluk desenler yok sayılıyor,
  boşluğun içindeki koyu lekeler dolduruluyor.
- Görselin ölçüsü ve oranı serbest (şu ankiler 960 × 540); boşluk kendi kutusuna
  kırpılıyor, oranı korunarak tahtaya yerleşiyor.
- Boşluğun büyüklüğünü görsel değil o günün alan hedefi belirliyor
  (`AREA_BY_DAY` / `areaT`), yani zorluk dengesi görsel değişince bozulmuyor —
  ama biçim değişince eğri `tools/denge-testi.mjs` ile yeniden ölçülmeli.
- Boşluk tek parça olmalı ve dar boyunlar en az birkaç yüzde genişlikte
  kalmalı; tahta 160 × 160 hücrelik ızgaraya düşüyor, çok ince geçitler kopar.
- Harita görselli günlerde polip, kist gibi hastalık ayrıntıları çizilmiyor —
  biçim görselde ne ise tahtada o.
