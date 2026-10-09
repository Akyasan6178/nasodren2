# Bölüm bilgi görselleri

O günün konusunu anlatan **bilgi görseli**. Bölüm başındaki künye kartında,
altyazısıyla birlikte gösteriliyor. (Eskiden tahtanın ortasında da açığa
çıkıyordu; artık temizlenen alanın altında bölgenin sahnesi var, bkz.
`assets/bg/README.md`.) Buraya bırakılan PNG'ler otomatik bulunur ve prosedürel
çizimin yerine geçer — kod değişikliği gerekmez.

Dosya adı: `day01.png` … `day12.png`.

## Bölgeler

Günler `assets/sinuzit.jfif`teki önden görünümdeki dört yapıya dağılıyor
(kür 12 gün). Her bölgede birinci gün sol, ikinci gün sağ taraf, üçüncü gün
iki taraf birlikte:

| Gün | Bölge |
|---|---|
| 1-3 | Burun boşluğu |
| 4-6 | Maksiller sinüs |
| 7-9 | Etmoid sinüs |
| 10-12 | Frontal sinüs |

Buradaki bilgi görseli bölgeyi değil **günün tedavi konusunu** anlatır; bölge
zaten bölüm girişindeki haritada ve HUD başlığında yazıyor.

## Günler ve konular

| Gün | Konu | Görsel | Altyazı |
|---|---|---|---|
| 1 | Akut tıkanıklık | Kanla dolu kılcal damar ağı | KILCAL DAMARLAR DOLU |
| 2 | Ödem ve basınç | Sıvı tutmuş, şişmiş mukoza hücreleri | ÖDEMLİ MUKOZA |
| 3 | Hipereminin kırılması | Ortasından daralan damarlar | DAMARLAR DARALIYOR |
| 4 | Mukus yoğunluğu | Goblet hücreleri, koyu mukus örtüsü | KOYU MUKUS TABAKASI |
| 5 | Salgının incelmesi | İri topakların ince iplik ve damlacığa dönüşmesi | SALGI İNCELİYOR |
| 6 | Drenajın düzenlenmesi | Katmanlar hâlinde süzülen mukus | MUKUS AKIŞI |
| 7 | Ostium açılımı | Dokuda açılmış ostium ağzı | OSTIUM AÇIKLIĞI |
| 8 | Basıncın dengelenmesi | Dipte duran salgı, yükselen hava kabarcıkları | HAVA DOLUYOR |
| 9 | Normal fonksiyon | Çalışan silyalı epitel | SİLYALI EPİTEL |
| 10 | Koruma modu | **Siklamen** (`assets/siclament.png`) | SİKLAMEN EKSTRESİ |
| 11 | Kronik destek | Sağlıklı mukoza kesiti | SAĞLIKLI MUKOZA |
| 12 | Tam havalandırma | Havayla dolmuş, ışık alan sinüs | HAVALANAN SİNÜS |

## Üslup

Görseller **doğal ve bilimsel** olmalı: histoloji kesiti, mikroskop görüntüsü,
botanik levha gibi. Ok, çarpı işareti, grafik ekseni gibi arayüz-şeması öğeleri
kullanılmıyor — bilgi, dokunun ve hücrenin kendi biçiminden gelmeli.

## Ölçü

Görsel yaklaşık **236 × 176** piksellik bir kutuya en-boy oranı korunarak
sığdırılır ve ortalanır. Dar kesitli günlerde (ör. etmoid günleri) kutu otomatik
olarak %46'ya kadar küçülebilir, bu yüzden ince detaylara güvenmeyin. Arkasında
yumuşak bir koyuluk, altında (yer yoksa üstünde) ölçekten bağımsız okunur bir altyazı var.
Altyazı tek ya da iki satırda boşluğa tam sığmıyorsa tahtaya hiç yazılmıyor —
yarım kalmış kelime göstermektense; bölüm başındaki künye kartında her zaman
duruyor. Şu an burun (1-2) ve etmoid sol (5) günlerinde kesit buna yetmiyor.

Şeffaf arka planlı PNG tercih edilir: görsel dokunun üstüne oturuyor, kendi
dikdörtgen çerçevesiyle değil.
