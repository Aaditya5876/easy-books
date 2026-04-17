import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MemoServiceImpl } from '../../../../application/services/memo.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateMemoDocumentSchema, UpdateMemoDocumentSchema, CreateMemoDocumentDTO, UpdateMemoDocumentDTO } from '@easy-books/shared';

@ApiTags('Memos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/memos')
export class MemoController {
  constructor(private readonly service: MemoServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all memo documents' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a memo document by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a memo document' })
  create(@Body(new ZodValidationPipe(CreateMemoDocumentSchema)) dto: CreateMemoDocumentDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a memo document' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateMemoDocumentSchema)) dto: UpdateMemoDocumentDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a memo document' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
