import { Module } from '@nestjs/common';
import { BlokController } from './blok.controller';
import { BlokCommandService } from './blok.command.service';
import { BlokQueryService } from './blok.query.service';

@Module({
  controllers: [BlokController],
  providers: [BlokCommandService, BlokQueryService],
})
export class BlokModule {}
