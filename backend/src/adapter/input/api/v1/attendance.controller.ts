import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttendanceServiceImpl } from '../../../../application/services/attendance.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateAttendanceSchema, UpdateAttendanceSchema, CreateAttendanceDTO, UpdateAttendanceDTO } from '@easy-books/shared';

// Staff/employee attendance only — Student attendance is a wholly separate
// model & controller (see school.controller.ts), unaffected by this gate.
@ApiTags('Attendance')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@RequiresModule('HRMS')
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceServiceImpl) {}

  // ── Self-service (any authenticated staff role — overrides the class-level
  // ACCOUNTANT/ADMIN restriction above) ─────────────────────────────────────
  @Get('self/today')
  @Roles('ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: "Get the current user's own attendance status for today" })
  @ApiQuery({ name: 'companyId', required: true })
  selfToday(@Req() req: any, @Query('companyId') companyId: string) {
    return this.service.selfToday(companyId, req.user.email);
  }

  @Post('self')
  @Roles('ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: "Check the current user in or out for today" })
  @ApiQuery({ name: 'companyId', required: true })
  selfMark(@Req() req: any, @Query('companyId') companyId: string, @Body('action') action: 'IN' | 'OUT') {
    return this.service.selfMark(companyId, req.user.email, action);
  }

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
