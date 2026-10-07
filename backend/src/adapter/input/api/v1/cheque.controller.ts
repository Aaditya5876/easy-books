import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChequeServiceImpl } from '../../../../application/services/cheque.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';

@ApiTags('Cheques')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@RequiresModule('FINANCE')
@Controller('api/v1/cheques')
export class ChequeController {
  constructor(private readonly service: ChequeServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all cheques' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'isReceivable', required: false, type: Boolean })
  findAll(
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('isReceivable') isReceivable?: string,
  ) {
    return this.service.findAll(companyId, {
      status,
      isReceivable: isReceivable !== undefined ? isReceivable === 'true' : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cheque by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findById(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Record a cheque' })
  @ApiQuery({ name: 'companyId', required: true })
  create(@Query('companyId') companyId: string, @Body() body: any) {
    return this.service.create(companyId, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update cheque status (deposit, clear, bounce, cancel)' })
  @ApiQuery({ name: 'companyId', required: true })
  updateStatus(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.service.updateStatus(id, companyId, body.status, body.notes);
  }
}
