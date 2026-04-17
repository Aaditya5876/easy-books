import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { TaskController } from '../adapter/input/api/v1/task.controller';
import { TaskServiceImpl } from '../application/services/task.service.impl';

@Module({
  controllers: [TaskController],
  providers: [PrismaService, TaskServiceImpl],
})
export class TaskModule {}
