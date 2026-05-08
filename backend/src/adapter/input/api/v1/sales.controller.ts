import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SalesServiceImpl } from '../../../../application/services/sales.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/sales')
export class SalesController {
  constructor(private readonly service: SalesServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all sales orders' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  findAll(
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.service.findAll(companyId, { status, clientId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sales order by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a sales order (auto-generates invoice number, deducts stock, posts to ledger)' })
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Record a payment against a sales order' })
  @ApiQuery({ name: 'companyId', required: true })
  recordPayment(@Param('id') salesOrderId: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.recordPayment({ ...body, companyId, salesOrderId });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a sales order (only if not completed)' })
  @ApiQuery({ name: 'companyId', required: true })
  update(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.update(id, companyId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sales order (restores stock, only if not completed)' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
