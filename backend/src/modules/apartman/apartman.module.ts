import { Module } from '@nestjs/common';
import { ApartmanController } from './apartman.controller';
import { ApartmanCommandService } from './apartman.command.service';
import { ApartmanQueryService } from './apartman.query.service';

@Module({
  controllers: [ApartmanController],
  providers: [ApartmanCommandService, ApartmanQueryService],
})
export class ApartmanModule {}
