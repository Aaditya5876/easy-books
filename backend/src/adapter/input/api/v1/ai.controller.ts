import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiService } from '../../../../application/services/ai.service';

@ApiTags('AI')
@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-notice')
  generateNotice(@Body() body: { topic: string; targetAudience: string; tone?: string }) {
    return this.aiService.generateNotice(body.topic, body.targetAudience, body.tone);
  }

  @Post('report-card-comment')
  reportCardComment(@Body() body: { studentName: string; examResults: any[] }) {
    return this.aiService.generateReportComment(body.studentName, body.examResults);
  }

  @Post('class-insights')
  classInsights(@Body() body: { classData: any }) {
    return this.aiService.getClassInsights(body.classData);
  }

  @Post('fee-reminder')
  feeReminder(@Body() body: { studentName: string; guardianName: string; month: string; amountDue: number; daysOverdue: number }) {
    return this.aiService.generateFeeReminder(
      body.studentName, body.guardianName, body.month, body.amountDue, body.daysOverdue,
    );
  }

  @Post('homework-description')
  homeworkDescription(@Body() body: { subject: string; topic: string; className: string; dueDate: string }) {
    return this.aiService.generateHomeworkDescription(body.subject, body.topic, body.className, body.dueDate);
  }
}
