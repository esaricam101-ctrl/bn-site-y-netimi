import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantCommandService } from './tenant.command.service';
import { TenantQueryService } from './tenant.query.service';

@Module({
  controllers: [TenantController],
  providers: [TenantCommandService, TenantQueryService],
  exports: [TenantCommandService, TenantQueryService],
})
export class TenantModule {}
