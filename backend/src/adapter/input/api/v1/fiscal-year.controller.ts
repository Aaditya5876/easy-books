import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FiscalYearService } from '../../../../application/services/fiscal-year.service';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';

@ApiTags('Fiscal Year')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@RequiresModule('FINANCE')
@Controller('api/v1/fiscal-year')
export class FiscalYearController {
  constructor(private readonly service: FiscalYearService) {}

  @Get('status')
  @ApiOperation({ summary: 'Current fiscal year, closed-year history, and a preview of what closing the previous year would do' })
  @ApiQuery({ name: 'companyId', required: true })
  status(@Query('companyId') companyId: string) {
    return this.service.getStatus(companyId);
  }

  @Post('close')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Close a fiscal year — posts closing entries zeroing Income/Expense into Retained Earnings. Requires the account password.' })
  close(@Body() body: { companyId: string; fiscalYear: string; password: string }, @Req() req: any) {
    return this.service.closeFiscalYear(body.companyId, body.fiscalYear, req.user?.sub, body.password);
  }

  @Post('reopen')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reopen a closed fiscal year — posts reversing entries. Requires the account password.' })
  reopen(@Body() body: { companyId: string; fiscalYear: string; password: string }, @Req() req: any) {
    return this.service.reopenFiscalYear(body.companyId, body.fiscalYear, req.user?.sub, body.password);
  }
}
