# Oturum Ã–zeti â€” 29-30 Temmuz 2026 (Docker Â· on bir modÃ¼l Â· muhasebe Â· banka)

Bu dosya **sonraki oturuma devir notudur**. AyrÄ±ntÄ±lÄ± geÃ§miÅŸ
[`DEVLOG.md`](DEVLOG.md) iÃ§indedir; burada yalnÄ±zca *nerede kaldÄ±k* ve
*nereden devam edilecek* yazar.

---

## â–¶â–¶â–¶ Ã–NCE BU â€” KAPSAM ETÄ°KETLEME (4 AÄŸustos akÅŸamÄ± verildi, BAÅLANMADI)

> **AKTÄ°F Ã‡ALIÅMA KAPSAMI: APARTMAN**
> *(Bu satÄ±r her oturum baÅŸÄ±nda okunacak. Kapsam deÄŸiÅŸirse Ã¼rÃ¼n sahibi
> aÃ§Ä±kÃ§a sÃ¶yleyecek. Kapsam dÄ±ÅŸÄ± iÅŸ gelirse **UYAR**: "Bu [SITE] iÅŸi, aktif
> kapsam APARTMAN. Devam edilsin mi?" â€” sessizce yapma.)*

**KÃ¶k sebep:** depo adÄ± `bnos-apartman-modul` ama iÃ§inde **hem site
(CIFT_TARAFLI) hem apartman (BASIT)** tarafÄ± var. Her iÅŸ "apartman modÃ¼lÃ¼"
baÅŸlÄ±ÄŸÄ± altÄ±nda yÃ¼rÃ¼yor ve bu hata Ã¼retiyor.

**Madde 1 â€” sabit baÅŸlÄ±k: âœ… YAPILDI** (commit `35c2a1f` Ã¶ncesi tur).
Kabuk baÅŸlÄ±ÄŸÄ± artÄ±k tenant'tan okunuyor: proje adÄ± + tip rozeti.
GiriÅŸ yanÄ±tÄ±na `tenantTipi` eklendi.

â˜… **Kalan sabit metinler â€” taranmÄ±ÅŸ liste, karar bekliyor:**

| Yer | Metin | DeÄŸerlendirme |
|---|---|---|
| `frontend/web/messages/tr.json:3` | `uygulamaAdi: "BNOS Apartman YÃ¶netimi"` | âš ï¸ **ÃœrÃ¼n adÄ± mÄ±, modÃ¼l adÄ± mÄ±?** Kabukta artÄ±k ikincil satÄ±rda. DeÄŸiÅŸecekse Ã¼rÃ¼n sahibi karar vermeli. |
| `backend/src/main.ts:55` | Swagger `setTitle('BNOS Apartman YÃ¶netimi API')` | GeliÅŸtirici gÃ¶rÃ¼r, kullanÄ±cÄ± gÃ¶rmez. DÃ¼ÅŸÃ¼k Ã¶ncelik. |
| `shared/module-sdk/src/manifest.ts:72` | `gorunenAd: 'Apartman YÃ¶netimi'` | âš ï¸ **ModÃ¼l manifesti** â€” `/saglik` yanÄ±tÄ±nda dÃ¶nÃ¼yor. ModÃ¼l kimliÄŸi burada; deÄŸiÅŸtirmek modÃ¼l sÃ¶zleÅŸmesini etkiler. |
| `backend/package.json:5` Â· `database/package.json:5` | paket aÃ§Ä±klamalarÄ± | Kozmetik. |

**Madde 2 â€” belge etiketleme: YAPILMADI.** Her ADR, her SESSION_SUMMARY
maddesi, her yol haritasÄ± satÄ±rÄ± `[SITE]` Â· `[APARTMAN]` Â· `[ORTAK]`
etiketlerinden birini taÅŸÄ±yacak. Mevcutlar **geriye dÃ¶nÃ¼k** etiketlenecek.
â˜… **Belirsiz olanÄ± `[ORTAK]` sayma â€” bilmiyorsan SOR.**

Ã–rnek: `[ORTAK]` ADR-0014 Â· `[SITE]` ADR-0017 Â· `[APARTMAN]` gelir-gider
dÃ¶kÃ¼mÃ¼ ekranÄ±.

**Madde 3 â€” README notu: YAPILMADI.** *"Bu depo hem SITE hem APARTMAN
modÃ¼lÃ¼nÃ¼ iÃ§erir. Depo adÄ± tarihseldir. Kapsam ayrÄ±mÄ± iÃ§in
[APARTMAN-SITE-AYRIMI.md](docs/APARTMAN-SITE-AYRIMI.md) ve belge
etiketlerine bakÄ±n."*

**Madde 4 â€” depo adÄ± DEÄÄ°ÅTÄ°RÄ°LMEYECEK:** baÄŸlantÄ±larÄ± ve CI'Ä± kÄ±rar,
etiketleme yeterli.

**Sonra:** tahsilat ekranÄ± `[APARTMAN]`.

---

## â–¶â–¶ SIRADAKÄ° Ä°Å â€” GÃœVENLÄ°K SEKMESÄ° (4 AÄŸustos'ta kararlaÅŸtÄ±rÄ±ldÄ±, BAÅLANMADI)

ÃœrÃ¼n sahibi kararÄ±: **misafir ve daire gÃ¶revlisi baÄŸÄ±msÄ±z modÃ¼l deÄŸildir**,
`GÃ¼venlik â†’ GiriÅŸ-Ã‡Ä±kÄ±ÅŸ KayÄ±tlarÄ±` sekmeleridir ([MENU-HARITASI Â§7](docs/MENU-HARITASI.md)).

âš ï¸ **SIRA TERSÄ°NE Ã‡EVRÄ°LEMEZ.** Ã–nce `/guvenlik` rotasÄ±, **sonra** menÃ¼den
kaldÄ±rma. Ters yapÄ±lÄ±rsa Ã§alÄ±ÅŸan iki ekran eriÅŸilemez kalÄ±r â€” `/belgeler`
dersinin tersi (orada *olmayan* ekranÄ±n menÃ¼ Ã¶ÄŸesi vardÄ±).

**AdÄ±mlar:**

1. `app/misafirler/page.tsx` (442 satÄ±r) ikiye bÃ¶lÃ¼nÃ¼r:
   `icerik.tsx` â†’ `MisafirlerIcerigi()` (kabuk YOK) + ince `page.tsx`
   (`UygulamaKabugu` + iÃ§erik). Rota **silinmez**: eski baÄŸlantÄ±lar kÄ±rÄ±lmasÄ±n.
2. AynÄ±sÄ± `app/daire-gorevlileri/page.tsx` (510 satÄ±r) iÃ§in.
3. `app/guvenlik/page.tsx` â€” `Sekmeler` bileÅŸeniyle iki sekme
   (muhasebe ekranÄ±nÄ±n deseni birebir kullanÄ±lÄ±r).
4. MenÃ¼den `Misafirler` ve `Daire GÃ¶revlileri` **kaldÄ±rÄ±lÄ±r**, tek
   `GÃ¼venlik` girer.

â˜… `Site Personeli` ana menÃ¼de **KALIR** â€” kadro kaydÄ±dÄ±r, gÃ¼venlik kaydÄ±
deÄŸil (MENU-HARITASI Â§2). ÃœrÃ¼n sahibine soruldu, aksi sÃ¶ylenmedi.

âš ï¸ **Ã–lÃ§ek:** ziyaretÃ§i ekranÄ± sitede en Ã§ok veri Ã¼reten ekrandÄ±r (rakipte
275.889 kayÄ±t) ve BNOS'ta bu yÃ¼k profili **hiÃ§ Ã¶lÃ§Ã¼lmedi**. Sayfalama ve
filtreleme baÅŸtan buna gÃ¶re kurulmalÄ±; sonradan eklenmez.

**BitiÅŸ Ã¶lÃ§Ã¼tÃ¼:** beÅŸ maddelik ekran Ã¶lÃ§Ã¼tÃ¼ (aÅŸaÄŸÄ±da) + `/misafirler` ve
`/daire-gorevlileri` rotalarÄ± hÃ¢lÃ¢ 200 dÃ¶nÃ¼yor.

---

## â˜… BAÄLAYICI KURAL â€” bir ekran ne zaman "bitti" sayÄ±lÄ±r

**YÃ¼rÃ¼rlÃ¼k: 4 AÄŸustos 2026.** Ã–nceki Ã¶lÃ§Ã¼t *"API'ye baÄŸlÄ± + test yeÅŸil"*
idi ve YETMÄ°YOR. Bir ekran **GÃ–STERÄ°LEBÄ°LÄ°R** olmadan bitmiÅŸ sayÄ±lmaz.

BeÅŸ maddenin **hepsi** zorunludur:

1. **GÃ–RSEL** â€” ekran biÃ§imli. Kart dÃ¼zeni, renk, tipografi, boÅŸluk
   yerinde. DÃ¼z metin yÄ±ÄŸÄ±nÄ± deÄŸil.
2. **VERÄ°** â€” tohumda gerÃ§ekÃ§i veri var. BoÅŸ liste ile bitmiÅŸ ekran aynÄ±
   ÅŸey deÄŸildir. Her listede en az 5-10 anlamlÄ± kayÄ±t, TÃ¼rkÃ§e okunabilir
   isimler, tutarlÄ± tutarlar.
3. **AKIÅ** â€” ekranÄ±n temel iÅŸi uÃ§tan uca yapÄ±labiliyor. YalnÄ±zca okuma
   deÄŸil; yazma varsa o da Ã§alÄ±ÅŸÄ±yor.
4. **BOÅ DURUM** â€” veri yoksa ne yazdÄ±ÄŸÄ± dÃ¼ÅŸÃ¼nÃ¼lmÃ¼ÅŸ. "KayÄ±t bulunamadÄ±"
   yetmez; **ne yapÄ±lmasÄ± gerektiÄŸini** sÃ¶ylesin.
5. **HATA DURUMU** â€” bir ÅŸey eksikse AÃ‡IK sÃ¶ylesin. Sessiz boÅŸ ekran yok.

**Her ekran bitiminde:** ekran gÃ¶rÃ¼ntÃ¼sÃ¼ alÄ±nÄ±p raporlanÄ±r. ÃœrÃ¼n sahibi
gÃ¶rmeden "bitti" denmez. BeÅŸ madde tek tek iÅŸaretlenir; eksik varsa
aÃ§Ä±kÃ§a sÃ¶ylenir ve ekran bitmiÅŸ sayÄ±lmaz.

âš ï¸ **Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ alÄ±namÄ±yorsa bu SÃ–YLENÄ°R** â€” o zaman Ã¼rÃ¼n sahibi aÃ§Ä±p
bakar, ama beÅŸ madde yine de Ã¶nceden kontrol edilir. **BugÃ¼nkÃ¼ durum:
alÄ±namÄ±yor.** Depoda Playwright/Puppeteer yok, tarayÄ±cÄ± otomasyonu
bulunmuyor. Eklenmesi ayrÄ± bir karardÄ±r (baÄŸÄ±mlÄ±lÄ±k + tarayÄ±cÄ± indirmesi).

---

## 1. Bu oturumda ne oldu

**Docker kuruldu ve veritabanÄ± ilk kez ayaÄŸa kalktÄ±.** Bu, aylardÄ±r
gÃ¶rÃ¼lemeyen hatalarÄ± gÃ¶rÃ¼nÃ¼r yaptÄ±: Ã¼Ã§ kritik hata yalnÄ±zca ayakta bir
veritabanÄ±yla ortaya Ã§Ä±kabilirdi. Hepsi derleniyordu, lint geÃ§iyordu ve
tip denetiminden geÃ§iyordu.

| Commit | Ä°ÅŸ |
|---|---|
| `48b0b7d` | VeritabanÄ± ayaÄŸa kalktÄ± â€” Ã¼Ã§ kritik hata dÃ¼zeltildi |
| `3d05194` | SÃ¶zleÅŸme testleri 24/24 â€” iki yetki aÃ§Ä±ÄŸÄ± kapatÄ±ldÄ± |
| `53e5010` | Gider TÃ¼rÃ¼ modÃ¼lÃ¼ + istek baÄŸlamÄ± middleware'e alÄ±ndÄ± |
| `e4149c4` | Gider TÃ¼rÃ¼ arayÃ¼zÃ¼ |
| `002fcf8` | Tahakkuk modÃ¼lÃ¼ |
| `5322afe` | AraÃ§ modÃ¼lÃ¼ + migration 0004 |
| `0b8609c` | SayaÃ§ modÃ¼lÃ¼ + migration 0005 + tahakkuk entegrasyonu |
| `3985c4c` | Belge modÃ¼lÃ¼ + migration 0006 + nesne deposu (MinIO) |
| `58ae032` | Belge profesyonel seviye (0007) + Daire GÃ¶revlileri (0008) |
| `a9d4071` | Devir notu â€” kritik soft-delete bulgusu |
| `b869940` | ModÃ¼l adÄ± dÃ¼zeltmesi: Konut Ã‡alÄ±ÅŸanlarÄ± â†’ Daire GÃ¶revlileri (0009) |
| `394eb61` | Site Personeli / Daire GÃ¶revlisi ayrÄ±mÄ± (0010) + tek ekran hÄ±zlÄ± kayÄ±t (0011-0013) + Misafir modÃ¼lÃ¼ |
| `e191968` | Devir notu â€” v23/v24 referans mimari gÃ¶revi |
| `2f39c75` | PortfÃ¶y YÃ¶netim Merkezi (0014 Â· ADR-0009) + v23/v24 boÅŸluk analizi |
| `b40ee54` | BeÅŸ "Yeni Ekle" formu sekmeli â€” KiÅŸi Bilgileri + modÃ¼le Ã¶zel sekmeler |
| `<muhasebe>` | **Muhasebe Ã§ekirdeÄŸi** (0015) â€” hesap planÄ± Â· fiÅŸ Â· defterler Â· mizan Â· dÃ¶nem kapanÄ±ÅŸÄ± + **iki sessiz kusur dÃ¼zeltildi** |
| `230042d` | **Banka YÃ¶netimi Ã§ekirdeÄŸi** (0016) â€” banka Â· ÅŸube Â· hesap Â· POS Â· hareket Â· virman Â· ekstre Â· mutabakat Â· Ã§ek/senet + **veritabanÄ± kÄ±sÄ±t ihlalleri artÄ±k 500 deÄŸil 4xx** |
| `5b56381` | ADR-0010 â€” cari hesap = **bÃ¶lÃ¼m yardÄ±mcÄ± defteri** (karar referans belgeden Ã§Ã¶zÃ¼ldÃ¼) |
| `85bbca5` | Tahsilat Ã§ekirdeÄŸi yarÄ±m (0017 + domain) â€” ÅŸema ve kurallar |
| `ed68721` | **Makbuzlar** (tahsilat uÃ§larÄ± + `/muhasebe` sekmesi) + **Genel Geri Al** (0018) |
| `2094903` | **Ä°letiÅŸim Ã§ekirdeÄŸi** (0019/0020) â€” WhatsApp Â· SMS Â· e-posta TEK modÃ¼lde |
| `ded0cc3` | **Sakin dayanak kuralÄ±** (0021) â€” sakin artÄ±k malike ya da kiracÄ±ya baÄŸlÄ± |
| `cdbe92d` | **DayanaÄŸÄ± biten sakine otomatik Ã§Ä±kÄ±ÅŸ** â€” malik devri Â· kiracÄ± tahliyesi + **bozuk kimlik artÄ±k 500 deÄŸil 404** |
| `90d085b` | **AltyapÄ± ve Ã¶lÃ§eklenebilirlik denetimi** â€” salt okunur, kod deÄŸiÅŸmedi (Â§3.F) |
| `e7543f7` | Oturum kapanÄ±ÅŸÄ± â€” devredilen iki dÃ¼zeltme kayda geÃ§ti (Â§3.G) |
| _bu commit_ | **Â§3.G'deki iki dÃ¼zeltme UYGULANDI** â€” konteyner giriÅŸ noktasÄ± + istek sÄ±nÄ±rÄ± |

### Bu commit'te yapÄ±lan â€” dayanaÄŸÄ± sona eren sakine otomatik Ã§Ä±kÄ±ÅŸ

ÃœrÃ¼n sahibi: *"DEVREDÄ°LMÄ°Å MALÄ°K VE TAHLÄ°YE EDÄ°LMÄ°Å KÄ°RACIDA SAKÄ°NLERDE
OTOMATÄ°KMEN TAHLÄ°YE EDÄ°LÄ°R"*.

0021 sakini bir malike ya da kiracÄ±ya baÄŸladÄ±. Bu commit baÄŸÄ±n **sona erme**
yÃ¶nÃ¼nÃ¼ kapatÄ±yor: dayanak biterse (tapu devri Â· kiracÄ± tahliyesi) o dayanaÄŸa
baÄŸlÄ± sakinlerin oturma hakkÄ± da biter.

**Elle yapÄ±lmasÄ± beklenseydi unutulurdu ve hata SESSÄ°Z olurdu.** KiracÄ± tahliye
edilir, eÅŸi ve Ã§ocuklarÄ± listede "hÃ¢len oturuyor" kalÄ±r; daire kartÄ±, acil
durum listesi ve doluluk raporu **aylarca** yanlÄ±ÅŸ Ã§alÄ±ÅŸÄ±r â€” kayÄ±t geÃ§erli
gÃ¶rÃ¼ndÃ¼ÄŸÃ¼ iÃ§in kimse fark etmez.

- `backend/src/common/kayit/sakin-otomatik-cikis.ts` â€” **tek yerde** yazÄ±lan
  kural; `malik.devret` ve `kiraci.tahliyeEt` ikisi de bunu Ã§aÄŸÄ±rÄ±r. AyrÄ± ayrÄ±
  yazÄ±lsaydÄ± biri dÃ¼zeltildiÄŸinde Ã¶teki eski davranmaya devam ederdi.

#### Zorlanan kritik kurallar

- **AYNI Ä°ÅLEM Ä°Ã‡Ä°NDE.** DayanaÄŸÄ±n kapanÄ±ÅŸÄ± ile sakinlerin Ã§Ä±kÄ±ÅŸÄ± ya birlikte
  olur ya hiÃ§ olmaz. AyrÄ± iÅŸlemde yapÄ±lsaydÄ± araya dÃ¼ÅŸen bir hata "kiracÄ±
  gitmiÅŸ ama ailesi hÃ¢lÃ¢ oturuyor" durumunu **kalÄ±cÄ±** hÃ¢le getirirdi.
- **Ã‡IKIÅ TARÄ°HÄ° = DAYANAÄIN BÄ°TÄ°ÅÄ°**, bugÃ¼n deÄŸil. KiracÄ± 30.06'da tahliye
  edildiyse ailesi de o gÃ¼n Ã§Ä±kmÄ±ÅŸtÄ±r; "bugÃ¼n" yazÄ±lsaydÄ± aradaki gÃ¼nler
  boyunca oturuyor gÃ¶rÃ¼nÃ¼rlerdi.
- **GÄ°RÄ°ÅÄ°, DAYANAÄIN BÄ°TÄ°ÅÄ°NDEN SONRA OLAN KAYIT SESSÄ°ZCE ATLANMAZ.** Ã‡Ä±kÄ±ÅŸ
  giriÅŸten Ã¶nce yazÄ±lsaydÄ± "eksi gÃ¼n oturmuÅŸ" bir kayÄ±t doÄŸardÄ±; bugÃ¼ne
  Ã§ekilseydi kiÅŸi dayanaÄŸÄ± bittikten sonra da oturmuÅŸ gÃ¶rÃ¼nÃ¼rdÃ¼. Ä°kisi de
  veriyi bozar â€” kayÄ±t **aÃ§Ä±k bÄ±rakÄ±lÄ±r** ve gerekÃ§esiyle **kullanÄ±cÄ±ya
  bildirilir**; kararÄ± kullanÄ±cÄ± verir.
- **HER SAKÄ°N Ä°Ã‡Ä°N AYRI DENETÄ°M KAYDI + AYRI OUTBOX OLAYI.** Tek toplu satÄ±r
  yazÄ±lsaydÄ± "benim sakin kaydÄ±mÄ± kim, ne zaman kapattÄ±" sorusu kiÅŸi bazÄ±nda
  yanÄ±tlanamazdÄ±. Olay elle Ã§Ä±kÄ±ÅŸla **aynÄ±dÄ±r** (`apartman.sakin.cikti`); fark
  `payload.otomatikMi` ile taÅŸÄ±nÄ±r, bÃ¶ylece tÃ¼keticiler ikisini ayÄ±rmak
  zorunda kalmaz.
- **SAYI YANITTA DÃ–NER VE EKRANDA GÃ–STERÄ°LÄ°R** (`sakinCikisi.cikarilan`).
  DÃ¶nmeseydi yÃ¶netici dÃ¶rt kiÅŸiyi listeden dÃ¼ÅŸÃ¼rdÃ¼ÄŸÃ¼nÃ¼ hiÃ§ Ã¶ÄŸrenmez, daire
  beklenmedik biÃ§imde boÅŸ gÃ¶rÃ¼ndÃ¼ÄŸÃ¼nde nedenini arayacak yer olmazdÄ±.
- **Ã–ZET SAYFA SEVÄ°YESÄ°NDE TUTULUR.** Ä°lk denemede eylem bileÅŸenine konmuÅŸtu;
  ama devir/tahliyeden sonra kayÄ±t "geÃ§erli deÄŸil" olur ve o bileÅŸen `null`
  dÃ¶ner â€” Ã¶zet **yazÄ±ldÄ±ÄŸÄ± anda kaybolurdu**. Ã‡Ä±karÄ±lamayan kayÄ±tlar ayrÄ±ca
  bildirim balonunda deÄŸil **kalÄ±cÄ± panelde** durur: balon beÅŸ saniyede
  kaybolur, oysa bunlar kullanÄ±cÄ±nÄ±n elle yapmasÄ± gereken bir iÅŸi anlatÄ±r.
- **MOCK DA AYNI KURALI UYGULAR.** `MockSakin` artÄ±k `malikId`/`kiraciId`
  taÅŸÄ±yor. Mock hiÃ§bir ÅŸey yapmasaydÄ± demo modda kiracÄ± tahliye edilir, ailesi
  "hÃ¢len oturuyor" kalÄ±rdÄ± â€” mock, Ã¼rÃ¼nÃ¼n **yapmadÄ±ÄŸÄ±** bir ÅŸeyi gÃ¶sterirdi.
- **SÃ¶zleÅŸme bitiÅŸi (`duzelt`) tahliye DEÄÄ°LDÄ°R** ve sakinleri kapatmaz:
  sÃ¶zleÅŸme sessizce yenilenmiÅŸ olabilir. Otomatik Ã§Ä±kÄ±ÅŸ yalnÄ±zca `devret` ve
  `tahliyeEt` uÃ§larÄ±na baÄŸlÄ±dÄ±r.

#### Yan bulgu â€” bozuk kimlik BÃœTÃœN uygulamada 500 dÃ¶nÃ¼yordu

CanlÄ± test yazarken Ã§Ä±ktÄ±: `/kiracilar/undefined/tahliye` gibi bir yol Prisma
`P2023` ("Inconsistent column data: Error creating UUID") atÄ±yor ve bu kod
`prisma-hata-cevirisi.ts` iÃ§inde **eÅŸlenmemiÅŸti** â†’ 500 "sistem bozuldu".

Adres Ã§ubuÄŸundaki kimliÄŸi kÄ±rpÄ±lmÄ±ÅŸ her baÄŸlantÄ±, eksik deÄŸiÅŸken taÅŸÄ±yan her
istemci Ã§aÄŸrÄ±sÄ± bu koda dÃ¼ÅŸer. ArtÄ±k **404** dÃ¶nÃ¼yor: sunucu saÄŸlamdÄ±r,
*aranan kayÄ±t yoktur*. 400 deÄŸil 404 â€” kimliÄŸin biÃ§imi hakkÄ±nda bilgi vermek,
var olan bir kimliÄŸin biÃ§imini de doÄŸrulamak olurdu.

#### DoÄŸrulama

- Birim: `tests/unit/sakin-otomatik-cikis.test.mjs` (**19**) + P2023 testi â†’
  toplam **317** birim testi.
- CanlÄ± (gerÃ§ek veritabanÄ±): **23/23** â€” iki sakinin tahliyeyle kapanmasÄ±,
  malik yakÄ±nÄ±nÄ±n **etkilenmemesi**, ileri tarihli kaydÄ±n **aÃ§Ä±k kalÄ±p
  raporlanmasÄ±**, devirde kapanma, mÃ¼kerrer tahliyenin reddi, bozuk kimlikte
  404. Sakin dayanak testi de yeniden koÅŸuldu: **11/11**.
- `pnpm verify` 9/9 Â· lint temiz Â· sÃ¶zleÅŸme testleri 24/24.

### Bu commit'te yapÄ±lan â€” Sakin kayÄ±t kuralÄ±

**SAKÄ°N ARTIK BÄ°R MALÄ°KE YA DA KÄ°RACIYA BAÄLANMAK ZORUNDA.**

BugÃ¼ne kadar `sakin` yalnÄ±zca bÃ¶lÃ¼me ve kiÅŸiye baÄŸlÄ±ydÄ±; **"bu kiÅŸi burada
KÄ°MÄ°N YAKINI olarak oturuyor" sorusunun cevabÄ± yoktu.** SonuÃ§larÄ±: kiracÄ±
taÅŸÄ±ndÄ±ÄŸÄ±nda ailesinin akÄ±beti belirsizdi, acil durumda "bu Ã§ocuÄŸun velisi
kim" yanÄ±tsÄ±zdÄ±, sakin ile sorumlu arasÄ±ndaki baÄŸ kurulamÄ±yordu.

- **0021** â€” `sakin.malik_id` Â· `sakin.kiraci_id` Â· `sakin.yakinlik_aciklamasi`
  + `YakinlikDerecesi` enum'una `ANNE` ve `BABA`.
- Form: **Malik / KiracÄ± seÃ§imi** (dairenin kendi malik-kiracÄ±larÄ±ndan) â†’
  **YakÄ±nlÄ±k Derecesi** â†’ `DiÄŸer` seÃ§ilirse **serbest metin alanÄ± aÃ§Ä±lÄ±r**.

#### Zorlanan kritik kurallar

- **DAYANAK TAM OLARAK BÄ°R TANE.** Ä°kisi birden verilirse hangisinin geÃ§erli
  olduÄŸu belirsiz; hiÃ§biri verilmezse kayÄ±t "havada" kalÄ±r ve kuralÄ±n kendisi
  anlamsÄ±zlaÅŸÄ±r. (CHECK `sakin_dayanak_tek` + servis denetimi.)
- **DAYANAK AYNI BÃ–LÃœMDE OLMAK ZORUNDA â€” ve bunu VERÄ°TABANI garanti ediyor.**
  `(malik_id, bolum_id)` Ã§ifti `malik(id, bolum_id)`ye **bileÅŸik yabancÄ±
  anahtarla** baÄŸlandÄ±. YalnÄ±zca serviste denetlenseydi, doÄŸrudan veritabanÄ±na
  yazan bir betik ya da ileride yazÄ±lacak toplu aktarÄ±m kuralÄ± sessizce
  atlardÄ±. Servis ayrÄ±ca **aÃ§Ä±k hata mesajÄ±** iÃ§in denetler; yoksa kullanÄ±cÄ±
  anlaÅŸÄ±lmaz bir FK hatasÄ± gÃ¶rÃ¼rdÃ¼.
- **DEVREDÄ°LMÄ°Å MALÄ°KE / TAHLÄ°YE OLMUÅ KÄ°RACIYA yeni sakin baÄŸlanamaz** â€” o
  hane artÄ±k onun deÄŸildir.
- **`DIGER` seÃ§ilirse serbest metin ZORUNLU**; baÅŸka dereceye geÃ§ilirse
  **boÅŸaltÄ±lÄ±r**. BoÅŸaltÄ±lmasaydÄ± "DiÄŸer â€” AmcasÄ±" kaydÄ± "EÅŸi"ne Ã§evrildiÄŸinde
  ekranda "EÅŸi (AmcasÄ±)" gibi Ã§eliÅŸkili bir bilgi kalÄ±rdÄ±.
- **Liste dayanaÄŸÄ± GÃ–STERÄ°R** (`dayanakTipi` Â· `dayanakKisiAdi`): "AyÅŸe YÄ±lmaz
  Â· EÅŸi" satÄ±rÄ±, kimin eÅŸi olduÄŸu yazÄ±lmazsa dÃ¶rt daireli bir katta hiÃ§bir ÅŸey
  anlatmaz.
- **`ANNE_BABA` KALDIRILMADI.** Enum deÄŸeri silmek, o deÄŸeri taÅŸÄ±yan satÄ±rlar
  varsa imkÃ¢nsÄ±zdÄ±r ve geÃ§miÅŸ kayÄ±tlarÄ±n anlamÄ± deÄŸiÅŸmemelidir. Yeni kayÄ±tlarda
  `ANNE`/`BABA` kullanÄ±lÄ±r â€” acil durumda "annesini arayÄ±n" ile "babasÄ±nÄ±
  arayÄ±n" farklÄ± bilgilerdir. AynÄ± ÅŸekilde `AKRABA` Â· `MISAFIR` Â· `CALISAN`
  DTO'da kabul edilmeye devam eder (eski kayÄ±tlar dÃ¼zeltilebilsin diye) ama
  formda **teklif edilmez**.
- **`KENDISI` FORMDAN Ã‡IKARILDI.** Ä°lk uygulamada listeye eklenmiÅŸti; Ã¼rÃ¼n
  sahibi talebi aynen yineleyince karar olarak alÄ±ndÄ±. Form artÄ±k **tam olarak
  istenen altÄ± seÃ§eneÄŸi** gÃ¶sterir: EÅŸi Â· Ã‡ocuÄŸu Â· Annesi Â· BabasÄ± Â· KardeÅŸi Â·
  DiÄŸer. Model: sakin, dayanaÄŸÄ±nÄ±n **yakÄ±nÄ±dÄ±r**; malikin/kiracÄ±nÄ±n kendisi
  zaten kendi kaydÄ±yla durur. `KENDISI` enum'da ve DTO'da kalÄ±r â€” eski
  kayÄ±tlarÄ±n dÃ¼zeltilebilmesi iÃ§in.
- **VARSAYILAN YAKINLIK YOK** â€” kullanÄ±cÄ± aÃ§Ä±kÃ§a seÃ§er. "EÅŸi" gibi bir
  varsayÄ±lan konsaydÄ±, alanÄ± atlayan kullanÄ±cÄ± Ã§ocuÄŸunu eÅŸi olarak kaydeder ve
  hata hiÃ§bir yerde gÃ¶rÃ¼nmezdi; acil durumda yanlÄ±ÅŸ kiÅŸiye ulaÅŸÄ±lÄ±rdÄ±.

#### Geriye dÃ¶nÃ¼k doldurma

Migration mevcut sakinleri sÄ±rayla baÄŸlar: (a) kiÅŸinin kendisi malik/kiracÄ±ysa
ona, (b) bÃ¶lÃ¼mÃ¼n aÃ§Ä±k kiracÄ±sÄ±na, (c) aÃ§Ä±k malikine. (b) ve (c) **tahmindir**
ve doldurulan kayÄ±tlar `yakinlik_aciklamasi` alanÄ±na **iz bÄ±rakÄ±r** â€” iz
olmasaydÄ± sonradan bakan biri bu baÄŸÄ±n kullanÄ±cÄ± tarafÄ±ndan mÄ± gÃ¶Ã§ tarafÄ±ndan
mÄ± kurulduÄŸunu ayÄ±rt edemezdi.

`CHECK sakin_dayanak_tek` doldurma baÅŸarÄ±sÄ±z kalÄ±rsa migration'Ä± **durdurur**.
BilinÃ§lidir: dayanaksÄ±z bir kaydÄ± sessizce bÄ±rakmak, kuralÄ± "yeni kayÄ±tlar
iÃ§in" geÃ§erli kÄ±lÄ±p eski veriyi gÃ¶rÃ¼nmez bir istisna hÃ¢line getirirdi.
(Bu veritabanÄ±nda 0 sakin kaydÄ± vardÄ±; doldurma yolu canlÄ±da sÄ±nanmadÄ±.)

#### Migration'da Ã§Ä±kan kusur

**FK doÄŸrulama taramasÄ± KAYNAK tabloyu da okur.** Ä°lk yazÄ±mda yalnÄ±zca hedefler
(`malik`, `kiraci`) RLS'ten muaf tutulmuÅŸtu; migration tam FK ekleme adÄ±mÄ±nda
durdu: *"Tenant baglami kurulmadan sorgu calistirilamaz"*. Tarama SELECT'i
`FROM ONLY sakin fk LEFT JOIN malik pk` biÃ§imindedir â€” kaynak taraf RLS
altÄ±ndaysa tarama da engellenir. (0011'de belgelenmiÅŸ tuzaÄŸÄ±n tekrarÄ±.)

#### DÃ¼zeltme formundaki gÃ¶sterim eksiÄŸi KAPATILDI

`secenekler()` mevcut deÄŸeri listeye **baÅŸa ekler**: eski deÄŸerli bir kayÄ±t
(`KENDISI` Â· `ANNE_BABA` Â· `AKRABA` â€¦) dÃ¼zenlenirken liste artÄ±k boÅŸ
gÃ¶rÃ¼nmÃ¼yor. BoÅŸ gÃ¶rÃ¼nseydi kullanÄ±cÄ± deÄŸerin kaybolduÄŸunu sanÄ±r ve rastgele
bir seÃ§im yaparak gerÃ§ek veriyi bozardÄ±. DÃ¼zeltme formuna ayrÄ±ca **"DiÄŸer" â†’
serbest metin** alanÄ± eklendi (ekleme formuyla aynÄ± kural).

### Bu commit'te yapÄ±lan â€” Ä°letiÅŸim (WhatsApp Business Â· SMS)

**WHATSAPP ve SMS AYRI MODÃœL DEÄÄ°LDÄ°R.** Ä°kisi de "bir mesajÄ±, bir alÄ±cÄ±ya,
bir kanaldan gÃ¶nder"dir. Ortak olanlar: alÄ±cÄ± Ã§Ã¶zÃ¼mÃ¼ (site Â· blok Â· kat Â·
daire Â· malik Â· kiracÄ± Â· sakin Â· daire gÃ¶revlisi Â· YK Â· kiÅŸiler), ÅŸablonlar ve
deÄŸiÅŸkenler, toplu/zamanlanmÄ±ÅŸ gÃ¶nderim, geÃ§miÅŸ, durum takibi, Ä°YS izin
denetimi, audit. AyrÄ± yazÄ±lsaydÄ± bu iskelet **iki kez** dururdu ve biri
dÃ¼zeltildiÄŸinde Ã¶teki sessizce eski davranÄ±rdÄ±. **Kanal bir ALANDIR.**
E-posta ileride aynÄ± Ã§ekirdeÄŸe yeni enum deÄŸeriyle girer.

Ekran: `/iletisim` â†’ **WhatsApp Â· SMS Â· E-posta** sekmeleri (kullanÄ±cÄ±nÄ±n
isteÄŸi: *"whatsapp, sms, e-posta gibi sekmeleri iletiÅŸim sekmesinde topla"*).

- **0019** â€” `mesaj_sablonu` Â· `iletisim_izni` Â· `mesaj_gonderimi` Â· `mesaj` Â·
  `otomatik_bildirim_kurali` + `kisi.whatsapp_no`. Hepsinde RLS + politika.
- **0020** â€” `daire_gorevlisi.whatsapp_no`. **Daire gÃ¶revlisi bir `Kisi`
  deÄŸildir** (0010); kendi telefonunu taÅŸÄ±r, dolayÄ±sÄ±yla kendi WhatsApp
  numarasÄ±nÄ± da taÅŸÄ±malÄ±ydÄ±.
- **domain** `shared/apartman-domain/src/iletisim` â€” 33 birim testi.
- **backend** `modules/iletisim` â€” CQRS + **saÄŸlayÄ±cÄ± portu**.
- **RBAC** â€” dÃ¶rt yeni izin (aÅŸaÄŸÄ±da).

#### Zorlanan kritik kurallar

- **HÄ°Ã‡BÄ°R MESAJ GERÃ‡EKTEN GÃ–NDERÄ°LMEZ** ve hiÃ§biri "teslim edildi"
  sayÄ±lmaz. SaÄŸlayÄ±cÄ± yokken durum `SAGLAYICI_YOK`ta kalÄ±r. Sahte bir baÅŸarÄ±,
  yÃ¶neticinin 400 daireyi bilgilendirdiÄŸini sanmasÄ±na yol aÃ§ardÄ± â€” ve bu
  ancak icra takibi aÅŸamasÄ±nda anlaÅŸÄ±lÄ±rdÄ±.
- **`SAGLAYICI_YOK` ve `IZIN_YOK`, `BASARISIZ` DEÄÄ°LDÄ°R.** Biri yapÄ±landÄ±rma
  eksiÄŸi, Ã¶teki hukuki engel; Ã¼Ã§Ã¼ tek durumda toplansaydÄ± "hata oranÄ±"
  hiÃ§bir ÅŸey anlatmazdÄ±.
- **Ä°YS: ÃœÃ‡ DURUM VARDIR, Ä°KÄ° DEÄÄ°L.** RET â†’ o kanalda bilgilendirme dahil
  hiÃ§bir ÅŸey; izin kaydÄ± yok â†’ bilgilendirme gider, ticari gitmez; Ä°ZÄ°N â†’
  ikisi de. Tek bayraÄŸa indirgenseydi ya aidat borcu haber verilemez ya da
  ticari ileti izinsiz giderdi (6563 s. K. md. 6 â€” idari para cezasÄ±).
- **SMS KONTÃ–RÃœ GSM-7/UCS-2 ayrÄ±mÄ±yla hesaplanÄ±r.** Tek bir `ÄŸ` mesajÄ±
  UCS-2'ye dÃ¼ÅŸÃ¼rÃ¼r ve parÃ§a sÄ±nÄ±rÄ± 160'tan 70'e iner. Hata **sessizdir**:
  mesaj yine gider, yalnÄ±zca fatura iki katÄ±na Ã§Ä±kar. (`Ã§ Ã¶ Ã¼` GSM-7'de
  vardÄ±r; hepsi UCS-2 sanÄ±lsaydÄ± kontÃ¶r boÅŸuna fazla hesaplanÄ±rdÄ±.)
- **Ã‡Ã–ZÃœLMEYEN ÅABLON DEÄÄ°ÅKENÄ° GÃ–NDERÄ°MÄ° ENGELLER.** Ham `{{ad}}` metninin
  ya da `"SayÄ±n , TL borcunuz var"` cÃ¼mlesinin gitmesi gÃ¼veni tek seferde
  bitirir. Ama tek alÄ±cÄ±nÄ±n eksik verisi **bÃ¼tÃ¼n partiyi dÃ¼ÅŸÃ¼rmez**: o mesaj
  `BASARISIZ` kaydedilir, Ã¶tekiler devam eder.
- **Ä°ZÄ°NSÄ°Z/NUMARASIZ ALICI ATLANMAZ, KAYDEDÄ°LÄ°R.** AtlansaydÄ± "500 kiÅŸiye
  gÃ¶nderdim" denir ama 80'ine gitmediÄŸi hiÃ§bir yerde gÃ¶rÃ¼nmezdi.
- **AYNI KÄ°ÅÄ° TEKÄ°LLEÅTÄ°RÄ°LÄ°R** â€” hem malik hem sakin olan kiÅŸi duyuruyu iki
  kez almaz (ve iki kontÃ¶r dÃ¼ÅŸmez).
- **AYRILMIÅ KÄ°RACIYA/ESKÄ° MALÄ°KE MESAJ GÄ°TMEZ**: alÄ±cÄ± Ã§Ã¶zÃ¼mÃ¼ *hÃ¢len sÃ¼ren*
  iliÅŸkiye bakar (`tapuBitis` Â· `bitis` Â· `cikisTarihi`).
- **GRUP hedefi AÃ‡IK HATA verir** â€” sistemde grup kavramÄ± yok; boÅŸ liste
  dÃ¶nmek sessiz baÅŸarÄ±sÄ±zlÄ±k olurdu.
- Numara **E.164'e normallenir** ve **sabit hat reddedilir**: normalleÅŸtirme
  olmasaydÄ± aynÄ± kiÅŸi Ã¼Ã§ kez kaydedilir ve aynÄ± duyuruyu Ã¼Ã§ kez alÄ±rdÄ±.

#### Yeni izinler (yetki matrisi geniÅŸletildi)

Bu talep RBAC gerektiriyordu ve iletiÅŸim izinleri **hiÃ§ yoktu**. DÃ¶rt ayrÄ±
izin eklendi â€” tek `iletisim.manage` deÄŸil, Ã§Ã¼nkÃ¼ bunlar farklÄ± bÃ¼yÃ¼klÃ¼kte
risklerdir:

| Ä°zin | Neden ayrÄ± |
|---|---|
| `ILETI_GONDER` | Tekil mesaj bir kiÅŸiye gider; yanlÄ±ÅŸsa dÃ¼zeltilir |
| `ILETI_TOPLU_GONDER` | 400 daireye aynÄ± anda gider ve **geri alÄ±namaz** |
| `ILETI_BELGE_PAYLAS` | Gizlilik seviyesi olan dosyayÄ± dÄ±ÅŸarÄ± Ã§Ä±karÄ±r (KVKK) |
| `ILETI_AYAR` | Åablon/kural deÄŸiÅŸikliÄŸi bÃ¼tÃ¼n gelecek gÃ¶nderimleri etkiler |

DaÄŸÄ±tÄ±m: `APARTMAN_YONETICISI` ve `YONETIM_SIRKETI` dÃ¶rdÃ¼ne de sahip.
`YK_BASKANI` **yalnÄ±zca `ILETI_GONDER`** â€” yÃ¶netim kurulu denetim organÄ±dÄ±r,
iÅŸletme deÄŸil; 400 daireye giden ve geri alÄ±namayan bir mesaj iÅŸletme
kararÄ±dÄ±r.

#### CanlÄ± testte Ã§Ä±kan iki kusur

1. **`tx.malik.findMany()` Ã§alÄ±ÅŸma zamanÄ±nda patladÄ±** â€” `Malik`, `Kiraci`,
   `Sakin` **soft delete taÅŸÄ±maz**; bunlar iliÅŸki kayÄ±tlarÄ±dÄ±r. AsÄ±l mesele
   tip hatasÄ± deÄŸil **anlam**: alan doÄŸru kabul edilseydi bile taÅŸÄ±nmÄ±ÅŸ
   kiracÄ±ya duyuru gitmeye devam ederdi.
2. **DÃ¶rt alÄ±cÄ±nÄ±n dÃ¶rdÃ¼ de numarasÄ±zken hiÃ§ uyarÄ± Ã¼retilmedi.** YanÄ±t
   "oluÅŸturuldu" dedi, `numarasiz: 4` sayÄ±sÄ± vardÄ± ama kimse okumak zorunda
   deÄŸildi. **SayÄ± ile uyarÄ± aynÄ± ÅŸey deÄŸildir**: sayÄ± veridir, uyarÄ±
   iddiadÄ±r. ArtÄ±k "hiÃ§bir alÄ±cÄ±ya mesaj gitmedi" aÃ§Ä±kÃ§a yazÄ±lÄ±yor.

#### KarÅŸÄ±lanmayanlar â€” aÃ§Ä±kÃ§a eksik

| Ä°stenen | Neden |
|---|---|
| **GerÃ§ek WhatsApp/SMS gÃ¶nderimi** | KullanÄ±cÄ±nÄ±n kararÄ±: *"gerÃ§ek API baÄŸlantÄ±larÄ± sonraki fazda"*. Port hazÄ±r; adaptÃ¶r eklenince servis kodu deÄŸiÅŸmez |
| **Belge paylaÅŸÄ±mÄ± (PDF/Excel/Word/resim)** | Ä°zin (`ILETI_BELGE_PAYLAS`) ve `BelgeVarlikTipi += MESAJ_GONDERIMI` hazÄ±r; **ekleme akÄ±ÅŸÄ± yazÄ±lmadÄ±**. Dosya altyapÄ±sÄ± Belge modÃ¼lÃ¼nde zaten var |
| **Otomatik bildirimler (14 olay)** | Kural tablosu var ve kayÄ±t alÄ±nabiliyor ama **outbox tÃ¼keticisi yok**: `aktif = true` olsa bile hiÃ§bir ÅŸey kendiliÄŸinden gitmez. Bu ekranda ve API aÃ§Ä±klamasÄ±nda yazÄ±lÄ± |
| **ZamanlanmÄ±ÅŸ gÃ¶nderim** | KayÄ±t oluÅŸur, **planlayÄ±cÄ± yok**; yanÄ±tta uyarÄ± olarak dÃ¶ner |
| **KiÅŸi kartlarÄ±na alan eklenmesi** | API hazÄ±r (`GET /iletisim/kisiler/:id`); Malik/KiracÄ±/Sakin **form ekranlarÄ±na** alan eklenmedi |
| **Åablon/izin/kural yÃ¶netim ekranlarÄ±** | API tam; ekran yalnÄ±zca ÅŸablon **seÃ§imi** sunuyor |
| **Grafikler** | Rapor uÃ§larÄ± seri dÃ¶ndÃ¼rÃ¼yor (`gunlukSeri`, `durumDagilimi`); grafik bileÅŸeni Ã§izilmedi |
| **DÄ±ÅŸa aktarma (Excel/PDF)** | FAZ 4 â€” kÃ¼tÃ¼phane kararÄ± bekliyor |

### Bu commit'te yapÄ±lan â€” Makbuzlar + Genel Geri Al

**Makbuzlar, `85bbca5`'te yarÄ±m kalan tahsilat modÃ¼lÃ¼nÃ¼ tamamlar.** Makbuz
AYRI BÄ°R VARLIK DEÄÄ°LDÄ°R: `tahsilat` kaydÄ±nÄ±n belge gÃ¶rÃ¼nÃ¼mÃ¼dÃ¼r. AyrÄ± bir
`makbuz` tablosu aÃ§Ä±lsaydÄ± aynÄ± para iki yerde durur ve biri gÃ¼ncellenmediÄŸinde
makbuz ile defter tutmazdÄ±.

Eklenen uÃ§lar (`/makbuzlar`):

- `GET /` **Makbuz GeÃ§miÅŸi** â€” iptal edilmiÅŸler de listede (durum rozetiyle);
  gizlenselerdi numara serisindeki boÅŸluk aÃ§Ä±klanamaz gÃ¶rÃ¼nÃ¼rdÃ¼.
- `GET /:id` **Tahsilat Makbuzu detayÄ±** â€” istenen alanlarÄ±n tamamÄ±.
  **Malik Â· KiracÄ± Â· Sakin Ã–DEYENDEN DEÄÄ°L** borcun sorumluluk zincirinden
  gelir: Ã¶deyen komÅŸusu olabilir.
- `GET /borclar/:bolumId` **DetaylÄ± Tahsilat GiriÅŸi** â€” aÃ§Ä±k borÃ§lar; hisseli
  mÃ¼lkiyette PAY satÄ±rlarÄ± ayrÄ±.
- `POST /tahsis-onerisi` â€” EN ESKÄ° VADE Ã¶nce, **hiÃ§bir ÅŸey yazmaz**.
- `POST /` tahsilat Â· `POST /:id/iptal` **Makbuz Ä°ptali** Â· `POST
  /:id/muhasebelestir`
- `GET /cari/:bolumId` **Cari Hesap Ekstresi** (ADR-0010) Â· `GET
  /rapor/yaslandirma` Â· `GET /rapor/kontrol-mutabakati`

Ekran: `/muhasebe` â†’ **Makbuzlar** sekmesi (altÄ±ncÄ± sekme). AyrÄ± rota deÄŸil â€”
makbuz listesi fiÅŸ listesiyle aynÄ± sÃ¼zgeÃ§/tablo iskeletini kullanÄ±r.

#### GENEL GERÄ° AL (0018)

**Yeni bir "ne deÄŸiÅŸti" gÃ¼nlÃ¼ÄŸÃ¼ AÃ‡ILMADI.** `audit_kaydi` zaten
`oncekiDeger`/`sonrakiDeger` tutuyor; ikinci bir gÃ¼nlÃ¼k yazÄ±lsaydÄ± iki kaynak
zamanla ayrÄ±ÅŸÄ±r ve geri alma **yanlÄ±ÅŸ deÄŸere** dÃ¶nerdi. `geri_alma` tablosu
yalnÄ±zca "hangi denetim kaydÄ±, hangi yÃ¶ntemle geri alÄ±ndÄ±" olgusunu taÅŸÄ±r â€”
iÅŸaret audit satÄ±rÄ±na yazÄ±lamaz Ã§Ã¼nkÃ¼ audit UPDATE'i trigger ile reddedilir.

YÃ¶ntemler varlÄ±ÄŸÄ±n **silme sÄ±nÄ±fÄ±na** gÃ¶re: FÄ°NANSAL â†’ `TERS_KAYIT` (kayÄ±t
silinmez), BELGE â†’ `ARSIVLE`/`GERI_YUKLE` (dosya silinmez, sÃ¼rÃ¼m korunur),
ANA_VERÄ° â†’ `ARSIVLE`/`GERI_YUKLE`/`ALAN_GERI_AL`.

Reddedilen durumlar **gerekÃ§esiyle** bildirilir: baÅŸkasÄ±nÄ±n iÅŸlemi Â· zaten geri
alÄ±nmÄ±ÅŸ Â· sonradan tekrar deÄŸiÅŸtirilmiÅŸ Â· anonimleÅŸtirme (KVKK) Â·
muhasebeleÅŸmiÅŸ finansal kayÄ±t Â· kapalÄ± dÃ¶nem Â· **kuralÄ± tanÄ±mlÄ± olmayan
varlÄ±k** ("muhtemelen ana veridir" varsayÄ±mÄ±yla devam edilseydi finansal bir
kayÄ±t silinebilirdi). 25 birim testi.

#### CanlÄ± testte Ã§Ä±kan iki kusur

1. **Geri alma uÃ§larÄ± `AUDIT_GORUNTULE` iznine baÄŸlanmÄ±ÅŸtÄ± â†’ 403.** O izin
   yalnÄ±zca DENETÃ‡Ä° rolÃ¼nde; yani kaydÄ± **giren kullanÄ±cÄ± kendi iÅŸlemini geri
   alamÄ±yordu** â€” Ã¶zelliÄŸin bÃ¼tÃ¼n amacÄ± buyken. DoÄŸru sÄ±nÄ±r **sahipliktir**:
   geri alma, kullanÄ±cÄ±nÄ±n zaten yapmaya yetkili olduÄŸu bir iÅŸlemi geri Ã§evirir
   ve servis kayÄ±t sahipliÄŸini doÄŸrular. ModÃ¼l izni kaldÄ±rÄ±ldÄ± (KapÄ± 1 ve 2
   Ã§alÄ±ÅŸmaya devam eder), **yetki matrisi deÄŸiÅŸtirilmedi, yeni izin
   tanÄ±mlanmadÄ±**.
2. **`dist` bayat kaldÄ±ÄŸÄ± iÃ§in ilk dÃ¼zeltme gÃ¶rÃ¼nmedi.** Backend Ã§alÄ±ÅŸÄ±rken
   yapÄ±lan derleme dosyalarÄ± yazamamÄ±ÅŸ; sÃ¼reÃ§ kapatÄ±lÄ±p `dist` silinerek
   yeniden derlendi. (Bilinen tuzak: Ã§alÄ±ÅŸan backend derleme Ã§Ä±ktÄ±sÄ±nÄ± kilitler.)

### Bu commit'te yapÄ±lan â€” Banka YÃ¶netimi Ã§ekirdeÄŸi (FAZ 1)

KullanÄ±cÄ±nÄ±n istediÄŸi **17 alt modÃ¼l dokuz tabloya indirildi.** Bu bir
eksiltme deÄŸil, "gereksiz tekrar eden ekran oluÅŸturma" kuralÄ±nÄ±n veri
katmanÄ±ndaki karÅŸÄ±lÄ±ÄŸÄ±dÄ±r:

| Ä°stenen | KarÅŸÄ±lÄ±ÄŸÄ± |
|---|---|
| Bankalar Â· Åubeler Â· Hesaplar | `banka` Â· `banka_subesi` Â· `banka_hesabi` |
| POS TanÄ±mlarÄ± Â· Sanal POS | `pos_tanimi` (`tip`) |
| Havale Â· EFT Â· FAST Â· Virman Â· Masraf Â· Faiz | `banka_hareketi` (`islem_tipi`) |
| Ekstreler Â· Online Ekstre Â· Mutabakat | `banka_ekstresi` + `ekstre_satiri` |
| Ã‡ek Â· Senet | `kiymetli_evrak` (`tip`) |
| Banka Parametreleri | `banka_parametresi` |

**âš ï¸ HAVALE ve EFT AYRI TABLO DEÄÄ°LDÄ°R.** Ä°kisi de "bir banka hesabÄ±ndan para
Ã§Ä±kÄ±ÅŸÄ±"dÄ±r ve alan kÃ¼meleri birebir aynÄ±dÄ±r. AyrÄ± tutulsaydÄ± banka bakiyesi
dÃ¶rt ayrÄ± sorgunun toplamÄ± olur, biri unutulduÄŸunda **bakiye sessizce yanlÄ±ÅŸ
Ã§Ä±kardÄ±** ve mutabakat dÃ¶rt tabloyu ayrÄ± ayrÄ± taramak zorunda kalÄ±rdÄ±.

Katmanlar:

- **0016** â€” dokuz tablo, hepsinde RLS + FORCE + politika; 6 kÄ±smÃ® unique
  index, 14 CHECK kÄ±sÄ±tÄ±. `BelgeVarlikTipi` += `BANKA_HAREKETI` Â·
  `BANKA_EKSTRESI` Â· `KIYMETLI_EVRAK` (belge modÃ¼lÃ¼ yeniden kullanÄ±ldÄ±).
- **domain** â€” `shared/apartman-domain/src/banka`: IBAN mod-97, hareket/virman
  kurallarÄ±, POS komisyonu (binde BigInt), mutabakat eÅŸleÅŸtirme, Ã§ek/senet
  durum makinesi. **38 birim testi.**
- **backend** â€” `modules/banka`, CQRS ayrÄ±mÄ± korundu: `BankaTanimServisi` Â·
  `BankaHareketCommandServisi` Â· `EkstreServisi` Â· `KiymetliEvrakServisi` Â·
  `BankaParametreServisi` (yazma), `BankaHareketQueryServisi` (okuma).
  **Yeni izin tanÄ±mlanmadÄ±.**
- **ekran YOK** â€” kullanÄ±cÄ±nÄ±n talimatÄ±: *"Do not generate the remaining
  screens yet."* FAZ 1 yalnÄ±zca temeldir.

Zorlanan kritik kurallar (canlÄ± test **91/91**, iki kez Ã¼st Ã¼ste):

- **IBAN mod-97 ile doÄŸrulanÄ±r.** Uzunluk denetimi yetmez: tek hane yanlÄ±ÅŸ
  girilmiÅŸ bir IBAN biÃ§imsel olarak kusursuz gÃ¶rÃ¼nÃ¼r ve hata ancak **para
  baÅŸka hesaba gittiÄŸinde** anlaÅŸÄ±lÄ±r. IBAN'Ä±n banka kodu seÃ§ilen bankanÄ±n EFT
  kodu ile tutmazsa hesap eklenemez.
- **Banka hesabÄ± muhasebe hesabÄ±na baÄŸlanmak ZORUNDA** ve baÄŸlanan hesabÄ±n
  `ozellik = BANKA` olmalÄ±. BaÄŸ olmasaydÄ± banka bakiyesi ile 102 Bankalar
  hesabÄ±nÄ±n bakiyesi baÄŸÄ±msÄ±z iki sayÄ± olur, **mutabakat yapÄ±lamazdÄ±**.
- **Tutar iÅŸaretsiz, yÃ¶n ayrÄ± alan.** Negatif tutarla Ã§Ä±kÄ±ÅŸ yazÄ±labilseydi
  "toplam giriÅŸ" sorgusu negatifleri de toplardÄ±.
- **VÄ°RMAN tek hareket olarak yazÄ±lamaz** â€” iki bacak, aynÄ± transaction,
  karÅŸÄ±lÄ±klÄ± referans. FarklÄ± para birimi virman deÄŸildir (kur iÅŸlemi).
- **Ä°ÅLEM ve VALÃ–R bakiyesi AYRI raporlanÄ±r.** Tek sayÄ± verilseydi POS
  tahsilatÄ± henÃ¼z hesaba geÃ§memiÅŸken bakiyede gÃ¶rÃ¼nÃ¼r, harcanabilir sanÄ±lÄ±r ve
  karÅŸÄ±lÄ±ksÄ±z Ã¶deme yapÄ±lÄ±rdÄ±. `yoldaTutar` farkÄ± gÃ¶sterir.
- **MuhasebeleÅŸtirme ayrÄ± adÄ±m ve TEK TRANSACTION.** FiÅŸ Ã¼retimi
  `FisCommandServisi.ekleIslemde` ile **kopyalanmadan** Ã§aÄŸrÄ±lÄ±r. Ä°ki ayrÄ±
  iÅŸlem olsaydÄ± fiÅŸ yazÄ±lÄ±p hareket iÅŸaretlenmeden hata alÄ±nabilir, hareket
  "muhasebeleÅŸmemiÅŸ" gÃ¶rÃ¼nmeye devam eder ve **aynÄ± para iki kez** deftere
  girerdi.
- **MuhasebeleÅŸmiÅŸ ya da eÅŸleÅŸmiÅŸ hareket deÄŸiÅŸtirilemez.**
- **Otomatik eÅŸleÅŸtirme BELÄ°RSÄ°ZLÄ°KTE DURUR.** Ä°ki aday uyuyorsa hiÃ§biri
  seÃ§ilmez; `kalanEslesmeyen` yanÄ±tta dÃ¶ner ve gizlenmez. Makine tahmin
  ederse yanlÄ±ÅŸ eÅŸleÅŸme mutabakatÄ± **sessizce tamamlanmÄ±ÅŸ** gÃ¶sterir.
- **`mutabikMi` Ä°KÄ° koÅŸul ister**: eÅŸleÅŸmemiÅŸ satÄ±r kalmamasÄ± **ve** bakiye
  farkÄ±nÄ±n sÄ±fÄ±r olmasÄ±. YalnÄ±zca satÄ±r sayÄ±sÄ±na bakÄ±lsaydÄ±, ekstrede hiÃ§
  gÃ¶rÃ¼nmeyen bir sistem hareketi mutabakatÄ± tamamlanmÄ±ÅŸ gÃ¶sterirdi.
- **FARK_KABUL gerekÃ§e ister** ve Ã¶zette **ayrÄ±** sayÄ±lÄ±r.
- **Ã‡ek/senet durum makinesi atlama kabul etmez.** `PORTFOYDE â†’
  TAHSIL_EDILDI` yasaktÄ±r: bankaya verilmemiÅŸ bir Ã§ek tahsil edilmiÅŸ olamaz ve
  "tahsilde bekleyenler" listesi bir daha doÄŸru olmazdÄ±. `KARSILIKSIZ â†’
  TAHSILDE` (yeniden ibraz) aÃ§Ä±ktÄ±r.
- Para her yerde `Decimal`/`Money`; hiÃ§bir yerde `Number`.

#### Bu commit'te bulunan sessiz kusur â€” kÄ±sÄ±t ihlalleri 500 dÃ¶nÃ¼yordu

`POST /banka/bankalar` aynÄ± EFT kodu ile ikinci kez Ã§aÄŸrÄ±ldÄ±ÄŸÄ±nda **500
"beklenmeyen bir sorun oluÅŸtu"** dÃ¶ndÃ¼. KÃ¶k neden banka modÃ¼lÃ¼nde deÄŸildi:
**Prisma/PostgreSQL kÄ±sÄ±t ihlalleri istisna filtresinde hiÃ§ eÅŸlenmemiÅŸti.**

Yani ÅŸemadaki **bÃ¼tÃ¼n** korumalar â€” 20'den fazla kÄ±smÃ® unique index, 30'dan
fazla CHECK kÄ±sÄ±tÄ±, yabancÄ± anahtarlar â€” kullanÄ±cÄ±ya "sistem bozuldu" gibi
gÃ¶rÃ¼nÃ¼yordu. `kisi_eposta_uq` iÃ§in Ã¶nceki bir oturumda **tek modÃ¼le Ã¶zel** Ã¶n
kontrol yazÄ±lmÄ±ÅŸtÄ±; bu sÄ±nÄ±fÄ± Ã§Ã¶zmez ve **yarÄ±ÅŸ durumuna** aÃ§Ä±ktÄ±r (kontrol ile
yazma arasÄ±na baÅŸka istek girebilir).

Ã‡Ã¶zÃ¼m merkezÃ®: `backend/src/common/errors/prisma-hata-cevirisi.ts`

- `P2002` â†’ **409**, `P2003` â†’ 422, `P2025` â†’ 404, `P2000` â†’ 422
- **CHECK kÄ±sÄ±tlarÄ± Prisma'da tipli hata deÄŸildir** (ham PostgreSQL mesajÄ±
  `PrismaClientUnknownRequestError` iÃ§inde gelir) â€” metinden de yakalanÄ±r.
  YalnÄ±zca tipli hatalar Ã§evrilseydi bÃ¼tÃ¼n CHECK korumalarÄ± 500 dÃ¶nmeye devam
  ederdi.
