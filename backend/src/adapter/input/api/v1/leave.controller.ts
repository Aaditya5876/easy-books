import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeaveServiceImpl } from '../../../../application/services/leave.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';

@ApiTags('Leave')
@ApiBearerAuth()
@RequiresModule('HRMS')
@Controller('api/v1/leave')
export class LeaveController {
  constructor(private readonly service: LeaveServiceImpl) {}

  // ─── Self-service (any authenticated staff role — overrides the class-level
  // roles above where narrower) ────────────────────────────────────────────────

  @Get('self/context')
  @Roles('ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: "Get the current user's own leave balances" })
  @ApiQuery({ name: 'companyId', required: true })
  selfContext(@Request() req: any, @Query('companyId') companyId: string) {
    return this.service.getSelfContext(companyId, req.user.email);
  }

  @Get('self/requests')
  @Roles('ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: "Get the current user's own leave requests" })
  @ApiQuery({ name: 'companyId', required: true })
  selfRequests(@Request() req: any, @Query('companyId') companyId: string) {
    return this.service.findSelfRequests(companyId, req.user.email);
  }

  @Post('self/requests')
  @Roles('ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: 'Submit a leave request for the current user' })
  @ApiQuery({ name: 'companyId', required: true })
  createSelfRequest(
    @Request() req: any,
    @Query('companyId') companyId: string,
    @Body() body: { leaveTypeId: string; startDate: string; endDate: string; reason?: string },
  ) {
    return this.service.createSelfRequest(companyId, req.user.email, body);
  }

  @Patch('self/requests/:id/cancel')
  @Roles('ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER', 'LIBRARIAN')
  @ApiOperation({ summary: "Cancel one of the current user's own leave requests" })
  @ApiQuery({ name: 'companyId', required: true })
  cancelSelfRequest(@Request() req: any, @Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.cancelSelfRequest(id, companyId, req.user.email);
  }

  // ─── Leave Types ─────────────────────────────────────────────────────────────

  @Get('types')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get all leave types' })
  @ApiQuery({ name: 'companyId', required: true })
  findAllTypes(@Query('companyId') companyId: string) {
    return this.service.findAllTypes(companyId);
  }

  @Post('types')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a leave type' })
  @ApiQuery({ name: 'companyId', required: true })
  createType(@Query('companyId') companyId: string, @Body() body: { name: string; daysPerYear: number; isPaid?: boolean }) {
    return this.service.createType(companyId, body);
  }

  @Put('types/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiQuery({ name: 'companyId', required: true })
  updateType(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateType(id, companyId, body);
  }

  @Delete('types/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a leave type' })
  @ApiQuery({ name: 'companyId', required: true })
  removeType(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.removeType(id, companyId);
  }

  // ─── Leave Balances ──────────────────────────────────────────────────────────

  @Get('balances/:employeeId')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get leave balances for an employee' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'fiscalYear', required: true, example: '2081-82' })
  getBalances(
    @Param('employeeId') employeeId: string,
    @Query('companyId') companyId: string,
    @Query('fiscalYear') fiscalYear: string,
  ) {
    return this.service.getBalances(employeeId, companyId, fiscalYear);
  }

  @Post('balances/allocate')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Allocate leave days to an employee' })
  @ApiQuery({ name: 'companyId', required: true })
  allocate(
    @Query('companyId') companyId: string,
    @Body() body: { employeeId: string; leaveTypeId: string; fiscalYear: string; totalDays: number },
  ) {
    return this.service.allocateLeave(companyId, body.employeeId, body.leaveTypeId, body.fiscalYear, body.totalDays);
  }

  @Post('balances/carryover')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Run year-end leave carryover for all employees' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'fromFiscalYear', required: true, example: '2081-82' })
  @ApiQuery({ name: 'toFiscalYear', required: true, example: '2082-83' })
  carryover(
    @Query('companyId') companyId: string,
    @Query('fromFiscalYear') fromFiscalYear: string,
    @Query('toFiscalYear') toFiscalYear: string,
  ) {
    return this.service.carryoverLeave(companyId, fromFiscalYear, toFiscalYear);
  }

  // ─── Leave Requests ──────────────────────────────────────────────────────────

  @Get('requests')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get all leave requests' })
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findRequests(
    @Query('companyId') companyId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findRequests(companyId, { employeeId, status });
  }

  @Get('requests/:id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get a leave request by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findRequestById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findRequestById(id, companyId);
  }

  @Post('requests')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  createRequest(
    @Query('companyId') companyId: string,
    @Body() body: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; reason?: string },
  ) {
    return this.service.createRequest(companyId, body);
  }

  @Patch('requests/:id/approve')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Approve a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  approve(@Param('id') id: string, @Query('companyId') companyId: string, @Request() req: any) {
    return this.service.approveRequest(id, companyId, req.user?.sub ?? 'system');
  }

  @Patch('requests/:id/reject')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Reject a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  reject(@Param('id') id: string, @Query('companyId') companyId: string, @Request() req: any) {
    return this.service.rejectRequest(id, companyId, req.user?.sub ?? 'system');
  }

  @Patch('requests/:id/cancel')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Cancel a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  cancel(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.cancelRequest(id, companyId);
  }
}
