import { Controller, Post, Get, Body, Req, UseGuards, Query, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PortalUserType } from '@prisma/client';
import { Public } from '../../../../modules/decorators/public.decorator';
import { PortalService } from '../../../../application/services/portal.service';
import { PaymentService } from '../../../../application/services/payment.service';
import { PortalGuard } from '../../../../modules/guards/portal.guard';
import { PortalRoles } from '../../../../modules/decorators/portal-roles.decorator';
import { Roles } from '../../../../modules/decorators/roles.decorator';

@ApiTags('Portal')
@Controller('api/v1/portal')
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly paymentService: PaymentService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() body: { phone: string; password: string; companyId: string }) {
    return this.portalService.login(body.phone, body.password, body.companyId);
  }

  // Not @Public() — requires a staff login. Explicitly role-gated: setting a
  // parent/student portal password is an administrative action, not something
  // every staff role (e.g. TEACHER, LIBRARIAN) should be able to do.
  @Roles('ADMIN', 'ACCOUNTANT')
  @Post('set-password')
  setPassword(
    @Body() body: { studentId: string; type: PortalUserType; phone: string; password: string; companyId: string },
  ) {
    return this.portalService.setPortalPassword(body.studentId, body.type, body.phone, body.password, body.companyId);
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
  @Get('fees/:invoiceId/receipt')
  feeReceipt(@Param('invoiceId') invoiceId: string, @Req() req: any) {
    return this.portalService.getFeeReceipt(invoiceId, req.portalUser.studentId, req.portalUser.companyId);
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

  // ── Payment — eSewa ────────────────────────────────────────────────────────

  @Public()
  @UseGuards(PortalGuard)
  @PortalRoles(PortalUserType.PARENT)
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
  @PortalRoles(PortalUserType.PARENT)
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
