import { Global, Module } from '@nestjs/common';
import { AuditServisi } from './audit.service';

@Global()
@Module({ providers: [AuditServisi], exports: [AuditServisi] })
export class AuditModule {}
