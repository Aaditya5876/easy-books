import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeaveServiceImpl } from '../../../../application/services/leave.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/leave')
export class LeaveController {
  constructor(private readonly service: LeaveServiceImpl) {}

  // ─── Leave Types ─────────────────────────────────────────────────────────────

  @Get('types')
  @ApiOperation({ summary: 'Get all leave types' })
  @ApiQuery({ name: 'companyId', required: true })
  findAllTypes(@Query('companyId') companyId: string) {
    return this.service.findAllTypes(companyId);
  }

  @Post('types')
  @ApiOperation({ summary: 'Create a leave type' })
  @ApiQuery({ name: 'companyId', required: true })
  createType(@Query('companyId') companyId: string, @Body() body: { name: string; daysPerYear: number; isPaid?: boolean }) {
    return this.service.createType(companyId, body);
  }

  @Put('types/:id')
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiQuery({ name: 'companyId', required: true })
  updateType(@Param('id') id: string, @Query('companyId') companyId: string, @Body() body: any) {
    return this.service.updateType(id, companyId, body);
  }

  @Delete('types/:id')
  @ApiOperation({ summary: 'Delete a leave type' })
  @ApiQuery({ name: 'companyId', required: true })
  removeType(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.removeType(id, companyId);
  }

  // ─── Leave Balances ──────────────────────────────────────────────────────────

  @Get('balances/:employeeId')
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
  @ApiOperation({ summary: 'Allocate leave days to an employee' })
  @ApiQuery({ name: 'companyId', required: true })
  allocate(
    @Query('companyId') companyId: string,
    @Body() body: { employeeId: string; leaveTypeId: string; fiscalYear: string; totalDays: number },
  ) {
    return this.service.allocateLeave(companyId, body.employeeId, body.leaveTypeId, body.fiscalYear, body.totalDays);
  }

  // ─── Leave Requests ──────────────────────────────────────────────────────────

  @Get('requests')
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
  @ApiOperation({ summary: 'Get a leave request by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findRequestById(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findRequestById(id, companyId);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  createRequest(
    @Query('companyId') companyId: string,
    @Body() body: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; reason?: string },
  ) {
    return this.service.createRequest(companyId, body);
  }

  @Patch('requests/:id/approve')
  @ApiOperation({ summary: 'Approve a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  approve(@Param('id') id: string, @Query('companyId') companyId: string, @Request() req: any) {
    return this.service.approveRequest(id, companyId, req.user?.sub ?? 'system');
  }

  @Patch('requests/:id/reject')
  @ApiOperation({ summary: 'Reject a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  reject(@Param('id') id: string, @Query('companyId') companyId: string, @Request() req: any) {
    return this.service.rejectRequest(id, companyId, req.user?.sub ?? 'system');
  }

  @Patch('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel a leave request' })
  @ApiQuery({ name: 'companyId', required: true })
  cancel(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.cancelRequest(id, companyId);
  }
}
