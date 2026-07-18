import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PayrollEngineService } from '../../../../application/services/payroll.engine';
import { Roles } from '../../../../modules/decorators/roles.decorator';

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('api/v1/payroll')
export class PayrollController {
  constructor(private readonly engine: PayrollEngineService) {}

  @Get('summary')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get payroll summary for a month' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'month', required: true, example: '2081-01' })
  getSummary(@Query('companyId') companyId: string, @Query('month') month: string) {
    return this.engine.getPayrollSummary(companyId, month);
  }

  @Post('process')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Batch-process payroll for all active employees (queues BullMQ jobs)' })
  process(@Body() body: { companyId: string; month: string }) {
    return this.engine.processMonthlyPayroll(body.companyId, body.month);
  }

  @Post('calculate')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Calculate payroll for a single employee (sync)' })
  calculateOne(@Body() body: { companyId: string; employeeId: string; month: string }) {
    return this.engine.calculateEmployeePayroll(body.companyId, body.employeeId, body.month);
  }

  @Patch(':id/mark-paid')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mark a payroll record as paid' })
  @ApiQuery({ name: 'companyId', required: true })
  markPaid(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.engine.markAsPaid(companyId, id);
  }

  @Patch(':id/hold')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Put payroll on hold or release hold' })
  @ApiQuery({ name: 'companyId', required: true })
  setHold(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { isOnHold: boolean; holdReason?: string },
  ) {
    return this.engine.setHold(companyId, id, body.isOnHold, body.holdReason);
  }

  @Patch(':id/adjust')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Adjust other deductions on a payroll record and recompute net salary' })
  @ApiQuery({ name: 'companyId', required: true })
  adjust(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: { otherDeductions: number }) {
    return this.engine.adjustPayroll(companyId, id, body.otherDeductions);
  }

  @Get('gratuity')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Calculate gratuity entitlement for an employee (Nepal Labour Act 2074)' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'employeeId', required: true })
  calculateGratuity(@Query('companyId') companyId: string, @Query('employeeId') employeeId: string) {
    return this.engine.calculateGratuity(companyId, employeeId);
  }
}
