import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from '../../../../application/services/ai.service';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';

// `companyId` on each body below isn't used by AiService itself (these are
// stateless Gemini calls) — it's there only so ModuleAccessGuard has a
// company to check the AI module's license against.
@ApiTags('AI')
@ApiBearerAuth()
@Roles('ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER', 'LIBRARIAN')
@RequiresModule('AI')
@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-notice')
  generateNotice(@Body() body: { companyId?: string; topic: string; targetAudience: string; tone?: string }) {
    return this.aiService.generateNotice(body.topic, body.targetAudience, body.tone);
  }

  @Post('report-card-comment')
  reportCardComment(@Body() body: { companyId?: string; studentName: string; examResults: any[] }) {
    return this.aiService.generateReportComment(body.studentName, body.examResults);
  }

  @Post('class-insights')
  classInsights(@Body() body: { companyId?: string; classData: any }) {
    return this.aiService.getClassInsights(body.classData);
  }

  @Post('fee-reminder')
  @Roles('ADMIN', 'ACCOUNTANT', 'STAFF')
  feeReminder(@Body() body: { companyId?: string; studentName: string; guardianName: string; month: string; amountDue: number; daysOverdue: number }) {
    return this.aiService.generateFeeReminder(
      body.studentName, body.guardianName, body.month, body.amountDue, body.daysOverdue,
    );
  }

  @Post('homework-description')
  homeworkDescription(@Body() body: { companyId?: string; subject: string; topic: string; className: string; dueDate: string }) {
    return this.aiService.generateHomeworkDescription(body.subject, body.topic, body.className, body.dueDate);
  }
}
