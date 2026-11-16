import { NoCompanyScope } from '../../../../modules/decorators/no-company-scope.decorator';
import { Controller, Get, Post, Put, Delete, Body, Query, Param, Req } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { RecycleBinServiceImpl, RecycleBinItemType, RecycleBinRef } from '../../../../application/services/recycle-bin.service.impl';

const ItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['client', 'vendor', 'employee', 'inventory', 'sales', 'purchase', 'task', 'memo']),
  })).min(1).max(500),
}).passthrough();

@Controller('api/v1/recycle-bin')
@Roles('ADMIN')
export class RecycleBinController {
  constructor(private readonly svc: RecycleBinServiceImpl) {}

  @NoCompanyScope()
  @Post('verify')
  async verify(@Req() req: any, @Body('password') password: string) {
    const valid = await this.svc.verifyPassword(req.user.sub, password);
    return { valid };
  }

  @Get()
  list(@Query('companyId') companyId: string) {
    return this.svc.list(companyId);
  }

  @Post('restore')
  restore(
    @Body('id') id: string,
    @Body('type') type: RecycleBinItemType,
    @Body('companyId') companyId: string,
  ) {
    return this.svc.restore(id, type, companyId);
  }

  @Post('restore-many')
  restoreMany(@Body('companyId') companyId: string, @Body(new ZodValidationPipe(ItemsSchema)) body: { items: RecycleBinRef[] }) {
    return this.svc.restoreMany(companyId, body.items);
  }

  @Post('delete-many')
  deleteMany(@Body('companyId') companyId: string, @Body(new ZodValidationPipe(ItemsSchema)) body: { items: RecycleBinRef[] }) {
    return this.svc.deleteMany(companyId, body.items);
  }

  @Post('restore-all')
  restoreAll(@Body('companyId') companyId: string) {
    return this.svc.restoreAll(companyId);
  }

  @Get('settings')
  getSettings(@Query('companyId') companyId: string) {
    return this.svc.getSettings(companyId);
  }

  @Put('settings')
  updateSettings(@Body('companyId') companyId: string, @Body('retentionDays') retentionDays: number) {
    return this.svc.updateSettings(companyId, Number(retentionDays));
  }

  @Delete('empty')
  emptyBin(@Query('companyId') companyId: string) {
    return this.svc.emptyBin(companyId);
  }

  @Post('cleanup')
  cleanup(
    @Body('companyId') companyId: string,
    @Body('days') days: number,
  ) {
    return this.svc.cleanupOlderThan(companyId, days);
  }

  @Delete(':id')
  permanentDelete(
    @Param('id') id: string,
    @Query('type') type: RecycleBinItemType,
    @Query('companyId') companyId: string,
  ) {
    return this.svc.permanentDelete(id, type, companyId);
  }
}
