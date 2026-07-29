import { Module } from '@nestjs/common';
import { BelgeController } from './belge.controller';
import { BelgeServisi } from './belge.service';

@Module({
  controllers: [BelgeController],
  providers: [BelgeServisi],
})
export class BelgeModule {}
