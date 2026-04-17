import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttendanceServiceImpl } from '../../../../application/services/attendance.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateAttendanceSchema, UpdateAttendanceSchema, CreateAttendanceDTO, UpdateAttendanceDTO } from '@easy-books/shared';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all attendance records' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'employeeId', required: false })
  findAll(
    @Query('companyId') companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findAll(companyId, employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an attendance record by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an attendance record' })
  create(@Body(new ZodValidationPipe(CreateAttendanceSchema)) dto: CreateAttendanceDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an attendance record' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateAttendanceSchema)) dto: UpdateAttendanceDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attendance record' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }
}
