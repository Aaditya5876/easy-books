import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PayrollEngineService } from '../../../../application/services/payroll.engine';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/payroll')
export class PayrollController {
  constructor(private readonly engine: PayrollEngineService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get payroll summary for a month' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'month', required: true, example: '2081-01' })
  getSummary(@Query('companyId') companyId: string, @Query('month') month: string) {
    return this.engine.getPayrollSummary(companyId, month);
  }

  @Post('process')
  @ApiOperation({ summary: 'Batch-process payroll for all active employees (queues BullMQ jobs)' })
  process(@Body() body: { companyId: string; month: string }) {
    return this.engine.processMonthlyPayroll(body.companyId, body.month);
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate payroll for a single employee (sync)' })
  calculateOne(@Body() body: { companyId: string; employeeId: string; month: string }) {
    return this.engine.calculateEmployeePayroll(body.companyId, body.employeeId, body.month);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Mark a payroll record as paid' })
  @ApiQuery({ name: 'companyId', required: true })
  markPaid(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.engine.markAsPaid(companyId, id);
  }

  @Patch(':id/hold')
  @ApiOperation({ summary: 'Put payroll on hold or release hold' })
  @ApiQuery({ name: 'companyId', required: true })
  setHold(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { isOnHold: boolean; holdReason?: string },
  ) {
    return this.engine.setHold(companyId, id, body.isOnHold, body.holdReason);
  }
}
