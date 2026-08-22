import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LedgerAccountServiceImpl } from '../../../../application/services/ledger-account.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateLedgerAccountSchema, UpdateLedgerAccountSchema, CreateLedgerAccountDTO, UpdateLedgerAccountDTO } from '@easy-books/shared';

@ApiTags('Ledger Accounts')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'ADMIN')
@RequiresModule('FINANCE')
@Controller('api/v1/ledger/accounts')
export class LedgerAccountController {
  constructor(private readonly service: LedgerAccountServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'Get all ledger accounts (hidden excluded)' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ledger account by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a ledger account' })
  create(@Body(new ZodValidationPipe(CreateLedgerAccountSchema)) dto: CreateLedgerAccountDTO) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a ledger account' })
  @ApiQuery({ name: 'companyId', required: true })
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateLedgerAccountSchema)) dto: UpdateLedgerAccountDTO,
  ) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ledger account' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }

  // ── Hidden account endpoints (ADMIN only) ──────────────────────────────────

  @Post(':id/toggle-hidden')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Hide or unhide a ledger account (ADMIN + password required)' })
  @ApiQuery({ name: 'companyId', required: true })
  toggleHidden(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { password: string },
    @Req() req: any,
  ) {
    return this.service.toggleHidden(id, companyId, req.user.sub, body.password);
  }

  @Post('hidden/search')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Find a hidden ledger account by name (ADMIN + password required)' })
  @ApiQuery({ name: 'companyId', required: true })
  findHidden(
    @Query('companyId') companyId: string,
    @Body() body: { accountName: string; password: string },
    @Req() req: any,
  ) {
    return this.service.findHiddenByName(body.accountName, companyId, req.user.sub, body.password);
  }

  @Delete(':id/hidden')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Permanently delete a hidden ledger account (ADMIN + password required)' })
  @ApiQuery({ name: 'companyId', required: true })
  removeHidden(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { password: string },
    @Req() req: any,
  ) {
    return this.service.removeHidden(id, companyId, req.user.sub, body.password);
  }
}
