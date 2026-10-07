import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QuotationServiceImpl } from '../../../../application/services/quotation.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateQuotationSchema, UpdateQuotationSchema, CreateQuotationDTO, UpdateQuotationDTO } from '@easy-books/shared';

@ApiTags('Quotations')
@ApiBearerAuth()
@Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
@Controller('api/v1/quotations')
export class QuotationController {
  constructor(private readonly service: QuotationServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all quotations' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a quotation by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Create a quotation' })
  create(@Body(new ZodValidationPipe(CreateQuotationSchema)) dto: CreateQuotationDTO) {
    return this.service.create(dto);
  }

  @Post(':id/convert')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Convert a quotation to a sales order' })
  @ApiQuery({ name: 'companyId', required: true })
  convertToSalesOrder(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.convertToSalesOrder(id, companyId);
  }

  @Put(':id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Update a quotation' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateQuotationSchema)) dto: UpdateQuotationDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Delete a quotation' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
