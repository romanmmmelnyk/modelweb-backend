import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: string, unreadOnly: boolean = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Security: only allow users to mark their own notifications
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId: string, notificationId: string) {
    return this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId, // Security: only allow users to delete their own notifications
      },
    });
  }

  /**
   * Create a welcome notification for new users
   */
  async createWelcomeNotification(userId: string, firstName?: string) {
    const name = firstName || 'there';
    
    return this.prisma.notification.create({
      data: {
        userId,
        title: `Welcome to MOTH Solutions${firstName ? `, ${firstName}` : ''}! 🎉`,
        message: `We're excited to have you here! Get started by exploring your dashboard and personalizing your profile.`,
        type: 'welcome',
        actionUrl: '/profile',
        actionLabel: 'Complete Profile',
      },
    });
  }

  /**
   * Create a generic notification
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    actionUrl?: string,
    actionLabel?: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        actionUrl,
        actionLabel,
      },
    });
  }

  /**
   * Create bulk notifications
   */
  async createBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
  ) {
    const notifications = userIds.map(userId => ({
      userId,
      title,
      message,
      type,
    }));

    return this.prisma.notification.createMany({
      data: notifications,
    });
  }

  /**
   * Delete old read notifications (cleanup)
   */
  async deleteOldReadNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notification.deleteMany({
      where: {
        read: true,
        readAt: {
          lte: cutoffDate,
        },
      },
    });

    this.logger.log(`Deleted ${result.count} old read notifications`);
    return result;
  }
}

