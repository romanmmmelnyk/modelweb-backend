import { Controller, Get, Post, Put, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Request() req, @Query('unreadOnly') unreadOnly?: string) {
    const unread = unreadOnly === 'true';
    return this.notificationService.getNotifications(req.user.id, unread);
  }

  @Get('count')
  async getUnreadCount(@Request() req) {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return { count };
  }

  @Put(':id/read')
  async markAsRead(@Request() req, @Param('id') id: string) {
    await this.notificationService.markAsRead(req.user.id, id);
    return { success: true };
  }

  @Put('read-all')
  async markAllAsRead(@Request() req) {
    await this.notificationService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Request() req, @Param('id') id: string) {
    await this.notificationService.deleteNotification(req.user.id, id);
    return { success: true };
  }
}

