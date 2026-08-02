import { Module } from '@nestjs/common';
import { NumberingModule } from '../../common/numbering/numbering.module';
import { MuhasebeModule } from '../muhasebe/muhasebe.module';
import { VirmanController } from './virman.controller';
import { VirmanCommandServisi } from './virman.command.service';

@Module({
  // Virman numarasi BOSLUKSUZ seridir (denetim izi) ve fis uretimi
  // KOPYALANMAZ — ikisi de caginanin transaction'i icinde calisir.
  imports: [NumberingModule, MuhasebeModule],
  controllers: [VirmanController],
  providers: [VirmanCommandServisi],
})
export class VirmanModule {}
