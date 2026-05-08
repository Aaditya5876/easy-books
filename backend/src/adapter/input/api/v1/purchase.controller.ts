import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PurchaseServiceImpl } from '../../../../application/services/purchase.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/purchases')
export class PurchaseController {
  constructor(private readonly service: PurchaseServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all purchase orders' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  findAll(
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.service.findAll(companyId, { status, vendorId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase order by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a purchase order (auto-generates number, increases stock, posts to ledger)' })
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Record a payment against a purchase order' })
  @ApiQuery({ name: 'companyId', required: true })
  recordPayment(@Param('id') purchaseOrderId: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.recordPayment({ ...body, companyId, purchaseOrderId });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a purchase order (only if not completed)' })
  @ApiQuery({ name: 'companyId', required: true })
  update(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.update(id, companyId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a purchase order (reverses stock, only if not completed)' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
