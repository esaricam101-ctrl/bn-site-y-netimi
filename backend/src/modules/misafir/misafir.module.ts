import { Module } from '@nestjs/common';
import { MisafirController } from './misafir.controller';
import { MisafirServisi } from './misafir.service';

@Module({
  controllers: [MisafirController],
  providers: [MisafirServisi],
})
export class MisafirModule {}
