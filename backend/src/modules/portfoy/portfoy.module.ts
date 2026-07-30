import { Module } from '@nestjs/common';
import { PortfoyController } from './portfoy.controller';
import { PortfoyServisi } from './portfoy.service';

@Module({
  controllers: [PortfoyController],
  providers: [PortfoyServisi],
})
export class PortfoyModule {}
