import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditQueryService } from './audit.query.service';

/**
 * Denetim kaydı OKUMA modülü.
 *
 * Yazma tarafı `common/audit/audit.module.ts` içindedir ve orada kalır —
 * her komut servisi ona bağlıdır. Bu modül yalnızca sorgu ucunu açar;
 * dosya adı `audit-sorgu` çünkü `audit.module` adı zaten kullanılıyor.
 */
@Module({
  controllers: [AuditController],
  providers: [AuditQueryService],
})
export class AuditSorguModule {}
