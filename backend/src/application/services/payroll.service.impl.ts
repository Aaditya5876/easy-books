// This file is superseded by payroll.engine.ts which handles all payroll logic.
// Kept as an empty stub to avoid breaking imports.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

@Injectable()
export class PayrollServiceImpl {
  constructor(private readonly prisma: PrismaService) {}
}
