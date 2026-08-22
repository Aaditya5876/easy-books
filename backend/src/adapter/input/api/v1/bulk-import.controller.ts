import { Controller, Post, Body, Param, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';
import { BulkImportService } from '../../../../application/services/bulk-import.service';

@ApiTags('Bulk Import')
@ApiBearerAuth()
@Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
@RequiresModule('BULK_IMPORT')
@Controller('api/v1/bulk')
export class BulkImportController {
  constructor(private readonly service: BulkImportService) {}

  @Post(':entity')
  @ApiOperation({ summary: 'Bulk import rows for an entity (students, subjects, books, employees, clients, vendors, inventory)' })
  import(
    @Param('entity') entity: string,
    @Body() body: { companyId: string; rows: any[] },
    @Req() req: any,
  ) {
    // Employees carry salary data — mirror the employee controller's ACCOUNTANT/ADMIN restriction
    if (entity === 'employees' && !['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      throw new ForbiddenException('Only ACCOUNTANT or ADMIN can import employees');
    }
    return this.service.import(entity, body.companyId, body.rows);
  }
}
