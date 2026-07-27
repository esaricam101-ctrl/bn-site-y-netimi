# @bnos/mobile — React Native (Expo)

Mobil uygulama iskeleti. **Sprint 2** teslimatıdır.

## Neden şimdi iskelet

ADR §1 mobili ilk günden zorunlu kılar. Bu paket, mobilin sonradan
eklenen bir katman olmadığını yapısal olarak garanti eder:

- Tema `@bnos/ui-tokens`'tan gelir — web ile **aynı kaynak**
- API istemcisi aynı Backend uçlarını kullanır
- Platforma özgü iş mantığı **geliştirilmez**

## Sprint 2'de eklenecek

Push bildirimleri · online ödeme · talep yönetimi · yönetici ile mesajlaşma ·
dosya ve fotoğraf yükleme · belge görüntüleme · kamera ile belge tarama ·
offline destek (uygun modüllerde) · senkronizasyon.

Offline sınırının hangi modülleri kapsadığı ADR §25 metni geldiğinde
netleşecektir (backlog O-7).
