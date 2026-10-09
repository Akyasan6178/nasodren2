# Bölüm arka planları

Bu klasöre bırakılan PNG'ler, oyun tarafından **otomatik olarak** bulunur ve
açığa çıkan (temizlenen) katmanın zemini olarak kullanılır. Kod değişikliği
gerekmez — dosyayı koy, `npm run dev` yeniden başlat, yeter.

## Dosya adlandırma

| Dosya adı | Nerede kullanılır |
|---|---|
| `day01.png` … `day12.png` | Yalnızca o günde |
| `vestibule.png` | Gün 1-3 — Burun boşluğu |
| `maxillary.png` | Gün 4-6 — Maksiller sinüs |
| `ethmoid.png` | Gün 7-9 — Etmoid sinüs |
| `frontal.png` | Gün 10-12 — Frontal sinüs |

Her bölgede (burun boşluğu dahil) üç gün vardır: sol taraf, sağ taraf (iki
taraf `sinuzit.jfif`teki gibi ayrı biçimde) ve iki taraf birlikte; arka plan
görseli üçünde de aynı kalır.

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
Hazır görsel hazırlanacaksa günün konusu şu yayla anlatılabilir:

| Günler | Bölge | Konu | Görsel dili |
|---|---|---|---|
| 1-2 | Burun boşluğu | Akut tıkanıklık, ödem | Şişmiş damar ağı, sıcak kırmızı lekeler, koyu ve morarmış ton |
| 3-4 | Maksiller sinüs | Mukus, drenaj | Aşağı süzülen kalın mukus telleri, damlalar, amber/haki |
| 5-6 | Etmoid sinüs | Ostium açılımı, koruma | Çalışan siller, açılan halkalar, turkuaza dönen ton |
| 7-8 | Frontal sinüs | Kronik destek, tam havalandırma | Serbest hava akımları, yükselen kabarcıklar, berrak ve aydınlık |

Genel kural: **gün ilerledikçe açılıyor** — koyu ve sıkışıktan berrak ve
havadara. Arka plan tek başına "kaçıncı gündeyiz" sorusuna cevap vermeli.

Görsel yokken oyun her bölgenin iyileşmiş hâlini **tek parça bir sahne**
olarak kendisi çiziyor (`paintHealthy`): aydınlık, hava dolu bir boşluk;
duvarlar boyunca kesitin biçimine kendiliğinden uyan pembe, nemli mukoza zarı
ve yüzeyinde silyalar; tepeden inen ışık huzmeleri, dipten tepeye yükselen hava
akımları, kabarcıklar. Bölgeye özel: maksillerde tavanda ışık saçan ostium ve
tabanda diş kökleri, etmoidde bal peteği hücreleri ve parlayan ağızları,
frontalde güçlü ışık ve dipteki kanaldan yükselen hava. Havanın tonu bölgenin
yüz haritasındaki rengine çalıyor (burun turkuaz, maksiller lavanta, etmoid
mavi, frontal yeşil). Hazır görseller de bu dili izlerse haritadan tahtaya
geçişte renk kopmaz.

## Canlı katman

Temizlenen alanda, arka planın üstünde yukarı süzülen hava zerreleri var
(oyun çiziyor, görselin parçası değil). Hava yolu açıldıkça hızlanıyor, nefes
anında kısa bir an parlıyor. Görsele ayrıca kabarcık ya da zerre koymaya
gerek yok; durağan dokuya odaklanın.

## Üstüne binen katmanlar

Arka planın üstüne oyun şunları çiziyor, tasarlarken hesaba katın:

- **Kemik duvarlar** — boşluğun dışı zaten opak duvarla kapanıyor, yani görselin
  kenarları büyük ölçüde görünmez. Merkeze yatırım yapın.
