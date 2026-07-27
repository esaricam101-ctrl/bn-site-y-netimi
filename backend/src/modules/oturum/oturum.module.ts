import { Module } from '@nestjs/common';
import { OturumController } from './oturum.controller';
import { OturumServisi } from './oturum.service';
import { SifreServisi } from '../../common/security/sifre.service';

@Module({
  controllers: [OturumController],
  providers: [OturumServisi, SifreServisi],
  exports: [SifreServisi],
})
export class OturumModule {}
