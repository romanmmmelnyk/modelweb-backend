import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from './session.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(private sessionService: SessionService) {}

  /**
   * Clean up expired sessions every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredSessionsCleanup() {
    try {
      const deletedCount = await this.sessionService.cleanupExpiredSessions();
      
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} expired sessions`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Log session statistics daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSessionStatsLogging() {
    try {
      const stats = await this.sessionService.getSessionStats();
      this.logger.log(
        `Session Stats - Total: ${stats.totalSessions}, Active: ${stats.activeSessions}, Expired: ${stats.expiredSessions}`
      );
    } catch (error) {
      this.logger.error('Error logging session statistics:', error);
    }
  }
}


