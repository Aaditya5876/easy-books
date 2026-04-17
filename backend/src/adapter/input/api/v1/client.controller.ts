import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClientServiceImpl } from '../../../../application/services/client.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateClientSchema, UpdateClientSchema, CreateClientDTO, UpdateClientDTO } from '@easy-books/shared';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/clients')
export class ClientController {
  constructor(private readonly service: ClientServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all clients' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a client by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a client' })
  create(@Body(new ZodValidationPipe(CreateClientSchema)) dto: CreateClientDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a client' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateClientSchema)) dto: UpdateClientDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a client' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
