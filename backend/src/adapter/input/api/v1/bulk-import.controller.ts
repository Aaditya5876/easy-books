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
    // Employees carry salary data — mirror employee.controller.ts's
    // ACCOUNTANT/ADMIN(/HR-tagged STAFF) restriction.
    const isHrStaff = req.user?.role === 'STAFF' && (req.user?.tags || []).includes('HR');
    if (entity === 'employees' && !['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role) && !isHrStaff) {
      throw new ForbiddenException('Only ACCOUNTANT, ADMIN, or HR-tagged STAFF can import employees');
    }
    return this.service.import(entity, body.companyId, body.rows);
  }
}
