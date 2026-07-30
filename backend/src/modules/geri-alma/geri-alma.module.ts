import { Module } from '@nestjs/common';
import { GeriAlmaController } from './geri-alma.controller';
import { GeriAlmaServisi } from './geri-alma.service';

/**
 * GENEL GERİ AL modülü.
 *
 * ⚠️  BAŞKA MODÜL İÇE AKTARILMADI. İlk yazımda `MuhasebeModule` ve
 *     `TahsilatModule` alınmıştı ama o modüllerin komut servisleri KENDİ
 *     transaction'larını açar; geri alma zaten bir transaction içindedir ve
 *     iç içe transaction, dış işlem geri sarıldığında iç işlemin kalıcı
 *     olmasına yol açardı.
 *
 *     Ters kayıt bu yüzden geri almanın kendi transaction'ında yazılır;
 *     kopyalanamayan yollar (fiş storno — dönem denetimi ve fiş numarası
 *     tahsisi ister) AÇIKÇA reddedilir ve kullanıcı ilgili modüle
 *     yönlendirilir. Sessizce yarım bir storno yazmaktansa net bir ret verilir.
 */
@Module({
  controllers: [GeriAlmaController],
  providers: [GeriAlmaServisi],
})
export class GeriAlmaModule {}
