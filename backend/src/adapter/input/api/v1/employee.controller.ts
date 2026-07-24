import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmployeeServiceImpl } from '../../../../application/services/employee.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateEmployeeSchema, UpdateEmployeeSchema, CreateEmployeeDTO, UpdateEmployeeDTO } from '@easy-books/shared';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('api/v1/employees')
export class EmployeeController {
  constructor(private readonly service: EmployeeServiceImpl) {}

  @Get()
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get all employees' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get('directory')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: 'Name-only employee list for pickers (no salary/PAN/bank data)' })
  @ApiQuery({ name: 'companyId', required: true })
  findAllDirectory(@Query('companyId') companyId: string) {
    return this.service.findAllDirectory(companyId);
  }

  @Get(':id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get an employee by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Create an employee' })
  create(@Body(new ZodValidationPipe(CreateEmployeeSchema)) dto: CreateEmployeeDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Update an employee' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateEmployeeSchema)) dto: UpdateEmployeeDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft-delete an employee (sets status to INACTIVE)' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
