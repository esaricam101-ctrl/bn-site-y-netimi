import { Module } from '@nestjs/common';
import { SitePersoneliController } from './site-personeli.controller';
import { SitePersoneliServisi } from './site-personeli.service';

@Module({
  controllers: [SitePersoneliController],
  providers: [SitePersoneliServisi],
})
export class SitePersoneliModule {}
