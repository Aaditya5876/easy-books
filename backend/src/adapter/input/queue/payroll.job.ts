import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PayrollEngineService } from '../../application/services/payroll.engine';
import { QUEUE_NAMES } from '../../../core/queue/bull.client';

@Processor(QUEUE_NAMES.PAYROLL)
export class PayrollJobProcessor {
  private readonly logger = new Logger(PayrollJobProcessor.name);

  constructor(private readonly payrollEngine: PayrollEngineService) {}

  @Process('process-employee-payroll')
  async handlePayroll(job: Job<{ companyId: string; employeeId: string; month: string }>) {
    const { companyId, employeeId, month } = job.data;
    try {
      const result = await this.payrollEngine.calculateEmployeePayroll(companyId, employeeId, month);
      this.logger.log(`Payroll processed: ${result.employeeName} — Net: ${result.netAmount}`);
    } catch (err) {
      this.logger.error(`Payroll failed for employee ${employeeId}: ${err.message}`);
      throw err;
    }
  }
}
