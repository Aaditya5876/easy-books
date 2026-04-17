import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LedgerEntryServiceImpl } from '../../../../application/services/ledger-entry.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateLedgerEntrySchema, UpdateLedgerEntrySchema, CreateLedgerEntryDTO, UpdateLedgerEntryDTO } from '@easy-books/shared';

@ApiTags('Ledger Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/ledger/entries')
export class LedgerEntryController {
  constructor(private readonly service: LedgerEntryServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all ledger entries' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ledger entry by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a ledger entry' })
  create(@Body(new ZodValidationPipe(CreateLedgerEntrySchema)) dto: CreateLedgerEntryDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a ledger entry' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateLedgerEntrySchema)) dto: UpdateLedgerEntryDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ledger entry' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
