import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // nosniff stops a browser from re-interpreting an uploaded file's bytes as
  // a different content type than what it was validated/stored as (e.g. an
  // uploaded image whose content doesn't match its extension being executed
  // as HTML/script by a MIME-sniffing browser).
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  app.useLogger(app.get(Logger));
  app.use(cookieParser());

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