- **KÄ±smÃ® unique index'te Prisma alan adÄ± VERMEZ** (`meta.target` =
  `"(not available)"`). O metin alan adÄ± deÄŸildir ve **gÃ¶sterilmez** â€” var
  olmayan bir alan uydurulmaz. KÄ±sÄ±t adÄ± ham PostgreSQL mesajÄ±ndan okunur.
- Ã‡evrilemeyen hata `null` dÃ¶ner ve 500'e dÃ¼ÅŸer: **bilinmeyen hata iÃ§in 4xx
  uydurulmaz.**
- KÄ±sÄ±t adÄ± â†’ kullanÄ±cÄ± diline Ã§eviri tablosu **veri olarak** tutulur (Â§33
  kural 3). 12 birim testi.

#### Ä°kinci kalÄ±cÄ± koruma â€” RLS politika kapsamÄ± taramasÄ±

`scripts/rls-scan.mjs` **uygulama** tarafÄ±nÄ± denetliyordu (sorgu baÄŸlam iÃ§inden
mi Ã§alÄ±ÅŸÄ±yor). **VeritabanÄ±** tarafÄ±nÄ± kimse denetlemiyordu: yeni bir tabloya
`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` yazmayÄ± unutmak derleme hatasÄ±
vermez, lint geÃ§er, testleri kÄ±rmaz ve uygulama taramasÄ±na da yakalanmaz â€”
sonuÃ§ **tenant izolasyonunun sessizce kalkmasÄ±dÄ±r.**

`scripts/rls-politika-scan.mjs` migration SQL'lerini okur ve `verify`
zincirine eklendi (artÄ±k 9 adÄ±m). 0001'in **dinamik** politika dÃ¶ngÃ¼sÃ¼
(`tenant_id` sÃ¼tunu olan her tabloyu tarar) modellendi; o dÃ¶ngÃ¼ yalnÄ±zca **o
anda var olan** tablolarÄ± kapsar, sonradan eklenen tablo kendi migration'Ä±nda
aÃ§Ä±kÃ§a politika almak zorundadÄ±r. Muafiyetler (`tenant` Â· `oturum_dizini`)
**gerekÃ§esiyle** listede. CanlÄ± veritabanÄ±na karÅŸÄ± da doÄŸrulandÄ±: 45 tablo,
9/9 banka tablosu RLS + FORCE + politika, `bnos_app` ve `bnos_migrator`
`NOBYPASSRLS`.

