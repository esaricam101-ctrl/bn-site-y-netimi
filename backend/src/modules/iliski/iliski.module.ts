import { Module } from '@nestjs/common';
import { IliskiController } from './iliski.controller';
import { IliskiCommandService } from './iliski.command.service';
import { IliskiQueryService } from './iliski.query.service';

@Module({
  controllers: [IliskiController],
  providers: [IliskiCommandService, IliskiQueryService],
})
export class IliskiModule {}
