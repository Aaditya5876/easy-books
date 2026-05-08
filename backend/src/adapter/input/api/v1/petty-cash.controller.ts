import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PettyCashServiceImpl } from '../../../../application/services/petty-cash.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Petty Cash')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/petty-cash')
export class PettyCashController {
  constructor(private readonly service: PettyCashServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all petty cash vouchers' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get petty cash summary by date range' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  getSummary(
    @Query('companyId') companyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.service.getSummary(companyId, fromDate, toDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get petty cash voucher by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findById(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a petty cash voucher' })
  @ApiQuery({ name: 'companyId', required: true })
  create(@Query('companyId') companyId: string, @Body() body: any) {
    return this.service.create(companyId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a petty cash voucher' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
