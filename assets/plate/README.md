# Bölüm bilgi görselleri

Boşluğun en açık yerine oturan, o günün konusunu anlatan **merkez görseli**.
Buraya bırakılan PNG'ler otomatik bulunur ve prosedürel çizimin yerine geçer —
kod değişikliği gerekmez.

Dosya adı: `day01.png` … `day08.png`.

## Bölgeler

Günler `assets/sinuzit.jfif`teki önden görünümdeki dört yapıya dağılıyor
(kür 8 gün). Burun boşluğu iki taraflı tek biçim; diğerlerinde birinci gün
sol, ikinci gün sağ taraftır:

| Gün | Bölge |
|---|---|
| 1-2 | Burun boşluğu |
| 3-4 | Maksiller sinüs |
| 5-6 | Etmoid sinüs |
| 7-8 | Frontal sinüs |

Buradaki bilgi görseli bölgeyi değil **günün tedavi konusunu** anlatır; bölge
zaten bölüm girişindeki haritada ve HUD başlığında yazıyor.

## Günler ve konular

| Gün | Konu | Görsel | Altyazı |
|---|---|---|---|
| 1 | Akut tıkanıklık | Kanla dolu kılcal damar ağı | KILCAL DAMARLAR DOLU |
| 2 | Ödem ve basınç | Sıvı tutmuş, şişmiş mukoza hücreleri | ÖDEMLİ MUKOZA |
| 3 | Mukus yoğunluğu | Goblet hücreleri, koyu mukus örtüsü | KOYU MUKUS TABAKASI |
| 4 | Drenajın düzenlenmesi | Katmanlar hâlinde süzülen mukus | MUKUS AKIŞI |
| 5 | Ostium açılımı | Dokuda açılmış ostium ağzı | OSTIUM AÇIKLIĞI |
| 6 | Koruma modu | **Siklamen** (`assets/siclament.png`) | SİKLAMEN EKSTRESİ |
| 7 | Kronik destek | Sağlıklı mukoza kesiti | SAĞLIKLI MUKOZA |
| 8 | Tam havalandırma | Havayla dolmuş, ışık alan sinüs | HAVALANAN SİNÜS |

## Üslup

Görseller **doğal ve bilimsel** olmalı: histoloji kesiti, mikroskop görüntüsü,
botanik levha gibi. Ok, çarpı işareti, grafik ekseni gibi arayüz-şeması öğeleri
kullanılmıyor — bilgi, dokunun ve hücrenin kendi biçiminden gelmeli.

## Ölçü

Görsel yaklaşık **236 × 176** piksellik bir kutuya en-boy oranı korunarak
sığdırılır ve ortalanır. Dar kesitli günlerde (ör. etmoid günleri) kutu otomatik
olarak %46'ya kadar küçülebilir, bu yüzden ince detaylara güvenmeyin. Arkasında
yumuşak bir koyuluk, altında da ölçekten bağımsız okunur bir altyazı var.

Şeffaf arka planlı PNG tercih edilir: görsel dokunun üstüne oturuyor, kendi
dikdörtgen çerçevesiyle değil.