Ã–ncesinde (aynÄ± gÃ¼n, Docker'dan baÄŸÄ±msÄ±z): `8bca955` Â· `66bd2a5` Â·
`b4759d3` Â· `ec76035` Â· `89a56df` Â· `666c918`.

### Bu commit'te yapÄ±lan â€” muhasebe Ã§ekirdeÄŸi

**BULGU: muhasebe ÅEMASI vardÄ± ama HÄ°Ã‡ UCU VE EKRANI YOKTU.** `hesap`,
`yevmiye_fisi` ve `yevmiye_satiri` 0001'de kurulmuÅŸtu ve yalnÄ±zca tahakkuk
modÃ¼lÃ¼ dolduruyordu; okuma, yazma, defter, mizan, dÃ¶nem â€” hiÃ§biri yoktu.

Eklenenler (0015 + `modules/muhasebe` + `/muhasebe` ekranÄ±):

| BÃ¶lÃ¼m | Durum |
|---|---|
| Hesap PlanÄ± | âœ… aÄŸaÃ§ Â· kod/tip tutarlÄ±lÄ±ÄŸÄ± Â· ara hesap korumasÄ± Â· arÅŸivleme |
| Muhasebe FiÅŸleri + detay | âœ… Ã§ift kayÄ±t denkliÄŸi Â· TASLAK/Ä°ÅLENDÄ° Â· **storno** |
| Yevmiye Defteri | âœ… tarih sÄ±rasÄ± Â· yevmiye sÄ±ra no |
| BÃ¼yÃ¼k Defter (Muavin) | âœ… aÃ§Ä±lÄ±ÅŸ devri Â· yÃ¼rÃ¼yen bakiye Â· doÄŸal yÃ¶n |
| Kasa Defteri | âœ… (aynÄ± uÃ§ `ozellik=BANKA` ile Banka Defteri) |
| Mizan | âœ… denklik denetimi yanÄ±tta dÃ¶ner |
| Muhasebe Parametreleri | âœ… varsayÄ±lan kasa/banka/dÃ¶nem kÃ¢rÄ± Â· geriye dÃ¶nÃ¼k pencere |
| DÃ¶nem Sonu KapanÄ±ÅŸ | âœ… hepsi (aÅŸaÄŸÄ±da) |

**DÃ¶nem Sonu KapanÄ±ÅŸ â€” altÄ± iÅŸlem:**

- **Yeni DÃ¶nem AÃ§Ä±lÄ±ÅŸÄ±** â€” aynÄ± mali yÄ±l iki kez aÃ§Ä±lamaz, tarih aralÄ±ÄŸÄ± Ã§akÄ±ÅŸamaz
- **Muhasebe AÃ§Ä±lÄ±ÅŸ Ä°ÅŸlemleri** â€” Ã¶nceki dÃ¶nemin **bilanÃ§o** bakiyelerini devreder
  (gelir/gider DEVRETMEZ: geÃ§miÅŸ yÄ±lÄ±n kÃ¢rÄ± yeni yÄ±lÄ±n gelir tablosunda ikinci
  kez gÃ¶rÃ¼nÃ¼rdÃ¼)
- **YansÄ±tma HesaplarÄ±** â€” `ozellik=YANSITMA` hesaplarÄ±nÄ± karÅŸÄ± yÃ¶ne yazar
- **Yevmiye Yeniden NumaralandÄ±rma** â€” `fisNo` **DEÄÄ°ÅTÄ°RÄ°LMEZ**, yalnÄ±zca
  `yevmiyeSiraNo` yazÄ±lÄ±r (makbuz Ã¼zerindeki numara ile defter tutmalÄ±)
- **Muhasebe/Mali YÄ±l KapanÄ±ÅŸÄ±** â€” gelir/gider sÄ±fÄ±rlanÄ±r, net sonuÃ§ Ã¶zkaynaÄŸa
  aktarÄ±lÄ±r; **GERÄ° ALINAMAZ** ve Ã¶nkoÅŸullar Ã¶ncesinde denetlenir

**Zorlanan kritik kurallar** (canlÄ± test 51/51):

- FiÅŸ **silinemez** â€” dÃ¼zeltme yalnÄ±zca ters kayÄ±t (storno); yÃ¶n ters Ã§evrilir,
  **negatif tutar yazÄ±lmaz** (eksi tutar mizan toplamlarÄ±nÄ± bozar)
- **KapalÄ± dÃ¶neme fiÅŸ yazÄ±lamaz** â€” dÃ¼zeltme aÃ§Ä±k dÃ¶nemde storno ile
- En az iki satÄ±r Â· borÃ§ = alacak Â· satÄ±rda tek yÃ¶n Â· ara hesaba fiÅŸ yok Â·
  aynÄ± hesap aynÄ± yÃ¶nde iki kez yok
- **Taslak fiÅŸ mizanda gÃ¶rÃ¼nmez** (parametre aÃ§abilir)
- Kasa/Banka Defteri hesap **koduna deÄŸil** `hesap.ozellik` alanÄ±na dayanÄ±r
  (kod planÄ± tenant'a gÃ¶re deÄŸiÅŸir)
- Para her yerde **Decimal/Money**, hiÃ§bir yerde `Number`

#### ğŸ”´ Ä°ki sessiz kusur bulundu ve dÃ¼zeltildi

**1. `silmeyiDogrula` engelleyen baÄŸÄ±mlÄ±lÄ±klarÄ± HÄ°Ã‡ OKUMUYORDU.** Alan
arayÃ¼zde tanÄ±mlÄ±ydÄ±, **dÃ¶rt modÃ¼l** dolduruyordu (`Belge`, `DaireGorevlisi`,
`Misafir`, `Hesap`) ama fonksiyon bakmÄ±yordu. SonuÃ§: "aÃ§Ä±k araÃ§ kaydÄ± varken
misafir/gÃ¶revli arÅŸivlenemez" ve "hareket gÃ¶rmÃ¼ÅŸ hesap arÅŸivlenemez"
korumalarÄ± **etkisizdi** â€” hesap arÅŸivlenip ona yazÄ±lmÄ±ÅŸ yevmiye satÄ±rlarÄ±
sahipsiz kalabiliyordu.

> ArayÃ¼zde duran ama okunmayan bir alan, Ã§aÄŸÄ±ranÄ± korunduÄŸuna inandÄ±rdÄ±ÄŸÄ± iÃ§in
> yokluÄŸundan daha tehlikelidir. DÃ¶rt test eklendi.

**2. `SilmePolitikaHatasi` istisna filtresinde eÅŸlenmemiÅŸti** â†’ 422 yerine
**500**. Ä°ki kusur birbirini gizliyordu: okunmayan alan yÃ¼zÃ¼nden bu hata hiÃ§
fÄ±rlatÄ±lmadÄ±ÄŸÄ± iÃ§in eÅŸleme eksikliÄŸi hiÃ§ gÃ¶rÃ¼nmemiÅŸti.

### Ã–nceki commit'te yapÄ±lan â€” beÅŸ form sekmeli hÃ¢le geldi

Malik Â· KiracÄ± Â· Sakin Â· Misafir Â· Daire GÃ¶revlisi "Yeni Ekle" ekranlarÄ±
sekmelendi. Ä°lk sekme **KiÅŸi Bilgileri** (ad Â· soyad Â· TC Â· telefon Â· e-posta Â·
doÄŸum tarihi Â· cinsiyet Â· adres Â· not Â· **Ã§oklu araÃ§ plakasÄ±**), ardÄ±ndan
modÃ¼le Ã¶zel sekmeler:

| ModÃ¼l | Sekmeler |
|---|---|
| Malik | KiÅŸi Bilgileri Â· **Tapu Bilgileri** |
| KiracÄ± | KiÅŸi Bilgileri Â· **Kira SÃ¶zleÅŸmesi** Â· **Kefil** |
| Sakin | KiÅŸi Bilgileri Â· **Oturum Bilgileri** |
| Misafir | KiÅŸi Bilgileri Â· **Ziyaret Bilgileri** |
| Daire GÃ¶revlisi | KiÅŸi Bilgileri Â· **GÃ¶rev Bilgileri** |

**TEK FORM, TEK KAYDET.** Sekmeler yalnÄ±zca hangi bÃ¶lÃ¼mÃ¼n gÃ¶rÃ¼neceÄŸini
deÄŸiÅŸtirir; her sekmenin kendi kaydet dÃ¼ÄŸmesi YOKTUR. KullanÄ±cÄ±nÄ±n daha Ã¶nce
istediÄŸi *"varsayÄ±lan kullanÄ±m tek ekrandan hÄ±zlÄ± kayÄ±t"* bÃ¶ylece korundu.

âš ï¸ **Sekmeli formun ASIL TUZAÄI: gizli sekmedeki hata gÃ¶rÃ¼nmez.** KullanÄ±cÄ±
Kaydet'e basar, hiÃ§bir ÅŸey olmaz ve nedenini gÃ¶remez. ÃœÃ§ koruma birlikte
uygulandÄ±:

1. **Sekme baÅŸlÄ±ÄŸÄ±nda hata rozeti** â€” o sekmedeki hata sayÄ±sÄ± kÄ±rmÄ±zÄ± badge
   olarak gÃ¶rÃ¼nÃ¼r (`aria-label="N hata"`; Ã§Ä±plak sayÄ± ekran okuyucuda
   anlamsÄ±zdÄ±r).
2. **GÃ¶nderim baÅŸarÄ±sÄ±zsa hatalÄ± ilk sekmeye geÃ§ilir** (`ilkHataliSekme`).
3. **Gizli alanda `required` KULLANILMAZ.** TarayÄ±cÄ± gizli bir zorunlu alanÄ±
   odaklayamaz ve gÃ¶nderimi *"An invalid form control is not focusable"* ile
   **sessizce** durdurur. BeÅŸ formdaki `required` nitelikleri kaldÄ±rÄ±ldÄ±;
   zorunluluk kendi doÄŸrulamamÄ±zla uygulanÄ±yor.

Ek olarak: **paneller kaldÄ±rÄ±lmaz, `hidden` ile gizlenir** â€” aÄŸaÃ§tan
Ã§Ä±karÄ±lsaydÄ± sekme deÄŸiÅŸtikÃ§e alanlarÄ±n DOM durumu sÄ±fÄ±rlanÄ±rdÄ±. Klavye
gezinmesi WAI-ARIA tabs desenine gÃ¶re (oklar Â· Home/End Â· tek durak).

**Hata yÃ¶nlendirme mantÄ±ÄŸÄ± test edildi.** `lib/sekme-hata.ts` React'ten ayrÄ±
tutuldu (JSX taÅŸÄ±yan modÃ¼l `node --test` ile iÃ§e alÄ±namaz) ve 9 test yazÄ±ldÄ±;
biri Ã¶zellikle ÅŸu ayrÄ±mÄ± korur: `plaka-0` Ã¶n ekle yakalanmalÄ± ama `plakaci`
yakalanMAmalÄ±. Birim testleri artÄ±k **155/155**.

> `.test.ts` olarak yazmak denendi: `pnpm verify` koÅŸuyor ama **ESLint
> dÃ¼ÅŸÃ¼yor** â€” kÃ¶k `tsconfig.json` yalnÄ±zca `references` taÅŸÄ±yan bir Ã§Ã¶zÃ¼m
> dosyasÄ± (`files: []`), bu yÃ¼zden `projectService` test dosyasÄ±nÄ± hiÃ§bir
> projede bulamÄ±yor. `.mjs` + Node 24 yerleÅŸik tip soyutlamasÄ± bunu tÃ¼mÃ¼yle
> Ã§Ã¶zdÃ¼.

### Ã–nceki commit'te yapÄ±lan â€” PortfÃ¶y YÃ¶netim Merkezi (ADR-0009)

**YÃ–NETÄ°M FÄ°RMASI ARTIK BÄ°R TENANT.** ÃœrÃ¼n gereksinimi PortfÃ¶y YÃ¶netim
Merkezi'ni zorunlu kÄ±ldÄ±: firma giriÅŸ yaptÄ±ÄŸÄ±nda doÄŸrudan bir projeye
dÃ¼ÅŸmÃ¼yor, Ã¶nce yÃ¶nettiÄŸi bÃ¼tÃ¼n projeleri kontrol merkezinde gÃ¶rÃ¼yor.

âš ï¸ **Yeni mimari TASARLANMADI.** [ADR-0002](docs/adr/log/0002-tenant-modeli.md)
bu gÃ¼nÃ¼ Ã¶ngÃ¶rmÃ¼ÅŸ ve Ã§Ã¶zÃ¼m yolunu *ÅŸimdiden yazmÄ±ÅŸtÄ±*:

> PortfÃ¶y gÃ¶rÃ¼nÃ¼mÃ¼ ileride **RLS gevÅŸetilerek Ã§Ã¶zÃ¼lmeyecektir.** Ã‡Ã¶zÃ¼m yolu:
> yÃ¶netim ÅŸirketi tenant'Ä± + apartman tenant'larÄ±ndan **aÃ§Ä±k devir**
> (delegation) iliÅŸkisi. Bu not, ileride kolay yolun (RLS by-pass) cazip
> gÃ¶rÃ¼nmemesi iÃ§in yazÄ±lmÄ±ÅŸtÄ±r.

Uygulanan tam olarak bu yol:

| Katman | Ne yapÄ±ldÄ± |
|---|---|
| Åema (0014) | `yonetim_delegasyonu` â€” firma tenant'Ä± âŸ· proje tenant'Ä±; **iki taraflÄ±** RLS politikasÄ± |
| Domain | `devirGecerliMi` Â· `devriDogrula` Â· `devirSonlandirmayiDogrula`; `Tenant.olustur` Ã¼Ã§ tipi de kabul ediyor |
| KapÄ± 2 | ÃœyeliÄŸin **ikinci yolu**: aktif devir. Jeton `dvr` claim'i taÅŸÄ±r |
| Backend | `/portfoy/ozet` Â· `/portfoy/projeler/:id/gir` Â· devir ekle/sonlandÄ±r |
| Rol | `YONETIM_SIRKETI.varsayilanPanel` â†’ **`/portfoy`** (projeye yÃ¶nlendirilmiyor) |
| Frontend | `/portfoy` kontrol merkezi + proje seÃ§imi + kabukta "Aktif proje / PortfÃ¶ye dÃ¶n" |
| Tohum | `portfoy@bn-yonetim.test` / `bnos1234` â€” iki projeye aÃ§Ä±k devir |

**Ã‡APRAZ-TENANT SORGU YOK.** Ã–zet, proje baÅŸÄ±na ayrÄ± `tenantIslemi(projeId)`
sorgusunun uygulama katmanÄ±nda toplanmasÄ±dÄ±r â€” ADR-0002'nin aÃ§Ä±kÃ§a kabul
ettiÄŸi bedel. `BYPASSRLS` yok ve CI'da denetleniyor.

**KÄ±smÃ® veri aÃ§Ä±kÃ§a bildiriliyor:** bir projenin Ã¶zeti okunamazsa satÄ±r
`ozetHatasi` ile YÄ°NE dÃ¶ner ve toplamlarÄ±n eksik olduÄŸu yazÄ±lÄ±r. 150 projeli
bir firmada bir projenin arÄ±zasÄ± Ã¶teki 149'u gÃ¶rÃ¼nmez kÄ±lmamalÄ±.

**Uydurma veri Ã¼retilmedi:** "AÃ§Ä±k Ä°ÅŸ Emirleri" ve "Bekleyen Talepler"
modÃ¼lleri yok; uÃ§lar **-1** dÃ¶ner ve ekran "ModÃ¼l hazÄ±r deÄŸil" gÃ¶sterir.
SÄ±fÄ±r basmak, "iÅŸ emri yok" ile "modÃ¼l yok" ayrÄ±mÄ±nÄ± gizlerdi.

### v23/v24 referans mimari boÅŸluk analizi

[`docs/V23-V24-BOSLUK-ANALIZI.md`](docs/V23-V24-BOSLUK-ANALIZI.md) â€”
referanslar madde madde mevcut kodla karÅŸÄ±laÅŸtÄ±rÄ±ldÄ±.

En Ã¶nemli iki bulgu:

1. **Referanslar ekran tasarÄ±mÄ± deÄŸil, SÃœRÃœM YOL HARÄ°TASIDIR** ve kendileri
   bunu sÃ¶ylÃ¼yor. Ekran envanteri V22 "Temel" belgesindedir.
2. ğŸ”´ **`/belgeler` menÃ¼de var ama sayfasÄ± YOK** â€” link 404 veriyor. Backend
   Belge modÃ¼lÃ¼ tam Ã§alÄ±ÅŸÄ±yor; eksik olan yalnÄ±zca ekran. Eski "KiÅŸiler"
   girdisiyle aynÄ± hata sÄ±nÄ±fÄ±.

### Ã–nceki commit'te yapÄ±lan â€” iki kavram ayrÄ±ldÄ±, kayÄ±t akÄ±ÅŸÄ± tek ekrana indi

**1. Ä°KÄ° AYRI KAVRAM TEK TABLODA BÄ°RLEÅTÄ°RÄ°LMÄ°ÅTÄ°.** 0009'da yapÄ±lan
adlandÄ±rma dÃ¼zeltmesi hatalÄ±ydÄ±: yÃ¶netimin kadrosu ile malikin Ã¼cretli
Ã§alÄ±ÅŸtÄ±rdÄ±ÄŸÄ± ev hizmetleri gÃ¶revlisi aynÄ± tabloya konmuÅŸtu. 0010 ile ayrÄ±ldÄ±:

| | **Site Personeli** | **Daire GÃ¶revlisi** |
|---|---|---|
| Ä°ÅŸveren | **YÃ¶netim** | **Malik / KiracÄ± / Sakin** |
| Ã–rnek | Site mÃ¼dÃ¼rÃ¼, gÃ¼venlik, temizlik, teknik, bahÃ§Ä±van, vale | Ã‡ocuk bakÄ±cÄ±sÄ±, hasta bakÄ±cÄ±sÄ±, ev yardÄ±mcÄ±sÄ±, aÅŸÃ§Ä±, ÅŸofÃ¶r |
| Ãœcret | Ä°ÅŸletme projesinden | Daire sahibi Ã¶der |
| SGK Â· departman Â· vardiya Â· zimmet | **Var** | **YOK** â€” yÃ¶netimin yÃ¼kÃ¼mlÃ¼lÃ¼ÄŸÃ¼ deÄŸil |
| Kapsam | Site geneli ya da apartman (`apartmanId` opsiyonel) | **Zorunlu tek baÄŸÄ±msÄ±z bÃ¶lÃ¼m** |
| AynÄ± TC tekilliÄŸi | Tenant geneli (mÃ¼kerrer kayÄ±t bordroyu ikiye katlar) | **BÃ¶lÃ¼m baÅŸÄ±na** (aynÄ± temizlikÃ§i Ã¼Ã§ dairede Ã§alÄ±ÅŸabilir) |
| KVKK veri sorumlusu | YÃ¶netim | Onu Ã§alÄ±ÅŸtÄ±ran malik |
| UÃ§ | `/site-personeli` | `/daire-gorevlileri` |

**2. KÄ°ÅÄ° SEÃ‡ME ZORUNLULUÄU KALKTI (0011).** Malik/kiracÄ±/sakin eklemek iÃ§in
Ã¶nce "KiÅŸiler"e gidip kayÄ±t aÃ§mak, sonra o kiÅŸiyi seÃ§mek gerekiyordu; bu,
sahada tek iÅŸlem olan bir ÅŸeyi ikiye bÃ¶lÃ¼yordu. ArtÄ±k `kisiId` isteÄŸe baÄŸlÄ±;
form iÃ§inde ad, soyad, TC, telefon, e-posta, doÄŸum tarihi, cinsiyet, adres,
not ve **Ã§oklu araÃ§ plakasÄ±** girilebiliyor.

> **MÃ¼kerrer kimlik kaydÄ± TC ve E-POSTA Ã¼zerinden Ã¶nleniyor.** `kisiId`
> zorunluluÄŸunun asÄ±l iÅŸlevi buydu. AynÄ± kiÅŸi iki `Kisi` satÄ±rÄ±na bÃ¶lÃ¼nÃ¼rse
> borÃ§ geÃ§miÅŸi, tahakkuk sorumluluÄŸu ve KVKK silme talebi iki kayda daÄŸÄ±lÄ±r.
> `kisiyiCoz` sÄ±rasÄ±: `kisiId` â†’ TC eÅŸleÅŸmesi â†’ e-posta eÅŸleÅŸmesi â†’ yeni kayÄ±t.
> Mevcut kiÅŸi bulunduÄŸunda YALNIZCA BOÅ alanlar doldurulur; dolu alanÄ±n
> Ã¼zerine yazmak kiracÄ± eklerken malikin telefonunu deÄŸiÅŸtirmek olurdu.

**3. MÄ°SAFÄ°R MODÃœLÃœ (0011).** Misafir **hak sahibi deÄŸildir**: borÃ§ sorumlusu
olmaz, tahakkuka girmez, arsa payÄ± taÅŸÄ±maz. Bu yÃ¼zden `Kisi` kaydÄ± AÃ‡ILMAZ â€”
verisi kÄ±sa Ã¶mÃ¼rlÃ¼dÃ¼r ve kalÄ±cÄ± kimlik kaydÄ±, ziyaretten aylar sonra silinmesi
gereken veriyi malik kayÄ±tlarÄ±yla aynÄ± Ã¶mre baÄŸlardÄ± (KVKK md. 4/1-Ã§).
Ã‡Ä±kÄ±ÅŸ tarihi boÅŸsa misafir **hÃ¢len iÃ§eridedir**; `/misafirler/iceride` gÃ¼venlik
ve tahliye listesidir.

**4. KEFÄ°L (0012).** KiracÄ±ya kefil alanlarÄ± eklendi ve **ayrÄ± `Kisi` kaydÄ±
aÃ§Ä±lmÄ±yor**: yÃ¶netimin ortak gider alacaÄŸÄ± malike (KMK md. 20) ve kiracÄ±ya
(md. 22, kira bedeli kadar mÃ¼teselsil) yÃ¶nelir, **kefile yÃ¶nelmez** â€” kefalet
kira sÃ¶zleÅŸmesinin tarafÄ±dÄ±r, yÃ¶netim planÄ±nÄ±n deÄŸil.

**5. TEK PLAKA KÃœTÃœÄÃœ, DÃ–RT SAHÄ°P TÄ°PÄ° + KAPSAM (0011-0013).** Otopark
kapasitesi malik aracÄ±yla bakÄ±cÄ±nÄ±n aracÄ±nÄ± ayÄ±rt etmez; ikisi de yer kaplar.
`arac` tek kÃ¼tÃ¼k kaldÄ±, sahip alanÄ± dÃ¶rde aÃ§Ä±ldÄ± (`arac_tek_sahip` tam olarak
birini zorlar) ve **kapsam** ayrÄ±ldÄ± (`arac_kapsam`):

- Malik Â· kiracÄ± Â· sakin Â· **daire gÃ¶revlisi** Â· **misafir** aracÄ± â†’
  **ilgili baÄŸÄ±msÄ±z bÃ¶lÃ¼me** (`bolum_id` dolu)
- **Site personeli aracÄ± â†’ YÃ–NETÄ°ME** (`bolum_id` boÅŸ)

> Personel aracÄ±nÄ± bir daireye yazmak o dairenin otopark hakkÄ±nÄ± tÃ¼ketmiÅŸ
> gÃ¶sterir ve KULLANIM_BAZLI daÄŸÄ±tÄ±mda ona fazla pay Ã§Ä±karÄ±r.

GÃ¶revli/misafir/personel kaydÄ± kapandÄ±ÄŸÄ±nda **aÃ§Ä±k araÃ§ kayÄ±tlarÄ± da aynÄ±
tarihte kapanÄ±r**; kapanmasaydÄ± iÅŸi bitmiÅŸ kiÅŸinin aracÄ± otopark sayÄ±mÄ±nda yer
kaplamaya devam ederdi.

### Bulunan ve dÃ¼zeltilen hatalar

1. **Migration 0001 hiÃ§ Ã§alÄ±ÅŸamazdÄ±.** Prisma'nÄ±n Ã¼retmesi gereken tablo
   DDL'i hiÃ§ Ã¼retilmemiÅŸti; dosyada yalnÄ±zca elle yazÄ±lan RLS bÃ¶lÃ¼mÃ¼ vardÄ±.
   `relation "kisi" does not exist` ile dÃ¼ÅŸÃ¼yordu. 0001 ve 0002 birleÅŸtirilip
   tek doÄŸru temel Ã¼retildi.
2. **GiriÅŸ hiÃ§ Ã§alÄ±ÅŸamazdÄ±.** `kullanici` RLS taÅŸÄ±r; kod "sistem iÅŸlemi olarak
   Ã§alÄ±ÅŸÄ±r" diyordu ama `sistemIslemi` RLS'i **atlamaz**, yalnÄ±zca baÄŸlam
   *kurmaz*. `POST /oturum/giris` her Ã§aÄŸrÄ±da 500 dÃ¶nÃ¼yordu. RLS'siz
   `oturum_dizini` katalogu eklendi (migration 0002); senkronu **trigger**
   tutar, uygulama kodu deÄŸil.
3. **Her okuma ucu 500 dÃ¶nÃ¼yordu.** 11 sorgu servisinde 30 Ã§aÄŸrÄ± RLS'li
   tablolarÄ± tenant baÄŸlamÄ± dÄ±ÅŸÄ±nda okuyordu â€” KapÄ± 2 dahil.
4. **BÃ¼tÃ¼n yazma uÃ§larÄ± kÄ±rÄ±ktÄ±.** Ä°stek baÄŸlamÄ± bir *interceptor*'da
   kuruluyordu; NestJS'te guard'lar interceptor'lardan **Ã¶nce** Ã§alÄ±ÅŸÄ±r, bu
   yÃ¼zden ÃœÃ§ KapÄ± baÄŸlama yazamÄ±yordu. Middleware'e alÄ±ndÄ±.
5. **Tenant uÃ§larÄ±nda hiÃ§ izin denetimi yoktu.** KimliÄŸi doÄŸrulanmÄ±ÅŸ herhangi
   bir kullanÄ±cÄ± platforma yeni yerleÅŸke aÃ§abiliyordu.
6. **PaylaÅŸÄ±lan paketler CommonJS'ten `require` edilemiyordu**; backend
   derlense de dist hiÃ§ Ã§alÄ±ÅŸmÄ±yordu.
7. **Yeni tenant belge politikasÄ±z aÃ§Ä±lÄ±yordu.** PolitikasÄ±z bir tenant'ta
   `tipPolitikasi` gÃ¼venli *gÃ¶rÃ¼nen* bir varsayÄ±lana dÃ¼ÅŸer (`finansalMi:
   false`) ve FATURA arÅŸivlendiÄŸinde silinebilir hale gelir; mali denetim izi
   sessizce kaybolur. VarsayÄ±lanlar domain'e taÅŸÄ±ndÄ±, tenant ve politikalarÄ±
   aynÄ± transaction'da yazÄ±lÄ±yor.
8. **DoÄŸrulama hatasÄ± hangi alanÄ±n hatalÄ± olduÄŸunu sÃ¶ylemiyordu.**
   `ValidationPipe` gÃ¶vdesinde `message` bir DÄ°ZÄ°DÄ°R; filtre yalnÄ±zca metin
   kabul ettiÄŸi iÃ§in sessizce dÃ¼ÅŸÃ¼yor ve istemciye "Bad Request Exception"
   gidiyordu â€” dosyadaki yorumun uyardÄ±ÄŸÄ± `String(unknown)` tuzaÄŸÄ±nÄ±n kardeÅŸi.

### KalÄ±cÄ± korumalar

- `scripts/rls-scan.mjs` â€” RLS'li modele tenant baÄŸlamÄ± dÄ±ÅŸÄ±nda eriÅŸen her
  Ã§aÄŸrÄ±yÄ± yakalar (**uygulama** tarafÄ±). `pnpm verify` zincirinde.
- `scripts/rls-politika-scan.mjs` â€” migration'da oluÅŸturulan her tablonun RLS
  politikasÄ± alÄ±p almadÄ±ÄŸÄ±nÄ± denetler (**veritabanÄ±** tarafÄ±). PolitikasÄ±z bir
  tablo derlenir, lint geÃ§er, testler yeÅŸil kalÄ±r ve tenant izolasyonu
  **sessizce** kalkar; bu iki tarama ayrÄ± sessiz kusur sÄ±nÄ±fÄ±dÄ±r.
- `common/errors/prisma-hata-cevirisi.ts` â€” veritabanÄ± kÄ±sÄ±t ihlalleri (unique Â·
  CHECK Â· FK) artÄ±k 500 deÄŸil **409/422/404** dÃ¶ner. Ã‡evrilemeyen hata `null`
  dÃ¶ner ve 500'e dÃ¼ÅŸer; bilinmeyen hata iÃ§in 4xx **uydurulmaz**.
- `scripts/db.mjs` â€” migration `bnos_migrator`, tohum `bnos_app` rolÃ¼yle
  koÅŸar. Tohumun uygulama rolÃ¼yle koÅŸmasÄ± **kasÄ±tlÄ±dÄ±r**: RLS bÃ¶ylece fiilen
  sÄ±nanÄ±r.
- `unplugin-swc` â€” vitest esbuild ile derliyordu ve `emitDecoratorMetadata`
  desteklemediÄŸi iÃ§in NestJS DI testlerde Ã§alÄ±ÅŸmÄ±yordu.

### Ã‡alÄ±ÅŸma zamanÄ± kanÄ±tÄ± (ilk kez alÄ±nabildi)

- Tenant baÄŸlamÄ± olmadan sorgu â†’ exception.
- A tenant'Ä± B'nin kaydÄ±nÄ± **gÃ¶remiyor**.
- YabancÄ± `tenant_id` ile yazma â†’ *"new row violates row-level security policy"*.
- Audit UPDATE/DELETE â†’ trigger reddediyor, kayÄ±t duruyor.
- `bnos_app` ve `bnos_migrator` â†’ `rolbypassrls = false`.
- 22/22 tenant tablosunda RLS + politika.

---

## 2. Åu anki durum

**DoÄŸrulama:** 9/9 build Â· ESLint 0 Â· tip denetimi temiz Â· verify **9/9** Â·
birim testleri **298/298** Â· sÃ¶zleÅŸme testleri **24/24** Â· lint:md 0 Â·
migration **21/21 uygulandÄ±** Â· 18 web rotasÄ± Â· hÄ±zlÄ± kayÄ±t canlÄ± testi
**40/40** Â· portfÃ¶y canlÄ± testi **19/19** Â· muhasebe canlÄ± testi **51/51** Â·
**banka canlÄ± testi 91/91** Â· makbuz+geri al **13/13** Â· iletiÅŸim **18/18** Â· sakin dayanak **11/11**.

> âš ï¸ **Makbuz canlÄ± testi 13/13.** `tahsilat` uÃ§larÄ± artÄ±k Ã§alÄ±ÅŸÄ±yor; kalan
> eksikler ("Makbuzlar talebinden karÅŸÄ±lanmayanlar") ve FAZ 2'nin geri kalanÄ±
> aÅŸaÄŸÄ±da baÅŸlÄ±klar hÃ¢linde yazÄ±lÄ±.

> âš ï¸ **MUHASEBE YAZMA YETKÄ°SÄ° YALNIZCA `YONETIM_SIRKETI` ROLÃœNDE.**
> `FINANS_YEVMIYE_GIRIS` ve `FINANS_DONEM_KAPAT` izinleri
> `APARTMAN_YONETICISI`de **yok**; o rol yalnÄ±zca defter gÃ¶rÃ¼ntÃ¼leyip ayar
> yapabiliyor. KMK md. 35/dâ€“36 uyarÄ±nca iÅŸletme defterini tutan ve genel kurula
> hesap veren taraf yÃ¶neticidir, dolayÄ±sÄ±yla bu daÄŸÄ±tÄ±m bÃ¼yÃ¼k olasÄ±lÄ±kla
> yanlÄ±ÅŸtÄ±r â€” ama **yetki matrisini izinsiz deÄŸiÅŸtirmedim**. Karar kullanÄ±cÄ±ya
> ait; deÄŸiÅŸecekse tek yerden: `shared/core-domain/src/yetki/roller.ts`.

Ã‡alÄ±ÅŸma aÄŸacÄ± temiz, `origin/master` ile senkron.

### AltyapÄ±

```bash
pnpm db:up        # postgres Â· redis Â· minio
pnpm db:status    # migration durumu
pnpm db:reset     # sÄ±fÄ±rla + migration + tohum (tohum bnos_app rolÃ¼yle)
pnpm test:contract
```

Tohum: iki tenant, her biri 1 apartman Â· 1 blok Â· 2 kat Â· bÃ¶lÃ¼mler Â·
malikler Â· 10 KMK varsayÄ±lan gider tÃ¼rÃ¼.
GiriÅŸ: `yonetici@guzel-apartmani.test` / `bnos1234`.

### Tamamlanan modÃ¼ller

| ModÃ¼l | Durum |
|---|---|
| **Gider TÃ¼rÃ¼** | âœ… API + UI. KMK md. 20 dÃ¶rt ekseni; kaynak referansÄ± zorunluluÄŸu; KARMA toplam denetimi |
| **Tahakkuk** | âœ… API. DaÄŸÄ±tÄ±m â†’ sorumluluk â†’ malik bÃ¶lÃ¼ÅŸÃ¼mÃ¼; snapshot; boÅŸluksuz numara; Ã¶nizleme; **sayaÃ§tan tÃ¼ketim** |
| **AraÃ§** | âœ… API + migration 0004. Plaka normalizasyonu; dÃ¶nemsel kayÄ±t; otopark aÅŸÄ±m raporu |
| **SayaÃ§** | âœ… API + migration 0005. Okuma Â· devir Â· deÄŸiÅŸim Â· dÃ¶nem tÃ¼ketimi Â· geÃ§miÅŸ |
| **Belge** | âœ… API + migration 0006/0007 + MinIO. Versiyonlama Â· kategori Â· Ã§oklu iliÅŸki Â· etiket Â· arama Â· gizlilik Â· Ã¶nizleme Â· KVKK imha |
| **Site Personeli** | âœ… API + UI + migration 0008/0009/0010. Ä°ÅŸveren YÃ–NETÄ°M. On gÃ¶rev Â· vardiya Â· SGK Â· sertifika Â· zimmet Â· ayrÄ±lÄ±ÅŸ Â· plaka (yÃ¶netim kapsamÄ±) |
| **Daire GÃ¶revlisi** | âœ… API + UI + migration 0010. Ä°ÅŸveren MALÄ°K/KÄ°RACI/SAKÄ°N. Ev hizmetleri; bÃ¶lÃ¼m zorunlu; plaka; Ã§alÄ±ÅŸma sonlandÄ±rma |
| **Misafir** | âœ… API + UI + migration 0011. `Kisi` kaydÄ± aÃ§maz; giriÅŸ/Ã§Ä±kÄ±ÅŸ; "hÃ¢len iÃ§eride" listesi; plaka |
| **HÄ±zlÄ± kayÄ±t** | âœ… Malik Â· KiracÄ± Â· Sakin Â· Misafir Â· Daire GÃ¶revlisi tek ekrandan. KiÅŸi seÃ§imi isteÄŸe baÄŸlÄ±; TC/e-posta ile tekilleÅŸtirme; Ã§oklu plaka |
| **Muhasebe** | âœ… API + UI (`/muhasebe`, 5 sekme) + migration 0015. Hesap planÄ± Â· fiÅŸ Â· storno Â· yevmiye/muavin/kasa defteri Â· mizan Â· dÃ¶nem kapanÄ±ÅŸÄ± (6 iÅŸlem) Â· parametreler |
| **Banka** | âœ… API + migration 0016, **EKRAN YOK** (kullanÄ±cÄ± talimatÄ±). Banka Â· ÅŸube Â· hesap (IBAN mod-97) Â· POS/sanal POS Â· hareket Â· virman Â· muhasebeleÅŸtirme Â· ekstre Â· mutabakat Â· Ã§ek/senet Â· parametreler |

KullanÄ±cÄ±nÄ±n istediÄŸi beÅŸ modÃ¼l + Belge profesyonel seviye + Site Personeli +
Daire GÃ¶revlisi + Misafir + tek ekran hÄ±zlÄ± kayÄ±t tamamlandÄ±.

### SayaÃ§ â€” kritik kurallar (canlÄ± doÄŸrulandÄ±)

- **SayaÃ§ geriye gitmez**; kÃ¼Ã§Ã¼len okuma reddedilir.
- **Devir aÃ§Ä±k bayrak ister.** 99998 â†’ 3 okumasÄ± `devirMi: true` olmadan
  reddedilir; iÅŸaretlendiÄŸinde tÃ¼ketim 100000âˆ’99998+3 = **5** Ã§Ä±kar.
  Tahmin edilseydi 99 995'lik olmayan bir tÃ¼ketim yazÄ±lÄ±rdÄ±.
- **DeÄŸiÅŸim dÃ¶neminde tÃ¼ketim iki parÃ§anÄ±n toplamÄ±dÄ±r** (5 + 120 = 125).
- Araya **geÃ§miÅŸ tarihli okuma girilemez** â€” sonraki tÃ¼ketimleri yanlÄ±ÅŸ bÄ±rakÄ±r.
- **TÃ¼ketim saklanÄ±r** (snapshot); sorgu anÄ±nda yeniden hesaplanmaz.
- Tahakkuk `sayacTuru` ile aÄŸÄ±rlÄ±klarÄ± okumalardan alÄ±r. **OkumasÄ± olmayan
  bÃ¶lÃ¼m varsa tahakkuk reddedilir** ve eksik kapÄ± numaralarÄ± yazÄ±lÄ±r; sessizce
  sÄ±fÄ±r yazmak o daireyi Ä±sÄ±tma giderinden muaf tutup farkÄ± diÄŸerlerine yÃ¼kler.

### Belge â€” kritik kurallar (canlÄ± doÄŸrulandÄ±)

- **Silinmez, versiyonlanÄ±r.** Yeni sÃ¼rÃ¼mde eski **arÅŸivlenir**.
- Zincirin ucu olmayan sÃ¼rÃ¼me yeni sÃ¼rÃ¼m baÄŸlanamaz (dallanma engellenir).
- **FÄ°NANSAL belge asla silinemez** (fatura Â· makbuz Â· genel kurul kararÄ±).
- GÃ¼ncel sÃ¼rÃ¼m silinemez; arÅŸivli + saklama sÃ¼resi dolmuÅŸ belge silinebilir.
- **Dosya API'den geÃ§mez**: Ã¶nimzalÄ± URL ile doÄŸrudan depoya. KayÄ±t aÃ§Ä±lmadan
  Ã¶nce nesnenin gerÃ§ekten yÃ¼klendiÄŸi `HeadObject` ile doÄŸrulanÄ±r.
- Nesne anahtarÄ± tenant Ã¶nekli; kayÄ±tta Ã¶nek denetlenir. Ä°ndirme
  `attachment` olarak zorlanÄ±r (HTML/SVG betik Ã§alÄ±ÅŸtÄ±rmasÄ±n), URL Ã¶mrÃ¼ 5 dk.
- **Kategori TÃœRÃœN Ã¶zelliÄŸidir**, belgenin deÄŸil: "Fatura" her zaman MALI.
  Belge baÅŸÄ±na serbest bÄ±rakÄ±lsaydÄ± aynÄ± tÃ¼r farklÄ± kategorilere dÃ¼ÅŸer ve
  kategori bazlÄ± arama gÃ¼venilmez olurdu.
- **Gizlilik yÃ¼kseltilebilir, DÃœÅÃœRÃœLEMEZ.** Tapu ve kira sÃ¶zleÅŸmesinin
  varsayÄ±lanÄ± KISIYE_OZEL'dir; tek yanlÄ±ÅŸ tÄ±kla herkese aÃ§Ä±lamamalÄ±.
- **Ã–nizleme yalnÄ±zca betik taÅŸÄ±yamayan tiplerde** (PDF Â· resim Â· dÃ¼z metin).
  HTML/SVG asla â€” depo alan adÄ±nda Ã§alÄ±ÅŸan betik oradaki oturum baÄŸlamÄ±na
  eriÅŸebilir.
- **KVKK kalÄ±cÄ± silmede Ã¼stveri KALIR.** KayÄ±t da silinseydi "bu belge ÅŸu
  tarihte, ÅŸu gerekÃ§eyle imha edildi" cevabÄ± kaybolur ve imha kanÄ±tlanamazdÄ±.
  Nesne, veritabanÄ± iÅŸlemi KAPANDIKTAN SONRA silinir.

### Site Personeli â€” kritik kurallar (canlÄ± doÄŸrulandÄ±)

- **`kisi` tablosundan AYRI tablo.** `Kisi` malik/kiracÄ±/sakin iliÅŸkilerinin
  dayandÄ±ÄŸÄ± KÄ°MLÄ°K kaydÄ±; personel bir Ä°STÄ°HDAM kaydÄ±. AynÄ± tabloda olsaydÄ±
  bir kapÄ±cÄ±nÄ±n o binada kiracÄ± olmasÄ± durumunda "iÅŸten ayrÄ±ldÄ±" iÅŸareti
  kiracÄ±lÄ±k kaydÄ±nÄ± da etkilerdi.
- AynÄ± TC ile **AKTÄ°F** ikinci kayÄ±t reddedilir (bordroyu ikiye katlar);
  ayrÄ±lmÄ±ÅŸ kayÄ±t engellemez â€” aynÄ± kiÅŸi tekrar iÅŸe alÄ±nabilir.
- **AyrÄ±lmÄ±ÅŸ personel AKTÄ°F olamaz** (veritabanÄ± kÄ±sÄ±tÄ±). AyrÄ± bÄ±rakÄ±lsaydÄ±
  "aktif personel" listesi ayrÄ±lmÄ±ÅŸ kiÅŸileri gÃ¶sterir ve vardiya planlamasÄ±
  yanlÄ±ÅŸ yapÄ±lÄ±rdÄ±.
- **AÃ§Ä±k zimmet ayrÄ±lÄ±ÅŸÄ± ENGELLEMEZ, UYARIR.** Teslim edilmemiÅŸ telsiz, kaydÄ±
  kapatmamak iÃ§in sebep deÄŸildir; gÃ¶rÃ¼nÃ¼r olmasÄ± yeter.
- Zimmet **iade ile kapanÄ±r**, silinmez â€” teslim geÃ§miÅŸi kanÄ±ttÄ±r.
- **AracÄ± YÃ–NETÄ°M kapsamÄ±ndadÄ±r** (`bolum_id` boÅŸ). AyrÄ±lÄ±ÅŸta araÃ§ da kapanÄ±r.
- **TC kimlik no denetim gÃ¶vdesine YAZILMAZ.** Audit kaydÄ± deÄŸiÅŸtirilemezdir;
  oraya giren kiÅŸisel veri bir daha silinemez.

### Daire GÃ¶revlisi â€” kritik kurallar (canlÄ± doÄŸrulandÄ±)

- **Ä°ÅŸveren YÃ–NETÄ°M DEÄÄ°LDÄ°R**, malik/kiracÄ±/sakindir. Bu yÃ¼zden SGK Â·
  departman Â· vardiya Â· zimmet alanlarÄ± **yoktur**: bunlarÄ± yÃ¶netimin
  kÃ¼tÃ¼ÄŸÃ¼nde tutmak, yÃ¶netimi hukuken iÅŸveren gibi gÃ¶sterirdi (5510 s.K.
  yÃ¼kÃ¼mlÃ¼lÃ¼ÄŸÃ¼ iÅŸvereninkidir).
- **`Kisi` kaydÄ± AÃ‡ILMAZ.** GÃ¶revli hak sahibi deÄŸildir; `Kisi`ye yazÄ±lsaydÄ±
  malik/kiracÄ± listelerine karÄ±ÅŸÄ±r ve borÃ§ sorumluluÄŸu sorgularÄ±nda gÃ¶rÃ¼nÃ¼rdÃ¼.
  `isverenKisiId` yalnÄ±zca ONU Ã‡ALIÅTIRAN kiÅŸiyi gÃ¶sterir.
- **`bolumId` ZORUNLU** â€” "site genelinde gÃ¶revli" hÃ¢li yoktur.
- AynÄ± TC tekilliÄŸi **BÃ–LÃœM BAÅINADIR**: bir temizlik gÃ¶revlisinin sitede Ã¼Ã§
  ayrÄ± dairede Ã§alÄ±ÅŸmasÄ± olaÄŸandÄ±r ve her biri ayrÄ± hizmet iliÅŸkisidir.
  Personeldeki kÄ±sÄ±t tenant genelindedir, Ã§Ã¼nkÃ¼ orada mÃ¼kerrer kayÄ±t bordro
  hatasÄ±dÄ±r.
- Ã‡alÄ±ÅŸma sonlandÄ±rÄ±ldÄ±ÄŸÄ±nda **aÃ§Ä±k araÃ§ kayÄ±tlarÄ± da kapanÄ±r**.

### Misafir â€” kritik kurallar (canlÄ± doÄŸrulandÄ±)

- **HAK SAHÄ°BÄ° DEÄÄ°LDÄ°R**: borÃ§ sorumlusu olmaz, tahakkuka girmez, arsa payÄ±
  taÅŸÄ±maz, genel kurulda oy kullanmaz.
- **`Kisi` kaydÄ± AÃ‡ILMAZ.** KVKK: misafir verisi kÄ±sa Ã¶mÃ¼rlÃ¼dÃ¼r; kalÄ±cÄ± kimlik
  kaydÄ±, ziyaretten aylar sonra silinmesi gereken veriyi malik/kiracÄ±
  kayÄ±tlarÄ±yla aynÄ± Ã¶mre baÄŸlardÄ±.
- **Ã‡Ä±kÄ±ÅŸ tarihi boÅŸsa misafir hÃ¢len iÃ§eridedir** â€” `/misafirler/iceride`
  gÃ¼venlik ve tahliye listesidir; kÄ±smÃ® index bu sorguya hizmet eder.
- Ã‡Ä±kÄ±ÅŸta **aracÄ± da kapanÄ±r**; kapanmasaydÄ± Ã§Ä±kmÄ±ÅŸ misafirin aracÄ± otopark
  sayÄ±mÄ±nda yer kaplamaya devam ederdi.

### HÄ±zlÄ± kayÄ±t â€” kritik kurallar (canlÄ± doÄŸrulandÄ±, 40/40)

- **KiÅŸi seÃ§imi isteÄŸe baÄŸlÄ±.** `kisiId` verilirse mevcut kiÅŸi kullanÄ±lÄ±r ve
  form alanlarÄ± YOK SAYILIR â€” var olan kimlik kaydÄ±nÄ± yan kapÄ±dan gÃ¼ncellemek,
  kiracÄ± eklerken malikin adÄ±nÄ± deÄŸiÅŸtirmek gibi sonuÃ§lar Ã¼retirdi.
- **TekilleÅŸtirme sÄ±rasÄ±:** `kisiId` â†’ TC eÅŸleÅŸmesi â†’ **e-posta eÅŸleÅŸmesi** â†’
  yeni kayÄ±t. E-posta da bir kimlik anahtarÄ±dÄ±r: `kisi_eposta_uq` tenant
  genelinde tekildir.
- Mevcut kiÅŸi bulunduÄŸunda **yalnÄ±zca BOÅ alanlar doldurulur**.
- E-posta doldurulacaksa **sahibi denetlenir**; baÅŸka kiÅŸiye kayÄ±tlÄ±ysa
  anlaÅŸÄ±lÄ±r bir 422 dÃ¶ner. Denetim yoksa veritabanÄ± kÄ±sÄ±tÄ± **500** olarak
  dÃ¶nÃ¼yordu (bu oturumda bulundu ve dÃ¼zeltildi).
- YanÄ±tta `kisiOlusturulduMu` ve `tcIleEslestiMi` dÃ¶ner: kullanÄ±cÄ± yeni kiÅŸi
  girdiÄŸini sanÄ±rken mevcut bir kayda baÄŸlanmÄ±ÅŸ olabilir; gÃ¶rmezse mÃ¼kerrer
  sandÄ±ÄŸÄ± kaydÄ± silmeye Ã§alÄ±ÅŸÄ±r.
- **Plakalar aynÄ± iÅŸlemde yazÄ±lÄ±r.** Hata verirse ana kayÄ±t da geri alÄ±nÄ±r;
  yarÄ±m kayÄ±t "plakayÄ± da girdim" sanan kullanÄ±cÄ± iÃ§in sessiz veri kaybÄ±dÄ±r.
- **MÃ¼kerrer plaka reddedilir** â€” hem veritabanÄ±ndaki kayÄ±tlara hem AYNI
  FORMDA iki kez yazÄ±lan plakaya karÅŸÄ±; tekillik **tenant genelindedir**.

---

## 3. Bekleyen iÅŸler

### A. ArayÃ¼zÃ¼ olmayan hazÄ±r API'ler â€” en yÃ¼ksek deÄŸer burada

Backend'de on bir modÃ¼l tamam ama **beÅŸinin ekranÄ± yok** (Tahakkuk Â· SayaÃ§ Â·
Belge Â· AraÃ§ Â· **Banka**). KullanÄ±cÄ± bunlarÄ± yalnÄ±zca Swagger'dan gÃ¶rebiliyor.

> **Banka ekranÄ± bilinÃ§li olarak yazÄ±lmadÄ±**, eksik kalmadÄ±: kullanÄ±cÄ±nÄ±n
> talimatÄ± *"Do not generate the remaining screens yet"* idi. Ekran Ã¼retimi
> FAZ 5'te, baÄŸÄ±mlÄ±lÄ±k sÄ±rasÄ±na gÃ¶re toplu yapÄ±lacak. Banka iÃ§in gereken
> sekmeler: Hesaplar Â· Hareketler Â· Ekstre/Mutabakat Â· Ã‡ek-Senet Â· POS Â·
> Parametreler â€” **tek rota, Ã§ok sekme** (muhasebe ekranÄ±ndaki desen).

1. **Tahakkuk ekranÄ±.** API Ã¶nizlemeli (`onizleme: true`), yani bir sihirbaz
   iÃ§in hazÄ±r: yÃ¶netici daÄŸÄ±tÄ±mÄ± gÃ¶rÃ¼p onaylayarak uygular. SayaÃ§ tÃ¼rÃ¼
   seÃ§ilince tÃ¼ketim otomatik gelir. **Ã–ncelikli iÅŸ budur** â€” tahakkuk,
   sistemin para Ã¼reten tek akÄ±ÅŸÄ±.
2. **SayaÃ§ ekranÄ±.** Okuma giriÅŸi toplu olmalÄ±: kapÄ±cÄ± bir turda kÄ±rk daire
   okur. Devir onayÄ± ekranda AÃ‡IK bir kutu olmalÄ±, varsayÄ±lan kapalÄ±.
3. **Belge ekranÄ±.** YÃ¼kleme iki adÄ±mlÄ±dÄ±r (izin â†’ PUT â†’ kayÄ±t); sÃ¼rÃ¼m
   geÃ§miÅŸi ve "geÃ§erliliÄŸi dolanlar" listesi gÃ¶sterilmeli.
4. **AraÃ§ ekranÄ±.**

### B. Bilinen sorunlar

0. ğŸ”´ **SOFT DELETE UZANTISI BAÄLI DEÄÄ°L â€” silinmiÅŸ kayÄ±tlar her listede
   gÃ¶rÃ¼nÃ¼yor.**

   `PrismaService` yapÄ±cÄ±sÄ±nda:
   ```ts
   this.$extends(softDeleteUzantisi());   // dÃ¶nÃ¼ÅŸ deÄŸeri ATILIYOR
   ```
   `$extends` **yeni bir istemci dÃ¶ndÃ¼rÃ¼r**, `this`'i deÄŸiÅŸtirmez. UzantÄ±
   hiÃ§bir zaman devreye girmiyor. SonuÃ§larÄ±:
   - Soft-delete edilmiÅŸ kayÄ±tlar **bÃ¼tÃ¼n liste uÃ§larÄ±nda dÃ¶nÃ¼yor**.
   - BirÃ§ok sorgu servisinin yorumunda yazan *"soft delete filtresi Prisma
     uzantÄ±sÄ± tarafÄ±ndan MERKEZÃ uygulanÄ±r"* ifadesi **YANLIÅ**.
   - `__silinmisleriDahilEt` sihirli bayraÄŸÄ± Prisma'ya bilinmeyen alan olarak
     gider ve `PrismaClientValidationError` verir (belge modÃ¼lÃ¼nde bu 500 ile
     yakalandÄ±; orada aÃ§Ä±k `silinmeTarihi` koÅŸuluna Ã§evrildi).

   **Neden bu oturumda dÃ¼zeltilmedi:** dÃ¼zeltmek Ã§apraz kesen bir deÄŸiÅŸiklik.
   Åu an silinmiÅŸ kayÄ±tlarÄ± gÃ¶steren her uÃ§ birden gÃ¶stermemeye baÅŸlar; 24
   sÃ¶zleÅŸme testinin ve mevcut ekranlarÄ±n davranÄ±ÅŸÄ± deÄŸiÅŸir. DÃ¼ÅŸÃ¼k kalan
   bÃ¼tÃ§eyle riskli bulundu ve **bilinÃ§li olarak devredildi**.

   **NasÄ±l dÃ¼zeltilir (Ã¼Ã§ seÃ§enek):**
   - `$use` middleware â€” `extends PrismaClient` ile yerinde Ã§alÄ±ÅŸÄ±r, Prisma
     5'te kullanÄ±mdan kaldÄ±rÄ±lmÄ±ÅŸ ama iÅŸlevsel. En kÃ¼Ã§Ã¼k deÄŸiÅŸiklik.
   - `PrismaService` geniÅŸletilmiÅŸ istemciyi tutup delege etsin â€” temiz ama
     geniÅŸ refactor.
   - UzantÄ±yÄ± bÄ±rakÄ±p her sorguda koÅŸulu AÃ‡IKÃ‡A yazmak â€” belge modÃ¼lÃ¼nde
     ÅŸimdilik bu yapÄ±ldÄ±.

   Hangisi seÃ§ilirse `scripts/` altÄ±na bir tarayÄ±cÄ± eklenmeli: RLS
   tarayÄ±cÄ±sÄ± gibi, soft delete taÅŸÄ±yan modele koÅŸulsuz sorgu atan yeri
   yakalasÄ±n.

   âš ï¸ **BU DÃœZELTME "TEK SATIR" DEÄÄ°LDÄ°R â€” ikinci bir tuzak var.**
   `SOFT_DELETE_HARICI` elle tutulan bir listedir ve **eksiktir**. UzantÄ±
   baÄŸlanÄ±r baÄŸlanmaz, `silinmeTarihi` sÃ¼tunu olmayan **15 modelin** bÃ¼tÃ¼n
   okuma uÃ§larÄ± `PrismaClientValidationError` verir (uzantÄ± `where`'a
   `silinmeTarihi: null` ekler): `YevmiyeFisi` Â· `YevmiyeSatiri` Â· `Borc` Â·
   `BorcSorumlusu` Â· `MuhasebeDonemi` Â· `MuhasebeParametresi` Â·
   `BolumIliskisi` Â· `SayacOkumasi` Â· `BelgeIliskisi` Â· `YonetimDelegasyonu` Â·
   `BankaHareketi` Â· `BankaEkstresi` Â· `EkstreSatiri` Â· `KiymetliEvrak` Â·
   `BankaParametresi`.

   Listeyi elle uzatmak Ã§Ã¶zÃ¼m deÄŸil: her yeni tabloda gÃ¼ncellenmeyi unutur ve
   hata sessizdir. Muafiyet **modelin o sÃ¼tunu gerÃ§ekten taÅŸÄ±yÄ±p
   taÅŸÄ±madÄ±ÄŸÄ±ndan** tÃ¼retilmeli (`Prisma.dmmf`). GerekÃ§e
   `prisma.service.ts` iÃ§inde de yazÄ±lÄ±.

5. **SÃ¶zleÅŸme testleri tenant sÄ±zdÄ±rÄ±yor.** `numaralandirma` ve
   `rls-izolasyon` testleri her koÅŸuda yeni tenant aÃ§Ä±yor ve temizlemiyor;
   dokuz koÅŸuda 29 tenant birikmiÅŸti. ÃœrÃ¼n hatasÄ± deÄŸil, test hijyeni â€”
   ama geliÅŸtirme veritabanÄ±nÄ± sÄ±nÄ±rsÄ±z bÃ¼yÃ¼tÃ¼yor ve tenant dÃ¶ngÃ¼sÃ¼ kuran
   migration'larÄ± yavaÅŸlatÄ±yor. `afterAll` temizliÄŸi gerekir.
6. **Belge hard delete yok.** Saklama sÃ¼resi dolan belge soft-delete edilir;
   nesne deposundaki dosya BIRAKILIR. KVKK silme hakkÄ± iÃ§in ayrÄ± bir
   "gerÃ§ekten sil" akÄ±ÅŸÄ± gerekir (soft delete â‰  hard delete â‰  anonimleÅŸtirme).

### C. Migration yazarken Ä°KÄ° TUZAK â€” 0004, 0005 ve 0006'da yaÅŸandÄ±

1. **`prisma migrate diff` Ã§Ä±ktÄ±sÄ± olduÄŸu gibi kullanÄ±lamaz.** Diff, ÅŸemada
   karÅŸÄ±lÄ±ÄŸÄ± olmayan elle yazÄ±lmÄ±ÅŸ kÄ±smi unique index'leri **dÃ¼ÅŸÃ¼rmek ister**
   (`borc_tahakkuk_no_uq`, `malik_kisi_donem_uq`, `kiraci_kisi_donem_uq`,
   `sakin_kisi_donem_uq`, `yevmiye_fis_no_uq`). KÃ¶rlemesine uygulanÄ±rsa
   mÃ¼kerrer tahakkuk numarasÄ± sessizce mÃ¼mkÃ¼n hale gelir. **Her migration'da
   `DROP INDEX` satÄ±rlarÄ± elle gÃ¶zden geÃ§irilmelidir.**
2. **FK eklemek `FORCE ROW LEVEL SECURITY` ile Ã§akÄ±ÅŸÄ±r.** `ADD CONSTRAINT
   ... FOREIGN KEY` bir doÄŸrulama taramasÄ± baÅŸlatÄ±r; tarama hedef tabloyu
   okur ve FORCE altÄ±nda sahibi bile politikaya tabidir. Ã‡Ã¶zÃ¼m 0004'te
   yazÄ±lÄ±: hedef tablolarÄ±n FORCE'u yalnÄ±zca o iÅŸlem boyunca kaldÄ±rÄ±lÄ±r,
   hemen geri verilir.

   âš ï¸ **0011'de Ã¶ÄŸrenilen ek:** hedef tablo YETMEZ, **KAYNAK tablo da**
   FORCE'suz olmalÄ±dÄ±r. DoÄŸrulama taramasÄ±
   `SELECT fk.x FROM ONLY kaynak fk LEFT JOIN hedef pk ON â€¦` koÅŸar, yani
   kaynaÄŸÄ± DA okur. 0004 ve 0008'de kaynak tablo yeni ve RLS'siz olduÄŸu iÃ§in
   fark edilmemiÅŸti; `arac`a FK eklerken `arac` Ã¼zerinde FORCE aÃ§Ä±k olduÄŸundan
   migration `app_tenant_id()` hatasÄ±yla dÃ¼ÅŸtÃ¼.

3. **Prisma isteÄŸe baÄŸlÄ± iliÅŸkide `onDelete: SetNull` VARSAYAR.** SQL'de
   `ON DELETE RESTRICT` yazÄ±lÄ±p ÅŸemada belirtilmezse `migrate diff` kalÄ±cÄ±
   sapma gÃ¶sterir. Daha kÃ¶tÃ¼sÃ¼: `arac`ta SetNull, sahibi silinen satÄ±rÄ±n sahip
   alanÄ±nÄ± boÅŸaltÄ±p `arac_tek_sahip` kÄ±sÄ±tÄ±nÄ± **silme anÄ±nda** ihlal ederdi.
   Yeni isteÄŸe baÄŸlÄ± iliÅŸkilerde `onDelete` **aÃ§Ä±kÃ§a yazÄ±lmalÄ±dÄ±r**.

**Bilinen kalÄ±cÄ± `migrate diff` sapmalarÄ±** (beklenen, dÃ¼zeltilmemeli):
elle yazÄ±lmÄ±ÅŸ kÄ±smÃ® unique index'ler (`arac_plaka_donem_uq`,
`belge_iliskisi_tekil_uq`, `borc_tahakkuk_no_uq`, `kiraci_kisi_donem_uq`,
`malik_kisi_donem_uq`, `sakin_kisi_donem_uq`, `sayac_okumasi_tarih_uq`,
`yevmiye_fis_no_uq`), kÄ±smÃ® `misafir_tenant_id_cikis_tarihi_idx` ve
`arac_tenant_id_yonetim_idx`, `oturum_dizini` index adÄ±.

