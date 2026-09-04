import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserServiceImpl } from '../../../../application/services/user.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/v1/users')
export class UserController {
  constructor(private readonly service: UserServiceImpl) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all users for a company' })
  @ApiQuery({ name: 'companyId', required: true })
  listCompanyUsers(@Query('companyId') companyId: string) {
    return this.service.listCompanyUsers(companyId);
  }

  // SUPER_ADMIN only — creates a new client company + its first ADMIN login
  // for sales-led onboarding. Placed before ':id'-style routes below is not
  // required here (literal 'provision-client' segment never collides with a
  // param route), kept next to 'invite' for readability.
  @Post('provision-client')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: "Create a new client company and its first ADMIN login (sales-led onboarding)" })
  provisionClient(
    @Body() body: { companyName: string; businessType: string; adminName: string; adminEmail: string; enabledModules?: string[] },
    @Req() req: any,
  ) {
    return this.service.provisionClient(req.user.sub, body);
  }

  @Post('invite')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Invite a user to the company (creates user if not exists)' })
  @ApiQuery({ name: 'companyId', required: true })
  invite(
    @Query('companyId') companyId: string,
    @Body() body: { email: string; name: string; role: string },
    @Req() req: any,
  ) {
    return this.service.inviteUser(companyId, body, req.user.role);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Change the role of a user within a company' })
  @ApiQuery({ name: 'companyId', required: true })
  changeRole(
    @Param('id') userId: string,
    @Query('companyId') companyId: string,
    @Body() body: { role: string },
    @Req() req: any,
  ) {
    return this.service.changeRole(userId, companyId, body.role, req.user.role);
  }

  @Patch(':id/max-companies')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Set how many companies this user may self-serve create (e.g. after they buy another school)' })
  updateMaxCompanies(@Param('id') id: string, @Body('maxCompanies') maxCompanies: number) {
    return this.service.updateMaxCompanies(id, maxCompanies);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove a user from the company' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(
    @Param('id') userId: string,
    @Query('companyId') companyId: string,
    @Req() req: any,
  ) {
    return this.service.removeUser(userId, companyId, req.user.role, req.user.sub);
  }
}
