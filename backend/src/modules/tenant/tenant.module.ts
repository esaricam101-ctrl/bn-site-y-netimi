import { Module } from '@nestjs/common';
import { TenantCommandService } from './tenant.command.service';
import { TenantQueryService } from './tenant.query.service';

@Module({
  providers: [TenantCommandService, TenantQueryService],
  exports: [TenantCommandService, TenantQueryService],
})
export class TenantModule {}
