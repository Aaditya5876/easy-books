import {
  Controller, Post, Get, Patch, Body, Req, UseGuards, Query, Param,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiConsumes } from '@nestjs/swagger';
import { Public } from '../../../../modules/decorators/public.decorator';
import { PortalService } from '../../../../application/services/portal.service';
import { PaymentService } from '../../../../application/services/payment.service';
import { PortalNotificationService } from '../../../../application/services/portal-notification.service';
import { PortalGuard } from '../../../../modules/guards/portal.guard';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { makeUploadStorage, extensionFilter } from './upload.util';

const PROOF_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('Portal')
@Controller('api/v1/portal')
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly paymentService: PaymentService,
    private readonly portalNotifications: PortalNotificationService,
  ) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() body: { phone: string; password: string; companyId: string }) {
    return this.portalService.login(body.phone, body.password, body.companyId);
  }

  // Not @Public() — requires a staff login. Explicitly role-gated: setting a
  // student's portal password is an administrative action, not something
  // every staff role (e.g. TEACHER, LIBRARIAN) should be able to do.
  @Roles('ADMIN', 'ACCOUNTANT')
  @Post('set-password')
  setPassword(@Body() body: { studentId: string; phone: string; password: string; companyId: string }) {
    return this.portalService.setPortalPassword(body.studentId, body.phone, body.password, body.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.portalService.getMyStudent(req.portalUser.studentId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('attendance')
  attendance(@Req() req: any) {
    return this.portalService.getAttendance(req.portalUser.studentId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('fees')
  fees(@Req() req: any) {
    return this.portalService.getFees(req.portalUser.studentId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('payment-qr-codes')
  paymentQrCodes(@Req() req: any) {
    return this.portalService.getPaymentQrCodes(req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('fees/:invoiceId/receipt')
  feeReceipt(@Param('invoiceId') invoiceId: string, @Req() req: any) {
    return this.portalService.getFeeReceipt(invoiceId, req.portalUser.studentId, req.portalUser.companyId);
  }

  // Screenshot upload for payment proof — portal users can't call the
  // staff-only /api/v1/upload endpoint, so this is a scoped equivalent:
  // images only, smaller size limit, same local-disk storage/URL shape.
  @Public()
  @UseGuards(PortalGuard)
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: makeUploadStorage(),
    limits: { fileSize: MAX_PROOF_FILE_SIZE },
    fileFilter: extensionFilter(PROOF_IMAGE_EXTENSIONS),
  }))
  uploadProof(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file provided');
    return { url: `/uploads/${file.filename}`, originalName: file.originalname, size: file.size, mimeType: file.mimetype };
  }

  @Public()
  @UseGuards(PortalGuard)
  @Post('fees/:invoiceId/payment-proof')
  submitPaymentProof(
    @Param('invoiceId') invoiceId: string,
    @Req() req: any,
    @Body() body: { amount: number; method?: string; bankAccountId?: string; proofScreenshotUrl: string; notes?: string },
  ) {
    return this.portalService.submitPaymentProof(invoiceId, req.portalUser.studentId, req.portalUser.companyId, body);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('results')
  results(@Req() req: any) {
    return this.portalService.getResults(req.portalUser.studentId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('homework')
  homework(@Req() req: any, @Query('classId') classId?: string) {
    return this.portalService.getHomework(classId || req.portalUser.classId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('notices')
  notices(@Req() req: any) {
    return this.portalService.getNotices(req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('timetable')
  timetable(@Req() req: any, @Query('classId') classId?: string) {
    return this.portalService.getTimetable(classId || req.portalUser.classId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('study-materials')
  studyMaterials(@Req() req: any, @Query('classId') classId?: string, @Query('subjectId') subjectId?: string) {
    return this.portalService.getStudyMaterials(classId || req.portalUser.classId, req.portalUser.companyId, subjectId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('exam-schedule')
  examSchedule(@Req() req: any, @Query('classId') classId?: string) {
    return this.portalService.getExamSchedule(classId || req.portalUser.classId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('events')
  events(@Req() req: any) {
    return this.portalService.getEvents(req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('notifications')
  notifications(@Req() req: any) {
    return this.portalNotifications.listForStudent(req.portalUser.studentId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Get('notifications/unread-count')
  notificationsUnreadCount(@Req() req: any) {
    return this.portalNotifications.getUnreadCount(req.portalUser.studentId, req.portalUser.companyId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Patch('notifications/:id/read')
  markNotificationRead(@Param('id') id: string, @Req() req: any) {
    return this.portalNotifications.markRead(id, req.portalUser.studentId);
  }

  @Public()
  @UseGuards(PortalGuard)
  @Patch('notifications/mark-all-read')
  markAllNotificationsRead(@Req() req: any) {
    return this.portalNotifications.markAllRead(req.portalUser.studentId, req.portalUser.companyId);
  }

  // ── Payment — eSewa ────────────────────────────────────────────────────────

  @Public()
  @UseGuards(PortalGuard)
  @Post('pay/esewa/:invoiceId')
  initiateEsewa(
    @Param('invoiceId') invoiceId: string,
    @Req() req: any,
    @Body() body: { frontendBaseUrl: string },
  ) {
    return this.paymentService.initiateEsewa(invoiceId, req.portalUser.companyId, body.frontendBaseUrl);
  }

  // Called by frontend after eSewa redirects back (public — no portal token at this point)
  @Public()
  @Post('pay/esewa/verify')
  verifyEsewa(@Body() body: { data: string; invoiceId: string; companyId: string }) {
    return this.paymentService.verifyEsewa(body.data, body.invoiceId, body.companyId);
  }

  // ── Payment — Khalti ───────────────────────────────────────────────────────

  @Public()
  @UseGuards(PortalGuard)
  @Post('pay/khalti/:invoiceId')
  initiateKhalti(
    @Param('invoiceId') invoiceId: string,
    @Req() req: any,
    @Body() body: { frontendBaseUrl: string },
  ) {
    return this.paymentService.initiateKhalti(invoiceId, req.portalUser.companyId, body.frontendBaseUrl);
  }

  @Public()
  @Post('pay/khalti/verify')
  verifyKhalti(@Body() body: { pidx: string; invoiceId: string; companyId: string }) {
    return this.paymentService.verifyKhalti(body.pidx, body.invoiceId, body.companyId);
  }
}
