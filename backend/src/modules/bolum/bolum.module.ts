import { Module } from '@nestjs/common';
import { BolumController } from './bolum.controller';
import { BolumCommandService } from './bolum.command.service';
import { BolumQueryService } from './bolum.query.service';

@Module({
  controllers: [BolumController],
  providers: [BolumCommandService, BolumQueryService],
  exports: [BolumQueryService],
})
export class BolumModule {}
