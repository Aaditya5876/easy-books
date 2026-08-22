import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BankGuaranteeServiceImpl } from '../../../../application/services/bank-guarantee.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';

@ApiTags('Bank Guarantees')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@RequiresModule('FINANCE')
@Controller('api/v1/bank-guarantees')
export class BankGuaranteeController {
  constructor(private readonly service: BankGuaranteeServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all bank guarantees' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query('companyId') companyId: string, @Query('status') status?: string) {
    return this.service.findAll(companyId, { status });
  }

  @Get('expiring-soon')
  @ApiOperation({ summary: 'Get bank guarantees expiring within N days' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'withinDays', required: false, type: Number })
  findExpiringSoon(@Query('companyId') companyId: string, @Query('withinDays') withinDays?: string) {
    return this.service.findExpiringSoon(companyId, withinDays ? parseInt(withinDays) : 30);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bank guarantee by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findById(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Record a bank guarantee' })
  @ApiQuery({ name: 'companyId', required: true })
  create(@Query('companyId') companyId: string, @Body() body: any) {
    return this.service.create(companyId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update bank guarantee status or notes' })
  @ApiQuery({ name: 'companyId', required: true })
  update(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.update(id, companyId, body);
  }
}
