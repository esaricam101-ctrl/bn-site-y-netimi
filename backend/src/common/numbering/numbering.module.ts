import { Global, Module } from '@nestjs/common';
import { NumaraServisi } from './numara.service';

@Global()
@Module({ providers: [NumaraServisi], exports: [NumaraServisi] })
export class NumberingModule {}
