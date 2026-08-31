import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<number>('SMTP_PORT', 587) === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendOtpVerification(email: string, name: string, otp: string): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'OneBook Nepal <noreply@easybooks.com.np>');
    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Verify your OneBook account',
        html: this.otpTemplate(name, otp),
      });
    } catch (err) {
      this.logger.error(`Failed to send OTP to ${email}: ${err.message}`);
    }
  }

  async sendInvitation(email: string, name: string, companyName: string, tempPassword: string): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'OneBook Nepal <noreply@easybooks.com.np>');
    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `You've been invited to ${companyName} on OneBook`,
        html: this.inviteTemplate(name, companyName, email, tempPassword),
      });
    } catch (err) {
      this.logger.error(`Failed to send invite to ${email}: ${err.message}`);
    }
  }

  private otpTemplate(name: string, otp: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;text-align:center;">
          <div style="background:rgba(255,255,255,0.15);width:48px;height:48px;border-radius:12px;margin:0 auto 12px;line-height:48px;">
            <span style="color:white;font-size:24px;font-weight:bold;">O</span>
          </div>
          <h1 style="color:white;margin:0;font-size:20px;">OneBook</h1>
        </div>
        <div style="padding:32px 24px;">
          <h2 style="color:#1e293b;font-size:18px;margin-top:0;">Verify your email, ${name}</h2>
          <p style="color:#64748b;line-height:1.6;">Enter this code to complete your registration:</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;margin:24px 0;letter-spacing:8px;">
            <span style="font-size:32px;font-weight:bold;color:#1e3a5f;font-family:monospace;">${otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px;">This code expires in <strong>10 minutes</strong>. If you didn't register for OneBook, ignore this email.</p>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">Powered by GeoInfosys | OneBook Nepal</p>
        </div>
      </div>
    `;
  }

  private inviteTemplate(name: string, companyName: string, email: string, tempPassword: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;text-align:center;">
          <div style="background:rgba(255,255,255,0.15);width:48px;height:48px;border-radius:12px;margin:0 auto 12px;line-height:48px;">
            <span style="color:white;font-size:24px;font-weight:bold;">O</span>
          </div>
          <h1 style="color:white;margin:0;font-size:20px;">OneBook</h1>
        </div>
        <div style="padding:32px 24px;">
          <h2 style="color:#1e293b;font-size:18px;margin-top:0;">Welcome to ${companyName}, ${name}!</h2>
          <p style="color:#64748b;line-height:1.6;">You've been invited to join <strong>${companyName}</strong> on OneBook Nepal.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:24px 0;">
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your Login Credentials</p>
            <p style="margin:0 0 4px;color:#1e293b;"><strong>Email:</strong> ${email}</p>
            <p style="margin:0;color:#1e293b;"><strong>Temporary Password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
          </div>
          <p style="color:#ef4444;font-size:13px;background:#fef2f2;padding:12px 16px;border-radius:6px;border-left:3px solid #ef4444;">You will be required to change your password on first login.</p>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">Powered by GeoInfosys | OneBook Nepal</p>
        </div>
      </div>
    `;
  }
}
