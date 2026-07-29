import { Global, Module } from '@nestjs/common';
import { NesneDeposuServisi } from './nesne-deposu.service';

/** Nesne deposu tek örnektir; S3 istemcisi bağlantı havuzu tutar. */
@Global()
@Module({
  providers: [NesneDeposuServisi],
  exports: [NesneDeposuServisi],
})
export class StorageModule {}
