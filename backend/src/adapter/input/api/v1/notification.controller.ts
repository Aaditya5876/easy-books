import { Controller, Get, Patch, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationServiceImpl } from '../../../../application/services/notification.service.impl';

// No class-level @Roles(...) — every authenticated user reads their own inbox;
// which roles ever receive a row is decided inside NotificationServiceImpl.notifyRole.
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/v1/notifications')
export class NotificationController {
  constructor(private readonly service: NotificationServiceImpl) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  list(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.service.listForUser(req.user.sub, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the current user' })
  unreadCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user.sub);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read for the current user' })
  markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(@Param('id') id: string, @Request() req: any) {
    return this.service.markRead(id, req.user.sub);
  }
}
