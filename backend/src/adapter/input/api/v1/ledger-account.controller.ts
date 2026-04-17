import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LedgerAccountServiceImpl } from '../../../../application/services/ledger-account.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateLedgerAccountSchema, UpdateLedgerAccountSchema, CreateLedgerAccountDTO, UpdateLedgerAccountDTO } from '@easy-books/shared';

@ApiTags('Ledger Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/ledger/accounts')
export class LedgerAccountController {
  constructor(private readonly service: LedgerAccountServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all ledger accounts' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ledger account by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a ledger account' })
  create(@Body(new ZodValidationPipe(CreateLedgerAccountSchema)) dto: CreateLedgerAccountDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a ledger account' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateLedgerAccountSchema)) dto: UpdateLedgerAccountDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ledger account' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
