import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AddSpaceChargeSchema, BulkSpacesSchema, CloseSpaceSessionSchema, CreateSpaceSchema, SetSpaceStatusSchema,
  StartSpaceSessionSchema, UpdateSpaceSchema,
} from '@easy-books/shared';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresStaffTag } from '../../../../modules/decorators/requires-staff-tag.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { SpaceService } from '../../../../application/services/space.service';

// Front-desk work (occupy, reserve, add charges, cleaning) is open to STAFF;
// setting up spaces and billing (close) is ACCOUNTANT / ADMIN, like Sales.
@ApiTags('Spaces')
@ApiBearerAuth()
@Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
@Controller('api/v1')
export class SpaceController {
  constructor(private readonly service: SpaceService) {}

  @Get('spaces')
  @ApiOperation({ summary: 'All spaces with what is in each right now' })
  @ApiQuery({ name: 'companyId', required: true })
  list(@Query('companyId') companyId: string) {
    return this.service.list(companyId);
  }

  @Post('spaces')
  @Roles('ACCOUNTANT', 'ADMIN')
  create(@Body('companyId') companyId: string, @Body(new ZodValidationPipe(CreateSpaceSchema)) dto: any) {
    return this.service.create(companyId, dto);
  }

  @Post('spaces/bulk')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Create many spaces at once (e.g. rooms 101–110)' })
  bulk(@Body('companyId') companyId: string, @Body(new ZodValidationPipe(BulkSpacesSchema)) dto: any) {
    return this.service.bulkCreate(companyId, dto);
  }

  @Put('spaces/:id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  update(@Param('id') id: string, @Query('companyId') companyId: string, @Body(new ZodValidationPipe(UpdateSpaceSchema)) dto: any) {
    return this.service.update(id, companyId, dto);
  }

  @Delete('spaces/:id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }

  @Patch('spaces/:id/status')
  @ApiQuery({ name: 'companyId', required: true })
  setStatus(@Param('id') id: string, @Query('companyId') companyId: string, @Body(new ZodValidationPipe(SetSpaceStatusSchema)) dto: any) {
    return this.service.setStatus(id, companyId, dto.status);
  }

  @Post('spaces/:id/sessions')
  @ApiOperation({ summary: 'Occupy (check in / seat) or reserve a free space' })
  @ApiQuery({ name: 'companyId', required: true })
  start(@Param('id') id: string, @Query('companyId') companyId: string, @Body(new ZodValidationPipe(StartSpaceSessionSchema)) dto: any, @Req() req: any) {
    return this.service.startSession(id, companyId, dto, req.user?.email);
  }

  @Get('space-sessions')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'spaceId', required: false })
  history(@Query('companyId') companyId: string, @Query('spaceId') spaceId?: string) {
    return this.service.history(companyId, spaceId);
  }

  @Get('space-sessions/:id')
  @ApiOperation({ summary: 'A session with its charges, time charge so far and running total' })
  @ApiQuery({ name: 'companyId', required: true })
  get(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.get(id, companyId);
  }

  @Post('space-sessions/:id/check-in')
  @ApiQuery({ name: 'companyId', required: true })
  checkIn(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.checkIn(id, companyId);
  }

  @Post('space-sessions/:id/cancel')
  @ApiQuery({ name: 'companyId', required: true })
  cancel(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.cancel(id, companyId);
  }

  @Post('space-sessions/:id/charges')
  @ApiQuery({ name: 'companyId', required: true })
  addCharge(@Param('id') id: string, @Query('companyId') companyId: string, @Body(new ZodValidationPipe(AddSpaceChargeSchema)) dto: any) {
    return this.service.addCharge(id, companyId, dto);
  }

  @Delete('space-sessions/:id/charges/:chargeId')
  @ApiQuery({ name: 'companyId', required: true })
  removeCharge(@Param('id') id: string, @Param('chargeId') chargeId: string, @Query('companyId') companyId: string) {
    return this.service.removeCharge(id, chargeId, companyId);
  }

  // Close & Bill makes the sales bill: STAFF only with the SALES tag.
  @Post('space-sessions/:id/close')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @RequiresStaffTag('SALES')
  @ApiOperation({ summary: 'Close and bill: charges + time rate become one sales bill' })
  @ApiQuery({ name: 'companyId', required: true })
  close(@Param('id') id: string, @Query('companyId') companyId: string, @Body(new ZodValidationPipe(CloseSpaceSessionSchema)) dto: any) {
    return this.service.close(id, companyId, dto);
  }
}
