import { Module } from '@nestjs/common';
import { SakinController } from './sakin.controller';
import { SakinCommandService } from './sakin.command.service';
import { SakinQueryService } from './sakin.query.service';

@Module({
  controllers: [SakinController],
  providers: [SakinCommandService, SakinQueryService],
  exports: [SakinQueryService],
})
export class SakinModule {}
