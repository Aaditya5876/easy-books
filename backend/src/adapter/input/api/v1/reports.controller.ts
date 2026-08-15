import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from '../../../../application/services/reports.service';
import { Roles } from '../../../../modules/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('day-book')
  @ApiOperation({ summary: 'Chronological journal of every posted voucher' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  dayBook(
    @Query('companyId') companyId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getDayBook(companyId, dateFrom, dateTo);
  }

  @Get('party-statement')
  @ApiOperation({ summary: "One ledger account's full running history" })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'accountId', required: true })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  partyStatement(
    @Query('companyId') companyId: string,
    @Query('accountId') accountId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getPartyStatement(companyId, accountId, dateFrom, dateTo);
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'All accounts with their debit/credit balances' })
  @ApiQuery({ name: 'companyId', required: true })
  trialBalance(@Query('companyId') companyId: string) {
    return this.service.getTrialBalance(companyId);
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Assets = Liabilities + Equity + Retained Earnings' })
  @ApiQuery({ name: 'companyId', required: true })
  balanceSheet(@Query('companyId') companyId: string) {
    return this.service.getBalanceSheet(companyId);
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Cash movement by Operating/Investing/Financing activity' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  cashFlow(
    @Query('companyId') companyId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getCashFlowStatement(companyId, dateFrom, dateTo);
  }
}