### D. KÃ¼tÃ¼phane kararÄ± bekleyenler

7. **PDF / XLSX Ã§Ä±ktÄ±sÄ±.** YazdÄ±rma stil sayfasÄ± yazÄ±ldÄ± (`@media print`);
   resmÃ® gÃ¶rÃ¼nÃ¼mlÃ¼ iÅŸletme defteri / borÃ§ bildirimi hÃ¢lÃ¢ kÃ¼tÃ¼phane kararÄ±
   bekliyor.
8. **Grafikler** â€” zaman serisi gerekirse.

### E. Bloke â€” teknik olmayan

9. **C-4 hukuki gÃ¶rÃ¼ÅŸ** (KMK emredici hÃ¼kÃ¼mler, genel kurul yeter sayÄ±sÄ±,
   vekÃ¢let sÄ±nÄ±rlarÄ±).

   â˜… **Eklendi (2 AÄŸustos 2026) â€” yenileme fonunun amaca Ã¶zgÃ¼lÃ¼ÄŸÃ¼.**

   âš ï¸ **DÃœZELTME:** burada Ã¶nce dayanak olarak **KMK md. 72** gÃ¶steriliyordu.
   AtÄ±f YANLIÅTI â€” md. 72 toplu yapÄ±larda ortak giderlere katÄ±lmayÄ± dÃ¼zenler,
   yenileme fonunu deÄŸil. Soru geÃ§erli; dayanaÄŸÄ± fonun kat maliklerine ait
   **iade edilebilir emanet** niteliÄŸidir (ADR-0017 Â§5.5).

   Yenileme fonu hesabÄ±ndan iÅŸletme hesabÄ±na aktarÄ±m meÅŸru mudur?
   - Fondan harcama hangi karar/onayla yapÄ±labilir?
   - AktarÄ±m sistemde **engellenmeli** mi, yoksa **uyarÄ± + gerekÃ§e** ile izin
     mi verilmeli?
   - Ters yÃ¶n (iÅŸletmeden fona) serbest mi?

   âš ï¸ Cevap gelmeden bu yola teknik kÄ±sÄ±t KONULMAMALIDIR: yanlÄ±ÅŸ yÃ¶nde katÄ±
   bir kural meÅŸru iÅŸlemi bloklar, gevÅŸek bir kural fonun amaÃ§ dÄ±ÅŸÄ±
   kullanÄ±mÄ±nÄ± sessizleÅŸtirir. BaÄŸlam: [ADR-0016](docs/adr/log/ADR-0016-virman.md) Â§A.

### F. AltyapÄ± ve Ã¶lÃ§eklenebilirlik denetimi (31 Temmuz 2026)

ÃœrÃ¼n sahibi talebiyle **salt okunur** bir denetim yapÄ±ldÄ±: 443 dosya, 55 model,
21 migration, 204 uÃ§, 317 birim + 24 sÃ¶zleÅŸme testi tarandÄ±. **Kod
deÄŸiÅŸtirilmedi.** AÅŸaÄŸÄ±dakiler bulgudur, karar deÄŸil â€” hiÃ§biri bu oturumda
uygulanmadÄ±.

**SonuÃ§:** uygulanmÄ±ÅŸ Ã§ekirdek (Ã§ok kiracÄ±lÄ±lÄ±k, RLS, denetim izi, ÅŸema, para
tipi, doÄŸrulama) kurumsal kalitede; eksik olan etrafÄ±ndaki **iÅŸletme
katmanÄ±dÄ±r** (kuyruk, zamanlayÄ±cÄ±, metrik, rate limit, daÄŸÄ±tÄ±m). UygulanmÄ±ÅŸ
bileÅŸenler Ã¼zerinden Ã¼retim hazÄ±rlÄ±ÄŸÄ± **%55**; 18 alanÄ±n kapsanma oranÄ± **%38**.
Ä°ki sayÄ± arasÄ±ndaki fark durumu Ã¶zetliyor: *derinlik var, geniÅŸlik yok.*

#### P0 â€” Ã¼retime Ã§Ä±kmadan kapatÄ±lmasÄ± gerekenler

1. ğŸ”´ **`yalnizcaKendiVerisi` UYGULANMIYOR.** `RolTanimi.yalnizcaKendiVerisi` ve
   `KENDI_VERISI_KISITLI` tanÄ±mlÄ± ama **hiÃ§bir yerde okunmuyor** (backend +
   frontend genelinde 0 kullanÄ±m). SonuÃ§: `MALIK`/`KIRACI`/`SAKIN` rolÃ¼ndeki bir
   kullanÄ±cÄ± `KISI_GORUNTULE` + `BOLUM_GORUNTULE` taÅŸÄ±dÄ±ÄŸÄ± iÃ§in `GET /kisiler`
   ve `GET /bolumler` ile **tÃ¼m sitenin** listesini Ã§ekebiliyor. README:151 bunun
   tersini iddia ediyor. **KVKK aÃ§Ä±ÄŸÄ±.**
2. ğŸ”´ **DaÄŸÄ±tÄ±m giriÅŸ noktasÄ± yanlÄ±ÅŸ.** Derleme Ã§Ä±ktÄ±sÄ± `backend/dist/src/main.js`
   (tsconfig `include` hem `src` hem `test` kapsadÄ±ÄŸÄ± iÃ§in rootDir `backend/`
   oluyor). Ama `backend/package.json:9` `dist/main.js`, `Dockerfile.backend`
   son satÄ±rÄ± `backend/dist/main.js` diyor â†’ **konteyner MODULE_NOT_FOUND ile
   aÃ§Ä±lÄ±ÅŸta dÃ¼ÅŸer.** Ä°majÄ±n bir kez bile Ã§alÄ±ÅŸtÄ±rÄ±lmadÄ±ÄŸÄ±nÄ± gÃ¶steriyor.
3. ğŸ”´ **Rate limiting yok** + giriÅŸ ucu istek baÅŸÄ±na ~134 MB scrypt belleÄŸi
   ayÄ±rÄ±yor (`N=131_072, r=8` â†’ `128Ã—NÃ—r`; `maxmem` tavanÄ± bunun iki katÄ±).
   SÄ±nÄ±r olmadÄ±ÄŸÄ± iÃ§in tek IP'den dÃ¼ÅŸÃ¼k maliyetli bellek tÃ¼kenmesi.
4. ğŸ”´ **`Idempotency-Key` gÃ¶nderiliyor, okunmuyor.** Frontend her POST'ta
   yolluyor (`api.ts:36`) ve yorumu "BFS v1 Â§12 zorunlu" diyor; backend'de
   `@Headers` **hiÃ§ kullanÄ±lmÄ±yor**. AÄŸ yeniden denemesi **mÃ¼kerrer tahsilat /
   tahakkuk** Ã¼retir.
5. ğŸ”´ **BaÄŸlantÄ± havuzu ve transaction timeout ayarsÄ±z.** `DATABASE_URL`'de
   `connection_limit` yok â†’ Prisma varsayÄ±lanÄ± 9-17. `$transaction` seÃ§eneksiz
   Ã§aÄŸrÄ±lÄ±yor â†’ varsayÄ±lan **5 sn**. Tahakkuk 400 daire iÃ§in ~400 advisory lock
   + ~1200 ardÄ±ÅŸÄ±k INSERT yapÄ±yor; bu sÄ±nÄ±rÄ±n altÄ±nda bitmesi olasÄ± deÄŸil
   (`P2028`).

#### P1 â€” Ã¶lÃ§ek bÃ¼yÃ¼meden kapatÄ±lmalÄ±

6. **PortfÃ¶y fan-out'u sÄ±nÄ±rsÄ±z eÅŸzamanlÄ±.** `portfoy.service.ts:307`
   `Promise.allSettled(gecerliler.map(...))` â€” proje baÅŸÄ±na ayrÄ± transaction,
   11 sorgu. 150 proje = 150 eÅŸzamanlÄ± transaction. Havuz tÃ¼kendiÄŸinde
   `allSettled` hatayÄ± yutuyor ve portfÃ¶y **eksik ama hatasÄ±z** gÃ¶rÃ¼nÃ¼yor.
7. **Ã–nbellek geÃ§ersizleÅŸtirmesi yok.** `desenSil()` yazÄ±lmÄ±ÅŸ, **sÄ±fÄ±r Ã§aÄŸrÄ±
   yeri**. Rol deÄŸiÅŸince yetki 5 dk eski kalÄ±yor. Ä°ronik: aynÄ± dosya devir kaydÄ±
   iÃ§in Ã¶nbelleklemeyi *"yetki kaldÄ±rmadÄ±r, 5 dakika geÃ§erli gÃ¶rÃ¼nmesi kabul
   edilemez"* diye reddediyor â€” aynÄ± gerekÃ§e Ã¼yelik iÃ§in de geÃ§erli.
8. **CI sÃ¶zleÅŸme testleri RLS'i doÄŸrulayamÄ±yor.** `ci.yml:74` `postgres`
   sÃ¼per kullanÄ±cÄ±sÄ±yla baÄŸlanÄ±yor; sÃ¼per kullanÄ±cÄ± RLS'i **her koÅŸulda atlar**
   ve `database/init/01-roles.sql` CI servisine baÄŸlanmadÄ±ÄŸÄ± iÃ§in `bnos_app`
   rolÃ¼ orada yok. Yerelde gerÃ§ekten doÄŸrulanÄ±yor, CI'da doÄŸrulanamÄ±yor.
9. **Audit zinciri tenant baÅŸÄ±na serileÅŸme noktasÄ± ve Ã§atallanabilir.** Her
   yazma `findFirst(orderBy: olusmaAni desc)` ile son halkayÄ± okuyor; iki
   eÅŸzamanlÄ± yazma **aynÄ± `oncekiHash`'i** alabilir ve `oncekiHash` Ã¼zerinde
   unique kÄ±sÄ±t yok. Advisory lock deseni depoda zaten var (`numara.service.ts`).
10. **Refresh token iptal edilemiyor.** `jti` Ã¼retiliyor, saklanmÄ±yor; Ã§Ä±kÄ±ÅŸ ucu
    yok. Ã‡alÄ±nan token 7 gÃ¼n geÃ§erli.
11. **Metrik ve tracing yok** (OTel/prom-client 0 sonuÃ§). `/saglik` Redis'i
    kontrol etmiyor; readiness/liveness ayrÄ±mÄ± yok.
12. **`trust proxy` ayarlanmamÄ±ÅŸ** â†’ LB arkasÄ±nda **her audit kaydÄ±ndaki IP
    yanlÄ±ÅŸ** olur ve hata sessizdir (alan dolu gÃ¶rÃ¼nÃ¼r).

#### UygulanmamÄ±ÅŸ bileÅŸenler (kapsam dÄ±ÅŸÄ±, belgeyle tutarlÄ±)

Workflow Engine Â· Knowledge Graph adaptÃ¶rÃ¼ Â· Vector DB / pgvector Â· AI Agent
System Â· LLM Router Â· Token Optimization. Bunlar C-1 aÃ§Ä±k maddesiyle zaten
iÅŸaretli. **Kuyruk altyapÄ±sÄ± farklÄ±:** BullMQ `backend/package.json`'da kurulu
ama kaynak kodda **sÄ±fÄ±r kullanÄ±m**; `IScheduler` portu ve `IsCalistirma` tablosu
(idempotentlik UNIQUE'i dahil) yazÄ±lmÄ±ÅŸ, **uygulamasÄ± yok**. Outbox Redis
Stream'e `XADD` yapÄ±yor ama **tÃ¼ketici yok** ve `MAXLEN` verilmediÄŸi iÃ§in stream
sÄ±nÄ±rsÄ±z bÃ¼yÃ¼yor. Ä°letiÅŸimdeki `durum: 'ZAMANLANDI'` kayÄ±tlarÄ± **hiÃ§bir zaman
gÃ¶nderilmiyor**.

#### Belgeâ€“kod tutarsÄ±zlÄ±klarÄ± (kod geÃ§erlidir)

| Belge iddiasÄ± | Koddaki gerÃ§ek |
|---|---|
| README:151 â€” malik/kiracÄ±/sakin `yalnizcaKendiVerisi` taÅŸÄ±r | Bayrak okunmuyor |
| `api.ts:29` â€” "her POST iÃ§in zorunlu (BFS v1 Â§12)" | Backend baÅŸlÄ±ÄŸÄ± okumuyor |
| ADR-0005 â€” "geÃ§ersizleÅŸtirme domain event'lerle" | `desenSil` hiÃ§ Ã§aÄŸrÄ±lmÄ±yor |
| ADR-0005 â€” "yetersizse Ã¶zet tablosu" | Ã–zet tablo yok, canlÄ± `groupBy` |
| `local-business-rules.adapter.ts:4` â€” "kurallar VERÄ° olarak" | TS closure'Ä± olarak gÃ¶mÃ¼lÃ¼ |
| `bnos-client/package.json` â€” "Workflow portlari" | Workflow portu yok |
| README:44 â€” `infrastructure/ â€¦ k8s` | Dizin **boÅŸ** |
| README:116 â€” "57 duman testi" | 317 test |
| `scheduler.port.ts:4` â€” "v1 uygulamasÄ±: BullMQ" | Uygulama yok |
| `prisma.service.ts:9` â€” "soft delete filtresi merkezÃ®dir" | UzantÄ± baÄŸlÄ± deÄŸil (Â§3.B.0) |

#### Ã–lÃ§ek deÄŸerlendirmesi (kod yapÄ±sÄ±ndan Ã§Ä±karÄ±m, Ã¶lÃ§Ã¼m yok)

| Ã–lÃ§ek | HazÄ±rlÄ±k | Ä°lk dÃ¼ÅŸecek bileÅŸen |
|---|---|---|
| 15 site | %60 | `GET /portfoy/ozet` yavaÅŸlar, dÃ¼ÅŸmez |
| 50 site | %40 | Havuz tÃ¼kenmesi â†’ `P2024`, portfÃ¶y **sessizce eksik** |
| 100 site | %20 | `tahakkuk.calistir` â†’ `P2028` (200+ daireli sitelerde) |
| 500 site | %10 | `audit_kaydi` (bÃ¶lÃ¼mleme ve arÅŸivleme yok) |
| 1000 site | %5 | Tek PostgreSQL Ã¶rneÄŸinin yazma kapasitesi |

âš ï¸  Bu tabloda **hiÃ§bir Ã¶lÃ§Ã¼m yok** â€” depoda yÃ¼k testi, benchmark veya
performans bÃ¼tÃ§esi bulunmuyor. Rakamlar kod yapÄ±sÄ±ndan yapÄ±lan mÃ¼hendislik
tahminidir ve gerÃ§ek Ã¶lÃ§Ã¼mle deÄŸiÅŸtirilmelidir.

### G. âœ… KAPATILDI â€” devredilen iki dÃ¼zeltme uygulandÄ±

> AÅŸaÄŸÄ±daki bÃ¶lÃ¼m bulguyu ve gerekÃ§esini tarihÃ§e olarak korur. **Ä°kisi de bu
> commit'te kapatÄ±ldÄ±**; nasÄ±l kapatÄ±ldÄ±ÄŸÄ± Â§3.H'dedir.



30-31 Temmuz 2026 oturumu kapatÄ±lÄ±rken Ã¼rÃ¼n sahibi, denetimde Ã§Ä±kan iki kÃ¼Ã§Ã¼k
ama **Ã¼retime Ã§Ä±kÄ±ÅŸÄ± doÄŸrudan engelleyen** dÃ¼zeltmenin sonraki oturumda ele
alÄ±nmasÄ±na karar verdi. Bu bir erteleme kararÄ±dÄ±r, bulgunun geÃ§ersizliÄŸi
DEÄÄ°LDÄ°R: ikisi de bugÃ¼n ayakta duran bir engeldir.

**1. Konteyner giriÅŸ noktasÄ± yanlÄ±ÅŸ â€” imaj aÃ§Ä±lÄ±ÅŸta dÃ¼ÅŸer.**

| Yer | Yazan | OlmasÄ± gereken |
|---|---|---|
| `backend/package.json:9` | `node dist/main.js` | `node dist/src/main.js` |
| `infrastructure/docker/Dockerfile.backend` (CMD) | `node backend/dist/main.js` | `node backend/dist/src/main.js` |

Sebep: `backend/tsconfig.json` `include: ["src/**/*", "test/**/*"]` olduÄŸu iÃ§in
tsc rootDir'i `backend/` seÃ§iyor ve Ã§Ä±ktÄ± `dist/src/` altÄ±na dÃ¼ÅŸÃ¼yor. Ä°ki yol da
`MODULE_NOT_FOUND` verir. **Ä°majÄ±n bir kez bile Ã§alÄ±ÅŸtÄ±rÄ±lmadÄ±ÄŸÄ±nÄ±n kanÄ±tÄ±dÄ±r.**

Ä°ki Ã§Ã¶zÃ¼m var, biri seÃ§ilmeli:
- YollarÄ± dÃ¼zeltmek (en kÃ¼Ã§Ã¼k deÄŸiÅŸiklik), ya da
- `tsconfig`'te testleri `include` dÄ±ÅŸÄ±na alÄ±p Ã§Ä±ktÄ±yÄ± `dist/` kÃ¶kÃ¼ne dÃ¼zleÅŸtirmek
  (o zaman `vitest` yollarÄ± gÃ¶zden geÃ§irilmeli).

âš ï¸  Hangisi seÃ§ilirse **CI'a bir duman testi baÄŸlanmalÄ±**: imaj build edilip
`--help` ya da saÄŸlÄ±k ucuyla bir kez aÃ§Ä±lmalÄ±. Bu hata tam olarak "hiÃ§
Ã§alÄ±ÅŸtÄ±rÄ±lmadÄ±ÄŸÄ± iÃ§in" fark edilmedi; aynÄ± boÅŸluk bÄ±rakÄ±lÄ±rsa tekrar eder.

**2. Rate limiting yok â€” giriÅŸ ucu ucuz bir bellek tÃ¼kenmesi vektÃ¶rÃ¼.**

`@nestjs/throttler` benzeri bir sÄ±nÄ±r **hiÃ§ yok** (depoda 0 sonuÃ§). GiriÅŸ ucu
her denemede scrypt Ã§alÄ±ÅŸtÄ±rÄ±yor â€” kullanÄ±cÄ± bulunamasa bile, Ã§Ã¼nkÃ¼ zamanlama
sÄ±zÄ±ntÄ±sÄ±nÄ± Ã¶nlemek iÃ§in `KUKLA_OZET` ile doÄŸrulama yapÄ±lÄ±yor
(`oturum.service.ts:95`, doÄŸru bir tasarÄ±m).

Maliyet: `N=131_072, r=8` â†’ scrypt Ã§alÄ±ÅŸma belleÄŸi `128 Ã— N Ã— r` â‰ˆ **134 MB**;
`sifre.ts:37`'deki `maxmem` tavanÄ± bunun **iki katÄ±nÄ±** (â‰ˆ268 MB) veriyor.
SÄ±nÄ±rsÄ±z istek Ã— 134 MB = tek IP'den Ã¶nemsiz maliyetle sÃ¼reÃ§ dÃ¼ÅŸÃ¼rÃ¼lebilir.

âš ï¸  **scrypt parametreleri DÃœÅÃœRÃœLEREK Ã§Ã¶zÃ¼lmemeli** â€” `N=2^17` OWASP 2024
asgarisidir ve bilinÃ§li seÃ§ilmiÅŸtir (`sifre.ts:28`). Ã‡Ã¶zÃ¼m sÄ±nÄ±rlamadÄ±r, maliyeti
azaltmak deÄŸil. En az `/oturum/giris` ve `/oturum/yenile` sÄ±nÄ±rlanmalÄ±; IP baÅŸÄ±na
ve e-posta baÅŸÄ±na ayrÄ± sayaÃ§ gerekir (yalnÄ±zca IP, NAT arkasÄ±ndaki bir siteyi
toptan kilitler).

**Devredilmeyen ama aÃ§Ä±k kalan:** Â§3.F'deki P0-1 (`yalnizcaKendiVerisi`
uygulanmÄ±yor â€” KVKK aÃ§Ä±ÄŸÄ±) bu iki maddenin **dÄ±ÅŸÄ±ndadÄ±r** ve hÃ¢lÃ¢ aÃ§Ä±ktÄ±r.
Denetimdeki en aÄŸÄ±r bulgu odur; kÃ¼Ã§Ã¼k bir dÃ¼zeltme olmadÄ±ÄŸÄ± iÃ§in bu ikisiyle
birlikte gruplanmadÄ±. Ã–nceliklendirmesi Ã¼rÃ¼n sahibine aittir.

### H. Bu commit'te yapÄ±lan â€” iki dÃ¼zeltmenin uygulanmasÄ±

#### 1. Konteyner giriÅŸ noktasÄ± â€” Ã‡Ã–ZÃœM: Ã§Ä±ktÄ± dÃ¼zeltildi, beyan deÄŸil

Ä°ki seÃ§enek vardÄ± (Â§3.G). **Ä°kincisi seÃ§ildi:** yollarÄ± `dist/src/main.js`'e
Ã§ekmek yerine, derleme Ã§Ä±ktÄ±sÄ± `dist/` kÃ¶kÃ¼ne dÃ¼zleÅŸtirildi. GerekÃ§e: birinci
seÃ§enek `dist/test/` klasÃ¶rÃ¼nÃ¼n de Ã¼retim imajÄ±na kopyalanmasÄ±nÄ± **sÃ¼rdÃ¼rÃ¼rdÃ¼**
â€” test kodu Ã¼retim imajÄ±nda iÅŸi olmayan bir yÃ¼ktÃ¼r.

- `backend/tsconfig.build.json` (yeni) â€” `test` ve `**/*.spec.ts` hariÃ§ tutulur.
- `backend/nest-cli.json` â€” `tsConfigPath` bu dosyaya baÄŸlandÄ±.
- SonuÃ§: Ã§Ä±ktÄ± artÄ±k `backend/dist/main.js`. `package.json` ve
  `Dockerfile.backend` **hiÃ§ deÄŸiÅŸmedi**; zaten doÄŸru yolu gÃ¶steriyorlardÄ±.
- `pnpm typecheck` hÃ¢lÃ¢ ana `tsconfig.json`'u kullanÄ±r â†’ **testler tip
  denetiminden geÃ§meye devam eder**. `vitest` swc kullanÄ±r, tsc Ã§Ä±ktÄ±sÄ±na
  baÄŸlÄ± deÄŸildir â†’ sÃ¶zleÅŸme testleri etkilenmez (24/24 doÄŸrulandÄ±).
- `tests/unit/*.mjs` iÃ§indeki iki `dist/src/...` yolu gÃ¼ncellendi.

