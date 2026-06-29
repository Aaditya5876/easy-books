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

  // ── Study Materials ───────────────────────────────────────────────────────────

  @Get('study-materials')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  listStudyMaterials(
    @Query('companyId') companyId: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.listStudyMaterials(companyId, classId, subjectId);
  }

  @Post('study-materials')
  createStudyMaterial(@Body() body: any) {
    return this.service.createStudyMaterial(body);
  }

  @Delete('study-materials/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteStudyMaterial(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteStudyMaterial(id, companyId);
  }

  // ── Homework ──────────────────────────────────────────────────────────────────

  @Get('homework')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  listHomework(
    @Query('companyId') companyId: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.listHomework(companyId, classId, subjectId);
  }

  @Post('homework')
  createHomework(@Body() body: any) {
    return this.service.createHomework(body);
  }

  @Put('homework/:id')
  @ApiQuery({ name: 'companyId', required: true })
  updateHomework(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateHomework(id, companyId, body);
  }

  @Delete('homework/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteHomework(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteHomework(id, companyId);
  }

  // ── Library ───────────────────────────────────────────────────────────────────

  @Get('library/books')
  @ApiQuery({ name: 'companyId', required: true })
  listBooks(@Query('companyId') companyId: string) {
    return this.service.listBooks(companyId);
  }

  @Post('library/books')
  createBook(@Body() body: any) {
    return this.service.createBook(body);
  }

  @Put('library/books/:id')
  @ApiQuery({ name: 'companyId', required: true })
  updateBook(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateBook(id, companyId, body);
  }

  @Delete('library/books/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteBook(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteBook(id, companyId);
  }

  @Get('library/issues')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'status', required: false })
  listIssues(@Query('companyId') companyId: string, @Query('status') status?: string) {
    return this.service.listIssues(companyId, status);
  }

  @Post('library/issues')
  issueBook(@Body() body: any) {
    return this.service.issueBook(body);
  }

  @Patch('library/issues/:id/return')
  @ApiQuery({ name: 'companyId', required: true })
  returnBook(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: { fine?: number }) {
    return this.service.returnBook(id, companyId, body.fine);
  }

  // ── Hostel ────────────────────────────────────────────────────────────────────

  @Get('hostel/rooms')
  @ApiQuery({ name: 'companyId', required: true })
  listHostelRooms(@Query('companyId') companyId: string) {
    return this.service.listHostelRooms(companyId);
  }

  @Post('hostel/rooms')
  createHostelRoom(@Body() body: any) {
    return this.service.createHostelRoom(body);
  }

  @Put('hostel/rooms/:id')
  @ApiQuery({ name: 'companyId', required: true })
  updateHostelRoom(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateHostelRoom(id, companyId, body);
  }

  @Delete('hostel/rooms/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteHostelRoom(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteHostelRoom(id, companyId);
  }

  @Get('hostel/allocations')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'roomId', required: false })
  listHostelAllocations(@Query('companyId') companyId: string, @Query('roomId') roomId?: string) {
    return this.service.listHostelAllocations(companyId, roomId);
  }

  @Post('hostel/allocations')
  allocateStudent(@Body() body: any) {
    return this.service.allocateStudent(body);
  }

  @Delete('hostel/allocations/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deallocateStudent(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deallocateStudent(id, companyId);
  }

  // ── Transport ─────────────────────────────────────────────────────────────────

  @Get('transport/routes')
  @ApiQuery({ name: 'companyId', required: true })
  listTransportRoutes(@Query('companyId') companyId: string) {
    return this.service.listTransportRoutes(companyId);
  }

  @Post('transport/routes')
  createTransportRoute(@Body() body: any) {
    return this.service.createTransportRoute(body);
  }

  @Put('transport/routes/:id')
  @ApiQuery({ name: 'companyId', required: true })
  updateTransportRoute(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateTransportRoute(id, companyId, body);
  }

  @Delete('transport/routes/:id')
  @ApiQuery({ name: 'companyId', required: true })
  deleteTransportRoute(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteTransportRoute(id, companyId);
  }

  @Get('transport/assignments')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'routeId', required: false })
  listTransportAssignments(@Query('companyId') companyId: string, @Query('routeId') routeId?: string) {
    return this.service.listTransportAssignments(companyId, routeId);
  }

  @Post('transport/assignments')
  assignStudentTransport(@Body() body: any) {
    return this.service.assignStudentTransport(body);
  }

  @Delete('transport/assignments/:id')
  @ApiQuery({ name: 'companyId', required: true })
  removeStudentTransport(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.removeStudentTransport(id, companyId);
  }
}
