import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Easy Books API')
    .setDescription('Accounting & Inventory Management API — Nepal')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('accessToken')
    .addTag('Auth')
    .addTag('Companies')
    .addTag('Inventory')
    .addTag('Sales')
    .addTag('Purchases')
    .addTag('Payments')
    .addTag('Credit Notes')
    .addTag('Debit Notes')
    .addTag('Clients')
    .addTag('Vendors')
    .addTag('Employees')
    .addTag('Attendance')
    .addTag('Leave')
    .addTag('Payroll')
    .addTag('Ledger')
    .addTag('Transactions')
    .addTag('Bank Accounts')
    .addTag('Cheques')
    .addTag('Bank Guarantees')
    .addTag('Petty Cash')
    .addTag('Quotations')
    .addTag('Memos')
    .addTag('Tasks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Easy Books API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
