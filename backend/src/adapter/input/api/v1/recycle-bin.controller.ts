import { Controller, Get, Post, Delete, Body, Query, Param, Req } from '@nestjs/common';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RecycleBinServiceImpl, RecycleBinItemType } from '../../../../application/services/recycle-bin.service.impl';

@Controller('api/v1/recycle-bin')
@Roles('ADMIN')
export class RecycleBinController {
  constructor(private readonly svc: RecycleBinServiceImpl) {}

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
