import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditLogService } from '../../../../application/services/audit-log.service';
import { Roles } from '../../../../modules/decorators/roles.decorator';

@ApiTags('Audit Log')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('api/v1/audit-logs')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries (who did what, when) — ADMIN only' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('companyId') companyId: string,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({
      companyId,
      userId,
      module,
      action,
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
