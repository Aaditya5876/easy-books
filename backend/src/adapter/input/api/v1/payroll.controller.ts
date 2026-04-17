import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PayrollServiceImpl } from '../../../../application/services/payroll.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreatePayrollSchema, UpdatePayrollSchema, CreatePayrollDTO, UpdatePayrollDTO } from '@easy-books/shared';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/payroll')
export class PayrollController {
  constructor(private readonly service: PayrollServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all payroll records' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'month', required: false })
  findAll(
    @Query('companyId') companyId: string,
    @Query('month') month?: string,
  ) {
    return this.service.findAll(companyId, month);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payroll record by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a payroll record' })
  create(@Body(new ZodValidationPipe(CreatePayrollSchema)) dto: CreatePayrollDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a payroll record' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdatePayrollSchema)) dto: UpdatePayrollDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a payroll record' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
