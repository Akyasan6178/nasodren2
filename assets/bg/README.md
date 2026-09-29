# Bölüm arka planları

Bu klasöre bırakılan PNG'ler, oyun tarafından **otomatik olarak** bulunur ve
açığa çıkan (temizlenen) katmanın zemini olarak kullanılır. Kod değişikliği
gerekmez — dosyayı koy, `npm run dev` yeniden başlat, yeter.

## Dosya adlandırma

| Dosya adı | Nerede kullanılır |
|---|---|
| `day01.png` … `day08.png` | Yalnızca o günde |
| `vestibule.png` | Gün 1-2 — Burun boşluğu |
| `maxillary.png` | Gün 3-4 — Maksiller sinüs |
| `ethmoid.png` | Gün 5-6 — Etmoid sinüs |
| `frontal.png` | Gün 7-8 — Frontal sinüs |

Maksiller, etmoid ve frontalde bölgenin iki günü sol ve sağ tarafıdır (iki
taraf `sinuzit.jfif`teki gibi ayrı biçimde); arka plan görseli ikisinde de
aynı kalır.

Öncelik sırası: önce `dayNN.png` aranır, yoksa kesit arketipinin dosyası, o da
yoksa oyun prosedürel arka planı çizer. Yani klasör boşken hiçbir şey bozulmaz.

## Ölçü

Görsel, oyun alanını **`cover` ile** kaplar: orana göre kırpılır, boşluk
bırakmaz.

Alan 960 × 960 kare; ekranda yalnızca günün kesitinin kutusu (ve çevresinde
ince bir kemik payı) görünür, geri kalanı kırpılır. Kural: görseli 960 × 960
kare hazırlayın, anlamı taşıyan her şeyi **ortadaki 720 × 720 alanda** tutun.
Köşelere yalnızca doku ve atmosfer koyun; oradaki hiçbir detayın görüneceğini
varsaymayın.

## Ne anlatmalı

Bu katman **tedavi edilmiş dokudur** — oyuncu temizledikçe altından çıkar.
Prosedürel sürüm günün konusunu şöyle anlatıyor, hazır görseller de aynı yayı
izlemeli:

| Günler | Bölge | Konu | Görsel dili |
|---|---|---|---|
| 1-2 | Burun boşluğu | Akut tıkanıklık, ödem | Şişmiş damar ağı, sıcak kırmızı lekeler, koyu ve morarmış ton |
| 3-4 | Maksiller sinüs | Mukus, drenaj | Aşağı süzülen kalın mukus telleri, damlalar, amber/haki |
| 5-6 | Etmoid sinüs | Ostium açılımı, koruma | Çalışan siller, açılan halkalar, turkuaza dönen ton |
| 7-8 | Frontal sinüs | Kronik destek, tam havalandırma | Serbest hava akımları, yükselen kabarcıklar, berrak ve aydınlık |

Genel kural: **gün ilerledikçe açılıyor** — koyu ve sıkışıktan berrak ve
havadara. Arka plan tek başına "kaçıncı gündeyiz" sorusuna cevap vermeli.

## Üstüne binen katmanlar

Arka planın üstüne oyun şunları çiziyor, tasarlarken hesaba katın:

- **Kanal parıltısı** — burun deliğinden ostiuma giden rota boyunca ince bir
  turkuaz ışık. Arka plan bunu yutmasın; o bölgeyi çok yoğun desenle doldurmayın.
- **Bilgi görseli** — boşluğun en açık yerine oturan, o günün konusunu anlatan
  doğal/bilimsel görsel ve altındaki başlık (ör. "SİLYALI EPİTEL"). Yaklaşık
  236 × 176 piksellik bir alan kaplar ve konumu kesitten kesite değişir, bu
  yüzden arka planın hiçbir yerinde okunmayı zorlaştıracak yoğunlukta desen
  olmamalı. Ayrıntılar ve kendi asset yuvası için `assets/plate/README.md`.
- **Kemik duvarlar** — boşluğun dışı zaten opak duvarla kapanıyor, yani görselin
  kenarları büyük ölçüde görünmez. Merkeze yatırım yapın.
