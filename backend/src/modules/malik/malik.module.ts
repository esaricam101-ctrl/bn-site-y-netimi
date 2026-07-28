import { Module } from '@nestjs/common';
import { MalikController } from './malik.controller';
import { MalikCommandService } from './malik.command.service';
import { MalikQueryService } from './malik.query.service';

@Module({
  controllers: [MalikController],
  providers: [MalikCommandService, MalikQueryService],
})
export class MalikModule {}
