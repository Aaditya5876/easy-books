import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentServiceImpl } from '../../../../application/services/payment.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/payments')
export class PaymentController {
  constructor(private readonly service: PaymentServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all payments for a company' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get('sales/:salesOrderId')
  @ApiOperation({ summary: 'Get payments for a sales order' })
  @ApiQuery({ name: 'companyId', required: true })
  findBySalesOrder(@Param('salesOrderId') salesOrderId: string, @Query('companyId') companyId: string) {
    return this.service.findBySalesOrder(salesOrderId, companyId);
  }

  @Get('purchases/:purchaseOrderId')
  @ApiOperation({ summary: 'Get payments for a purchase order' })
  @ApiQuery({ name: 'companyId', required: true })
  findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string, @Query('companyId') companyId: string) {
    return this.service.findByPurchaseOrder(purchaseOrderId, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findById(id, companyId);
  }
}
