import { Controller, Get, Post, Put, Body, Param, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  ActivatePlanSchema, ActivatePlanDTO, RenewPlanSchema, RenewPlanDTO, UpdatePlanPriceSchema, UpdatePlanPriceDTO,
} from '@easy-books/shared';
import { SubscriptionService } from '../../../../application/services/subscription.service';
import { NoCompanyScope } from '../../../../modules/decorators/no-company-scope.decorator';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';

// OneBook plans. Company routes are keyed on ":id" (not a companyId param) so
// an admin whose plan ran out can still see it — CompanyAccessGuard would
// otherwise block them; membership is checked in the service instead.
@ApiTags('Subscriptions')
@ApiBearerAuth()
@NoCompanyScope()
@Controller('api/v1/subscriptions')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Get('prices')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Price list for every product line and tier' })
  listPrices() {
    return this.service.listPrices();
  }

  @Put('prices/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Change one price-list row' })
  updatePrice(@Param('id') id: string, @Body(new ZodValidationPipe(UpdatePlanPriceSchema)) body: UpdatePlanPriceDTO) {
    return this.service.updatePrice(id, body);
  }

  @Get('company/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: "A company's plan, expiry, user count, prices and payments" })
  getForCompany(@Param('id') id: string, @Req() req: any) {
    return this.service.getForCompany(id, req.user.sub, req.user.role);
  }

  @Post('company/:id/activate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Record the first purchase (installation fee, one year)' })
  activate(@Param('id') id: string, @Body(new ZodValidationPipe(ActivatePlanSchema)) body: ActivatePlanDTO, @Req() req: any) {
    return this.service.activate(id, body, req.user.sub);
  }

  @Post('company/:id/renew')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Record a renewal (monthly, quarterly, half-yearly or yearly)' })
  renew(@Param('id') id: string, @Body(new ZodValidationPipe(RenewPlanSchema)) body: RenewPlanDTO, @Req() req: any) {
    return this.service.renew(id, body, req.user.sub);
  }
}
