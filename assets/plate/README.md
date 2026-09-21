# Bölüm bilgi görselleri

Boşluğun en açık yerine oturan, o günün konusunu anlatan **merkez görseli**.
Buraya bırakılan PNG'ler otomatik bulunur ve prosedürel çizimin yerine geçer —
kod değişikliği gerekmez.

Dosya adı: `day01.png` … `day10.png`.

## Bölgeler

Günler `assets/sinuzit.png`deki koronal kesitten türeyen beş anatomik bölgeye
dağılıyor; her bölgenin iki günü sol ve sağ tarafıdır:

| Gün | Bölge |
|---|---|
| 1-2 | Burun boşluğu |
| 3-4 | Ostiomeatal kompleks |
| 5-6 | Maksiller sinüs |
| 7-8 | Etmoid hücreler |
| 9-10 | Frontal sinüs |

Buradaki bilgi görseli bölgeyi değil **günün tedavi konusunu** anlatır; bölge
zaten bölüm girişindeki haritada ve HUD başlığında yazıyor.

## Günler ve konular

| Gün | Konu | Görsel | Altyazı |
|---|---|---|---|
| 1 | Akut tıkanıklık | Kanla dolu kılcal damar ağı | KILCAL DAMARLAR DOLU |
| 2 | Ödem ve basınç | Sıvı tutmuş, şişmiş mukoza hücreleri | ÖDEMLİ MUKOZA |
| 3 | Hipereminin kırılması | Ortasından daralan damarlar | DAMARLAR DARALIYOR |
| 4 | Mukus yoğunluğu | Goblet hücreleri, koyu mukus örtüsü | KOYU MUKUS TABAKASI |
| 5 | Drenajın düzenlenmesi | Katmanlar hâlinde süzülen mukus | MUKUS AKIŞI |
| 6 | Ostium açılımı | Dokuda açılmış ostium ağzı | OSTIUM AÇIKLIĞI |
| 7 | Normal fonksiyon | Çalışan silyalı epitel | SİLYALI EPİTEL |
| 8 | Koruma modu | **Siklamen** (`assets/siclament.png`) | SİKLAMEN EKSTRESİ |
| 9 | Kronik destek | Sağlıklı mukoza kesiti | SAĞLIKLI MUKOZA |
| 10 | Tam havalandırma | Havayla dolmuş, ışık alan sinüs | HAVALANAN SİNÜS |

## Üslup

Görseller **doğal ve bilimsel** olmalı: histoloji kesiti, mikroskop görüntüsü,
botanik levha gibi. Ok, çarpı işareti, grafik ekseni gibi arayüz-şeması öğeleri
kullanılmıyor — bilgi, dokunun ve hücrenin kendi biçiminden gelmeli.

## Ölçü

Görsel yaklaşık **236 × 176** piksellik bir kutuya en-boy oranı korunarak
sığdırılır ve ortalanır. Dar kesitli günlerde (ör. gün 7 ve 10) kutu otomatik
olarak %60'a kadar küçülebilir, bu yüzden ince detaylara güvenmeyin. Arkasında
yumuşak bir koyuluk, altında da ölçekten bağımsız okunur bir altyazı var.

Şeffaf arka planlı PNG tercih edilir: görsel dokunun üstüne oturuyor, kendi
dikdörtgen çerçevesiyle değil.
