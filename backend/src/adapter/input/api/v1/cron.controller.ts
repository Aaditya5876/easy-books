import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../../modules/decorators/public.decorator';
import { ScheduledTasksService } from '../../../../application/services/scheduled-tasks.service';

// Entry points for Vercel Cron (see backend/vercel.json), which replaces the
// in-process @Cron timers on serverless. Vercel sends
// `Authorization: Bearer $CRON_SECRET`; with no secret configured every call
// is refused rather than left open.
@ApiExcludeController()
@SkipThrottle()
@Public()
@Controller('api/v1/cron')
export class CronController {
  constructor(private readonly tasks: ScheduledTasksService) {}

  @Get('expired-companies')
  async expiredCompanies(@Headers('authorization') auth?: string) {
    this.assertCron(auth);
    await this.tasks.notifyExpiredCompanies();
    return { ok: true };
  }

  @Get('nightly-automation')
  async nightlyAutomation(@Headers('authorization') auth?: string) {
    this.assertCron(auth);
    await this.tasks.runMonthlyAutomation();
    return { ok: true };
  }

  private assertCron(auth?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) throw new UnauthorizedException();
  }
}
