import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SalesServiceImpl } from '../../../../application/services/sales.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateSalesOrderSchema, UpdateSalesOrderSchema, CreateSalesOrderDTO, UpdateSalesOrderDTO } from '@easy-books/shared';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/sales')
export class SalesController {
  constructor(private readonly service: SalesServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all sales orders' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sales order by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a sales order' })
  create(@Body(new ZodValidationPipe(CreateSalesOrderSchema)) dto: CreateSalesOrderDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a sales order' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateSalesOrderSchema)) dto: UpdateSalesOrderDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sales order' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
