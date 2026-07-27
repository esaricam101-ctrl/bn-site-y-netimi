import { Module } from '@nestjs/common';
import { KisiController } from './kisi.controller';
import { KisiCommandService } from './kisi.command.service';
import { KisiQueryService } from './kisi.query.service';

@Module({
  controllers: [KisiController],
  providers: [KisiCommandService, KisiQueryService],
})
export class KisiModule {}
