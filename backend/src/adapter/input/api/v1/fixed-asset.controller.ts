import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FixedAssetServiceImpl } from '../../../../application/services/fixed-asset.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';

@ApiTags('Fixed Assets')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@RequiresModule('FINANCE')
@Controller('api/v1/fixed-assets')
export class FixedAssetController {
  constructor(private readonly service: FixedAssetServiceImpl) {}

  @Get()
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiQuery({ name: 'companyId', required: true })
  findById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findById(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Record a fixed asset and post its purchase (INVESTING) entry' })
  create(@Body() body: {
    companyId: string; assetName: string; assetCode?: string; category?: string;
    purchaseDateAd: string; cost: number; usefulLifeYears: number; salvageValue?: number;
    paymentMethod?: 'CASH' | 'BANK' | 'CREDIT'; notes?: string;
  }) {
    const { companyId, ...data } = body;
    return this.service.create(companyId, data);
  }

  @Post('run-depreciation')
  @ApiOperation({ summary: 'Manually run straight-line depreciation for all active assets' })
  runDepreciation(@Body() body: { companyId: string; asOfDateAd: string }) {
    return this.service.runDepreciation(body.companyId, body.asOfDateAd);
  }

  @Post(':id/dispose')
  @ApiOperation({ summary: 'Dispose an asset with full gain/loss accounting' })
  dispose(
    @Param('id') id: string,
    @Body() body: { companyId: string; disposalDateAd: string; disposalAmount: number; paymentMethod?: 'CASH' | 'BANK' },
  ) {
    const { companyId, ...data } = body;
    return this.service.dispose(companyId, id, data);
  }
}