**TekrarÄ± Ã¶nleyen denetim** (Â§3.G'nin istediÄŸi): `scripts/config-check.mjs`'e
yedinci adÄ±m eklendi â€” `package.json` "start" ile Dockerfile CMD'si birbiriyle
**ve** varsa gerÃ§ek derleme Ã§Ä±ktÄ±sÄ±yla karÅŸÄ±laÅŸtÄ±rÄ±lÄ±r. `pnpm verify` zincirinde
ve CI'Ä±n ilk iÅŸinde koÅŸar.

âš ï¸  **Denetleyici NEGATÄ°F TESTLE kanÄ±tlandÄ±:** `dist/main.js` geÃ§ici olarak
baÅŸka bir ada alÄ±ndÄ±, `config-check.mjs` Ã§Ä±kÄ±ÅŸ kodu **1** verdi ve
*"Giris noktasi derleme ciktisinda YOK â€¦ Konteyner acilista MODULE_NOT_FOUND ile
duser"* yazdÄ±. KontrolÃ¼n gerÃ§ekten Ã§alÄ±ÅŸtÄ±ÄŸÄ±, "yeÅŸil yanÄ±yor" ile deÄŸil
**kÄ±rmÄ±zÄ± yakÄ±larak** doÄŸrulandÄ±.

âš ï¸  Bu, imaj duman testinin **ucuz ikamesidir, yerine geÃ§mez.** `docker build`
+ bir kez aÃ§Ä±lÄ±ÅŸ hÃ¢lÃ¢ CI'a eklenmeli; bu kontrol yalnÄ±zca yol tutarlÄ±lÄ±ÄŸÄ±nÄ±
gÃ¶rÃ¼r, imajÄ±n gerÃ§ekten aÃ§Ä±ldÄ±ÄŸÄ±nÄ± deÄŸil.

#### 2. Ä°stek sÄ±nÄ±rÄ± â€” `common/guards/istek-siniri.guard.ts` (yeni)

`@nestjs/throttler` **kullanÄ±lmadÄ±**, iki nedenle: (a) kurulu deÄŸil ve depoda
scrypt'in bcrypt yerine seÃ§ilme gerekÃ§esiyle aynÄ± Ã§izgide gereksiz baÄŸÄ±mlÄ±lÄ±k
eklenmiyor; (b) varsayÄ±lan deposu **bellek iÃ§idir** ve Ã§ok Ã¶rnekli daÄŸÄ±tÄ±mda
sessizce yanlÄ±ÅŸ Ã§alÄ±ÅŸÄ±r â€” 3 replikada etkin sÄ±nÄ±r 3Ã— olur, koruma "var"
gÃ¶rÃ¼nÃ¼rken Ã¼Ã§te bir gÃ¼cÃ¼ndedir. SayaÃ§ **Redis'tedir** (`ioredis` zaten var).

| UÃ§ | IP | Kimlik | Pencere |
|---|---|---|---|
| `POST /oturum/giris` | 20 | 5 (e-posta) | 300 sn |
| `POST /oturum/yenile` | 60 | â€” | 300 sn |

Zorlanan kurallar:

- **Ä°ÅŸaretsiz uÃ§ sÄ±nÄ±rlanmaz.** `@IstekSiniri(...)` taÅŸÄ±mayan uÃ§ dokunulmadan
  geÃ§er (`@RequirePermission` deseni). Genel bir sÄ±nÄ±r, toplu tahakkuk ve toplu
  gÃ¶nderim gibi meÅŸru yoÄŸun iÅŸleri sessizce keserdi.
- **SÄ±nÄ±r ÃœÃ§ KapÄ±'dan Ã–NCE** Ã§alÄ±ÅŸÄ±r ama bir kapÄ± deÄŸildir. Sonda olsaydÄ±
  reddedilen istek yine de JWT doÄŸrulamasÄ± ve veritabanÄ± okumasÄ± yaptÄ±rÄ±rdÄ±.
- **Atomik Lua sayacÄ±.** `INCR` + `EXPIRE` iki gidiÅŸ-dÃ¶nÃ¼ÅŸ olarak yazÄ±lamaz:
  arada baÄŸlantÄ± koparsa anahtar **Ã¶mÃ¼rsÃ¼z** kalÄ±r ve o kimlik KALICI olarak
  kilitlenir â€” kullanÄ±cÄ± "ÅŸifremi unuttum" akÄ±ÅŸÄ±nda da kilitli kalÄ±r.
- **429 hangi sayacÄ±n dolduÄŸunu SÃ–YLEMEZ.** "Bu e-posta iÃ§in sÄ±nÄ±r doldu"
  demek, e-postanÄ±n kayÄ±tlÄ± olduÄŸunu doÄŸrulardÄ± ve giriÅŸ ucunun kullanÄ±cÄ±
  numaralandÄ±rmayÄ± engelleme Ã§abasÄ±nÄ± boÅŸa Ã§Ä±karÄ±rdÄ±.
- **Ham e-posta anahtara yazÄ±lmaz**, SHA-256 Ã¶zeti konur: sayaÃ§ kiÅŸisel veri
  deposu deÄŸildir (KVKK).
- **Fail-open + ERROR log.** Redis dÃ¼ÅŸerse istek geÃ§er. Fail-closed seÃ§ilseydi
  bir Redis kesintisi **tam bir kimlik kesintisine** dÃ¶nÃ¼ÅŸÃ¼rdÃ¼. Kabul edilen
  bedel aÃ§Ä±kÃ§a loglanÄ±r â€” alarm kurulacak yer orasÄ±dÄ±r.
- **BaÄŸlantÄ± tembeldir** (`lazyConnect`). Eager baÄŸlanan yapÄ±cÄ± sÄ±nÄ±fÄ± birim
  testinde kurulamaz kÄ±lÄ±yordu: soket aÃ§Ä±lÄ±yor, olay dÃ¶ngÃ¼sÃ¼ ayakta kalÄ±yor ve
  **test asÄ±lÄ±yordu** (yaÅŸandÄ±). AyrÄ±ca fail-open politikasÄ±yla da Ã§eliÅŸirdi.

**scrypt parametrelerine DOKUNULMADI.** `N=2^17` OWASP 2024 asgarisidir;
dÃ¼ÅŸÃ¼rmek DoS'u hafifletirken parola kÄ±rmayÄ± ucuzlatÄ±rdÄ± â€” bir aÃ§Ä±ÄŸÄ± kapatÄ±p
daha kÃ¶tÃ¼sÃ¼nÃ¼ aÃ§mak olurdu.

#### YanÄ±nda kapatÄ±lan: `TRUST_PROXY`

IP sayacÄ±, doÄŸru istemci adresi olmadan **anlamsÄ±zdÄ±r**: yÃ¼k dengeleyici
arkasÄ±nda bÃ¼tÃ¼n istekler tek adresten geliyor gÃ¶rÃ¼nÃ¼r ve sayaÃ§ bir sitenin
tamamÄ±nÄ± kilitler. Bu yÃ¼zden `TRUST_PROXY` ortam deÄŸiÅŸkeni eklendi
(`env.schema.ts` + `main.ts` + `.env.example`).

âš ï¸  **VarsayÄ±lan 0 (kapalÄ±).** Ä°ki yÃ¶nde de sessiz hata var: yanlÄ±ÅŸ **aÃ§mak**
korumayÄ± tÃ¼mÃ¼yle kaldÄ±rÄ±r (doÄŸrudan eriÅŸilen sunucuda istemci
`X-Forwarded-For`'u kendisi yazar ve her istekte farklÄ± "IP" gÃ¶rÃ¼nÃ¼r); yanlÄ±ÅŸ
**kapatmak** meÅŸru kullanÄ±cÄ±yÄ± kilitler. DaÄŸÄ±tÄ±m topolojisi bilinerek verilir.

#### âš ï¸ KAPANMAYAN kalan boÅŸluk â€” dÃ¼rÃ¼stÃ§e

**Ä°stek sÄ±nÄ±rÄ± HIZI sÄ±nÄ±rlar, EÅZAMANLILIÄI deÄŸil.** Pencere baÅŸÄ±na 20 istek,
o 20 isteÄŸin aynÄ± anda gelemeyeceÄŸi anlamÄ±na gelmez: en kÃ¶tÃ¼ durumda 20
eÅŸzamanlÄ± scrypt â‰ˆ **2,7 GB**. SÄ±nÄ±rsÄ±z hÃ¢le gÃ¶re bÃ¼yÃ¼k kazanÃ§, ama sÄ±fÄ±r risk
deÄŸil. Kalan boÅŸluk scrypt Ã§aÄŸrÄ±larÄ±na bir **eÅŸzamanlÄ±lÄ±k kapÄ±sÄ± (semafor)**
koymakla kapanÄ±r; bu ayrÄ± bir iÅŸtir ve bu dÃ¼zeltmenin kapsamÄ±nda deÄŸildi.
Buraya yazÄ±lmasÄ±nÄ±n nedeni "Ã§Ã¶zÃ¼ldÃ¼" sanÄ±lmamasÄ±dÄ±r.

#### DoÄŸrulama

- Birim: `tests/unit/istek-siniri.test.mjs` (**14**) â†’ toplam **331** birim testi.
- SÃ¶zleÅŸme: **24/24** (Docker ayaÄŸa kaldÄ±rÄ±lÄ±p koÅŸuldu).
- `pnpm verify` **9/9** Â· lint temiz Â· `lint:md` temiz.
- **CanlÄ± 13/13** â€” kabul Ã¶lÃ§Ã¼tÃ¼ karÅŸÄ±landÄ±:
  - Backend `node backend/dist/main.js` ile **ayaÄŸa kalktÄ±** (beyan edilen yol).
  - `/saglik` â†’ **200**, `veritabani: aÃ§Ä±k`.
  - Ä°ÅŸaretsiz uÃ§ sÄ±nÄ±rlanmadÄ± (30 saÄŸlÄ±k isteÄŸi geÃ§ti).
  - GiriÅŸ: `401 401 401 401 401` â†’ **6.'da 429**, `Retry-After: 297`.
  - 429 gÃ¶vdesi sayaÃ§ adÄ±nÄ± sÄ±zdÄ±rmÄ±yor, `correlationId` taÅŸÄ±yor.
  - FarklÄ± e-posta ayrÄ± sayÄ±ldÄ±; IP sayacÄ± da baÄŸÄ±msÄ±z tetiklendi (20'de).
- Denetleyici negatif testi: giriÅŸ noktasÄ± saklandÄ±ÄŸÄ±nda `config-check` **1**
  dÃ¶ndÃ¼.

---

### I. GerÃ§ekÃ§i daÄŸÄ±lÄ±m Ã¶lÃ§Ã¼mÃ¼ â€” 5.000 bÃ¶lÃ¼m / 4.700 malik (31 Temmuz 2026)

Bu tur **yalnÄ±zca Ã¶lÃ§Ã¼mdÃ¼r**; Ã¼rÃ¼n kodu deÄŸiÅŸmedi. Veri seti:
`database/perf/gercek-dagilim.sql` (tenant `gercek-5000`) â€” 5.000 bÃ¶lÃ¼m Â·
13.000 kiÅŸi Â· 4.985 malik kaydÄ± (4.700 tekil kiÅŸi) Â· 3.000 kiracÄ± Â· 5.300
sakin. Malik daÄŸÄ±lÄ±mÄ± 4.500Ã—1 daire Â· 150Ã—2 Â· 45Ã—3 Â· 5Ã—10. Parti tavanÄ± iÃ§in
ikinci fikstÃ¼r: `database/perf/parti-tavani.sql` (tenant `perf-parti`,
25/50/100/200/300/400 bÃ¶lÃ¼mlÃ¼k bloklar).

BÃ¼tÃ¼n sayÄ±lar **uÃ§tan uca HTTP** Ã¶lÃ§Ã¼mÃ¼dÃ¼r (`node dist/main.js`, Ã¼retim
derlemesi). psql sayÄ±larÄ± artÄ±k Ã¶lÃ§Ã¼t olarak kullanÄ±lmÄ±yor â€” gerekÃ§e ADR-0011.

#### â˜… P0-Ä°ÅLEVSEL â€” toplu tahakkuk hedef Ã¶lÃ§ekte KIRIK

**Bu bir performans sorunu deÄŸil; Ã§ekirdek Ã¶zellik 5.000 bÃ¶lÃ¼mlÃ¼k bir sitede
hiÃ§ Ã§alÄ±ÅŸmÄ±yor.**

`POST /tahakkuk/calistir` tÃ¼m siteye aidat yazarken **5 saniyelik iÅŸlem
sÄ±nÄ±rÄ±nÄ± aÅŸÄ±yor ve 500 dÃ¶nÃ¼yor**. Ä°ÅŸlem tÃ¼mÃ¼yle geri alÄ±nÄ±yor: **sÄ±fÄ±r borÃ§,
sÄ±fÄ±r outbox olayÄ±**. YÃ¶netici hiÃ§bir ÅŸey yazÄ±lmadÄ±ÄŸÄ±nÄ± yalnÄ±zca opak bir
hata mesajÄ±ndan anlÄ±yor.

Parti bÃ¼yÃ¼klÃ¼ÄŸÃ¼ taramasÄ± (`perf-parti`, BLOK_BAZLI):

| bÃ¶lÃ¼m | HTTP | sÃ¼re | borÃ§ | outbox |
|---|---|---|---|---|
| 25 | 201 | 437 ms | +25 | +1 |
| 50 | 201 | 700 ms | +50 | +1 |
| 100 | 201 | 1.263 ms | +100 | +1 |
| 200 | 201 | 2.386 ms | +200 | +1 |
| 300 | 201 | 4.002 ms | +300 | +1 |
| **400** | 201 | **4.789 ms** | +400 | +1 |
| 500 | **500** | ~5.020 ms | **+0** | **+0** |

DoÄŸrusal: bÃ¶lÃ¼m baÅŸÄ±na **â‰ˆ11,6 ms**. 5.000 ms'lik sÄ±nÄ±r **â‰ˆ420 bÃ¶lÃ¼mde**
doluyor. 400 bÃ¶lÃ¼m zaten **%96 dolulukta** â€” daha yavaÅŸ bir makinede o da
dÃ¼ÅŸer. Tek blok (500 bÃ¶lÃ¼m) Ã¼Ã§ denemede de 500 dÃ¶ndÃ¼.

Yan bulgular: outbox olayÄ± **tahakkuk baÅŸÄ±na 1** (bÃ¶lÃ¼m baÅŸÄ±na deÄŸil), relay
gecikmesi ortalama 1,3 sn, yeniden deneme 0 â€” outbox geride kalmÄ±yor.
10 eÅŸzamanlÄ± okuyucu varken toplu tahakkuk koÅŸarsa okuma p95 282,8 â†’ 319,7 ms
(+%13).

Karar taslaÄŸÄ±: **ADR-0013** (yalnÄ±zca sorular; karar verilmedi).

#### P0-Ã–LÃ‡EK â€” havuz ve iÅŸlem sarmalama

- **DB baÄŸlantÄ± havuzu 5** (Prisma varsayÄ±lanÄ±; `DATABASE_URL` iÃ§inde
  `connection_limit` verilmemiÅŸ).
- **Doygunluk 10 eÅŸzamanlÄ± kullanÄ±cÄ±da.** Verim tavanÄ± ~44 istek/sn; 25'e
  Ã§Ä±kÄ±nca verim aynÄ± kalÄ±p gecikme 2,5Ã—, 50'de verim dÃ¼ÅŸÃ¼yor.
- YÃ¼k altÄ±nda baÄŸlantÄ±lar Ã§oÄŸunlukla **`idle in transaction`**:
  `PrismaService.tenantIslemi` **her isteÄŸi** interaktif iÅŸleme sarÄ±yor ve
  4 `set_config` gidiÅŸ-dÃ¶nÃ¼ÅŸÃ¼ boyunca baÄŸlantÄ± tutuluyor. Havuz meÅŸgul
  gÃ¶rÃ¼nÃ¼yor ama sorgu koÅŸmuyor.
- YÃ¼ksek eÅŸzamanlÄ±lÄ±kta arÄ±za yavaÅŸ sorgu deÄŸil, **iÅŸlem baÅŸlatma aÃ§lÄ±ÄŸÄ±**:
  Prisma iÅŸlemi verilen sÃ¼rede baÅŸlatamÄ±yor ve istek **500** dÃ¶nÃ¼yor. KullanÄ±cÄ±
  Ã¶nce bekliyor, sonra opak `BEKLENMEYEN_HATA` alÄ±yor.
- GC darboÄŸaz **deÄŸil**: duraklamalar boÅŸtaki 6,7 ms medyandan 20 ms'e Ã§Ä±kÄ±yor,
  RSS 215 â†’ 216 MB, yÄ±ÄŸÄ±n bÃ¼yÃ¼mÃ¼yor.

#### P1

- **Kapsam kurulumu O(tenant)** â€” O(kapsam) deÄŸil. UÃ§tan uca soÄŸuk maliyet:
  13.000 kiÅŸilik tenant'ta **â‰ˆ39 ms**, 30 kiÅŸilik tenant'ta **â‰ˆ14 ms**
  (kapsamsÄ±z YÃ–NETÄ°CÄ° kontrol Ã¶lÃ§Ã¼mÃ¼ Ã§Ä±karÄ±lmÄ±ÅŸ hÃ¢liyle). KÃ¶k sebep
  `backend/src/common/prisma/tenant.reader.ts:113` (`kisiId: { not: â€¦ }`) ve
  `:150` â€” 3.000 satÄ±r Ã§ekilip JS tarafÄ±nda `Set` kesiÅŸimi yapÄ±lÄ±yor.
- **TenantGuard, PermissionGuard'dan Ã–NCE koÅŸuyor.** Reddedilecek bir istek
  bile bu bedeli Ã¶dÃ¼yor: SAKÄ°N'in 403 aldÄ±ÄŸÄ± uÃ§ soÄŸuk kapsamda **61 ms**.
- SÄ±cak/soÄŸuk farkÄ± bÃ¼yÃ¼k: aynÄ± uÃ§ Ã¶nbellek isabetinde 15â€“30 ms, Ä±skada
  60â€“78 ms. Rol bazlÄ± uÃ§larÄ±n Ã¶lÃ§Ã¼mÃ¼ bu yÃ¼zden iki ayrÄ± sayÄ± ister.
- **MANUEL tahakkuk doÄŸrulamasÄ±** eksik bÃ¶lÃ¼mlerin tamamÄ±nÄ± tek `detail`
  metnine yazÄ±yor; 5.000 bÃ¶lÃ¼mde binlerce isim dÃ¶ndÃ¼rÃ¼yor.

#### â˜… AÃ‡IK SORU â€” yarÄ±n ilk iÅŸ

**Kapsam Ã¶nbelleÄŸi 300 sn TTL** (`tenant.reader.ts:82`). SÃ¼resi dolmuÅŸ bir
yetki bu pencerede hÃ¢lÃ¢ eriÅŸim veriyor olabilir.

A0.7'deki **17. negatif test** geÃ§iyorsa, muhtemelen Ã¶nbellekli yoldan
**GEÃ‡MÄ°YOR**. DoÄŸrulanacak: test Ã¶nbellekli yolu mu, doÄŸrudan yolu mu Ã¶lÃ§Ã¼yor?
GeÃ§iyorsa **test yanlÄ±ÅŸ gÃ¼vence veriyor** ve dÃ¼zeltilmesi gereken testtir.

#### P1 â€” `prisma migrate reset` KIRIK (1 AÄŸustos 2026)

```
Error: P3016  The fallback method for database resets failedâ€¦
ERROR: cannot drop table borc because other objects depend on it
DETAIL: policy tahsilat_kapsam on table tahsilat depends on table borc
        policy borc_sorumlusu_kapsam on table borc_sorumlusu depends on table borc
HINT: Use DROP â€¦ CASCADE
```

**KÃ¶k sebep bulundu.** Kapsam politikalarÄ±ndan **ikisi** `EXISTS` alt sorgusuyla
BAÅKA bir tabloya bakÄ±yor; PostgreSQL bunu `pg_depend` kaydÄ± olarak tutuyor:

| politika | tablo | baÄŸÄ±mlÄ± olduÄŸu |
|---|---|---|
| `borc_sorumlusu_kapsam` | `borc_sorumlusu` | `borc` |
| `tahsilat_kapsam` | `tahsilat` | `borc`, `tahsilat_tahsisi` |

(`0022_satir_kapsami/migration.sql:141,166` Â· `0023_kirali_mulk_kapsami/migration.sql:66,87`)

Prisma'nÄ±n reset geri dÃ¼ÅŸÃ¼ÅŸ yolu tablolarÄ± **CASCADE olmadan** dÃ¼ÅŸÃ¼rÃ¼yor ve bu
iki baÄŸÄ±mlÄ±lÄ±kta takÄ±lÄ±yor. DiÄŸer 13 kapsam politikasÄ± yalnÄ±zca kendi tablosuna
baktÄ±ÄŸÄ± iÃ§in sorun Ã§Ä±karmÄ±yor.

**Etki alanÄ± â€” Ã¼retim riski DEÄÄ°L, doÄŸrulanmadan yazÄ±lmasÄ±n:** `migrate deploy`
(Ã¼retim yolu) hiÃ§bir ÅŸey dÃ¼ÅŸÃ¼rmez, etkilenmez. KÄ±rÄ±lan yollar `migrate reset` ve
sÃ¼rÃ¼klenme (drift) algÄ±landÄ±ÄŸÄ±nda reset Ã§aÄŸÄ±ran `migrate dev`. Yani risk
**geliÅŸtirme ve CI** ortamlarÄ±ndadÄ±r: temiz kurulum yapÄ±lamaz, CI'da sÄ±fÄ±rdan
ÅŸema kurma adÄ±mÄ± eklenirse ilk gÃ¼nden kÄ±rmÄ±zÄ± yanar.

**BugÃ¼nkÃ¼ geÃ§ici Ã§Ã¶zÃ¼m** (uygulandÄ±, kalÄ±cÄ± deÄŸil):
`DROP SCHEMA public CASCADE` + `CREATE SCHEMA` + `pnpm db:migrate` + `pnpm db:seed`.

**DÃ¼zeltme seÃ§enekleri â€” karar verilmedi:**
1. `scripts/db.mjs reset` iÃ§inde ÅŸema dÃ¼ÅŸÃ¼rmeyi Prisma'ya bÄ±rakmayÄ±p doÄŸrudan
   `DROP SCHEMA â€¦ CASCADE` yapmak (en kÃ¼Ã§Ã¼k deÄŸiÅŸiklik, Prisma'ya dokunmaz).
2. Ä°ki politikayÄ± tablolar arasÄ± `EXISTS` kullanmayacak biÃ§imde yeniden yazmak
   (baÄŸÄ±mlÄ±lÄ±ÄŸÄ± kaldÄ±rÄ±r ama kapsam kuralÄ±nÄ± deÄŸiÅŸtirir â€” ADR-0011 konusu).
3. Reset Ã¶ncesi politikalarÄ± dÃ¼ÅŸÃ¼ren bir hazÄ±rlÄ±k adÄ±mÄ±.

### K. P0 KAPATILDI â€” Ã§ift tahakkuk (1 AÄŸustos 2026)

**Ã–lÃ§Ã¼lmÃ¼ÅŸ mali veri bozulmasÄ±ydÄ±:** 5.000 bÃ¶lÃ¼mlÃ¼k bir sitede beklenen 5.000
yerine **10.000 borÃ§ satÄ±rÄ±**. AyrÄ±ntÄ± ve karar:
[ADR-0014](docs/adr/log/0014-mukerrer-tahakkuk-korumasi.md).

Kapatan ÅŸey: **migration 0026** â€” `tahakkuk_calismasi` tablosu ve kÄ±smi
benzersiz indeks `tahakkuk_calismasi_asil_uq`. Ã‡alÄ±ÅŸma satÄ±rÄ± iÅŸlemin ilk
yazmasÄ±dÄ±r; ikinci iÅŸlem kÄ±sÄ±t Ã¼zerinde bloklanÄ±r. `borc.count()` denetimi
kaldÄ±rÄ±ldÄ± â€” okuma/yazma penceresi uygulama katmanÄ±nda kapatÄ±lamÄ±yordu.

YanÄ±nda gelen Ã¼Ã§ ÅŸey:

- **`Idempotency-Key` artÄ±k OKUNUYOR** (`IdempotansInterceptor` + tablo).
  BFS v1 Â§366 zorunlu kÄ±lÄ±yordu, depoda hiÃ§bir yer okumuyordu.
- **Ek/dÃ¼zeltme tahakkuku** aÃ§Ä±k `ekTahakkuk` bayraÄŸÄ± ister; `tip='EK'` ile
  yeni Ã§alÄ±ÅŸma aÃ§ar ve kÄ±smi indekse takÄ±lmaz.
- **Migration mevcut bozuk veriyi sessizce dÃ¼zeltmez** â€” mÃ¼kerrer satÄ±r varsa
  durur ve hangi satÄ±rlarÄ±n bozuk olduÄŸunu yazar. Ä°lk uygulamada gerÃ§ekten
  tetiklendi.

Testler: **CT-16, 6/6** (`backend/test/contract/mukerrer-tahakkuk.spec.ts`).
Uygulamadan Ã¶nce yazÄ±ldÄ±, 5'i kÄ±rmÄ±zÄ±ydÄ±.

#### KalÄ±cÄ±laÅŸan ikinci deÄŸiÅŸiklik: `set_config` tek sorguda

`tenantIslemi`'ndeki dÃ¶rt `set_config` Ã§aÄŸrÄ±sÄ± tek `SELECT`'e alÄ±ndÄ±. Ã–lÃ§Ã¼len
(50 eÅŸzamanlÄ±, havuz 20): boÅŸ bekleme %23,2 â†’ %13,0 Â· `active` %72,7 â†’ %83,6 Â·
verim 63,9 â†’ 80,7 istek/sn Â· p95 1.110 â†’ 878 ms.

#### âš ï¸ HAVUZ Ã–NERÄ°M DEÄÄ°ÅTÄ° â€” birleÅŸtirmeden sonra yeniden Ã¶lÃ§Ã¼ldÃ¼

DÃ¼n "20 iyi gÃ¶rÃ¼nÃ¼yor, belki 25" demiÅŸtim. BirleÅŸtirme kalÄ±cÄ±laÅŸtÄ±ktan sonra
aynÄ± yÃ¼k (50 eÅŸzamanlÄ±) dÃ¶rt havuz boyutuyla Ã¶lÃ§Ã¼ldÃ¼:

| havuz | p50 | p95 | istek/sn |
|---|---|---|---|
| varsayÄ±lan (5) | 891 ms | 1.280 ms | 52,8 |
| 15 | 907 ms | 1.138 ms | 53,4 |
| 20 | 975 ms | 1.382 ms | 49,3 |
| 30 | 949 ms | 1.416 ms | 50,7 |

**Fark yok** â€” dÃ¶rdÃ¼ de koÅŸum oynaklÄ±ÄŸÄ± iÃ§inde. Havuz bÃ¼yÃ¼tmenin dÃ¼nkÃ¼
kazancÄ± (44 â†’ 70 istek/sn), baÄŸlantÄ±larÄ±n `set_config` gidiÅŸ-dÃ¶nÃ¼ÅŸleri boyunca
tutulmasÄ±ndan kaynaklanÄ±yordu; birleÅŸtirme o baskÄ±yÄ± kaldÄ±rÄ±nca havuz boyutu
belirleyici olmaktan Ã§Ä±ktÄ±.

**Yeni Ã¶neri: `connection_limit` ÅŸimdilik DEÄÄ°ÅTÄ°RÄ°LMESÄ°N.** Ã–lÃ§Ã¼m bir kazanÃ§
gÃ¶stermiyor; kanÄ±tsÄ±z bir yapÄ±landÄ±rma eklemek yalnÄ±zca bakÄ±m yÃ¼kÃ¼dÃ¼r. Ã–lÃ§Ã¼m
yapÄ±landÄ±rmadan Ã¶nce gelir â€” bu ADR-0011'in 1. yÃ¶ntem kuralÄ±nÄ±n aynÄ±sÄ±dÄ±r.

#### Madde 4 analizi â€” kapsam kurulumu ayrÄ± iÅŸlemde (Ã¶lÃ§Ã¼m YOK, yalnÄ±zca analiz)

`tenant.reader.ts:120` kendi `tenantIslemi` Ã§aÄŸrÄ±sÄ±nÄ± aÃ§ar. SoÄŸuk bir istek iki
interaktif iÅŸlem baÅŸlatÄ±r.

1. **Ana iÅŸlemin iÃ§ine alÄ±nabilir mi? â€” HAYIR, sÄ±ra sorunu var.** Kapsam,
   `set_config` deÄŸerlerini ÃœRETEN ÅŸeydir; ana iÅŸlem o deÄŸerler yazÄ±lmadan
   aÃ§Ä±lamaz. Kapsam sorgularÄ±nÄ±n kendisi de kapsam politikalarÄ±na tabidir
   (`malik`, `kiraci`, `sakin` Ã¼zerinde RESTRICTIVE politika var) â€” kapsam
   kurulmadan koÅŸarlarsa kendilerini sÃ¼zerler. BugÃ¼n bu, kapsamÄ± **kurulmadan
   Ã¶nce** ayrÄ± bir iÅŸlemde okuyarak Ã§Ã¶zÃ¼lÃ¼yor ve `tenant.reader.ts:77`
   yorumu bunu aÃ§Ä±kÃ§a uyarÄ±yor. BirleÅŸtirme, politikalarÄ±n kapsam kurulumunu
   muaf tutmasÄ±nÄ± gerektirirdi; bu ADR-0002'nin tek katmanlÄ± olmama ilkesine
   dokunur. **Ã–nerilmez.**
2. **`:113`'teki `kisiId: { not: â€¦ }` sorgusu `bolum_id` ile kÄ±sÄ±tlanabilir mi?
   â€” EVET, ve maliyeti O(tenant)'tan O(kapsam)'a dÃ¼ÅŸÃ¼rÃ¼r.** Sorgunun amacÄ±
   "kiÅŸinin MALÄ°K olduÄŸu bÃ¶lÃ¼mlerde baÅŸkasÄ± kiracÄ± mÄ±" sorusudur; yani ilgi
   alanÄ± zaten **o kiÅŸinin malik olduÄŸu bÃ¶lÃ¼mlerdir**. BugÃ¼n tenant'Ä±n bÃ¼tÃ¼n
   kiracÄ±larÄ±nÄ± (3.000 satÄ±r) Ã§ekiyor. `bolumId: { in: malikBolumleri }`
   eklenmesi sorguyu kapsam boyutuna indirir. Malik sorgusu Ã¶nce koÅŸtuÄŸu iÃ§in
   liste zaten elde; iki sorgu `Promise.all` yerine sÄ±raya alÄ±nÄ±r.
   **Ã–nerilir.**
3. **`:150`'deki JS `Set` kesiÅŸimi SQL'e taÅŸÄ±nabilir mi? â€” EVET ve 2. madde
   uygulanÄ±rsa GEREKSÄ°ZLEÅÄ°R.** 2. madde sonrasÄ± dÃ¶nen satÄ±r sayÄ±sÄ± kapsam
   kadar olur (tipik olarak 1â€“10); kesiÅŸimin JS'te yapÄ±lmasÄ± sorun deÄŸildir.
   SQL'e taÅŸÄ±mak ancak 2. madde uygulanmazsa anlamlÄ±dÄ±r. **Ã–nce 2. madde.**

**Ã–lÃ§Ã¼m tahmini vermiyorum** â€” 2. maddenin kazancÄ± uygulanÄ±p Ã¶lÃ§Ã¼lmeden
bilinemez.

### J. Ä°ki ayar denemesi ve set_config birleÅŸtirme (1 AÄŸustos 2026)

**HiÃ§biri kalÄ±cÄ± deÄŸildir.** Ayarlar Ã¶lÃ§Ã¼m sonrasÄ± geri alÄ±ndÄ±, deneme dalÄ±
silindi, hiÃ§bir ÅŸey commit edilmedi. SayÄ±lar karar iÃ§indir.

**Deney 1 â€” `connection_limit=20` + tahakkuk yolunda `timeout` 110 sn.**
Havuz 5 â†’ 20; `max_connections` 200, sorun yok. SonuÃ§: verim tavanÄ± 44 â†’ 70
istek/sn, 50 eÅŸzamanlÄ±da p95 2.280 â†’ 957 ms, 500'ler sÄ±fÄ±rlandÄ±, verim Ã§Ã¶kÃ¼ÅŸÃ¼
kalktÄ±. Toplu tahakkuk 5.000 bÃ¶lÃ¼mde **Ã§alÄ±ÅŸtÄ±** (49,6 sn, doÄŸrusal) â€”
ADR-0013'Ã¼n ilk gerekÃ§esi bÃ¶yle Ã§Ã¼rÃ¼tÃ¼ldÃ¼.

**Deney 2 â€” `tenantIslemi`'ndeki 4 `set_config` tek sorguda.** AynÄ± havuzla
(20) A/B:

| eÅŸzamanlÄ± | idle-in-tx ayrÄ±k â†’ birleÅŸik | active ayrÄ±k â†’ birleÅŸik | p95 | istek/sn |
|---|---|---|---|---|
| 10 | %26,3 â†’ **%19,8** | %51,1 â†’ %53,9 | 256 â†’ 263 | 62,8 â†’ 63,2 |
| 25 | %24,5 â†’ **%14,7** | %70,4 â†’ %81,3 | 637 â†’ 526 | 66,0 â†’ 78,4 |
| 50 | %23,2 â†’ **%13,0** | %72,7 â†’ **%83,6** | 1.110 â†’ **878** | 63,9 â†’ **80,7** |

BoÅŸ bekleme **yarÄ±ya indi**, verim %26 arttÄ±, p95 %21 dÃ¼ÅŸtÃ¼. Tek satÄ±rlÄ±k bir
deÄŸiÅŸiklik; kalÄ±cÄ± hÃ¢le getirilip getirilmeyeceÄŸi Ã¼rÃ¼n sahibinin kararÄ±.

**Kapsam kurulumu bu iÅŸlemin Ä°Ã‡Ä°NDE DEÄÄ°L.** `tenant.reader.ts:120`
kapsamÄ± **kendi `tenantIslemi` Ã§aÄŸrÄ±sÄ±nda** kuruyor. Yani Ã¶nbellek Ä±skalayan bir
istek **iki interaktif iÅŸlem** aÃ§Ä±yor: ayrÄ±k sÃ¼rÃ¼mde 8 `set_config` gidiÅŸ-dÃ¶nÃ¼ÅŸÃ¼,
birleÅŸik sÃ¼rÃ¼mde 2. SoÄŸuk/sÄ±cak faz Ã¶lÃ§Ã¼mÃ¼ (aynÄ± havuz, kontrol grubu Ã§Ä±karÄ±lmÄ±ÅŸ):

| | soÄŸuk âˆ’ sÄ±cak | kontrol (kapsamsÄ±z yÃ¶netici) | dÃ¼zeltilmiÅŸ kapsam maliyeti |
|---|---|---|---|
| ayrÄ±k `set_config` | 50,7 ms | +10,3 ms | **â‰ˆ40 ms** |
| birleÅŸik `set_config` | 34,1 ms | âˆ’0,7 ms | **â‰ˆ35 ms** |

Yani kapsam kurulumunun â‰ˆ35 ms'i `set_config` deÄŸil, **4 kapsam sorgusu + JS
`Set` kesiÅŸimi**. BirleÅŸtirme sÄ±cak yolu iyileÅŸtiriyor; soÄŸuk yol iÃ§in asÄ±l
dÃ¼zeltme hÃ¢lÃ¢ `tenant.reader.ts:113/:150`.

#### Ã–lÃ§Ã¼m koÅŸullarÄ± (tekrar Ã¼retmek iÃ§in)

- Ä°stek sÄ±nÄ±rÄ± sayaÃ§larÄ± giriÅŸ Ã¶ncesi Redis'ten temizlendi. Bu bir **fikstÃ¼r
  engeli**dir (IP baÅŸÄ±na 20 giriÅŸ / 5 dk), Ã¶lÃ§Ã¼len uÃ§ deÄŸil.
- DB havuzu Ã¶rneklemesi **ayrÄ± bir sÃ¼reÃ§te** koÅŸtu. Ä°lk denemede aynÄ± sÃ¼reÃ§te
  senkron Ã¶rnekleme olay dÃ¶ngÃ¼sÃ¼nÃ¼ blokladÄ± ve gecikmeleri bozdu; o koÅŸum
  atÄ±ldÄ±.
- `pg_stat_activity.state` yalnÄ±zca sÃ¼per kullanÄ±cÄ±ya gÃ¶rÃ¼nÃ¼r; `bnos_migrator`
  ile Ã¶rneklerken bÃ¼tÃ¼n alanlar NULL geldi.

---

### H. Kurulum bÃ¼tÃ¼nlÃ¼ÄŸÃ¼ â€” tohumla kurulan proje muhasebe yapamÄ±yordu (2 AÄŸustos 2026)

Virman Ã§alÄ±ÅŸmasÄ± sÄ±rasÄ±nda **ayrÄ± bir bulgu** olarak Ã§Ä±ktÄ±, virmanla ilgisi yok.
KapatÄ±ldÄ±; ama kapatÄ±lan **semptomdu, sebep deÄŸil** â€” sebep Â§H.3'te aÃ§Ä±k madde
olarak duruyor.

#### H.1 Â· Ã–lÃ§Ã¼m â€” Ã¼Ã§ boÅŸluk, sÄ±rayla ortaya Ã§Ä±ktÄ±

KanÄ±t Ã¶nce alÄ±ndÄ±, sonra dÃ¼zeltildi. Her dÃ¼zeltme bir sonrakini gÃ¶rÃ¼nÃ¼r yaptÄ±:

| # | BoÅŸluk | Ã–lÃ§Ã¼len davranÄ±ÅŸ |
|---|---|---|
| 1 | `MuhasebeParametresi` kaydÄ± **hiÃ§ aÃ§Ä±lmÄ±yordu** | `POST /makbuzlar/:id/muhasebelestir` â†’ **422** Â· *"VarsayÄ±lan kasa hesabÄ± tanÄ±mlÄ± deÄŸil; nakit tahsilat muhasebeleÅŸemez."* |
| 2 | 12 hesabÄ±n **hiÃ§birinde** `ozellik` yoktu (hepsi `NORMAL`) | `GET /muhasebe/defterler/kasa?ozellik=KASA` â†’ **200 Â· `[]`** (BANKA da aynÄ±) |
| 3 | **HiÃ§ muhasebe dÃ¶nemi aÃ§Ä±lmÄ±yordu** | 1 ve 2 kapatÄ±ldÄ±ktan sonra â†’ **422** Â· *"2026-08-02 tarihini kapsayan bir muhasebe dÃ¶nemi yok."* |

ÃœÃ§Ã¼ de kapatÄ±ldÄ±ktan sonra uÃ§tan uca kanÄ±t: `POST /makbuzlar` â†’ **201**,
`POST /makbuzlar/:id/muhasebelestir` â†’ **201 Â· `YEV-2026-000001`**.
Kasa defteri artÄ±k `[]` deÄŸil, hesabÄ± dÃ¶ndÃ¼rÃ¼yor (satÄ±rlarÄ± boÅŸ, Ã§Ã¼nkÃ¼ fiÅŸ
TASLAK ve `taslakMizanaGirer=false` â€” beklenen).

> âš ï¸ **BoÅŸluk 3, ilk ikisi kapatÄ±lmadan GÃ–RÃœNMÃœYORDU.** Ä°lk hata sonrakini
> maskeliyordu. "Bir hata dÃ¼zelttik, bitti" varsayÄ±mÄ±nÄ±n neden Ã¶lÃ§Ã¼mle
> sÄ±nanmasÄ± gerektiÄŸinin somut Ã¶rneÄŸi.

#### H.2 Â· YANSITMA â€” varsayÄ±mÄ±m yanlÄ±ÅŸ Ã§Ä±ktÄ±, dÃ¼zeltildi

Ã–nceki turda *"yansÄ±tma dÃ¶nem kapanÄ±ÅŸÄ±na kadar gÃ¶rÃ¼nmez, muhtemelen o da
sessiz"* demiÅŸtim. **Ã–yle deÄŸil.** `donem.service.ts:632` aÃ§Ä±k hata veriyor:

```
422 Â· "YansÄ±tÄ±lacak hesap hareketi yok."
      sonrakiEylem: "Hesap planÄ±nda Ã¶zelliÄŸi YANSITMA olan hesap tanÄ±mlÄ± mÄ±?"
```

Yani aynÄ± eksiklik sÄ±nÄ±fÄ± Ã¼rÃ¼nÃ¼n **iki farklÄ± yerinde iki farklÄ± ÅŸekilde**
davranÄ±yor: yansÄ±tma yolu doÄŸruyu yapÄ±yor, kasa/banka defteri yapmÄ±yor. Bu
tutarsÄ±zlÄ±k Ã¶lÃ§Ã¼lmeseydi "hepsi sessiz" ya da "hepsi aÃ§Ä±k" sanÄ±lacaktÄ±.

#### H.3 Â· â˜… KapatÄ±lan semptomdu, sebep deÄŸil

Tohum dÃ¼zeltmesi **tohumu** dÃ¼zeltir. Sebep ÅŸudur:

> Kurulumun tamamlanÄ±p tamamlanmadÄ±ÄŸÄ±nÄ± **hiÃ§bir yerde kontrol eden yok.**
> Eksik kurulmuÅŸ proje, hata vermek yerine boÅŸ ekran gÃ¶steriyor.

Elle kurulan yeni bir tenant aynÄ± duruma **bugÃ¼n de** dÃ¼ÅŸer. Bu yÃ¼zden
`backend/test/contract/kurulum-butunlugu.spec.ts` (**CT-20 Â· 7 test**) iki
bÃ¶lÃ¼mlÃ¼ yazÄ±ldÄ± ve **ikinci bÃ¶lÃ¼m kalÄ±cÄ±dÄ±r**:

- **BÃ¶lÃ¼m 1 (5 test)** â€” tohumun kurulumu tam mÄ±. DÃ¼zeltmeden sonra yeÅŸil.
- **BÃ¶lÃ¼m 2 (2 test)** â€” kurulum EKSÄ°KKEN sistem ne yapÄ±yor. Kendi iÅŸaretsiz
  tenant'Ä±nÄ± kurar; **tohum dÃ¼zeltildikten sonra da koÅŸar.** AmacÄ± sessizliÄŸin
  gÃ¶rÃ¼nÃ¼r kalmasÄ±dÄ±r. `it.skip` kullanÄ±lmadÄ± â€” atlanan test, olmayan testtir.

#### H.4 Â· Migration YAZILMADI â€” gerekÃ§e

Var olan projelerin hesap planÄ±na `ozellik` atayan bir migration **bilerek
yazÄ±lmadÄ±**:

> `kod='120'` varsayan bir migration, hesap planÄ±nÄ± Ã¶zelleÅŸtirmiÅŸ projede
> **yanlÄ±ÅŸ hesabÄ± kontrol hesabÄ± yapar. Sessiz bozulma, iÅŸaretsiz kalmaktan
> kÃ¶tÃ¼dÃ¼r.**

Hangi hesabÄ±n kontrol hesabÄ± olduÄŸu **mali bir karardÄ±r** (ADR-0010) ve kod
adÄ±na verilemez. Var olan projeler iÃ§in doÄŸru yol Â§H.3'teki kurulum kontrolÃ¼:
eksikliÄŸi **sÃ¶yle**, tahmin etme.

#### H.5 Â· Yol haritasÄ±na eklenen Ã¼Ã§ madde

- **(b) Defter sorgusu aÃ§Ä±k hata versin.** `defter.query.service.ts:293-316` â€”
  iÅŸaretli hesap yoksa `hesaplar` boÅŸ kalÄ±yor, dÃ¶ngÃ¼ hiÃ§ dÃ¶nmÃ¼yor, `200 Â· []`
  dÃ¶nÃ¼yor. "Hesap iÅŸaretlenmemiÅŸ" ile "hesapta hareket yok" ayrÄ± iki durumdur;
  ikisi de aynÄ± yanÄ±tÄ± veriyor. DoÄŸrusu: iÅŸaretli hesap yoksa **422 + Ã§Ä±kÄ±ÅŸ
  yolu**. DÃ¼zeltildiÄŸinde CT-20 test (6) *422 bekleyecek ÅŸekilde GÃœNCELLENÄ°R,
  silinmez.*
- **(c) Kurulum tamamlanma kontrolÃ¼.** Proje "kullanÄ±ma hazÄ±r" sayÄ±lmadan Ã¶nce
  neyin zorunlu olduÄŸunu tek yerde tanÄ±mlayan kontrol: parametre kaydÄ±,
  kasa/banka/cari kontrol/yansÄ±tma iÅŸaretleri, bugÃ¼nÃ¼ kapsayan aÃ§Ä±k dÃ¶nem.
  Eksikse yÃ¶netime **liste hÃ¢linde** gÃ¶ster. HenÃ¼z **yapÄ±lmadÄ±**, karar bekliyor.
- **UÃ§ adÄ± tutarsÄ±zlÄ±ÄŸÄ±.** Tahsilat modÃ¼lÃ¼nÃ¼n ucu `POST /makbuzlar`, modÃ¼l adÄ±
  `tahsilat`. `POST /tahsilat` **404** veriyor (Ã¶lÃ§Ã¼ldÃ¼). Ä°kisinden biri
  seÃ§ilmeli; bu turda dokunulmadÄ±.

#### H.6 Â· Yan bulgu â€” testin kendisi de sessiz kalabiliyor

CT-20 test (2) ilk koÅŸumda **yanlÄ±ÅŸ sebeple yeÅŸil** geÃ§ti: kayÄ±t yokken
`p?.varsayilanKasaHesapId` `undefined` Ã¼retiyor ve `not.toBeNull()` geÃ§iyor.
Test dosyasÄ±na kural olarak yazÄ±ldÄ±: **iddia edilen ÅŸeyin varlÄ±ÄŸÄ± Ã¶nce
daraltÄ±lÄ±r, `?.` ile geÃ§iÅŸtirilmez.**

---

### I. Demo akÄ±ÅŸÄ± Ã¶lÃ§Ã¼mÃ¼ + tohum tutarlÄ±lÄ±ÄŸÄ± (2 AÄŸustos 2026)

#### I.1 Â· UÃ§tan uca Ã¶lÃ§Ã¼m â€” 34 uÃ§, ham Ã§Ä±ktÄ±

Tohum yeniden kurulup 34 uÃ§ sÄ±rayla Ã§aÄŸrÄ±ldÄ± (ilk koÅŸum kendi kanÄ±t betiÄŸimin
bÄ±raktÄ±ÄŸÄ± makbuzla kirlenmiÅŸti; `db:reset` sonrasÄ± tekrarlandÄ±). Dolu dÃ¶nenler:
apartman Â· blok Â· kat Â· bÃ¶lÃ¼m Â· kiÅŸi Â· malik Â· iliÅŸki Â· gider tÃ¼rÃ¼ Â·
tahakkuk borÃ§larÄ± (36) Â· dÃ¶nemler (3) Â· cari ekstre Â· yaÅŸlandÄ±rma Â· hesaplar Â·
kasa/banka defteri. BoÅŸ dÃ¶nenler: kiracÄ± Â· sakin Â· makbuz Â· fiÅŸ Â· yevmiye Â·
muavin Â· mizan Â· sayaÃ§ Â· belge Â· araÃ§ Â· misafir Â· daire gÃ¶revlisi Â·
site personeli Â· banka hesabÄ±.

`GET /daireler` iÃ§in aldÄ±ÄŸÄ±m 404 **benim hatamdÄ±** â€” liste ucu yok, rota
`/daireler/:bolumId/kart`.

#### I.2 Â· â˜… Tohum kendi kendini yalanlÄ±yordu â€” kapatÄ±ldÄ±

```
Ã–NCE : borc kapandi_mi=true â†’ 24 Â· Î£ odenen = 43.200,00 Â· tahsilat tablosu â†’ 0 satÄ±r
       cari ekstre: 3 BORÃ‡ satÄ±rÄ±, hiÃ§ TAHSÄ°LAT satÄ±rÄ± yok, tahsilatToplam "0.0000"
```

`odenen` elle yazÄ±lÄ±yordu (`odenen: d.kapali ? d.tutar : 0`) â€” oysa ÅŸema
`Borc.odenen` notu aÃ§Ä±kÃ§a *"ARTIK BU SATIRLARDAN TÃœRETÄ°LÄ°R (0017 Â· ADR-0010),
elle yazÄ±lmaz"* diyor. Tohum belgelenmiÅŸ bir deÄŸiÅŸmezi Ã§iÄŸniyordu.

DÃ¼zeltildi: tohum artÄ±k gerÃ§ek `Tahsilat` + `TahsilatTahsisi` kayÄ±tlarÄ± Ã¼retiyor,
`odenen` ve `kapandiMi` **onlardan tÃ¼retiliyor**.

```
SONRA: odenen = 43.200,0000 Â· tahsis = 43.200,0000 Â· fark = 0,0000
       cari ekstre: BORÃ‡ â†’ TAHSÄ°LAT â†’ BORÃ‡ â†’ TAHSÄ°LAT â†’ BORÃ‡,
       her Ã¶demeden sonra yÃ¼rÃ¼yen bakiye 0, kapanÄ±ÅŸ 1.950 (tek aÃ§Ä±k borÃ§)
```

âš ï¸ Tahsilatlar **muhasebeleÅŸtirilmedi** (`yevmiyeFisiId` boÅŸ) ve bu bilinÃ§li:
tahakkuk deftere dÃ¼ÅŸmediÄŸi iÃ§in yalnÄ±zca tahsilatÄ± muhasebeleÅŸtirmek 120'yi
alacaklandÄ±rÄ±p mutabakat farkÄ±nÄ± **bÃ¼yÃ¼tÃ¼rdÃ¼**. Bkz. Â§I.4.

âš ï¸ BÃ¼tÃ¼n makbuzlar NAKÄ°T. `tahsilat_kanal_banka` CHECK kÄ±sÄ±tÄ± BANKA kanalÄ±nda
`banka_hareketi_id` zorunlu kÄ±lÄ±yor ve tohumda banka hesabÄ± yok. **KÄ±sÄ±t doÄŸru
Ã§alÄ±ÅŸÄ±yor** â€” gevÅŸetilmedi, kanal daraltÄ±ldÄ±.

#### I.3 Â· Hisseli mÃ¼lkiyet fikstÃ¼rÃ¼ â€” ilk kez var

Ã–lÃ§Ã¼m gÃ¶sterdi: 12 dairenin **hepsi** tek malikti, hisse `1/1`. Yani
`borc_sorumlusu.pay` mantÄ±ÄŸÄ± ve pay bazÄ±nda tahsis kodda vardÄ± ama **hiÃ§bir
fikstÃ¼r ona dokunmuyordu.** ÃœÃ§ daire hisseli yapÄ±ldÄ±:

| Daire | Hisse | BorÃ§ 1.950 nasÄ±l bÃ¶lÃ¼nÃ¼yor |
|---|---|---|
| 4 | 1/2 + 1/2 (iki kardeÅŸ) | 975,00 + 975,00 |
| 9 | 1/3 Ã— 3 (miras) | 650,00 Ã— 3 |
| 12 | **3/4 + 1/4** (eÅŸit deÄŸil) | **1.462,50 + 487,50** |

Daire 12 bilerek eÅŸit deÄŸil: eÅŸit paylÄ± fikstÃ¼r, `pay = tutar/n` varsayan bir
hatayÄ± yakalayamaz.

Tohuma iki kontrol eklendi (kontrol **eklendi**, gevÅŸetilmedi):
Î£ hisse â‰  1 ise tohum **durur**; pay daÄŸÄ±tÄ±mÄ±nda **son hissedar artÄ±ÄŸÄ± alÄ±r** ki
`Î£ pay = borc.tutar` bozulmasÄ±n. Ä°kincisi bir daÄŸÄ±tÄ±m tekniÄŸidir, yuvarlama
politikasÄ± deÄŸil â€” o karar tohumun iÅŸi deÄŸildir.

DoÄŸrulama: `Î£ pay â‰  tutar` olan borÃ§ sayÄ±sÄ± **0**.

#### I.4 Â· â˜… DUR VE BÄ°LDÄ°R â€” tahakkuk deftere hiÃ§ dÃ¼ÅŸmÃ¼yor

`kontrol-mutabakati` her projede `mutabikMi:false` dÃ¶ner. Sebep yapÄ±sal:
`Borc` modelinde `yevmiyeFisiId` yok, tahakkukta `muhasebelestir` ucu yok.
Bu **eksik Ã¶zelliktir, veri eksiÄŸi deÄŸil** â€” tohuma elle yevmiye fiÅŸi yazmak
Ã¼rÃ¼nÃ¼n yapamadÄ±ÄŸÄ± bir ÅŸeyi demoda gÃ¶stermek olurdu.
[ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md) aÃ§Ä±ldÄ±, **karar
yok**. Yol haritasÄ±nda **P0** ve virmandan Ã¶ncedir.

---

### J. Tahakkuk muhasebeleÅŸtirmesi + apartman/site ayrÄ±mÄ± (2 AÄŸustos 2026)

[ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md) karara baÄŸlandÄ±
ve uygulandÄ±; kapsamÄ± **`CIFT_TARAFLI` muhasebedir**. AyrÄ±mÄ±n tamamÄ± tek
belgede: [docs/APARTMAN-SITE-AYRIMI.md](docs/APARTMAN-SITE-AYRIMI.md).

#### J.1 Â· BitiÅŸin kanÄ±tÄ±

```json
SITE (Papatya Sitesi Â· CIFT_TARAFLI)
{"yardimciDefterToplami":"15600.0000","kontrolHesabiKodu":"120",
 "kontrolHesabiBakiyesi":"15600.0000","fark":"0.0000","mutabikMi":true,
 "bolumSayisi":8}
```

Ã–nceki hÃ¢li `{"fark":"15600.0000","mutabikMi":false}` idi. Tohum artÄ±k
tahakkuklarÄ± **ve** tahsilatlarÄ± muhasebeleÅŸtiriyor; yalnÄ±zca biri
muhasebeleÅŸseydi kontrol hesabÄ± Ã¶denen kadar sapardÄ±.

âš ï¸ Tohumun Ã¼rettiÄŸi fiÅŸ, `muhasebelestir` ucunun Ã¼rettiÄŸinin **aynÄ±
biÃ§imidir** (fiÅŸ tÃ¼rÃ¼ Â· kaynak baÄŸÄ± Â· iki satÄ±r Â· `ISLENDI`). Elle yevmiye
fiÅŸi yazÄ±lmadÄ± â€” tohum, Ã¼rÃ¼nÃ¼n yapmadÄ±ÄŸÄ± bir ÅŸeyi gÃ¶stermez.

#### J.2 Â· Muhasebe derinliÄŸi

`MuhasebeParametresi.muhasebeDerinligi: BASIT | CIFT_TARAFLI` (migration 0034).
VarsayÄ±lanÄ± kurulumda `Tenant.tip`'ten gelir ama **kural deÄŸildir** â€”
politika koda gÃ¶mÃ¼lmediÄŸi gibi **yapÄ±ya da gÃ¶mÃ¼lmez**. `BASIT` projede
`muhasebelestir` ve `kontrol-mutabakati` **422** verir; alacak takibi
**etkilenmez**.

#### J.3 Â· CT-20 yanlÄ±ÅŸ teÅŸhis koyuyordu â€” dÃ¼zeltildi

Test, her projede hesap planÄ± + parametre + aÃ§Ä±k dÃ¶nem arÄ±yordu. `BASIT`
derinlikte bunlarÄ±n olmamasÄ± **eksiklik deÄŸildir**. ArtÄ±k Ã¼Ã§ bÃ¶lÃ¼mlÃ¼ ve
Ã¶znesi site tenant'Ä±: 12/12 yeÅŸil.

#### J.4 Â· Tohumda hiÃ§ SITE yoktu

`seed.ts` iÃ§inde `tip: 'SITE'` iÃ§in 0 eÅŸleÅŸme vardÄ±; site tarafÄ±na kod
yazÄ±lÄ±yordu ama **hiÃ§bir fikstÃ¼r onu temsil etmiyordu**. Papatya Sitesi
eklendi (2 blok Â· 8 bÃ¶lÃ¼m Â· hisseli daire dÃ¢hil).

#### J.5 Â· CanlÄ± Ã¶lÃ§Ã¼m â€” her iki taraf

```json
SITE (Papatya Â· CIFT_TARAFLI)
{"yardimciDefterToplami":"15600.0000","kontrolHesabiBakiyesi":"15600.0000",
 "fark":"0.0000","mutabikMi":true,"bolumSayisi":8}

APARTMAN (GÃ¼zel Â· BASIT) â†’ HTTP 422
{"detail":"Bu proje basit muhasebe kullanÄ±yor; kontrol hesabÄ± mutabakatÄ±
 yapÄ±lmaz.","sonrakiEylem":"â€¦ Alacak takibi ETKÄ°LENMEZ: â€¦"}
```

#### J.6 Â· â˜… 404 SUNUCU ARIZASI â€” sebep BENDÄ°M, P0 deÄŸil

BÃ¼tÃ¼n rotalar 404 veriyordu, `/api/v1/saglik` dÃ¢hil. TeÅŸhis:

```text
[RoutesResolver] HealthController {/C:/Program Files/Git/api/v1/saglik}
```

Genel Ã¶nek `/api/v1` yerine **`/C:/Program Files/Git/api/v1`** olarak
kaydedilmiÅŸ. Sebep: sunucuyu **Git Bash iÃ§inden** `set -a && . ./.env` ile
baÅŸlatmÄ±ÅŸtÄ±m; MSYS yol dÃ¶nÃ¼ÅŸÃ¼mÃ¼ `.env`'deki `API_PREFIX="/api/v1"` deÄŸerini
Windows yoluna Ã§evirdi.

âš ï¸ **Denetim raporundaki P0 giriÅŸ noktasÄ± bulgusu DEÄÄ°LDÄ° ve o bulgu ÅŸu an
yeniden Ã¼retmiyor:** `backend/dist/main.js` var ve taze, `dist/src/main.js`
yok. `config-check.mjs` bunu zaten kapÄ± olarak doÄŸruluyor
(*"Giris noktasi dogrulandi: backend/dist/main.js"*).

â˜… **Ders:** Windows'ta bir Node sunucusunu Git Bash'ten ortam yÃ¼kleyerek
baÅŸlatmayÄ±n; eÄŸik Ã§izgiyle baÅŸlayan deÄŸerler sessizce yola Ã§evrilir. Hata
mesajÄ± vermez â€” rota tablosu bozulur.

#### J.7 Â· â˜…â˜… `pnpm verify` UYGULAMA KODUNU HÄ°Ã‡ TÄ°P DENETÄ°MÄ°NDEN GEÃ‡Ä°RMÄ°YORDU

Bu turda Ã¼Ã§ gerÃ§ek hata (`FIS_TURLERI`/`FisTuru` `TAHAKKUK` taÅŸÄ±mÄ±yor, gider
tÃ¼rÃ¼ ucu zorunlu `muhasebeHesapId`'yi vermiyor) **`pnpm verify` YEÅÄ°LKEN**
geÃ§ti ve ancak sunucu yeniden baÅŸlatÄ±lÄ±nca ortaya Ã§Ä±ktÄ±.

**Sebep Ã¶lÃ§Ã¼ldÃ¼:**

| Ne | Kapsam |
|---|---|
| KÃ¶k `tsconfig.json` â†’ `references` | **yalnÄ±zca `shared/*`** â€” `backend` grafikte YOK |
| `verify` adÄ±mÄ± *"TypeScript derleme (tsc -b)"* | kÃ¶k grafiÄŸi derler â†’ uygulama kodunu **gÃ¶rmez** |
| `verify` adÄ±mÄ± *"Test derlemesi"* | `tests/tsconfig.json` â†’ framework baÄŸÄ±msÄ±z modÃ¼ller |
| Vitest | tip denetimi **yapmaz** |
| CI `pnpm typecheck` â†’ `pnpm -r typecheck` | backend `tsc --noEmit` â€” **yakalardÄ±** |

Yani **yerel kapÄ± ile CI aynÄ± ÅŸeyi Ã¶lÃ§mÃ¼yordu.** AdÄ±n *"TypeScript derleme"*
olmasÄ± bÃ¼tÃ¼n deponun tarandÄ±ÄŸÄ± izlenimi veriyordu; taramÄ±yordu.

**KapatÄ±ldÄ±.** `verify` artÄ±k uygulama paketlerini de tarÄ±yor ve **liste elle
yazÄ±lmadÄ±, TÃœRETÄ°LDÄ°**: workspace desenlerinden paketler bulunur,
`typecheck` betiÄŸi `--noEmit` iÃ§erenler taranÄ±r (`tsc -b` kullananlar kÃ¶k
grafikte zaten var). Yeni bir paket eklendiÄŸinde sessizce dÄ±ÅŸarÄ±da kalmaz.

```text
GECTI      Tip denetimi â€” backend
GECTI      Tip denetimi â€” frontend/mobile
GECTI      Tip denetimi â€” frontend/web
GECTI      Tip denetimi â€” database
```

âš ï¸ `pnpm -r typecheck` Ã§aÄŸrÄ±lmadÄ±: `pnpm` Windows'ta `.cmd` shim'idir ve
`execFileSync` onu kabuk olmadan Ã§alÄ±ÅŸtÄ±ramaz â€” denendi, adÄ±m **boÅŸ Ã§Ä±ktÄ±yla**
baÅŸarÄ±sÄ±z oluyordu.

**Negatif test yapÄ±ldÄ±** (kapÄ± gerÃ§ekten yakalÄ±yor mu):

```text
FIS_TURLERI'den 'TAHAKKUK' geÃ§ici olarak kaldÄ±rÄ±ldÄ±
  â†’  BASARISIZ  Tip denetimi â€” backend
dosya yedekten geri alÄ±ndÄ± (git checkout -- KULLANILMADI)
```

â˜… **Ders â€” "gÃ¼vence mekanizmasÄ±nÄ±n kendisi doÄŸrulanmamÄ±ÅŸ" sÄ±nÄ±fÄ±nÄ±n yeni
Ã¶rneÄŸi.** Bir kapÄ±nÄ±n adÄ±, neyi kapsadÄ±ÄŸÄ±nÄ±n kanÄ±tÄ± deÄŸildir. Bu oturumda
aynÄ± sÄ±nÄ±f dÃ¶rt kez Ã§Ä±ktÄ±: RLS politikalarÄ± hiÃ§ sÄ±nanmamÄ±ÅŸtÄ±, CI iÅŸ akÄ±ÅŸÄ± hiÃ§
koÅŸmamÄ±ÅŸtÄ±, `Idempotency-Key` okunmuyordu, ve ÅŸimdi tip kapÄ±sÄ± uygulama
kodunu gÃ¶rmÃ¼yordu. **Yeni bir kapÄ± eklendiÄŸinde negatif testi de eklenmeli:
kapÄ±yÄ± bilerek ihlal et, kÄ±rmÄ±zÄ±ya dÃ¶ndÃ¼ÄŸÃ¼nÃ¼ gÃ¶r, geri al.**

#### J.8 Â· â˜… CT-04 kÄ±rmÄ±zÄ±sÄ± â€” Ä°LK TEÅHÄ°SÄ°M YANLIÅTI, sebep Ã¶lÃ§Ã¼ldÃ¼

Ã–nce *"sebep CT-19'un uygulanmamÄ±ÅŸ olmasÄ±; virman bitince kapanÄ±r"* demiÅŸtim.
**KapanmadÄ±:** virman uygulandÄ±, CT-19 18/18 yeÅŸile dÃ¶ndÃ¼, CT-04 hÃ¢lÃ¢
kÄ±rmÄ±zÄ±ydÄ±.

GerÃ§ek sebep sayaÃ§lardan okundu:

```text
21 <- sinir:POST:OturumController.giris:ip:::ffff:127.0.0.1     â† sÄ±nÄ±r 20
 2 <- sinir:POST:OturumController.giris:kimlik:â€¦                â† sÄ±nÄ±r 5
```

**IP baÅŸÄ±na 20 giriÅŸ / 5 dk** sÄ±nÄ±rÄ± doluyordu; kimlik sayaÃ§larÄ±nÄ±n en yÃ¼kseÄŸi
2'ydi. Yani sebep kimlik deÄŸil **IP**'ydi ve sÃ¼it bÃ¼yÃ¼dÃ¼kÃ§e eÅŸiÄŸi aÅŸtÄ±. 21'inci
giriÅŸ 429 alÄ±yor, CT-04 `expected undefined to be '/yonetim'` ile dÃ¼ÅŸÃ¼yordu â€”
**hata, sÄ±nadÄ±ÄŸÄ± davranÄ±ÅŸla ilgisiz bir yerde Ã§Ä±kÄ±yordu.**

`global-setup.ts` sayaÃ§larÄ± zaten sÄ±fÄ±rlÄ±yordu ama **koÅŸum baÅŸÄ±nda bir kez**;
21 giriÅŸin hepsi tek koÅŸumda Ã¼retiliyor. SÄ±fÄ±rlama **dosya baÅŸÄ±na** alÄ±ndÄ±
(`test/setup.ts`).

âš ï¸ **SINIR KAPATILMADI, yalnÄ±zca sayaÃ§ sÄ±fÄ±rlanÄ±yor.** Guard testlerde de tam
olarak Ã¼retimdeki kod yolunu koÅŸar. *"Test modunda sÄ±nÄ±r yok"* bayraÄŸÄ± hem
Ã¼retimde yanlÄ±ÅŸlÄ±kla aÃ§Ä±labilir hem de guard'Ä± testlerde hiÃ§ Ã§alÄ±ÅŸtÄ±rmazdÄ±.

â˜… **Ders:** bir teÅŸhisi kanÄ±tlamadan yazmak, sonraki turda onu doÄŸru sanmaya
yol aÃ§ar. Ä°lk aÃ§Ä±klamam makuldÃ¼ ve **yanlÄ±ÅŸtÄ±**; Ã¶lÃ§Ã¼m onu Ã§Ã¼rÃ¼ttÃ¼.

â˜… Yan bulgu: aynÄ± sÄ±nÄ±ftan ikinci bir olay â€” CT-20'ye eklediÄŸim giriÅŸ Ã¶nce
tohum kullanÄ±cÄ±sÄ±nÄ± kullanÄ±yordu ve **kimlik** bÃ¼tÃ§esini tÃ¼ketiyordu.
**PaylaÅŸÄ±lan kimlik, paylaÅŸÄ±lan fikstÃ¼rdÃ¼r**; CT-20 artÄ±k kendi kullanÄ±cÄ±sÄ±nÄ±
aÃ§Ä±yor.

#### J.9 Â· VÄ°RMAN uygulandÄ± â€” CT-19 Â· 18/18

[ADR-0016 Â§C](docs/adr/log/ADR-0016-virman.md) karara baÄŸlandÄ± ve uygulandÄ±
(Â§A kasa/banka ile Â§B hesap virmanÄ± **hÃ¢lÃ¢ aÃ§Ä±k**).

**â˜… VirmanÄ±n iki davranÄ±ÅŸÄ±** â€” asÄ±l kural: `satirlar` doluysa deftere fiÅŸ
yazÄ±lÄ±r, **boÅŸsa yazÄ±lmaz**. Saf taÅŸÄ±nma virmanÄ±nda borcun toplamÄ± da hangi
hesapta durduÄŸu da deÄŸiÅŸmez; yalnÄ±zca yardÄ±mcÄ± defterin iÃ§indeki daÄŸÄ±lÄ±m
deÄŸiÅŸir ve deftere yazÄ±lacak **denk bir kayÄ±t yoktur**. Zorla Ã¼retilseydi
yevmiye defteri taÅŸÄ±nma sayÄ±sÄ± kadar anlamsÄ±z fiÅŸle ÅŸiÅŸerdi. Test (17) bunu
kalÄ±cÄ± olarak Ã¶lÃ§Ã¼yor. *FiÅŸsiz olmak izsiz olmak deÄŸildir:* virman kaydÄ± ve
numarasÄ± her hÃ¢lÃ¼kÃ¢rda yazÄ±lÄ±r.

**ÃœÃ§ fikstÃ¼r eksiÄŸi Ã¶lÃ§Ã¼lerek bulundu** (Ã¼rÃ¼n hatasÄ± deÄŸil, testin kendi
kurulumu):

| Bulgu | Kural doÄŸru muydu |
|---|---|
| 2026 muhasebe dÃ¶nemi hiÃ§ yoktu | evet â€” dÃ¶nemsiz fiÅŸ yazÄ±lamaz |
| `KAPALI` dÃ¶nem kapanÄ±ÅŸ alanlarÄ± olmadan yazÄ±lmak isteniyordu | evet â€” `muhasebe_donemi_kapanis_tutarlilik` |
| Virman tarihi `2026-08-20`, yani **gelecek** | evet â€” *"FiÅŸ tarihi gelecekte olamaz"* |

â˜… AyrÄ±ca `/tahsis|iade/i` eÅŸleÅŸmesi TÃ¼rkÃ§e `Ä°` yÃ¼zÃ¼nden tutmuyordu
(`'Ä°'.toLowerCase()` birleÅŸik karakter Ã¼retir). MesajÄ± bÃ¼yÃ¼k harfle
vurgulamak, arayan tarafÄ±n metni bulamamasÄ±na yol aÃ§Ä±yordu.

#### J.10 Â· â˜… AYRI Ä°ZÄ°N â€” `FINANS_VIRMAN`

UÃ§ Ã¶nce `FINANS_YEVMIYE_GIRIS` istiyordu ve `APARTMAN_YONETICISI` bu izni
taÅŸÄ±mÄ±yor. **Tespit doÄŸruydu, Ã§Ã¶zÃ¼mÃ¼ yanlÄ±ÅŸ yerde arÄ±yordum:** sorun rolÃ¼n
eksik izni deÄŸil, **ucun yanlÄ±ÅŸ izne baÄŸlanmÄ±ÅŸ olmasÄ±ydÄ±.**

**Karar:** virman bir **CARÄ° iÅŸlemdir, muhasebe iÅŸlemi deÄŸildir.** Deftere
yazmasÄ± **yan etkidir** ve her virmanda olmaz â€” saf taÅŸÄ±nma virmanÄ± hiÃ§ fiÅŸ
Ã¼retmez. Yevmiye iznine baÄŸlansaydÄ±, kiracÄ± taÅŸÄ±ndÄ±ÄŸÄ± iÃ§in pay bÃ¶len bir site
yÃ¶neticisinden **serbest yevmiye fiÅŸi kesme yetkisi** istenmiÅŸ olurdu.

| Rol | `FINANS_VIRMAN` |
|---|---|
| `APARTMAN_YONETICISI` Â· `YONETIM_SIRKETI` | âœ… |
| `YK_BASKANI` Â· `YK_UYESI` | â›” denetim organÄ± |
| `DENETCI` | â›” denetim, denetlediÄŸi kaydÄ± Ã¼retemez |

â›” **Rol tanÄ±mÄ± "test geÃ§sin" diye gevÅŸetilmedi.**

**ÃœÃ§ negatif test** (CT-19 Â· 20/20): DENETCI 403 Â· `FINANS_VIRMAN` taÅŸÄ±mayan
rol 403 Â· **virman izninin yevmiye iznine baÄŸlÄ± olmadÄ±ÄŸÄ±** â€” aynÄ± kullanÄ±cÄ±
virman yapabiliyor ama `POST /muhasebe/fisler`'den 403 alÄ±yor. ÃœÃ§Ã¼ncÃ¼sÃ¼ kararÄ±n
kendisini koruyor: kÄ±rmÄ±zÄ±ya dÃ¶nerse ya rol ya uÃ§ izni sessizce deÄŸiÅŸmiÅŸtir.

â˜… **AÃ§Ä±k bÄ±rakÄ±lan:** fiÅŸ ÃœRETEN virman iÃ§in ek kontrol gerekir mi? Ä°zin guard
aÅŸamasÄ±nda, gÃ¶vdeye bakÄ±lmadan kontrol edilir; davranÄ±ÅŸa gÃ¶re izin seÃ§mek
mimari deÄŸiÅŸikliktir. **Karar Ã¶lÃ§Ã¼me baÄŸlandÄ±** â€” satÄ±rlÄ± virman pratikte kim
tarafÄ±ndan yapÄ±lÄ±yor?

#### J.11 Â· ADR-0016 Â§A ve Â§B soru listeleri yazÄ±ldÄ±

**Karar verilmedi.** Ä°ki Ã¶neri gerekÃ§esiyle kayda geÃ§ti:

- **Â§A birleÅŸme:** `POST /banka/virman` kaldÄ±rÄ±lmaz ama `Virman` kaydÄ±nÄ± da
  Ã¼retir (`tur = KASA_BANKA`). **Tek kavram, tek kayÄ±t, iki uÃ§** â€” uÃ§larÄ±
  tekleÅŸtirmek gÃ¶vdeyi tÃ¼r baÅŸÄ±na iki ayrÄ± ÅŸekle bÃ¶lerdi. Â§A'nÄ±n aÃ§Ä±k hatasÄ±
  (bacaklarÄ±n baÄŸÄ±msÄ±z muhasebeleÅŸmesi) bu birleÅŸmenin doÄŸal sonucu olarak
  kapanÄ±r.
- **Â§A kasa/banka iki seviye:** `Hesap` tarafÄ± seÃ§ilsin â€”
  `BankaHesabi.muhasebeHesapId` zaten zorunlu, dÃ¶nÃ¼ÅŸÃ¼m **kayÄ±psÄ±z**; ters yÃ¶n
  deÄŸil. âš ï¸ Bedeli aÃ§Ä±kÃ§a yazÄ±ldÄ±: aynÄ± muhasebe hesabÄ±na baÄŸlÄ± iki banka
  hesabÄ± varsa hangisinden para Ã§Ä±ktÄ±ÄŸÄ± bilinemez, bu yÃ¼zden uÃ§ banka bacaÄŸÄ±nÄ±
  `bankaHesabiId` ile almalÄ±.
- **Â§B belki hiÃ§ gerekmiyor:** mevcut `storno` + elle fiÅŸ yolu iÅŸlevsel olarak
  yeterli; Â§B'nin eklediÄŸi ÅŸey kolaylÄ±k ve niyetin kayda geÃ§mesi. â˜… Karar
  Ã¶lÃ§Ã¼tÃ¼ **Ã¶lÃ§Ã¼m**: kaÃ§ storno *"tek satÄ±r yanlÄ±ÅŸ hesapta"* durumuydu?
- **Â§B ÅŸÃ¼pheli hesap Ã§iftleri:** `ISINMA_CAKISMASI` deseni (0030) uygulanabilir
  â€” tanÄ±m veridir, motor kod bilmez, sonuÃ§ **engelleme deÄŸil uyarÄ±**.
- **Â§B `500` fon hesabÄ±**, Â§A'nÄ±n fon sorusunun **muhasebe tarafÄ±ndaki
  ikizidir**; aynÄ± hukuki cevaba baÄŸlÄ±, ayrÄ± cevaplanmamalÄ±.

---

## 4. Sonraki oturum â€” ilk komut ve ilk gÃ¶rev

> âš ï¸ **AÅAÄIDAKÄ° "Ã–NCEKÄ° Ä°LK GÃ–REV" VE "AÃ‡IK Ä°Å" BÃ–LÃœMLERÄ° ESKÄ°DÄ°R** ve
> tarihsel kayÄ±t olarak duruyor. **3 AÄŸustos 2026 itibarÄ±yla gÃ¼ncel devir
> aÅŸaÄŸÄ±daki kutudur.**

### â–¶ DEVÄ°R â€” 3 AÄŸustos 2026

```bash
pnpm db:up && pnpm db:reset && pnpm verify && pnpm --filter @bnos/backend exec vitest run
```

Beklenen: `Tum kontroller yesil` Â· **145 passed (145)**.

âš ï¸ ArayÃ¼zÃ¼ de Ã§alÄ±ÅŸtÄ±racaksanÄ±z: `pnpm dev:web` â€” `NEXT_PUBLIC_MOCK`
varsayÄ±lanÄ± artÄ±k **`'0'`** (gerÃ§ek backend). Mock'u aÃ§arsanÄ±z ekranÄ±n
Ã¼stÃ¼nde **kapatÄ±lamaz** uyarÄ± bandÄ± gÃ¶rÃ¼nÃ¼r.

Docker Desktop kapalÄ±ysa Ã¶nce baÅŸlatÄ±lmalÄ±:
`C:\Users\HP\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`

âš ï¸ **GeliÅŸtirme sunucusunu PowerShell'den baÅŸlatÄ±n, Git Bash'ten DEÄÄ°L**
(Â§J.6): MSYS yol dÃ¶nÃ¼ÅŸÃ¼mÃ¼ `API_PREFIX` deÄŸerini bozar ve bÃ¼tÃ¼n rotalar 404
verir. Åu an ayakta olan sÃ¼reÃ§ `node --env-file=.env backend/dist/main.js` ile
koÅŸuyor â€” **derlenmiÅŸ Ã§Ä±ktÄ±, watch modu YOK**. GeliÅŸtirmeye devam etmeden Ã¶nce
durdurup kendi `pnpm dev:backend` akÄ±ÅŸÄ±nÄ±zÄ± aÃ§Ä±n.

#### Bu oturumda kapananlar

| Commit | Ä°ÅŸ |
|---|---|
| `ccf8fb0` | Tohum kurulumu tamamlanÄ±yor + CT-20 kurulum bÃ¼tÃ¼nlÃ¼ÄŸÃ¼ |
| `f020b0b` | `odenen` tahsis satÄ±rlarÄ±ndan tÃ¼retiliyor + hisseli mÃ¼lkiyet fikstÃ¼rÃ¼ |
| `a5a3285` | ADR-0017'ye hukuk/muhasebe araÅŸtÄ±rmasÄ± + iki atÄ±f dÃ¼zeltmesi |
| `48d0647` | Tahakkukun dayanaÄŸÄ± kavramÄ± + bÃ¼tÃ§e farkÄ± sorularÄ± + terminoloji kuralÄ± |
| `9abf128` | Tahakkuk muhasebeleÅŸtirmesi + daÄŸÄ±tÄ±m ezmesi + muhasebe derinliÄŸi |
| `8e60d11` | SITE tenant muhasebeleÅŸiyor â€” `mutabikMi: true` |
| `10950b2` | `verify` uygulama paketlerini tip denetimine aldÄ± |
| `2ef78f4` | **Cari virman uygulandÄ±** (ADR-0016 Â§C) â€” CT-19 18/18 |
| `e5297a8` | `FINANS_VIRMAN` ayrÄ± izin + ADR-0016 Â§A/Â§B soru listeleri |
| `fdfbb48` Â· `877f1e4` | Referans envanteri â€” sÃ¼rÃ¼m ayrÄ±mÄ±, V16 sekme haritasÄ± sabit kayÄ±t |
| `5a5e1f1` | `MOCK=0` Ã¶lÃ§Ã¼mÃ¼ â€” hiÃ§bir ekran kÄ±rÄ±lmÄ±yor Â· `/belgeler` menÃ¼den kaldÄ±rÄ±ldÄ± |
| `35c57ca` Â· `e15dd80` | **CT-22 arayÃ¼z sÃ¶zleÅŸmesi** Â· `KatSatiri.blokId` Â· `Mock` Ã¶neki temizliÄŸi |
| `cb4b9e0` | Sahte veri varsayÄ±lanÄ± **KAPALI** + kapatÄ±lamaz uyarÄ± bandÄ± |
| `b67a36e` | **Muhasebe parametreleri ekranÄ±** (7. sekme) + derinlik geÃ§iÅŸ yasaÄŸÄ± |

#### â–¶â–¶ SIRADAKÄ° Ä°Å â€” TAHAKKUK Ã‡ALIÅTIRMA EKRANI (3 AÄŸustos'ta tarif edildi, BAÅLANMADI)

Ekran yazÄ±mÄ± sÄ±rasÄ±: muhasebe parametreleri âœ… â†’ **tahakkuk Ã§alÄ±ÅŸtÄ±rma** â†’
tahsilat + cari ekstre â†’ kasa/banka defteri â†’ virman.

**Kapsam â€” Ã¼rÃ¼n sahibinin tarifi:**

1. DÃ¶nem ve gider tÃ¼rÃ¼ seÃ§imi
2. Tutar giriÅŸi
3. DaÄŸÄ±tÄ±m kuralÄ± â€” gider tÃ¼rÃ¼nden **varsayÄ±lan** gelir, **ezilebilir**
4. â˜… **Ã–NÄ°ZLEME: daÄŸÄ±tÄ±m daire daire gÃ¶rÃ¼nÃ¼r, henÃ¼z yazÄ±lmaz**
5. Onay â†’ tahakkuk oluÅŸur
6. SonuÃ§ ekranÄ±

> â˜… **Ã–NÄ°ZLEME ADIMI ATLANMASIN.** Mali kayÄ±t geri alÄ±namaz (ters kayÄ±tla
> dÃ¼zeltilir); yÃ¶neticinin yanlÄ±ÅŸ tutarÄ± fark edebileceÄŸi **tek an** burasÄ±dÄ±r.

**Ekranda gÃ¶rÃ¼nmesi gerekenler:**

- **Denge:** daÄŸÄ±tÄ±lan toplam = girilen tutar, **fark gÃ¶rÃ¼nÃ¼r**
- **MÃ¼kerrer uyarÄ±sÄ±:** aynÄ± dÃ¶nem + gider tÃ¼rÃ¼ varsa **aÃ§Ä±k hata**
- **`ISINMA_CAKISMASI`** uyarÄ±sÄ± (varsa)
- Ezme veri gerektiriyorsa (`TUKETIM` Â· `MANUEL`) **eksik verinin hangi
  bÃ¶lÃ¼mlerde olduÄŸu listelensin**

**â›” Yapma:** yeni backend ucu Â· toplu dÃ¼zenleme/yuvarlama Â· otomatik
tekrarlayan tahakkuk Â· baÅŸka ekrana geÃ§me.

**BitiÅŸ Ã¶lÃ§Ã¼tÃ¼:** ekran gerÃ§ek API'ye baÄŸlÄ± Â· yeni tipler CT-22'de Â·
Ã¶nizlemeâ†’onay uÃ§tan uca denenmiÅŸ (ham Ã§Ä±ktÄ±) Â· mÃ¼kerrer denemesinin ekranda
ne gÃ¶sterdiÄŸi gÃ¶sterilmiÅŸ Â· sÃ¼it + verify + lint yeÅŸil.

â˜… **Ã–lÃ§Ã¼lmÃ¼ÅŸ olgu:** `POST /tahakkuk/onizleme` diye **ayrÄ± bir uÃ§ YOK**.
Ã–nizleme, `POST /tahakkuk/calistir` gÃ¶vdesindeki **`onizleme: true`** bayraÄŸÄ±yla
yapÄ±lÄ±r (`tahakkuk.dto.ts:181` â€” *"true ise borÃ§ YAZILMAZ, yalnÄ±zca daÄŸÄ±tÄ±m
Ã¶nizlemesi dÃ¶ner"*). Yani yeni uÃ§ yazmaya gerek yok, tek uÃ§ iki kez Ã§aÄŸrÄ±lÄ±r.

#### â˜… Ä°LK GÃ–REV â€” karar bekleyen maddeler

Kod yazmadan Ã¶nce cevaplanmalÄ±; hepsi Ã¼rÃ¼n sahibine ait:

1. **ADR-0016 Â§A Â· kasa/banka virmanÄ±** (P1). AÃ§Ä±k hata duruyor: iki bacak
   baÄŸÄ±msÄ±z muhasebeleÅŸebiliyor, *"paranÄ±n yarÄ±sÄ± deftere girer"*. **Ä°ki Ã¶neri
   gerekÃ§esiyle yazÄ±ldÄ±** (birleÅŸme Â· `Hesap` tarafÄ±), karar bekliyor.
2. **ADR-0016 Â§B Â· hesap virmanÄ±** (P2). â˜… Ä°lk soru *"gerekli mi"*: mevcut
   storno + elle fiÅŸ yolu yeterli olabilir. Karar Ã¶lÃ§Ã¼tÃ¼ Ã¶lÃ§Ã¼m.
3. **ADR-0015 soru 7** â€” yÄ±l sonu artÄ±/eksi bakiye nereye dÃ¼ÅŸer.
4. **`APARTMAN_YONETICISI` yevmiye fiÅŸi kesebilmeli mi?** (P1) Virman kÄ±smÄ±
   `FINANS_VIRMAN` ile Ã§Ã¶zÃ¼ldÃ¼; kalan yalnÄ±zca yevmiye yetkisi.
5. **FiÅŸ Ã¼reten virman iÃ§in ek kontrol?** (P2) â€” karar **Ã¶lÃ§Ã¼me baÄŸlandÄ±**:
   satÄ±rlÄ± virman pratikte kim tarafÄ±ndan yapÄ±lÄ±yor?

#### Sonra sÄ±rada (karar gerektirmeyen)

- `TahakkukDayanagi` uygulamasÄ± â€” model kararÄ± verildi (ADR-0017 Â§6.3), ayrÄ±
  ADR ile. **Yol haritasÄ±nda P0**: bugÃ¼n tahakkuk tutarÄ± serbest giriliyor ve
  tebligat/icra zincirinin ilk halkasÄ± tutulmuyor.
- `GiderKapsami` / iki kademeli gider paylaÅŸÄ±mÄ± â€” site tarafÄ± bugÃ¼n ifade
  edilemiyor.
- Aidat artÄ±ÅŸ tavanÄ± (YDO) â€” Ã¼rÃ¼nde hiÃ§ yok.
- Apartman tarafÄ±nÄ±n basit gelir-gider ekranÄ± (`BASIT` derinliÄŸin Ã§Ä±ktÄ±sÄ±).

### âœ… Ã–nceki ilk gÃ¶rev TAMAMLANDI

Â§3.G'deki iki dÃ¼zeltme uygulandÄ± ve doÄŸrulandÄ± (ayrÄ±ntÄ±: **Â§3.H**). Kabul
Ã¶lÃ§Ã¼tÃ¼ karÅŸÄ±landÄ±: uygulama beyan edilen yoldan ayaÄŸa kalkÄ±yor, `/saglik` 200
dÃ¶nÃ¼yor, giriÅŸ ucu 6. denemede 429 + `Retry-After` veriyor.

### âš ï¸ AÃ‡IK Ä°Å â€” satÄ±r kapsamÄ± (31 Temmuz, oturum ortasÄ±nda kesildi)

**Durum: kod ve migration YAZILDI ve UYGULANDI; 0025 sonrasÄ± testler
KOÅULMADI.** Sonraki oturumun ilk iÅŸi budur.

#### Tamamlananlar

| Ä°ÅŸ | Durum |
|---|---|
| CT-13 `satir-kapsami.spec.ts` (14 test) | âœ… yazÄ±ldÄ± Â· 0024'e kadar yeÅŸil |
| CT-14 `kapsam-kenar-durumlari.spec.ts` (12 test) | âœ… yazÄ±ldÄ± Â· 0024'e kadar yeÅŸil |
| Migration 0022 â€” kapsam ekseni, 15 RESTRICTIVE politika | âœ… uygulandÄ± |
| Migration 0023 â€” kiraya verilen mÃ¼lkte yalnÄ±zca borÃ§/Ã¶deme | âœ… uygulandÄ± |
| Migration 0024 â€” hisseli mÃ¼lkiyette yalnÄ±zca kendi payÄ± | âœ… uygulandÄ± |
| Migration 0025 â€” InitPlan sarmalama | âœ… uygulandÄ± |
| `docs/SATIR-KAPSAMI-KANITI.md` â€” 55 tablonun kapsam envanteri | âœ… |
| Git geÃ§miÅŸi sÄ±zÄ±ntÄ± taramasÄ± (67 commit) | âœ… **temiz** |

#### ğŸ”´ 0025 SONRASI TESTLER KOÅULMADI

50 sÃ¶zleÅŸme testi **0024 durumunda** yeÅŸildi. `0025_kapsam_initplan`
politika ifadelerini yeniden yazdÄ± ve **ondan sonra hiÃ§bir test koÅŸulmadÄ±**.
Ä°lk iÅŸ: `pnpm test:contract` â†’ 50/50 beklenir. KÄ±rmÄ±zÄ± Ã§Ä±karsa DUR ve bildir.

#### âš ï¸ `= ANY ((SELECT dizi))` YAZILAMAZ â€” 42883

Talimatta yazÄ±lan biÃ§im PostgreSQL'de **Ã§alÄ±ÅŸmaz**:

```sql
id = ANY ((SELECT app_kapsam_kisileri()))
-- ERROR 42883: operator does not exist: uuid = uuid[]
```

PostgreSQL bunu *alt sorgu biÃ§imi* sanÄ±p `uuid = uuid[]` operatÃ¶rÃ¼ arar.
0025'te kullanÄ±lan geÃ§erli biÃ§im:

```sql
id IN (SELECT unnest(app_kapsam_kisileri()))
```

Bu da amaca ulaÅŸÄ±r: plan `hashed SubPlan` Ã¼retir, fonksiyon sorgu baÅŸÄ±na
**bir kez** Ã§alÄ±ÅŸÄ±r. Skaler Ã§aÄŸrÄ±lar (`app_kapsam_serbest`,
`app_kapsam_kisi_id`) `(SELECT f())` ile sarÄ±labilir ve InitPlan olur.

#### Ã–lÃ§Ã¼m â€” 0025 Ã¶ncesi/sonrasÄ± (uygulama rolÃ¼ `bnos_app`)

Sentetik: 5.000 baÄŸÄ±msÄ±z bÃ¶lÃ¼m Â· 5.000 kiÅŸi Â· 5.000 malik.

| Senaryo | Execution Ã–NCE | SONRA | Buffers Ã–NCE | SONRA |
|---|---|---|---|---|
| KÄ±sÄ±tsÄ±z | 0,295 ms | 1,474 ms | 54 | 54 |
| 1 daireli malik | 280,483 ms | 12,700 ms | 15.194 | 5.023 |
| 200 daireli malik | **39.227 ms** | **10,639 ms** | **545.390** | **1.709** |
| 5.000 daireli malik | 10 dk'da bitmedi | Ã¶lÃ§Ã¼lemedi (Ã§Ä±ktÄ± kesildi) | â€” | 10.057 |

Plan artÄ±k `InitPlan 1/2` + `hashed SubPlan 3` dÃ¼ÄŸÃ¼mlerini gÃ¶steriyor.
KÄ±sÄ±tsÄ±z yol 0,295 â†’ 1,474 ms yavaÅŸladÄ± (InitPlan yÃ¶neticide de kuruluyor);
mutlak deÄŸer kÃ¼Ã§Ã¼k ama gerÃ§ek.

`set_config` boyutu **deÄŸiÅŸmedi**: 200 daire = 7.399 bayt, 5.000 daire =
184.999 bayt.

#### ÃœrÃ¼n sahibi kararlarÄ± (bu oturumda alÄ±ndÄ±)

| Konu | Karar |
|---|---|
| ReÅŸit olmayan | YalnÄ±zca **baÅŸka hane** gizlenir; veli kendi Ã§ocuÄŸunu gÃ¶rÃ¼r |
| KÄ°RACI bina finansÄ± | Yeni izin `FINANS_BINA_OZET` â€” MALÄ°K'te var, KÄ°RACI'da yok |
| Kiraya verilen mÃ¼lk | Malik yalnÄ±zca **borÃ§ + Ã¶deme** gÃ¶rÃ¼r (KMK md. 22) |
| Hisseli mÃ¼lkiyet | Her malik **yalnÄ±zca kendi payÄ±nÄ±** gÃ¶rÃ¼r (0024) |
| Ã‡ok rollÃ¼ kiÅŸi | BirleÅŸim korunur â€” bir rolÃ¼ kÄ±sÄ±tsÄ±zsa kapsam kurulmaz |
| SECURITY DEFINER (AdÄ±m 2) | âŒ **GERÄ° Ã‡EKÄ°LDÄ°** â€” ADR-0002 ile Ã§eliÅŸiyor |
| Ayar boyutunu kÃ¼Ã§Ã¼ltme | âŒ ÅŸimdilik yapÄ±lmayacak |

#### Sonraki oturumun sÄ±rasÄ±

1. `pnpm test:contract` â€” 50/50 doÄŸrula (0025 sonrasÄ± ilk koÅŸu).
2. Ã–lÃ§Ã¼mÃ¼ tekrarla: 30 kiÅŸi Â· 5.000 kiÅŸi Â· 200 daireli malik. 5.000 daireli
   senaryonun `Execution Time`'Ä± **hÃ¢lÃ¢ eksik**.
3. **Analiz sorularÄ±** (Â§ aÅŸaÄŸÄ±da) yanÄ±tlandÄ±; kararÄ± Ã¼rÃ¼n sahibi verecek.
4. Veri temizliÄŸi: `prisma migrate reset` + seed. Ters kayÄ±t KULLANILMAZ â€”
   yerel fikstÃ¼r muhasebe kaydÄ± deÄŸildir.
5. Ters kayÄ±t / soft delete / toplu geri alma iÃ§in **ayrÄ±** testler.
6. CI kilitleme ve README:151 â€” politika DDL'i durulana kadar **beklemede**.

#### VeritabanÄ±nda duran artÄ±klar

- `perf-5000` tenant'Ä± (5.000 bÃ¶lÃ¼m Â· 5.000 kiÅŸi Â· 5.000 malik)
- `malik-test@guzel-apartmani.test` kullanÄ±cÄ±sÄ±
- 2026-03 dÃ¶nemi tahakkuku (4 borÃ§ kaydÄ±)
- CT-13/CT-14 tenant'larÄ± (denetim kaydÄ± olanlar silinemedi â€” trigger)

Hepsi `migrate reset` ile gidecek. VeritabanÄ± **yerel**, paylaÅŸÄ±mlÄ± deÄŸil.

#### ğŸ”´ Depo PUBLIC

`90d085b` Â· `e7543f7` Â· `3220c3b` commit'leri kapatÄ±lmamÄ±ÅŸ aÃ§Ä±ÄŸÄ±n tarifini
yayÄ±mladÄ±. ÃœrÃ¼n sahibi depoyu private yapacaÄŸÄ±nÄ± bildirdi. GeÃ§miÅŸ
**yeniden yazÄ±lmayacak** (Ã¶nbellek ve Ã§atallar kalÄ±r); sÄ±zmÄ±ÅŸ bir sÄ±r
bulunmadÄ±ÄŸÄ± iÃ§in iptal edilecek anahtar da yok.

### L. CI yeÅŸile dÃ¶ndÃ¼ Â· virman analizi (1â€“2 AÄŸustos 2026)

**CI ilk kez koÅŸtu ve tam yeÅŸile dÃ¶ndÃ¼.** Depo kurulduÄŸundan beri hiÃ§
Ã§alÄ±ÅŸmamÄ±ÅŸtÄ±; tetikleyicide `master` yoktu. BeÅŸ turda beÅŸ ayrÄ± sÄ±nÄ±f arÄ±za
Ã§Ä±ktÄ± â€” ayrÄ±ntÄ± ve **ortak sebep** [`YOL-HARITASI.md`](YOL-HARITASI.md)
"Ã‡Ã¼rÃ¼tÃ¼len varsayÄ±mlar" bÃ¶lÃ¼mÃ¼ndedir.

Son durum (koÅŸu `f7aeacf`): `mimari` âœ… Â· `belge` âœ… Â· `migration` âœ… Â·
`kalite` âœ… â€” sÃ¶zleÅŸme testleri **uygulama rolÃ¼yle** koÅŸuyor, yani CT-01
gerÃ§ekten RLS'i sÄ±nÄ±yor.

**KalÄ±cÄ± kapÄ±lar (hepsi bozukken kÄ±rmÄ±zÄ± verdiÄŸi gÃ¶rÃ¼lerek eklendi):**

| KapÄ± | Ne yakalar |
|---|---|
| `config-check` Â· Node sÃ¼rÃ¼mÃ¼ | `.nvmrc` Â· `engines` Â· iÅŸ akÄ±ÅŸlarÄ± ayrÄ±ÅŸÄ±rsa |
| `scripts/test-onkosul.mjs` | derlenmiÅŸ Ã§Ä±ktÄ± yoksa `ERR_MODULE_NOT_FOUND` yerine aÃ§Ä±k mesaj |
| `scripts/env-sozlesme-check.mjs` | ÅŸemadaki zorunlu anahtar `.env.example`'da yoksa |
| CI `migration` iÅŸi | zincir boÅŸ veritabanÄ±na uygulanamÄ±yorsa Â· reset geri dÃ¼ÅŸÃ¼ÅŸe girerse |
| `.github/actions/kosu-ve-raporla` | hata metnini `::error::` olarak yayÄ±nlar â€” log admin ister, annotation istemez |

**Tohum artÄ±k demo fikstÃ¼rÃ¼dÃ¼r.** CI'Ä±n kullandÄ±ÄŸÄ± veri ile sunumda
gÃ¶sterilecek veri **aynÄ±**: 12 daire, sÃ¶ylenebilir isimler, 3 kiracÄ±,
3 dÃ¶nem tahakkuk geÃ§miÅŸi, 12 aÃ§Ä±k ve vadesi geÃ§miÅŸ borÃ§ (23.400 TL).
GiriÅŸ: `yonetici@guzel-apartmani.test` / `bnos1234`.

**Virman analizi** â€” kod yazÄ±lmadÄ±, [ADR-0016](docs/adr/log/ADR-0016-virman.md)
taslaÄŸÄ± aÃ§Ä±ldÄ±. DÃ¶rt tÃ¼r ayrÄ±ldÄ± (A kasa/banka Â· B hesap Â· C cari Â·
D kalem bazlÄ± tahsis) ve taramadan Ã§Ä±kan bulgular:

- âš ï¸ **Bankaâ†”banka virmanÄ±n iki bacaÄŸÄ± BAÄIMSIZ muhasebeleÅŸiyor.** Biri
  deftere girip Ã¶teki girmezse para kaybolmuÅŸ gÃ¶rÃ¼nÃ¼r, mizan tutmaz.
  Ã–neri: virman anÄ±nda **tek fiÅŸ**; karar bekliyor.
- Kasa ayrÄ± bir varlÄ±k deÄŸil (hesap planÄ± kalemi) â€” **kasaâ†”banka yolu yok**.
- **Elle kalem tahsisi zaten asÄ±l yoldur**; otomatik FIFO yalnÄ±zca Ã¶neri ve
  hiÃ§bir ÅŸey yazmÄ±yor. D'nin eksiÄŸi motor deÄŸil **arayÃ¼z**.
- **Ä°leri dÃ¶nem tahakkuku bugÃ¼n mÃ¼mkÃ¼n** (tek tarih kuralÄ± `vade >= donem`).
- **`YevmiyeFisi`'nde belge tarihi alanÄ± yok** â€” dayanak bilgisi serbest
  metne sÄ±kÄ±ÅŸÄ±yor.

ADR-0015'teki dÃ¶nem kilidi sorusu dÃ¼zeltildi: **mekanizma var ve Ã§alÄ±ÅŸÄ±yor.**
Yenileme fonunun amaca Ã¶zgÃ¼lÃ¼ÄŸÃ¼ (KMK md. 72) Â§3.E'deki C-4 listesine eklendi.

### Ä°LK GÃ–REV â€” sÄ±rada ne var (3 AÄŸustos 2026)

CI yeÅŸil, demo fikstÃ¼rÃ¼ hazÄ±r. SÄ±radaki Ã¼Ã§ iÅŸ:

1. **ADR-0016 Â· B ve C soru listeleri.** BÃ¶lÃ¼mler aÃ§Ä±k, taramadan Ã§Ä±kan
   girdiler iÃ§inde, ama Ã¼rÃ¼n sahibinin soru listeleri **gelmedi**. AyrÄ±ca
   onay bekleyen Ã¼Ã§ karar var: sebep kodu baÅŸlangÄ±Ã§ listesi, `DIGER` kodu
   olsun mu, virmanÄ±n taslak kalabilmesi.

2. **â˜… VirmanÄ±n iki bacaÄŸÄ±nÄ±n baÄŸÄ±msÄ±z muhasebeleÅŸmesi.** ADR-0016 Â§A'daki
   aÃ§Ä±k hata â€” para kaybolmuÅŸ gÃ¶rÃ¼nÃ¼yor. Ã–neri "tek fiÅŸ" yazÄ±lÄ±, karar
   bekliyor. Karar Ã§Ä±kÄ±nca bu bir P0 dÃ¼zeltmesidir.

3. **Demo ekranÄ±.** D bÃ¶lÃ¼mÃ¼nÃ¼n eksiÄŸi motor deÄŸil arayÃ¼z. ÃœÃ§ aday:
   Tahakkuk SihirbazÄ± Â· `/belgeler` (menÃ¼de Ã¶lÃ¼ link) Â· Sakin paneli.
   Hangisinin Ã¶nce yapÄ±lacaÄŸÄ± seÃ§ilmedi.

**YapÄ±sal borÃ§, arka planda duruyor:** yerelde Linux yok. BeÅŸ CI arÄ±zasÄ±nÄ±n
beÅŸi de yerelde gÃ¶rÃ¼nemezdi. WSL2 kurulu ama boÅŸ; kapanmazsa altÄ±ncÄ±sÄ± da
CI'da bulunacak.

Daha Ã¶nce sÄ±raya alÄ±nmÄ±ÅŸ ve **hÃ¢lÃ¢ aÃ§Ä±k** olanlar: kapsam Ã¶nbelleÄŸi TTL
gÃ¼venlik doÄŸrulamasÄ± (A0.7'deki 17. negatif testin hangi yolu Ã¶lÃ§tÃ¼ÄŸÃ¼),
ADR-0013 partileme kararÄ±, kapsam kurulumunun O(tenant) maliyeti,
`yalnizcaKendiVerisi` uÃ§larÄ±nÄ±n kalan denetimi, ÅŸemaâ†”migration sÃ¼rÃ¼klenmesi
(P1), imaj duman testi.

### Muhasebe/Banka talebinin EKSÄ°K KALAN bÃ¶lÃ¼mleri

KullanÄ±cÄ± 10 bÃ¶lÃ¼mlÃ¼k bir liste verdi (~100+ ekran). Bu commit **1. bÃ¶lÃ¼mÃ¼n
Ã§ekirdeÄŸini** tamamladÄ±; geri kalanÄ± aÅŸaÄŸÄ±da. SÄ±ralama baÄŸÄ±mlÄ±lÄ±ÄŸa gÃ¶redir:
analiz/liste/ekstre/dÃ¶kÃ¼m ekranlarÄ±nÄ±n hepsi muhasebe Ã§ekirdeÄŸinin ve banka
modÃ¼lÃ¼nÃ¼n Ã¼stÃ¼ne kurulur.

| BÃ¶lÃ¼m | Durum |
|---|---|
| **1. Muhasebe** | âœ… Ã§ekirdek tamam (fiÅŸ Â· hesap planÄ± Â· 3 defter Â· mizan Â· parametre Â· 6 kapanÄ±ÅŸ iÅŸlemi) Â· âŒ Muhasebe RaporlarÄ± (bkz. 6) |
| **2. Banka YÃ¶netimi** (17 alt modÃ¼l) | âœ… **Ã§ekirdek tamam** (0016) â€” banka Â· ÅŸube Â· hesap Â· POS/sanal POS Â· hareket (havale/EFT/FAST/virman/masraf/faiz/POS) Â· ekstre Â· mutabakat Â· Ã§ek/senet Â· parametre. **API tam, EKRAN YOK** (kullanÄ±cÄ± talimatÄ±) |
| **3. Muhasebe Analizleri** (11 ekran) | âŒ yok. Ã–deme skorlarÄ± `borc` + `borc_sorumlusu` Ã¼zerinden tÃ¼retilebilir; nakit akÄ±ÅŸÄ± artÄ±k **banka hareketlerinden tÃ¼retilebilir** (Ã¶n koÅŸul kalktÄ±) |
| **4. Listeler** (14 ekran) | âš ï¸ veri temeli var (`borc` Â· `Malik/Kiraci/Sakin` Â· mizan), ekran yok. Makbuz numaralandÄ±rma serileri hazÄ±r |
| **5. Ekstreler** (7 ekran) | âš ï¸ **Muavin bunun motoru**: cari/kasa/banka/genel hesap ekstresi `muavin` ucunun farklÄ± hesap seÃ§imleridir. Personel ve site sakini ekstresi cari hesap kavramÄ± ister (henÃ¼z yok) |
| **6. DÃ¶kÃ¼mler** (7 dÃ¶kÃ¼m) | âš ï¸ **Mizan âœ… Â· Muavin âœ…** Â· BilanÃ§o Â· Gelir Tablosu Â· FiÅŸ dÃ¶kÃ¼mÃ¼ Â· Hesap planÄ± dÃ¶kÃ¼mÃ¼ Â· Gelir-gider muavini âŒ |
| **7. Grafikler** (7 grafik) | âŒ yok. `dataviz` yÃ¶nergesi izlenmeli; veri kaynaklarÄ± (3) ve (6)'ya baÄŸlÄ± |
| **8. Ä°letiÅŸim** (9 ekran) | âš ï¸ veri var (kiÅŸi Â· araÃ§ Â· misafir giriÅŸ-Ã§Ä±kÄ±ÅŸ Â· personel), ekran/Ã§Ä±ktÄ± yok |
| **9. Evrak YÃ¶netimi** | âš ï¸ **Belge modÃ¼lÃ¼ tam** (versiyonlama Â· kategori Â· gizlilik Â· Ã¶nizleme Â· KVKK Â· MinIO). 0015 `YEVMIYE_FISI` + `MUHASEBE_DONEMI`, 0016 `BANKA_HAREKETI` + `BANKA_EKSTRESI` + `KIYMETLI_EVRAK` ekledi; **cari hesap iliÅŸkisi FAZ 2'de**. `/belgeler` EKRANI hÃ¢lÃ¢ yok |
| **10. Genel Ã–zellikler** | âš ï¸ Audit âœ… (hash zincirli) Â· Yetkilendirme âœ… (ÃœÃ§ KapÄ±) Â· Listeleme/arama/filtreleme/sÄ±ralama âœ… Â· Sayfalama âš ï¸ (limit var, cursor yok) Â· YazdÄ±rma âœ… (`@media print`) Â· **Excel/PDF aktarma âŒ kÃ¼tÃ¼phane kararÄ± bekliyor** Â· Toplu iÅŸlem âš ï¸ kÄ±smÃ® Â· Ä°ÅŸlem geÃ§miÅŸi âš ï¸ audit'ten okunuyor, ekranÄ± yok |

**Neden hepsi yapÄ±lmadÄ±:** ~100 ekranÄ± tek oturumda Ã¼retmek, kullanÄ±cÄ±nÄ±n kendi
koyduÄŸu iki kurala aykÄ±rÄ± olurdu â€” *"Gereksiz tekrar eden ekran oluÅŸturma"* ve
*"Kod kalitesini dÃ¼ÅŸÃ¼rme"*. Muhasebe Ã§ekirdeÄŸi seÃ§ildi Ã§Ã¼nkÃ¼ 3 Â· 4 Â· 5 Â· 6 Â· 7
bÃ¶lÃ¼mlerinin **tamamÄ±** onun okuma modelleridir; Ã§ekirdek yanlÄ±ÅŸsa yÃ¼z ekran da
yanlÄ±ÅŸ olur.

**Ã–nerilen sÄ±ra:** ~~(a) Banka YÃ¶netimi Ã§ekirdeÄŸi~~ âœ… **bu commit** Â·
**(b) Cari hesap kavramÄ±** â€” 4 ve 5'in Ã¶n koÅŸulu Â· (c) BilanÃ§o + Gelir Tablosu
(mizandan tÃ¼retilir) Â· (d) Excel/PDF kÃ¼tÃ¼phane kararÄ±, sonra tÃ¼m dÃ¶kÃ¼mler Â·
(e) Analizler ve grafikler Â· (f) `/belgeler` ve Ä°letiÅŸim ekranlarÄ± Â·
(g) **ekranlarÄ±n toplu Ã¼retimi** â€” baÄŸÄ±mlÄ±lÄ±k sÄ±rasÄ±na gÃ¶re, her toplu grup
kendi iÃ§inde Ã§alÄ±ÅŸÄ±r durumda.

---

## Mimari-Ã¶ncelikli plan â€” nerede kaldÄ±k

KullanÄ±cÄ±nÄ±n onayladÄ±ÄŸÄ± sÄ±ra: *"Finish the shared platform and domain
foundation firstâ€¦ When the platform foundation is complete, automatically start
generating the remaining screens batch by batch."*

| Faz | Kapsam | Durum |
|---|---|---|
| **FAZ 1** | Banka YÃ¶netimi Ã§ekirdeÄŸi (0016 Â· domain Â· CQRS servisleri) | âœ… **tamam** â€” 91/91 canlÄ± |
| **FAZ 2** | **Cari hesap** â€” karar (ADR-0010) Â· 0017 Â· domain | âš ï¸ **YARIM** â€” aÅŸaÄŸÄ±da |
| FAZ 3 | BilanÃ§o + Gelir Tablosu (mizandan tÃ¼retilir) | bekliyor |
| FAZ 4 | Excel/PDF kÃ¼tÃ¼phane kararÄ± + aktarma altyapÄ±sÄ± | bekliyor |
| FAZ 5+ | EkranlarÄ±n toplu Ã¼retimi (baÄŸÄ±mlÄ±lÄ±k sÄ±rasÄ±na gÃ¶re) | bekliyor |

### FAZ 2 â€” cari hesap: karar VERÄ°LDÄ° (ADR-0010), asÄ±l eksik baÅŸkaydÄ±

Mimari soru â€” *cari, `hesap` aÄŸacÄ±nÄ±n altÄ±na mÄ± yoksa ayrÄ± bir `cari` tablosuna
mÄ±?* â€” **referans belgelerde cevaplÄ±ydÄ±.** KullanÄ±cÄ±ya sorulmasÄ±na gerek
kalmadÄ±:

> **Debt follows the unit, not the person.** â€¦ The data model therefore attaches
> the receivable to the **Daire**, with the responsible party recorded separately
> and historically. â€” `07-Finance-Spec` Â§128
>
> **The critical relationship:** `Receivable â†’ Daire`, not
> `Receivable â†’ Resident`. â€” Â§561
>
> `GET /statements/{unitId}` â€” **Unit** statement Â· `unit balance = Î£
> receivables âˆ’ Î£ allocations`

Referans prototipinde de yevmiye satÄ±rÄ± **`120 AlÄ±cÄ±lar (Daire Cari)`** â€”
cari hesabÄ±n **birimi dairedir.** BNOS bunu zaten uygulamÄ±ÅŸ: `borc.bolum_id`
zorunlu, `borc_sorumlusu` tarihsel snapshot.

**Karar** ([ADR-0010](docs/adr/log/0010-cari-hesap-bolum-yardimci-defteri.md)):
cari hesap ayrÄ± bir varlÄ±k deÄŸil, **kontrol hesabÄ± `120` ile mutabÄ±k olan bÃ¶lÃ¼m
bazlÄ± yardÄ±mcÄ± defterdir.** KiÅŸi ekstresi bir **gÃ¶rÃ¼nÃ¼mdÃ¼r**
(`borc_sorumlusu` sÃ¼zgeci), ayrÄ± defter deÄŸil. YardÄ±mcÄ± defter â†” kontrol hesabÄ±
uyuÅŸmazlÄ±ÄŸÄ± **dÃ¶nem kapanÄ±ÅŸÄ±nÄ± bloke eder.**

#### Karar netleÅŸince gÃ¶rÃ¼nen GERÃ‡EK eksik: `tahsilat` tablosu YOK

Ã–deme bilgisi bugÃ¼n yalnÄ±zca `borc.odenen` ve `borc_sorumlusu.odenen`
kolonlarÄ±nda **yÃ¼rÃ¼yen bir toplam**. SonuÃ§larÄ±:

- **Ekstre Ã¼retilemez** â€” ekstre "borÃ§ satÄ±rÄ± Â· Ã¶deme satÄ±rÄ± Â· yÃ¼rÃ¼yen bakiye"
  ister; Ã¶deme satÄ±rÄ± diye bir kayÄ±t yok.
- **Tahsis izlenemez** â€” bir Ã¶deme birden Ã§ok borcu kapatabilir; hangisine ne
  kadar gittiÄŸi kayÄ±tsÄ±z.
- **Denetlenemez** â€” `odenen` bir UPDATE ile artÄ±yor; kim, ne zaman, hangi
  kanaldan tahsil etti belli deÄŸil. Bu FÄ°NANSAL kayÄ±ttÄ±r ve BFS v1 Â§5.1
  uyarÄ±nca deÄŸiÅŸtirilemez olmalÄ±ydÄ±.
- **Makbuz numarasÄ± baÄŸlanamaz** â€” boÅŸluksuz seri hazÄ±r ama baÄŸlanacak Ã¶deme
  kaydÄ± yok.
- **Banka mutabakatÄ± yarÄ±m kalÄ±yor** â€” 0016 ile aidat tahsilatÄ± arasÄ±nda baÄŸ
  yok; para hesaba girdi ama hangi borcu kapattÄ±ÄŸÄ± kayÄ±tsÄ±z.

> âš ï¸ `odenen` kolonu, Ã¶deme kaydÄ± olmadan da **doÄŸru gÃ¶rÃ¼nÃ¼r.** Toplam tuttuÄŸu
> iÃ§in Ã¶deme geÃ§miÅŸinin var olduÄŸu sanÄ±lÄ±r; oysa yoktur. Eksiklik ancak ekstre
> Ã¼retmeye Ã§alÄ±ÅŸÄ±nca ortaya Ã§Ä±kar.

**FAZ 2 kapsamÄ±:** (1) `tahsilat` â€” FÄ°NANSAL, silinmez; kanal Â· makbuz no Â·
`banka_hareketi_id?` Â· `yevmiye_fisi_id?` Â· (2) `tahsilat_tahsisi` â€” Î£ tahsis =
tahsilat tutarÄ±; `borc.odenen` bundan **tÃ¼retilir**, elle yazÄ±lmaz Â·
(3) bÃ¶lÃ¼m cari ekstresi Â· (4) kiÅŸi ekstresi (aynÄ± motor, sÃ¼zgeÃ§) Â·
(5) yardÄ±mcÄ± defter â†” kontrol hesabÄ± mutabakat denetimi.

#### Makbuzlar talebinden KARÅILANMAYANLAR â€” aÃ§Ä±kÃ§a eksik

KullanÄ±cÄ± 17 alt modÃ¼l istedi. KarÅŸÄ±lanan: **Tahsilat Makbuzu Â· DetaylÄ±
Tahsilat GiriÅŸi Â· Makbuz Ä°ptali Â· Makbuz GeÃ§miÅŸi** (+ Makbuz YazdÄ±r yalnÄ±zca
tarayÄ±cÄ± yazdÄ±rmasÄ±). KarÅŸÄ±lanmayanlar ve **nedenleri**:

| Ä°stenen | Neden yapÄ±lmadÄ± |
|---|---|
| **PDF OluÅŸtur** (otomatik) | PDF kÃ¼tÃ¼phanesi kararÄ± verilmedi (FAZ 4). Ekran ÅŸu an `window.print()` kullanÄ±r â€” gerÃ§ek PDF deÄŸildir ve Ã¶yle sunulmuyor |
| **E-posta Â· SMS Â· WhatsApp** | Bildirim altyapÄ±sÄ± **yok**. AyrÄ±ca ticari elektronik ileti **Ä°YS kapsamÄ± belirsiz** ve bu, belgelerde aÃ§Ä±k bir bloke (`04-CAKISMA-KAYDI.md` C-6). SaÄŸlayÄ±cÄ± seÃ§ilmeden gÃ¶nderim yazmak, mevzuata aykÄ±rÄ± ileti Ã¼retebilirdi |
| **Ä°ade Makbuzu** | Ä°ade kavramÄ± TANIMSIZ. ADR-0010 negatif tahsilatÄ± yasakladÄ±; iade ayrÄ± bir kayÄ±t tipi ve karÅŸÄ±lÄ±k hesabÄ± ister. Uydurmak yerine bÄ±rakÄ±ldÄ± |
| **BorÃ§ Makbuzu Â· Toplu/Otomatik BorÃ§landÄ±rma Â· Gider/Gelir DaÄŸÄ±tÄ±mÄ±** | Bunlar **tahsilat deÄŸil TAHAKKUK** iÅŸlemleridir ve `TahakkukModule`'e aittir (API var, ekran yok). Makbuz modÃ¼lÃ¼ne kopyalamak aynÄ± daÄŸÄ±tÄ±m mantÄ±ÄŸÄ±nÄ± ikinci kez yazmak olurdu |
| **Devir Bakiye GiriÅŸi** | Muhasebe **aÃ§Ä±lÄ±ÅŸ fiÅŸi** ile yapÄ±lÄ±r (`DonemServisi.acilisFisiUret` mevcut). Cari devir bakiyesi iÃ§in ayrÄ± bir akÄ±ÅŸ gerekir; kontrol hesabÄ± mutabakatÄ±nÄ± bozmadan yazÄ±lmalÄ± |
| **Toplu Tahsilat** | Tek tahsilat Ã§ekirdeÄŸi yeni oturdu. Toplu akÄ±ÅŸ, kÄ±smÃ® baÅŸarÄ±sÄ±zlÄ±kta ne olacaÄŸÄ±na (hepsi mi geri alÄ±nÄ±r) dair karar ister |
| **Makbuz versiyonlama** | Makbuz Ä°PTAL edilir, sÃ¼rÃ¼mlenmez (VUK: numara korunur). "Versiyon" isteniyorsa Belge modÃ¼lÃ¼ zaten sÃ¼rÃ¼mlÃ¼yor; makbuz PDF'i oraya `varlikTipi = TAHSILAT` ile baÄŸlanabilir â€” 0017 bu enum deÄŸerini ekledi |
| **Geri Al arayÃ¼zÃ¼** | Backend tamam (`/geri-alma`), ekran yok |

#### FAZ 2 nerede kaldÄ± â€” YARIM, kalan iÅŸ net

| Katman | Durum |
|---|---|
| **ADR-0010** â€” cari = bÃ¶lÃ¼m yardÄ±mcÄ± defteri | âœ… yazÄ±ldÄ±, commit edildi |
| **Migration 0017** â€” `tahsilat` + `tahsilat_tahsisi` + `CARI_KONTROL` | âœ… **uygulandÄ±** (48 tablo, RLS taramasÄ± temiz) |
| **Prisma modelleri** + 7 ters iliÅŸki + client | âœ… tamam |
| **Domain** `shared/apartman-domain/src/tahsilat` | âœ… tamam â€” **32 birim testi** |
| **Backend `modules/tahsilat`** | âš ï¸ **YALNIZCA DTO yazÄ±ldÄ±.** Servisler Â· controller Â· module YOK |
| CanlÄ± test | âŒ yapÄ±lamadÄ± (uÃ§ yok) |

**SÄ±radaki oturumun ilk iÅŸi â€” `backend/src/modules/tahsilat/` tamamlamak.**
DTO hazÄ±r (`dto/tahsilat.dto.ts`); yazÄ±lacaklar:

1. `tahsilat.command.service.ts`
   - `ekle` â€” `tahsilatiDogrula` + `tahsisleriDogrula`, makbuz no
     `NumaraServisi.tahsisEt(tx, {seriKodu: 'MAKBUZ'})`, tahsis satÄ±rlarÄ±,
     **ardÄ±ndan `borc.odenen` ve `borc_sorumlusu.odenen` YENÄ°DEN HESAPLANIR**
     (Î£ tahsis) â€” asla `increment` ile artÄ±rÄ±lmaz.
   - `iptal` â€” `tahsilatIptalEdilebilirMi` (muhasebeleÅŸmiÅŸse RED), tahsisler
     silinir, `odenen` yeniden hesaplanÄ±r, `durum = IPTAL` + gerekÃ§e.
   - `muhasebelestir` â€” `FisCommandServisi.ekleIslemde` ile **aynÄ±
     transaction'da** (banka modÃ¼lÃ¼ndeki desen). BorÃ§ tarafÄ± kanala gÃ¶re:
     NAKIT â†’ `varsayilanKasaHesapId`, BANKA/POS â†’ banka hareketinin hesabÄ± ya
     da `varsayilanBankaHesapId`. Alacak tarafÄ± **`ozellik = CARI_KONTROL`**
     hesabÄ±. CEK/SENET/MAHSUP iÃ§in hesap tanÄ±mÄ± yok â†’ **aÃ§Ä±k hata mesajÄ±yla
     reddedilmeli**, uydurma hesap seÃ§ilmemeli.
2. `cari.query.service.ts` â€” `cariEkstre` (bÃ¶lÃ¼m), kiÅŸi ekstresi
   (`borc_sorumlusu` sÃ¼zgeci), `alacakYaslandirmasi`, `otomatikTahsis`
   Ã¶nizlemesi (**YAZMAZ**), `kontrolMutabakati`.
3. `tahsilat.controller.ts` + `tahsilat.module.ts` (+ `app.module.ts` kaydÄ±).
   Yetki: okuma `FINANS_BORCLU_DETAY`/`FINANS_DEFTER_GORUNTULE`, yazma
   `FINANS_TAHSILAT`, makbuz `FINANS_MAKBUZ`, muhasebeleÅŸtirme
   `FINANS_YEVMIYE_GIRIS`.
4. `DonemServisi.kapat` iÃ§ine **kontrol mutabakatÄ± bloÄŸu**: uyuÅŸmazlÄ±k
   kapanÄ±ÅŸÄ± engeller (ADR-0010).

> âš ï¸ Domain kurallarÄ± hazÄ±r ve testli ama **hiÃ§bir uÃ§tan Ã§aÄŸrÄ±lmÄ±yor.** Bu
> durum 0004/0005'te yaÅŸananÄ±n aynÄ±sÄ±dÄ±r: kural katmanÄ± var, kalÄ±cÄ±lÄ±k var,
> arada uÃ§ yok. `git grep tahsisleriDogrula` bugÃ¼n yalnÄ±zca testte eÅŸleÅŸir.

**Kapsam dÄ±ÅŸÄ± ve aÃ§Ä±kÃ§a eksik:** tedarikÃ§i carisi, personel bordro/avans
defteri, `120` kontrol hesabÄ±nÄ±n `HesapOzelligi` ile iÅŸaretlenmesi. Bunlar
ADR-0010'da bekleyen karar olarak kayÄ±tlÄ± â€” **uydurma veriyle ekran
Ã¼retilmeyecek.**

### Ä°lk gÃ¶rev â€” `/belgeler` ekranÄ± (menÃ¼de Ã¶lÃ¼ link)

**En dÃ¼ÅŸÃ¼k maliyet, en gÃ¶rÃ¼nÃ¼r kazanÃ§.** `components/uygulama-kabugu.tsx`
menÃ¼sÃ¼nde `/belgeler` girdisi var ama `app/belgeler/` **yok**; link 404
veriyor. Backend Belge modÃ¼lÃ¼ **tam** (versiyonlama Â· kategori Â· Ã§oklu iliÅŸki Â·
etiket Â· arama Â· gizlilik Â· Ã¶nizleme Â· KVKK imha) ve MinIO baÄŸlÄ±.

EkranÄ±n taÅŸÄ±masÄ± gerekenler (backend hazÄ±r):

- YÃ¼kleme **iki adÄ±mlÄ±dÄ±r**: `POST /belgeler/yukleme-izni` â†’ Ã¶nimzalÄ± URL'ye
  `PUT` â†’ `POST /belgeler`. Dosya API'den geÃ§mez.
- SÃ¼rÃ¼m geÃ§miÅŸi zinciri; gÃ¼ncel sÃ¼rÃ¼m silinemez.
- Kategori Â· etiket Â· tarih aralÄ±ÄŸÄ± Â· iliÅŸki (apartman/blok/bÃ¶lÃ¼m/kiÅŸi) sÃ¼zgeci.
- "GeÃ§erliliÄŸi dolanlar" listesi.
- Gizlilik yÃ¼kseltilebilir, DÃœÅÃœRÃœLEMEZ â€” arayÃ¼z dÃ¼ÅŸÃ¼rmeyi teklif etmemeli.
- Ã–nizleme yalnÄ±zca betik taÅŸÄ±yamayan tiplerde (PDF Â· resim Â· dÃ¼z metin).

### Ä°kinci gÃ¶rev â€” Tahakkuk SihirbazÄ±

BoÅŸluk analizinin 2. Ã¶nceliÄŸi: sistemin **para Ã¼reten tek akÄ±ÅŸÄ±** ve ekranÄ±
yok. AyrÄ±ntÄ±lÄ± kapsam aÅŸaÄŸÄ±da.

> SÄ±ralamanÄ±n tamamÄ± ve gerekÃ§eleri:
> [`docs/V23-V24-BOSLUK-ANALIZI.md`](docs/V23-V24-BOSLUK-ANALIZI.md) Â§5.
> KÄ±saca: (3) Muhasebe ekranÄ± Â· (4) Malik/KiracÄ± liste ekranlarÄ± Â·
> (5) **v24 iskeleti** (Ä°ÅŸ Emri + Onay AkÄ±ÅŸÄ± + Bildirim Merkezi â€” "Teknik
> Ä°ÅŸler", "AÃ§Ä±k Ä°ÅŸ Emirleri" ve personel gÃ¶rev onayÄ±nÄ±n ORTAK temeli; Ã¼Ã§Ã¼nÃ¼
> ayrÄ± kurmak Ã¼Ã§ farklÄ± onay mekanizmasÄ± doÄŸurur) Â· (6) personel gÃ¶rev
> yÃ¼rÃ¼tme akÄ±ÅŸÄ± Â· (7) v23 pano derinliÄŸi.

### Tahakkuk SihirbazÄ± â€” kapsam

KullanÄ±cÄ± bu iÅŸi tarif etti ama bÃ¼tÃ§e Belge + Site Personeli / Daire GÃ¶revlisi
ayrÄ±mÄ± + hÄ±zlÄ± kayÄ±t + PortfÃ¶y Merkezi'ne gitti; **hiÃ§ baÅŸlanmadÄ±**.

Talep edilen kapsam (kullanÄ±cÄ±nÄ±n kendi sÃ¶zleriyle: *"ticari muhasebe
mantÄ±ÄŸÄ±yla deÄŸil, Kat MÃ¼lkiyeti Kanunu ve profesyonel site yÃ¶netimi
mantÄ±ÄŸÄ±yla"*):

**1. Motorun desteklemesi gereken tahakkuk tÃ¼rleri.** BugÃ¼n `PaylasimKurali`
ekseni var (ESIT Â· ARSA_PAYI Â· BRUT_M2 Â· NET_M2 Â· TUKETIM Â· SABIT_TUTAR Â·
KULLANIM_BAZLI Â· BLOK_BAZLI Â· MANUEL Â· KARMA) ama bunlar *nasÄ±l daÄŸÄ±tÄ±lacaÄŸÄ±*.
Eksik olan *ne olduÄŸu*: **aidat Â· avans Â· ek bÃ¼tÃ§e Â· demirbaÅŸ Â· gecikme
tazminatÄ±**. Bunlar yeni bir eksen (`TahakkukTuru`) ister; paylaÅŸÄ±m kuralÄ±yla
karÄ±ÅŸtÄ±rÄ±lmamalÄ±:
   - **Avans** ileriki dÃ¶neme mahsuptur; Ã¶dendiÄŸinde borÃ§ kapatmaz, alacak
     doÄŸurur (KMK md. 20 iÅŸletme projesi avansÄ±).
   - **Ek bÃ¼tÃ§e** genel kurul kararÄ± ister â€” `kaynakReferansi` zorunlu olmalÄ±.
   - **DemirbaÅŸ** MALÄ°KE aittir (KMK md. 20/b), kiracÄ±ya yansÄ±tÄ±lamaz.
   - **Gecikme tazminatÄ±** KMK md. 20/son: aylÄ±k **%5**'i geÃ§emez ve ANA
     BORÃ‡TAN AYRI bir kalemdir; ana borca eklenip Ã¼zerine yeniden faiz
     iÅŸletilirse bileÅŸik faize dÃ¶nÃ¼ÅŸÃ¼r ve talep edilemez hale gelir.

**2. Ã–nizlemede denetim listesi.** BugÃ¼n Ã¶nizleme daÄŸÄ±tÄ±mÄ± gÃ¶steriyor.
Eklenmesi istenen kontroller: borÃ§lular Â· paylaÅŸÄ±m kurallarÄ± Â· **muafiyetler**
Â· **yÃ¶netim planÄ± istisnalarÄ±** Â· **genel kurul kararlarÄ±** Â· **geÃ§miÅŸ
tahakkuklar**. BunlarÄ±n bir kÄ±smÄ± iÃ§in veri kaynaÄŸÄ± henÃ¼z yok (yÃ¶netim planÄ±
istisnasÄ± ve genel kurul kararÄ± yalnÄ±zca `kaynakReferansi` metni olarak var) â€”
**Ã¶nce o eksik netleÅŸtirilmeli**, uydurma alan eklenmemeli.

**3. Geriye dÃ¶nÃ¼k deÄŸiÅŸmezlik ve dÃ¼zeltme akÄ±ÅŸlarÄ±.** BugÃ¼n tahakkuk yazÄ±ldÄ±ktan
sonra deÄŸiÅŸtirilemiyor (iyi) ama dÃ¼zeltme YOLU YOK. Gereken Ã¼Ã§ kayÄ±t tipi:
   - **Ä°ptal** (ters kayÄ±t / storno) â€” borÃ§ sÄ±fÄ±rlanÄ±r, iki kayÄ±t da durur.
   - **Mahsup** â€” fazla tahsilat sonraki dÃ¶neme sayÄ±lÄ±r.
   - **Devir** â€” kapanmayan borÃ§ sonraki dÃ¶neme taÅŸÄ±nÄ±r.
   `borc` tablosu FINANSAL sÄ±nÄ±ftÄ±r ve silinmez; bu Ã¼Ã§Ã¼ yeni satÄ±r olarak
   yazÄ±lmalÄ± ve orijinale referans vermeli (`ters_kayit_id` gibi).

HazÄ±r olan altyapÄ±: `POST /tahakkuk/calistir` Ã¶nizlemeli Ã§alÄ±ÅŸÄ±yor,
`satirlar[].sorumlular` her bÃ¶lÃ¼m iÃ§in borcun kime yazÄ±lacaÄŸÄ±nÄ±
(malik/kiracÄ±/sakin Â· ASIL/Ä°KÄ°NCÄ°L) gÃ¶steriyor â€” **onay ekranÄ±nÄ±n asÄ±l deÄŸeri
budur**, yÃ¶netici parayÄ± kimden isteyeceÄŸini uygulamadan Ã–NCE gÃ¶rÃ¼r. SayaÃ§
entegrasyonu da hazÄ±r: eksik okuma varsa uÃ§ 422 dÃ¶ner ve eksik kapÄ±
numaralarÄ±nÄ± yazar.

| Sihirbaz adÄ±mÄ± | UÃ§ |
|---|---|
| 1. Gider tÃ¼rÃ¼ seÃ§ | `GET /gider-turleri?yalnizcaAktif=true` |
| 2. Tutar Â· dÃ¶nem Â· vade | â€” |
| 3. TUKETIM ise sayaÃ§ tÃ¼rÃ¼ | `GET /sayaclar/tuketim/donem` |
| 4. DaÄŸÄ±tÄ±mÄ± ve borÃ§lularÄ± gÃ¶r | `POST /tahakkuk/calistir` + `onizleme: true` |
| 5. Onayla ve uygula | aynÄ± uÃ§, `onizleme` olmadan |

---

## 5. Bu oturumda alÄ±nan Ã¶nemli kararlar

Hepsi geri alÄ±nabilir; nedenleri burada yazÄ±lÄ± ki tartÄ±ÅŸÄ±labilsin.

| Karar | GerekÃ§e | Nerede |
|---|---|---|
| **0001 ve 0002 tek temele birleÅŸtirildi** | 0001 uygulanamaz durumdaydÄ± (tablo DDL'i yoktu) ve ikisi de hiÃ§bir veritabanÄ±na uygulanmamÄ±ÅŸtÄ±. AyrÄ± tutmak, 0001 dÃ¶nemine ait kurgusal bir ÅŸema uydurmayÄ± gerektirirdi. | `migrations/0001_init` baÅŸlÄ±ÄŸÄ± |
| **GiriÅŸ iÃ§in RLS'siz `oturum_dizini` katalogu** | `kullanici` RLS taÅŸÄ±r, giriÅŸ tenant'Ä± bilmeden okumak zorunda. Reddedilenler: BYPASSRLS'li rol (ele geÃ§irilirse izolasyon tÃ¼mÃ¼yle kalkar), SECURITY DEFINER (FORCE RLS sahibi de kapsar), giriÅŸte tÃ¼m tenant'larÄ± dolaÅŸmak (10 000 tenant = 10 000 sorgu). Senkronu **trigger** tutar. | `migrations/0002_oturum_dizini` |
| **Ä°stek baÄŸlamÄ± interceptor'dan middleware'e alÄ±ndÄ±** | NestJS sÄ±rasÄ± middleware â†’ guard â†’ interceptor. BaÄŸlam interceptor'da kurulunca ÃœÃ§ KapÄ± ona yazamÄ±yordu ve **bÃ¼tÃ¼n yazma uÃ§larÄ±** 403 dÃ¶nÃ¼yordu. | `common/context/correlation.middleware.ts` |
| **`tenant.setup` YÃ¶netim Åirketi'ne taÅŸÄ±ndÄ±** | Yeni yerleÅŸke aÃ§mak onboarding iÅŸlemidir; tek bina yÃ¶neten rolde olmamalÄ±. Belgelerde yetki matrisi **yok** â€” bu bir yorum, farklÄ± isteniyorsa tek yerden deÄŸiÅŸir. | `shared/core-domain/src/yetki/roller.ts` |
| **`prisma migrate diff` Ã§Ä±ktÄ±sÄ± elle sÃ¼zÃ¼lÃ¼r** | Diff, ÅŸemada karÅŸÄ±lÄ±ÄŸÄ± olmayan elle yazÄ±lmÄ±ÅŸ kÄ±smi index'leri dÃ¼ÅŸÃ¼rmek ister; uygulanÄ±rsa mÃ¼kerrer tahakkuk numarasÄ± sessizce mÃ¼mkÃ¼n olur. Migration'lar elle yazÄ±lÄ±yor. | `migrations/0004` Â· `0005` Â· `0006` |
| **Dosya API'den geÃ§mez (Ã¶nimzalÄ± URL)** | 50 MB'lÄ±k bir belgeyi Node Ã¼zerinden akÄ±tmak olay dÃ¶ngÃ¼sÃ¼nÃ¼ tÄ±kar; iÃ§erik hiÃ§ uygulama belleÄŸine girmez. Bedeli: dosyasÄ±z kayÄ±t riski â€” `HeadObject` ile kapatÄ±ldÄ±. | `common/storage/nesne-deposu.service.ts` |
| **Yeni baÄŸÄ±mlÄ±lÄ±klar: `@aws-sdk/client-s3`, `unplugin-swc`** | S3 imzalama elle yazÄ±lamayacak kadar gÃ¼venlik-kritik. `unplugin-swc` olmadan sÃ¶zleÅŸme testleri hiÃ§ koÅŸamÄ±yordu (esbuild `emitDecoratorMetadata` desteklemez). | `backend/package.json` |
| **Personel `kisi` tablosuna KONULMADI** | `Kisi` malik/kiracÄ±/sakin iliÅŸkilerinin dayandÄ±ÄŸÄ± kimlik kaydÄ±; personel bir istihdam kaydÄ±. AynÄ± tabloda olsaydÄ± bir kapÄ±cÄ±nÄ±n o binada kiracÄ± olmasÄ± durumunda "iÅŸten ayrÄ±ldÄ±" iÅŸareti kiracÄ±lÄ±k kaydÄ±nÄ± da etkilerdi. KullanÄ±cÄ± "Malik/KiracÄ±/Sakin'e dokunma" dedi; ayrÄ± tablo bunu garanti eder. | `migrations/0008` |
| **`kisi` API'si KALDIRILMADI, yalnÄ±zca menÃ¼ girdisi kaldÄ±rÄ±ldÄ±** | `POST /kisiler`, bir malik/kiracÄ±/sakin eklemenin TEK yoludur (hepsi var olan `kisiId` ister). KaldÄ±rÄ±lsaydÄ± kullanÄ±cÄ±nÄ±n korunmasÄ±nÄ± istediÄŸi Ã¼Ã§ modÃ¼l Ã§alÄ±ÅŸamaz hale gelirdi. MenÃ¼deki "KiÅŸiler" girdisi zaten var olmayan bir rotayÄ± gÃ¶steriyordu; o kaldÄ±rÄ±ldÄ±. | `uygulama-kabugu.tsx` |
| **Etiket ASCII katlanÄ±r, TÃ¼rkÃ§e katlanmaz** | Etiket bir KÄ°MLÄ°KTÄ°R. `'ACIL'.toLocaleLowerCase('tr')` â†’ `'acÄ±l'` verir (noktasÄ±z I'nÄ±n kÃ¼Ã§Ã¼ÄŸÃ¼ Ä±'dÄ±r); dilbilgisel olarak doÄŸru ama caps lock ile yazan kullanÄ±cÄ±nÄ±n etiketi "acil" ile eÅŸleÅŸmezdi. Prose aramasÄ±nda (ad/notlar) TÃ¼rkÃ§e katlama doÄŸru olandÄ±r â€” ayrÄ±m korunmalÄ±. | `shared/apartman-domain/src/belge/belge.ts` |
| **Site Personeli ile Daire GÃ¶revlisi AYRI tablolara ayrÄ±ldÄ±** | 0009'da ikisi tek tabloda birleÅŸtirilmiÅŸti; bu hataydÄ±. Ä°ÅŸveren farklÄ±dÄ±r (yÃ¶netim â†” malik/kiracÄ±), dolayÄ±sÄ±yla SGK/vardiya/zimmet yÃ¼kÃ¼mlÃ¼lÃ¼ÄŸÃ¼, KVKK veri sorumlusu ve TC tekillik kapsamÄ± da farklÄ±dÄ±r. Tek tabloda tutmak yÃ¶netimi, olmadÄ±ÄŸÄ± bir iliÅŸkide iÅŸveren gibi gÃ¶sterirdi. 0008 uygulanmÄ±ÅŸ olduÄŸu iÃ§in **dÃ¼zenlenmedi**, 0010 ile taÅŸÄ±ndÄ±. | `migrations/0010_site_personeli_ayrimi` |
| **Misafir ve daire gÃ¶revlisi `Kisi` kaydÄ± AÃ‡MAZ** | Ä°kisi de hak sahibi deÄŸildir: borÃ§ sorumlusu olmaz, tahakkuka girmez, arsa payÄ± taÅŸÄ±maz. `Kisi`ye yazÄ±lsalardÄ± malik/kiracÄ± listelerine karÄ±ÅŸÄ±r ve borÃ§ sorumluluÄŸu sorgularÄ±nda gÃ¶rÃ¼nÃ¼rlerdi. Misafirde ayrÄ±ca KVKK: verisi kÄ±sa Ã¶mÃ¼rlÃ¼dÃ¼r, kalÄ±cÄ± kimlik kaydÄ± yanlÄ±ÅŸ Ã¶mre baÄŸlardÄ±. | `migrations/0011` Â· `misafir.service.ts` |
| **Kefil ayrÄ± `Kisi` DEÄÄ°L, sÃ¶zleÅŸme Ã¼zerinde inline** | YÃ¶netimin ortak gider alacaÄŸÄ± malike (KMK md. 20) ve kiracÄ±ya (md. 22, kira bedeli kadar mÃ¼teselsil) yÃ¶nelir; **kefile yÃ¶nelmez** â€” kefalet kira sÃ¶zleÅŸmesinin tarafÄ±dÄ±r, yÃ¶netim planÄ±nÄ±n deÄŸil. AyrÄ± kimlik kaydÄ± borÃ§ sorumluluÄŸu sorgularÄ±nda gÃ¶rÃ¼nÃ¼rdÃ¼. | `migrations/0012_kiraci_kefil` |
| **Tek araÃ§ kÃ¼tÃ¼ÄŸÃ¼ + kapsam ayrÄ±mÄ±** | Otopark kapasitesi malik aracÄ±yla bakÄ±cÄ±nÄ±n/gÃ¼venliÄŸin aracÄ±nÄ± ayÄ±rt etmez; ayrÄ± tablolar sayÄ±mÄ± bÃ¶lerdi. Ama **personel aracÄ± yÃ¶netime**, diÄŸerleri **ilgili bÃ¶lÃ¼me** kayÄ±tlÄ±dÄ±r: personel aracÄ±nÄ± daireye yazmak o dairenin otopark hakkÄ±nÄ± tÃ¼ketmiÅŸ gÃ¶sterir ve KULLANIM_BAZLI daÄŸÄ±tÄ±mda ona fazla pay Ã§Ä±karÄ±r. | `migrations/0011` Â· `0013_arac_kapsami` |
| **`kisiId` zorunluluÄŸu kalktÄ±; tekilleÅŸtirme TC + e-postaya devredildi** | ZorunluluÄŸun asÄ±l iÅŸlevi mÃ¼kerrer kimlik kaydÄ±nÄ± engellemekti. KaldÄ±rÄ±rken bu koruma bÄ±rakÄ±lsaydÄ± aynÄ± kiÅŸi iki `Kisi` satÄ±rÄ±na bÃ¶lÃ¼nÃ¼r ve borÃ§ geÃ§miÅŸi, tahakkuk sorumluluÄŸu, KVKK silme talebi iki kayda daÄŸÄ±lÄ±rdÄ±. `kisi_eposta_uq` tenant genelinde tekil olduÄŸu iÃ§in e-posta da kimlik anahtarÄ± sayÄ±ldÄ±. | `common/kayit/hizli-kayit.ts` |
| **PortfÃ¶y, RLS gevÅŸetilerek DEÄÄ°L aÃ§Ä±k devirle Ã§Ã¶zÃ¼ldÃ¼** | ADR-0002 kolay yolu (RLS by-pass / `BYPASSRLS` rolÃ¼) ismiyle yasaklamÄ±ÅŸ ve Ã§Ã¶zÃ¼m yolunu ÅŸimdiden yazmÄ±ÅŸtÄ±. Devir modeli **yetkilendirme ile izolasyonu ayÄ±rÄ±r**: firma neye eriÅŸeceÄŸini devir kaydÄ±ndan Ã¶ÄŸrenir, ama her sorgu yine tek tenant baÄŸlamÄ±nda koÅŸar. Devir kaydÄ± silinse bile RLS ayakta kalÄ±r. | [ADR-0009](docs/adr/log/0009-yonetim-sirketi-acik-devir.md) |
| **Devir yetkisi KapÄ± 2'de doÄŸrulanÄ±r, projede `kullanici` kaydÄ± AÃ‡ILMAZ** | Firma kullanÄ±cÄ±sÄ±nÄ± her projeye kopyalamak, KVKK silme talebinde kiÅŸinin kaÃ§ tenant'a yayÄ±ldÄ±ÄŸÄ±nÄ± takip edilemez kÄ±lardÄ±. Bunun yerine jeton `dvr` claim'i taÅŸÄ±r ve KapÄ± 2 aktif devri sorgular. | `common/guards/tenant.guard.ts` |
| **Devir doÄŸrulamasÄ± Ã–NBELLEKLENMEZ** | Ãœyelik 5 dk Ã¶nbelleklenir (deÄŸiÅŸimi nadir, etkisi sÄ±nÄ±rlÄ±). Devrin sona ermesi bir YETKÄ° KALDIRMADIR; 5 dakika boyunca geÃ§erli gÃ¶rÃ¼nmesi kabul edilemez. | `common/prisma/tenant.reader.ts` |
| **`Tenant.olustur` Ã¼Ã§ tipi de kabul ediyor; birim testi buna gÃ¶re GÃœNCELLENDÄ°** | Test "yalnizca APARTMAN kabul edilir" diye assert ediyordu. O kÄ±sÄ±t kaynaÄŸÄ±n kendisinde "v1 kapsamÄ±nda" diye yazÄ±lmÄ±ÅŸ geÃ§ici bir kÄ±sÄ±ttÄ±; ADR-0008 SITE'yi, ADR-0009 YONETIM_SIRKETI'ni kapsama aldÄ±. Testi olduÄŸu gibi bÄ±rakmak, kararÄ± koda yansÄ±tmayÄ± imkÃ¢nsÄ±z kÄ±lardÄ±. | `tests/unit/domain.smoke.mjs` |

---

## 6. Sonraki oturumda dikkat edilecekler

- **`sistemIslemi` RLS'i ATLAMAZ**, yalnÄ±zca tenant baÄŸlamÄ± **kurmaz**.
  YalnÄ±zca RLS taÅŸÄ±mayan katalog tablolarÄ± (`tenant`, `oturum_dizini`) iÃ§in
  kullanÄ±lÄ±r. `scripts/rls-scan.mjs` bunu denetler.
- **ÃœÃ§ KapÄ± baÄŸlamÄ± middleware'den gelir.** Bir interceptor'da baÄŸlam kurmak
  guard'lara ulaÅŸmaz (NestJS sÄ±rasÄ±: middleware â†’ guard â†’ interceptor).
- **Audit `varlik_id` bir UUID'dir.** BileÅŸik anahtar (`KOD:donem`) yazma
  anÄ±nda patlar; Ã§alÄ±ÅŸtÄ±rmaya kendi kimliÄŸi verilmelidir.
- **Snapshot kuralÄ± Ã¼Ã§ yerde geÃ§erli:** borÃ§ sorumlusu, sayaÃ§ tÃ¼ketimi ve
  belge sÃ¼rÃ¼mÃ¼. ÃœÃ§Ã¼ de yazÄ±ldÄ±ÄŸÄ± anda sabitlenir; sorgu anÄ±nda yeniden
  hesaplanÄ±rsa geÃ§miÅŸ sessizce deÄŸiÅŸir ve tahsil edilmiÅŸ tutarla tutmaz.
- **Yeni bir tenant aÃ§an her yol politikalarÄ± da yazmalÄ±dÄ±r.** Belge saklama
  politikalarÄ± `VARSAYILAN_BELGE_POLITIKALARI` (domain) iÃ§indedir; tohum ve
  `TenantCommandService.olustur` ikisi de oradan okur. ÃœÃ§Ã¼ncÃ¼ bir yol
  eklenirse aynÄ± listeyi kullanmalÄ± â€” politikasÄ±z tenant'ta fatura
  silinebilir hale gelir.
- **Para ve pay hiÃ§bir yerde ondalÄ±k tutulmaz.** KuruÅŸu `Number`'a Ã§evirip
  bÃ¶lmek float yuvarlamasÄ± yapar (`moneyKurustan` kullanÄ±n). Arsa payÄ± ve
  hisse kesirdir (`lib/kesir.ts` Â· `shared/apartman-domain/src/kesir.ts`).
- **Sahte veri Ã¼retilmez.** Backend'i olmayan alanlar `HazirDegil` bileÅŸeniyle
  iÅŸaretlidir.
- **CT-05 disiplini:** kullanÄ±cÄ±ya gÃ¶rÃ¼nen her metin `messages/tr.json`
  iÃ§inde bir i18n anahtarÄ±dÄ±r.
- **Web paketinin birim testi neredeyse yok.** `tests/unit` Ã§oÄŸunlukla
  `shared/*/dist` ve `backend/src/common` derlemesini koÅŸar; `filtre.ts`,
  `csv-oku.ts` ve `lib/kesir.ts` yalnÄ±zca tip denetimi ve derleme ile
  korunuyor. **Ä°stisna:** `lib/sekme-hata.ts` React'ten ayrÄ± tutulduÄŸu iÃ§in
  `tests/unit/sekme-hata.test.mjs` ile test edilir â€” aynÄ± yol, saf mantÄ±ÄŸÄ±
  bileÅŸenden Ã§Ä±kararak baÅŸka web modÃ¼lleri iÃ§in de kullanÄ±labilir.
- **TarayÄ±cÄ± koÅŸum harness'Ä± YOK** (playwright/puppeteer/jsdom kurulu deÄŸil).
  EtkileÅŸimli davranÄ±ÅŸ (sekme deÄŸiÅŸimi, form gÃ¶nderimi) tip denetimi, derleme,
  i18n anahtar denetimi ve saf mantÄ±k testleriyle korunuyor; gerÃ§ek tÄ±klama
  doÄŸrulanmÄ±yor. Sekmeli formlarda bu sÄ±nÄ±r Ã¶zellikle Ã¶nemli.
- **SEKMELÄ° FORMDA GÄ°ZLÄ° ALANDA `required` KULLANILMAZ.** TarayÄ±cÄ± gizli bir
  zorunlu alanÄ± odaklayamaz ve gÃ¶nderimi *sessizce* durdurur. Yeni bir sekme
  eklerken bu kural tekrar hatÄ±rlanmalÄ±.
- **Enum kodlarÄ± iki yerde aynalÄ±:** `frontend/web/lib/kodlar.ts` ve
  `messages/tr.json`. Domain'e yeni kod eklenirse ikisine de eklenmelidir.
- **SÄ°TE PERSONELÄ° â‰  DAÄ°RE GÃ–REVLÄ°SÄ°.** Ä°ÅŸveren farklÄ±dÄ±r ve bu, alan listesini
  belirler: SGK Â· departman Â· vardiya Â· zimmet YALNIZCA site personelinde
  bulunur. Yeni bir alan eklerken "bu yÃ¼kÃ¼mlÃ¼lÃ¼k kimin?" sorusu sorulmalÄ±dÄ±r.
  Ä°ki ekran birbirine gÃ¶nderme yapan bir uyarÄ± satÄ±rÄ± taÅŸÄ±r; kaldÄ±rÄ±lmamalÄ±.
- **i18n anahtarlarÄ± toptan arama-deÄŸiÅŸtirme ile YENÄ°DEN ADLANDIRILAMAZ.**
  0009'da blanket bir `Personel â†’ GÃ¶revli` deÄŸiÅŸimi `yeniPersonel`
  ANAHTARINI `yeniGÃ¶revli` yapÄ±p Next.js'i `MISSING_MESSAGE` ile patlatmÄ±ÅŸtÄ±.
  Bu oturumda `tr.json` **programatik olarak** (JSON dÃ¼zeyinde) ayrÄ±ldÄ±.
- **Kabuk Ã¼zerinden node betiÄŸi yazarken ÅŸablon dizgi kullanmayÄ±n.** `bash -c`
  iÃ§indeki `\`${...}\`` ve `\"` kaÃ§Ä±ÅŸlarÄ± sessizce yeniyor: bu oturumda bir
  Prisma modelinin bÃ¼tÃ¼n `@map("...")` tÄ±rnaklarÄ± kayboldu ve ÅŸema geÃ§ersiz
  hale geldi; baÅŸka bir seferde Malik ile KiracÄ± modellerine yanlÄ±ÅŸ alan
  bloÄŸu yazÄ±ldÄ±. Betikler **dosyaya yazÄ±lÄ±p** `node dosya.mjs` ile koÅŸulmalÄ±.
- **Git Bash `/api/v1` gibi env deÄŸerlerini Windows yoluna Ã§evirir.** Backend'i
  elle baÅŸlatÄ±rken `MSYS_NO_PATHCONV=1` verilmezse API Ã¶neki
  `C:/Program Files/Git/api/v1` olur ve bÃ¼tÃ¼n uÃ§lar 404 dÃ¶ner. AyrÄ±ca giriÅŸ
  noktasÄ± `dist/src/main.js`'tir (`dist/main.js` deÄŸil).
- **Backend Ã§alÄ±ÅŸÄ±rken `prisma generate` EPERM verir.** Motor DLL'i
  (`query_engine-windows.dll.node`) kilitlidir. `pnpm -r build` Ã¶ncesi node
  sÃ¼reÃ§leri durdurulmalÄ±.
- **PORTFÃ–Y Ã–ZETÄ° Ã‡APRAZ-TENANT SORGU DEÄÄ°LDÄ°R.** Proje baÅŸÄ±na ayrÄ±
  `tenantIslemi(projeId)` Ã§aÄŸrÄ±sÄ±dÄ±r. "Tek sorguda toplayalÄ±m" fikri
  ADR-0002'nin ismiyle yasakladÄ±ÄŸÄ± ÅŸeydir; hÄ±zlandÄ±rma yolu da yazÄ±lÄ±dÄ±r â€”
  RLS'i delmek deÄŸil, event ile bakÄ±mÄ± yapÄ±lan Ã¶zet tablolarÄ±
  (IMPLEMENTATION-ROADMAP R-4).
- **Kontrol merkezinde karÅŸÄ±lÄ±ÄŸÄ± olmayan gÃ¶sterge `-1` dÃ¶ner**, sÄ±fÄ±r DEÄÄ°L.
  SÄ±fÄ±r basmak "iÅŸ emri yok" ile "iÅŸ emri modÃ¼lÃ¼ yok" ayrÄ±mÄ±nÄ± gizler.
- **Yetki modeli kararÄ±:** `tenant.setup` Apartman YÃ¶neticisi'nden alÄ±nÄ±p
  YÃ¶netim Åirketi'ne verildi (yeni yerleÅŸke aÃ§mak bir onboarding iÅŸlemidir).
  Belgelerde yetki matrisi yok; farklÄ± isteniyorsa tek yerden deÄŸiÅŸir:
  `shared/core-domain/src/yetki/roller.ts`.

---

*Ä°lgili belgeler:* [`DEVLOG.md`](DEVLOG.md) Â·
[`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) Â·
[`docs/adr/log/`](docs/adr/log/)

