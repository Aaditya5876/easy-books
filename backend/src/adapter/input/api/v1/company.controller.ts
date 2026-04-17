import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyServiceImpl } from '../../../../application/services/company.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateCompanySchema, UpdateCompanySchema, CreateCompanyDTO, UpdateCompanyDTO } from '@easy-books/shared';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/companies')
export class CompanyController {
  constructor(private readonly service: CompanyServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all companies' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a company' })
  create(@Body(new ZodValidationPipe(CreateCompanySchema)) dto: CreateCompanyDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a company' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCompanySchema)) dto: UpdateCompanyDTO,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a company' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
