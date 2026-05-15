import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardServiceImpl } from '../../../../application/services/dashboard.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard summary (revenue, expenses, cash, receivables, payables, payroll)' })
  @ApiQuery({ name: 'companyId', required: true })
  getSummary(@Query('companyId') companyId: string) {
    return this.service.getSummary(companyId);
  }

  @Get('top-clients')
  @ApiOperation({ summary: 'Get top clients by revenue' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopClients(@Query('companyId') companyId: string, @Query('limit') limit?: string) {
    return this.service.getTopClients(companyId, limit ? parseInt(limit) : 5);
  }

  @Get('top-vendors')
  @ApiOperation({ summary: 'Get top vendors by purchase amount' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopVendors(@Query('companyId') companyId: string, @Query('limit') limit?: string) {
    return this.service.getTopVendors(companyId, limit ? parseInt(limit) : 5);
  }

  @Get('pending-receivables')
  @ApiOperation({ summary: 'List all unpaid / partially-paid sales orders' })
  @ApiQuery({ name: 'companyId', required: true })
  getPendingReceivables(@Query('companyId') companyId: string) {
    return this.service.getPendingReceivables(companyId);
  }

  @Get('pending-payables')
  @ApiOperation({ summary: 'List all unpaid / partially-paid purchase orders' })
  @ApiQuery({ name: 'companyId', required: true })
  getPendingPayables(@Query('companyId') companyId: string) {
    return this.service.getPendingPayables(companyId);
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Last 6 months revenue vs expenses trend' })
  @ApiQuery({ name: 'companyId', required: true })
  getSalesTrend(@Query('companyId') companyId: string) {
    return this.service.getSalesTrend(companyId);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Operational alerts: low stock, expiring BGs, overdue cheques' })
  @ApiQuery({ name: 'companyId', required: true })
  getAlerts(@Query('companyId') companyId: string) {
    return this.service.getOperationalAlerts(companyId);
  }

  @Get('hr-summary')
  @ApiOperation({ summary: 'HR snapshot: attendance today, pending leaves, payroll status' })
  @ApiQuery({ name: 'companyId', required: true })
  getHrSummary(@Query('companyId') companyId: string) {
    return this.service.getHrSummary(companyId);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Last 5 sales orders and last 5 purchase orders' })
  @ApiQuery({ name: 'companyId', required: true })
  getRecentActivity(@Query('companyId') companyId: string) {
    return this.service.getRecentActivity(companyId);
  }

  @Get('vat-summary')
  @ApiOperation({ summary: 'VAT collected vs paid this month and net VAT payable' })
  @ApiQuery({ name: 'companyId', required: true })
  getVatSummary(@Query('companyId') companyId: string) {
    return this.service.getVatSummary(companyId);
  }
}
