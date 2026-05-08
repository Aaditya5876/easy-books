import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DebitNoteServiceImpl } from '../../../../application/services/debit-note.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Debit Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/debit-notes')
export class DebitNoteController {
  constructor(private readonly service: DebitNoteServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all debit notes' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get debit note by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findById(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a debit note' })
  @ApiQuery({ name: 'companyId', required: true })
  create(@Query('companyId') companyId: string, @Body() body: any) {
    return this.service.create(companyId, body);
  }

  @Patch(':id/apply')
  @ApiOperation({ summary: 'Mark debit note as applied' })
  @ApiQuery({ name: 'companyId', required: true })
  apply(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.apply(id, companyId);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close a debit note' })
  @ApiQuery({ name: 'companyId', required: true })
  close(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.close(id, companyId);
  }
}
