import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyServiceImpl } from '../../../../application/services/company.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('api/v1/companies')
export class CompanyController {
  constructor(private readonly service: CompanyServiceImpl) {}

  @Get()
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Get all companies for current user' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.sub);
  }

  @Get('user-companies')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Get user companies with default flag' })
  getUserCompanies(@Req() req: any) {
    return this.service.getUserCompanies(req.user.sub);
  }

  @Get('default')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Get default company for current user' })
  getDefaultCompany(@Req() req: any) {
    return this.service.getDefaultCompany(req.user.sub);
  }

  // SUPER_ADMIN only — every company on the platform, not just ones this
  // account happens to be linked to (unlike findAll above). Must stay ahead
  // of the ':id' route below so 'all' isn't swallowed as a company id.
  @Get('all')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get every company across the platform (SUPER_ADMIN client directory)' })
  findAllForSuperAdmin() {
    return this.service.findAllForSuperAdmin();
  }

  @Get(':id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Get a company by id' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.sub, req.user.role);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a company' })
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(body, req.user.sub);
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a company' })
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, body, req.user.sub, req.user.role);
  }

  // SUPER_ADMIN only — @Roles('SUPER_ADMIN') here means literally that: a
  // regular company ADMIN does not satisfy this list (unlike most @Roles()
  // checks, SUPER_ADMIN is not a superset of ADMIN in RolesGuard — it's a
  // separate bypass — so this is the one place that distinction matters).
  @Patch(':id/package')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: "Set a company's package (Base/Standard/Premium) by enabled module keys" })
  updatePackage(@Param('id') id: string, @Body('enabledModules') enabledModules: string[]) {
    return this.service.updatePackage(id, enabledModules);
  }

  // SUPER_ADMIN only — a client's own company ADMIN can no longer suspend or
  // delete their own company (previously @Roles('ADMIN') on both).
  @Patch(':id/active')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: "Suspend or restore a client company (blocks their users' login while inactive)" })
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.service.setActive(id, isActive);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a company' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.sub, req.user.role);
  }

  // ─── Payroll Settings ────────────────────────────────────────────────────────

  @Get(':id/payroll-settings')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get payroll settings for a company' })
  getPayrollSettings(@Param('id') id: string, @Req() req: any) {
    return this.service.getPayrollSettings(id, req.user.sub, req.user.role);
  }

  @Patch(':id/payroll-settings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create or update payroll settings (SSF %, PIT, Dashain bonus)' })
  upsertPayrollSettings(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.upsertPayrollSettings(id, req.user.sub, req.user.role, body);
  }
}
