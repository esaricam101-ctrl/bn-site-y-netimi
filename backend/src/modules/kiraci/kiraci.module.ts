import { Module } from '@nestjs/common';
import { KiraciController } from './kiraci.controller';
import { KiraciCommandService } from './kiraci.command.service';
import { KiraciQueryService } from './kiraci.query.service';

@Module({
  controllers: [KiraciController],
  providers: [KiraciCommandService, KiraciQueryService],
  exports: [KiraciQueryService],
})
export class KiraciModule {}
