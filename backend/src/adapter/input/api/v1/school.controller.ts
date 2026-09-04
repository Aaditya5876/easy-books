import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';
import { SchoolService } from '../../../../application/services/school.service';
import { SchoolAnalyticsService } from '../../../../application/services/school-analytics.service';
import { SchoolFinanceService } from '../../../../application/services/school-finance.service';

@ApiTags('School')
@ApiBearerAuth()
@Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
@Controller('api/v1/school')
export class SchoolController {
  constructor(
    private readonly service: SchoolService,
    private readonly analytics: SchoolAnalyticsService,
    private readonly finance: SchoolFinanceService,
  ) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: 'School dashboard summary with analytics extras' })
  @ApiQuery({ name: 'companyId', required: true })
  async getDashboard(@Query('companyId') companyId: string) {
    const [summary, extras] = await Promise.all([
      this.service.getDashboardSummary(companyId),
      this.analytics.dashboardExtras(companyId),
    ]);
    return { ...summary, ...extras };
  }

  // ── Analytics / Reports ──────────────────────────────────────────────────────

  @Get('analytics/attendance')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM, defaults to current month' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Optional inclusive start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Optional inclusive end date' })
  getAttendanceAnalytics(
    @Query('companyId') companyId: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.attendanceReport(companyId, month, startDate, endDate);
  }

  @Get('analytics/fees')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'startDate', required: false, description: 'Optional inclusive start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Optional inclusive end date' })
  getFeesAnalytics(@Query('companyId') companyId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.analytics.feesReport(companyId, startDate, endDate);
  }

  @Get('analytics/academics')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'examName', required: false })
  @ApiQuery({ name: 'startDate', required: false, description: 'Optional inclusive start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Optional inclusive end date' })
  getAcademicsAnalytics(
    @Query('companyId') companyId: string,
    @Query('examName') examName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.academicsReport(companyId, examName, startDate, endDate);
  }

  @Get('analytics/operations')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'startDate', required: false, description: 'Optional inclusive start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Optional inclusive end date' })
  getOperationsAnalytics(@Query('companyId') companyId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.analytics.operationsReport(companyId, startDate, endDate);
  }

  // ── Academic Years ────────────────────────────────────────────────────────────

  @Get('academic-years')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
  @ApiQuery({ name: 'companyId', required: true })
  listClasses(@Query('companyId') companyId: string) {
    return this.service.listClasses(companyId);
  }

  @Post('classes')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  createClass(@Body() body: { companyId: string; name: string; section?: string; classTeacherId?: string }) {
    return this.service.createClass(body);
  }

  @Put('classes/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or roll number — used by search-as-you-type pickers' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  listStudents(
    @Query('companyId') companyId: string,
    @Query('classId') classId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listStudents(companyId, {
      classId,
      search,
      status,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('students/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  listSubjects(@Query('companyId') companyId: string, @Query('classId') classId?: string) {
    return this.service.listSubjects(companyId, classId);
  }

  @Post('subjects')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  createSubject(@Body() body: { companyId: string; name: string; code?: string; classIds?: string[]; bookReference?: string; chapters?: number }) {
    return this.service.createSubject(body);
  }

  @Put('subjects/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  updateSubject(@Param('id') id: string, @Body() body: any) {
    return this.service.updateSubject(id, body);
  }

  @Delete('subjects/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiQuery({ name: 'companyId', required: true })
  deleteSubject(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteSubject(id, companyId);
  }

  // ── Student Attendance ────────────────────────────────────────────────────────

  @Get('attendance')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  saveAttendance(@Body() body: { companyId: string; classId: string; date: string; academicYearId?: string; entries: Array<{ studentId: string; status: string; notes?: string }> }) {
    return this.service.saveAttendance(body.companyId, body.classId, body.date, body.academicYearId, body.entries);
  }

  @Get('attendance/report')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
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
  @ApiQuery({ name: 'search', required: false, description: 'Search by student name or roll number' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  listFeeInvoices(
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listFeeInvoices(
      companyId,
      status,
      studentId,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
      search,
    );
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
  @ApiQuery({ name: 'companyId', required: true })
  recordPayment(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { amount: number; method?: string; notes?: string; bankAccountId?: string },
  ) {
    return this.finance.recordPayment(companyId, id, body);
  }

  @Get('fee-invoices/:id/payments')
  @ApiQuery({ name: 'companyId', required: true })
  listInvoicePayments(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.finance.listPayments(companyId, id);
  }

  @Get('fee-payments/pending')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  listPendingPaymentProofs(@Query('companyId') companyId: string) {
    return this.finance.listPendingPaymentProofs(companyId);
  }

  @Get('fee-payments/verify/:code')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  verifyPaymentByCode(@Param('code') code: string, @Query('companyId') companyId: string) {
    return this.finance.verifyByCode(companyId, code);
  }

  @Patch('fee-payments/:id/confirm')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  confirmPaymentProof(@Param('id') id: string, @Query('companyId') companyId: string, @Req() req: any) {
    return this.finance.confirmPaymentProof(companyId, id, req.user?.sub);
  }

  @Patch('fee-payments/:id/reject')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  rejectPaymentProof(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.finance.rejectPaymentProof(companyId, id, body.reason, req.user?.sub);
  }

  @Patch('fee-invoices/:id/release')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  releaseInvoice(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.finance.releaseInvoiceById(companyId, id);
  }

  @Post('fee-invoices/release-bulk')
  @Roles('ADMIN', 'ACCOUNTANT')
  releaseBulkInvoices(@Body() body: { companyId: string }) {
    return this.finance.releaseBulk(body.companyId);
  }

  // ── Fee Heads ─────────────────────────────────────────────────────────────────

  @Get('fee-heads')
  @ApiQuery({ name: 'companyId', required: true })
  listFeeHeads(@Query('companyId') companyId: string) {
    return this.finance.listFeeHeads(companyId);
  }

  @Post('fee-heads')
  @Roles('ADMIN', 'ACCOUNTANT')
  createFeeHead(@Body() body: any) {
    return this.finance.createFeeHead(body);
  }

  @Post('fee-heads/defaults')
  @Roles('ADMIN', 'ACCOUNTANT')
  createDefaultFeeHeads(@Body() body: { companyId: string }) {
    return this.finance.createDefaultFeeHeads(body.companyId);
  }

  @Put('fee-heads/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  updateFeeHead(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.finance.updateFeeHead(id, companyId, body);
  }

  @Delete('fee-heads/:id')
  @Roles('ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  deleteFeeHead(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.finance.deleteFeeHead(id, companyId);
  }

  // ── Student Fee Profile / Scholarships / Packages ────────────────────────────

  @Get('students/:id/fee-profile')
  @ApiQuery({ name: 'companyId', required: true })
  getStudentFeeProfile(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.finance.getStudentFeeProfile(companyId, id);
  }

  @Post('students/:id/scholarships')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  addScholarship(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.finance.addScholarship(companyId, id, body);
  }

  @Delete('scholarships/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  removeScholarship(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.finance.removeScholarship(companyId, id);
  }

  @Get('fee-packages')
  @ApiQuery({ name: 'companyId', required: true })
  listFeePackages(@Query('companyId') companyId: string) {
    return this.finance.listPackages(companyId);
  }

  @Post('fee-packages')
  @Roles('ADMIN', 'ACCOUNTANT')
  createFeePackage(@Body() body: any) {
    return this.finance.createPackage(body);
  }

  @Put('fee-packages/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  updateFeePackage(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.finance.updatePackage(id, companyId, body);
  }

  @Delete('fee-packages/:id')
  @Roles('ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  deleteFeePackage(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.finance.deletePackage(id, companyId);
  }

  @Patch('students/:id/package')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiQuery({ name: 'companyId', required: true })
  assignPackage(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: { packageId: string | null }) {
    return this.finance.assignPackage(companyId, id, body.packageId ?? null);
  }

  // ── Billing Run ───────────────────────────────────────────────────────────────

  @Post('billing-run')
  @Roles('ADMIN', 'ACCOUNTANT')
  billingRun(@Body() body: { companyId: string; month?: string; classId?: string; dueDate?: string; invoiceDate?: string }) {
    // Manual, button-triggered run — never auto-releases (autoRelease stays
    // false); only the nightly cron (ScheduledTasksService) can pass that.
    return this.finance.billingRun(body.companyId, body.month, body.classId, body.dueDate, body.invoiceDate);
  }

  @Get('fee-invoices/:id/receipt')
  @ApiQuery({ name: 'companyId', required: true })
  getFeeReceipt(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.finance.getFeeReceipt(companyId, id);
  }

  // ── Exams (tabs) ──────────────────────────────────────────────────────────────
  // Standard+ tier — see MODULE_KEYS in core/modules/module-keys.ts.

  @Get('exams')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  listExams(@Query('companyId') companyId: string) {
    return this.service.listExams(companyId);
  }

  @Post('exams')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  createExam(@Body() body: { companyId: string; name: string; examDate?: string; notes?: string }) {
    return this.service.createExam(body);
  }

  @Delete('exams/:id')
  @Roles('ADMIN')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  deleteExam(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteExam(id, companyId);
  }

  // ── Exam Results ──────────────────────────────────────────────────────────────

  @Get('exam-results')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'examName', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'classId', required: false })
  listExamResults(
    @Query('companyId') companyId: string,
    @Query('examName') examName?: string,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.service.listExamResults(companyId, examName, studentId, classId);
  }

  @Get('exam-results/report-card')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  createExamResult(@Body() body: any) {
    return this.service.createExamResult(body);
  }

  @Put('exam-results/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  updateExamResult(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateExamResult(id, companyId, body);
  }

  @Delete('exam-results/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  deleteExamResult(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteExamResult(id, companyId);
  }

  // ── Exam Schedules ────────────────────────────────────────────────────────────

  @Get('exam-schedules')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'examName', required: false })
  listExamSchedules(
    @Query('companyId') companyId: string,
    @Query('classId') classId?: string,
    @Query('examName') examName?: string,
  ) {
    return this.service.listExamSchedules(companyId, classId, examName);
  }

  @Post('exam-schedules')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  createExamSchedule(@Body() body: any) {
    return this.service.createExamSchedule(body);
  }

  @Post('exam-schedules/bulk')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  createExamSchedulesBulk(@Body() body: {
    companyId: string;
    classId: string;
    examName: string;
    rows: Array<{ subjectId?: string; examDate: string; startTime?: string; endTime?: string; roomNumber?: string }>;
  }) {
    return this.service.createExamSchedulesBulk(body);
  }

  @Put('exam-schedules/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  updateExamSchedule(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateExamSchedule(id, companyId, body);
  }

  @Delete('exam-schedules/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  deleteExamSchedule(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteExamSchedule(id, companyId);
  }

  // ── Timetable ─────────────────────────────────────────────────────────────────

  @Get('timetable')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'classId', required: true })
  getTimetable(@Query('companyId') companyId: string, @Query('classId') classId: string) {
    return this.service.getTimetable(companyId, classId);
  }

  @Post('timetable')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  upsertTimetableEntry(@Body() body: any) {
    return this.service.upsertTimetableEntry(body);
  }

  @Delete('timetable/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  deleteTimetableEntry(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteTimetableEntry(id, companyId);
  }

  // ── Notices ───────────────────────────────────────────────────────────────────

  @Get('notices')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
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

  @Post('notices/:id/broadcast-sms')
  @Roles('ADMIN')
  broadcastNoticeSms(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.broadcastNoticeSms(id, companyId);
  }

  // ── SMS ───────────────────────────────────────────────────────────────────────

  @Post('sms/fee-reminder/:invoiceId')
  sendFeeReminderSms(@Param('invoiceId') invoiceId: string, @Query('companyId') companyId: string) {
    return this.service.sendFeeReminderSms(invoiceId, companyId);
  }

  // ── Events ────────────────────────────────────────────────────────────────────

  @Get('events')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER', 'LIBRARIAN')
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
  // Standard+ tier — see MODULE_KEYS in core/modules/module-keys.ts.

  @Get('study-materials')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  createStudyMaterial(@Body() body: any) {
    return this.service.createStudyMaterial(body);
  }

  @Delete('study-materials/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  deleteStudyMaterial(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteStudyMaterial(id, companyId);
  }

  // ── Homework ──────────────────────────────────────────────────────────────────

  @Get('homework')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
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
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  createHomework(@Body() body: any) {
    return this.service.createHomework(body);
  }

  @Put('homework/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  updateHomework(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateHomework(id, companyId, body);
  }

  @Delete('homework/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @RequiresModule('SCHOOL_ACADEMICS')
  @ApiQuery({ name: 'companyId', required: true })
  deleteHomework(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteHomework(id, companyId);
  }

  // ── Library ───────────────────────────────────────────────────────────────────
  // Premium tier — see MODULE_KEYS in core/modules/module-keys.ts.

  @Get('library/books')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'LIBRARIAN')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  listBooks(@Query('companyId') companyId: string) {
    return this.service.listBooks(companyId);
  }

  @Post('library/books')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'LIBRARIAN')
  @RequiresModule('FACILITIES')
  createBook(@Body() body: any) {
    return this.service.createBook(body);
  }

  @Put('library/books/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'LIBRARIAN')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  updateBook(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateBook(id, companyId, body);
  }

  @Delete('library/books/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'LIBRARIAN')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  deleteBook(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteBook(id, companyId);
  }

  @Get('library/issues')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'LIBRARIAN')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'status', required: false })
  listIssues(@Query('companyId') companyId: string, @Query('status') status?: string) {
    return this.service.listIssues(companyId, status);
  }

  @Post('library/issues')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'LIBRARIAN')
  @RequiresModule('FACILITIES')
  issueBook(@Body() body: any) {
    return this.service.issueBook(body);
  }

  @Patch('library/issues/:id/return')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'LIBRARIAN')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  returnBook(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: { fine?: number }) {
    return this.service.returnBook(id, companyId, body.fine);
  }

  // ── Hostel ────────────────────────────────────────────────────────────────────
  // Premium tier — see MODULE_KEYS in core/modules/module-keys.ts.

  @Get('hostel/rooms')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  listHostelRooms(@Query('companyId') companyId: string) {
    return this.service.listHostelRooms(companyId);
  }

  @Post('hostel/rooms')
  @RequiresModule('FACILITIES')
  createHostelRoom(@Body() body: any) {
    return this.service.createHostelRoom(body);
  }

  @Put('hostel/rooms/:id')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  updateHostelRoom(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateHostelRoom(id, companyId, body);
  }

  @Delete('hostel/rooms/:id')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  deleteHostelRoom(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteHostelRoom(id, companyId);
  }

  @Get('hostel/allocations')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'roomId', required: false })
  listHostelAllocations(@Query('companyId') companyId: string, @Query('roomId') roomId?: string) {
    return this.service.listHostelAllocations(companyId, roomId);
  }

  @Post('hostel/allocations')
  @RequiresModule('FACILITIES')
  allocateStudent(@Body() body: any) {
    return this.service.allocateStudent(body);
  }

  @Delete('hostel/allocations/:id')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  deallocateStudent(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deallocateStudent(id, companyId);
  }

  // ── Transport ─────────────────────────────────────────────────────────────────
  // Premium tier — see MODULE_KEYS in core/modules/module-keys.ts.

  @Get('transport/routes')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  listTransportRoutes(@Query('companyId') companyId: string) {
    return this.service.listTransportRoutes(companyId);
  }

  @Post('transport/routes')
  @RequiresModule('FACILITIES')
  createTransportRoute(@Body() body: any) {
    return this.service.createTransportRoute(body);
  }

  @Put('transport/routes/:id')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  updateTransportRoute(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateTransportRoute(id, companyId, body);
  }

  @Delete('transport/routes/:id')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  deleteTransportRoute(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.deleteTransportRoute(id, companyId);
  }

  @Get('transport/assignments')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'routeId', required: false })
  listTransportAssignments(@Query('companyId') companyId: string, @Query('routeId') routeId?: string) {
    return this.service.listTransportAssignments(companyId, routeId);
  }

  @Post('transport/assignments')
  @RequiresModule('FACILITIES')
  assignStudentTransport(@Body() body: any) {
    return this.service.assignStudentTransport(body);
  }

  @Delete('transport/assignments/:id')
  @RequiresModule('FACILITIES')
  @ApiQuery({ name: 'companyId', required: true })
  removeStudentTransport(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.removeStudentTransport(id, companyId);
  }
}
