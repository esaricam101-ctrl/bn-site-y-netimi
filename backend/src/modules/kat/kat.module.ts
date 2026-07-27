import { Module } from '@nestjs/common';
import { KatController } from './kat.controller';
import { KatCommandService } from './kat.command.service';
import { KatQueryService } from './kat.query.service';

@Module({
  controllers: [KatController],
  providers: [KatCommandService, KatQueryService],
})
export class KatModule {}
