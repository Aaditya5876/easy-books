import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyServiceImpl } from '../../../../application/services/company.service.impl';
import { JwtAuthGuard } from '../../../../modules/guards/jwt-auth.guard';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/companies')
export class CompanyController {
  constructor(private readonly service: CompanyServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all companies for current user' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.sub);
  }

  @Get('user-companies')
  @ApiOperation({ summary: 'Get user companies with default flag' })
  getUserCompanies(@Req() req: any) {
    return this.service.getUserCompanies(req.user.sub);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default company for current user' })
  getDefaultCompany(@Req() req: any) {
    return this.service.getDefaultCompany(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a company' })
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a company' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a company' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ─── Payroll Settings ────────────────────────────────────────────────────────

  @Get(':id/payroll-settings')
  @ApiOperation({ summary: 'Get payroll settings for a company' })
  getPayrollSettings(@Param('id') id: string) {
    return this.service.getPayrollSettings(id);
  }

  @Patch(':id/payroll-settings')
  @ApiOperation({ summary: 'Create or update payroll settings (SSF %, PIT, Dashain bonus)' })
  upsertPayrollSettings(@Param('id') id: string, @Body() body: any) {
    return this.service.upsertPayrollSettings(id, body);
  }
}
