import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // Uploaded files are served by UploadsDownloadController (requires an
  // authenticated staff or portal session) instead of unauthenticated static
  // hosting — see uploads-download.controller.ts.

  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  // Standard security response headers (HSTS, X-Content-Type-Options,
  // X-Frame-Options/clickjacking protection, Referrer-Policy, etc.). CSP is
  // disabled: this is a pure JSON API plus the Swagger UI at /docs, and a
  // default CSP blocks Swagger UI's own inline scripts/styles — the other
  // headers still apply everywhere, including /docs.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const envLabel = isProduction ? 'Production' : 'Development';

  const swaggerConfig = new DocumentBuilder()
    .setTitle(`OneBook API (${envLabel})`)
    .setDescription('Accounting & Inventory Management API — Nepal')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('accessToken')
    .addTag('Auth')
    .addTag('Users')
    .addTag('Companies')
    .addTag('Dashboard')
    .addTag('Inventory')
    .addTag('Sales')
    .addTag('Purchases')
    .addTag('Payments')
    .addTag('Credit Notes')
    .addTag('Debit Notes')
    .addTag('Clients')
    .addTag('Vendors')
    .addTag('Quotations')
    .addTag('Memos')
    .addTag('Tasks')
    .addTag('Employees')
    .addTag('Attendance')
    .addTag('Leave')
    .addTag('Payroll')
    .addTag('Ledger Accounts')
    .addTag('Ledger Entries')
    .addTag('Transactions')
    .addTag('Bank Accounts')
    .addTag('Cheques')
    .addTag('Bank Guarantees')
    .addTag('Petty Cash')
    .addTag('School')
    .addTag('Notifications')
    .addTag('Portal')
    .addTag('AI')
    .addTag('Bulk Import')
    .addTag('Upload')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`OneBook API (${envLabel}) running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
