import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { SchoolService } from '../../../../application/services/school.service';

@ApiTags('School')
@ApiBearerAuth()
@Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
@Controller('api/v1/school')
export class SchoolController {
  constructor(private readonly service: SchoolService) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'School dashboard summary' })
  @ApiQuery({ name: 'companyId', required: true })
  getDashboard(@Query('companyId') companyId: string) {
    return this.service.getDashboardSummary(companyId);
  }

  // ── Academic Years ────────────────────────────────────────────────────────────

  @Get('academic-years')
  @ApiQuery({ name: 'companyId', required: true })
  listAcademicYears(@Query('companyId') companyId: string) {
    return this.service.listAcademicYears(companyId);
  }

  @Post('academic-years')
  createAcademicYear(@Body() body: any) {
    return this.service.createAcademicYear(body);
  }

  @Put('academic-years/:id')
  updateAcademicYear(@Param('id') id: string, @Body() body: any, @Query('companyId') companyId: string) {
    return this.service.updateAcademicYear(id, companyId, body);
  }

  @Delete('academic-years/:id')
  @Roles('ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  deleteAcademicYear(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteAcademicYear(id, companyId);
  }

  // ── Classes ──────────────────────────────────────────────────────────────────

  @Get('classes')
  @ApiQuery({ name: 'companyId', required: true })
  listClasses(@Query('companyId') companyId: string) {
    return this.service.listClasses(companyId);
  }

  @Post('classes')
  createClass(@Body() body: { companyId: string; name: string; section?: string; classTeacherId?: string }) {
    return this.service.createClass(body);
  }

  @Put('classes/:id')
  updateClass(@Param('id') id: string, @Body() body: any) {
    return this.service.updateClass(id, body);
  }

  @Delete('classes/:id')
  @Roles('ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  deleteClass(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteClass(id, companyId);
  }

  // ── Students ─────────────────────────────────────────────────────────────────

  @Get('students')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  listStudents(@Query('companyId') companyId: string, @Query('classId') classId?: string) {
    return this.service.listStudents(companyId, classId);
  }

  @Get('students/:id')
  @ApiQuery({ name: 'companyId', required: true })
  getStudent(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.getStudent(id, companyId);
  }

  @Post('students')
  createStudent(@Body() body: any) {
    return this.service.createStudent(body);
  }

  @Put('students/:id')
  updateStudent(@Param('id') id: string, @Body() body: any) {
    return this.service.updateStudent(id, body);
  }

  @Delete('students/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteStudent(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteStudent(id, companyId);
  }

  @Post('students/promote')
  @Roles('ADMIN')
  promoteStudents(@Body() body: { companyId: string; fromClassId: string; toClassId: string; studentIds: string[] }) {
    return this.service.promoteStudents(body.companyId, body.fromClassId, body.toClassId, body.studentIds);
  }

  // ── Subjects ─────────────────────────────────────────────────────────────────

  @Get('subjects')
  @ApiQuery({ name: 'companyId', required: true })
  listSubjects(@Query('companyId') companyId: string) {
    return this.service.listSubjects(companyId);
  }

  @Post('subjects')
  createSubject(@Body() body: { companyId: string; name: string; code?: string }) {
    return this.service.createSubject(body);
  }

  @Put('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() body: any) {
    return this.service.updateSubject(id, body);
  }

  @Delete('subjects/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteSubject(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteSubject(id, companyId);
  }

  // ── Student Attendance ────────────────────────────────────────────────────────

  @Get('attendance')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: true })
  @ApiQuery({ name: 'date', required: true })
  getAttendance(
    @Query('companyId') companyId: string,
    @Query('classId') classId: string,
    @Query('date') date: string,
  ) {
    return this.service.getAttendanceByDate(companyId, classId, date);
  }

  @Post('attendance')
  saveAttendance(@Body() body: { companyId: string; classId: string; date: string; academicYearId?: string; entries: Array<{ studentId: string; status: string; notes?: string }> }) {
    return this.service.saveAttendance(body.companyId, body.classId, body.date, body.academicYearId, body.entries);
  }

  @Get('attendance/report')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getAttendanceReport(
    @Query('companyId') companyId: string,
    @Query('classId') classId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getClassAttendanceReport(companyId, classId, startDate, endDate);
  }

  @Get('attendance/summary')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'studentId', required: true })
  @ApiQuery({ name: 'month', required: false })
  getAttendanceSummary(
    @Query('companyId') companyId: string,
    @Query('studentId') studentId: string,
    @Query('month') month?: string,
  ) {
    return this.service.getAttendanceSummary(companyId, studentId, month);
  }

  // ── Fee Structures ────────────────────────────────────────────────────────────

  @Get('fee-structures')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  listFeeStructures(@Query('companyId') companyId: string, @Query('classId') classId?: string) {
    return this.service.listFeeStructures(companyId, classId);
  }

  @Post('fee-structures')
  createFeeStructure(@Body() body: any) {
    return this.service.createFeeStructure(body);
  }

  @Put('fee-structures/:id')
  updateFeeStructure(@Param('id') id: string, @Body() body: any) {
    return this.service.updateFeeStructure(id, body);
  }

  @Delete('fee-structures/:id')
  @Roles('ADMIN')
  deleteFeeStructure(@Param('id') id: string) {
    return this.service.deleteFeeStructure(id);
  }

  // ── Fee Invoices ──────────────────────────────────────────────────────────────

  @Get('fee-invoices')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  listFeeInvoices(
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.service.listFeeInvoices(companyId, status, studentId);
  }

  @Post('fee-invoices')
  createFeeInvoice(@Body() body: any) {
    return this.service.createFeeInvoice(body);
  }

  @Post('fee-invoices/bulk')
  @Roles('ADMIN', 'ACCOUNTANT')
  generateBulkInvoices(@Body() body: { companyId: string; classId: string; month: string; feeStructureIds: string[] }) {
    return this.service.generateBulkInvoices(body.companyId, body.classId, body.month, body.feeStructureIds);
  }

  @Patch('fee-invoices/:id/payment')
  recordPayment(@Param('id') id: string, @Body() body: { amount: number; notes?: string }) {
    return this.service.recordPayment(id, body.amount, body.notes);
  }

  @Get('fee-invoices/:id/receipt')
  @ApiQuery({ name: 'companyId', required: true })
  getFeeReceipt(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.getFeeReceipt(id, companyId);
  }

  // ── Exam Results ──────────────────────────────────────────────────────────────

  @Get('exam-results')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'examName', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  listExamResults(
    @Query('companyId') companyId: string,
    @Query('examName') examName?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.service.listExamResults(companyId, examName, studentId);
  }

  @Get('exam-results/report-card')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'studentId', required: true })
  @ApiQuery({ name: 'examName', required: true })
  getReportCard(
    @Query('companyId') companyId: string,
    @Query('studentId') studentId: string,
    @Query('examName') examName: string,
  ) {
    return this.service.getReportCard(studentId, companyId, examName);
  }

  @Post('exam-results')
  createExamResult(@Body() body: any) {
    return this.service.createExamResult(body);
  }

  @Put('exam-results/:id')
  updateExamResult(@Param('id') id: string, @Body() body: any) {
    return this.service.updateExamResult(id, body);
  }

  @Delete('exam-results/:id')
  deleteExamResult(@Param('id') id: string) {
    return this.service.deleteExamResult(id);
  }

  // ── Timetable ─────────────────────────────────────────────────────────────────

  @Get('timetable')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: true })
  getTimetable(@Query('companyId') companyId: string, @Query('classId') classId: string) {
    return this.service.getTimetable(companyId, classId);
  }

  @Post('timetable')
  upsertTimetableEntry(@Body() body: any) {
    return this.service.upsertTimetableEntry(body);
  }

  @Delete('timetable/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteTimetableEntry(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteTimetableEntry(id, companyId);
  }

  // ── Notices ───────────────────────────────────────────────────────────────────

  @Get('notices')
  @ApiQuery({ name: 'companyId', required: true })
  listNotices(@Query('companyId') companyId: string) {
    return this.service.listNotices(companyId);
  }

  @Post('notices')
  createNotice(@Body() body: any) {
    return this.service.createNotice(body);
  }

  @Put('notices/:id')
  @ApiQuery({ name: 'companyId', required: true })
  updateNotice(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateNotice(id, companyId, body);
  }

  @Delete('notices/:id')
  @Roles('ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  deleteNotice(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteNotice(id, companyId);
  }

  // ── Events ────────────────────────────────────────────────────────────────────

  @Get('events')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'month', required: false })
  listEvents(@Query('companyId') companyId: string, @Query('month') month?: string) {
    return this.service.listEvents(companyId, month);
  }

  @Post('events')
  createEvent(@Body() body: any) {
    return this.service.createEvent(body);
  }

  @Put('events/:id')
  @ApiQuery({ name: 'companyId', required: true })
  updateEvent(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateEvent(id, companyId, body);
  }

  @Delete('events/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteEvent(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteEvent(id, companyId);
  }
}
