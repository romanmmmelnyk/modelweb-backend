import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'crypto-random-string';
import { UserSession } from '@prisma/client';

export interface SessionData {
  userAgent?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export interface CreateSessionOptions {
  userId: string;
  sessionData?: SessionData;
  expiresInDays?: number;
}

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new user session
   */
  async createSession({ userId, sessionData, expiresInDays = 7 }: CreateSessionOptions): Promise<UserSession> {
    const sessionToken = this.generateSecureToken();
    const refreshToken = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.userSession.create({
      data: {
        sessionToken,
        refreshToken,
        userId,
        userAgent: sessionData?.userAgent,
        ipAddress: sessionData?.ipAddress,
        deviceInfo: sessionData?.deviceInfo,
        expiresAt,
        lastAccessed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return session;
  }

  /**
   * Validate a session token and return session data
   */
  async validateSession(sessionToken: string): Promise<UserSession | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    // Update last accessed time
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastAccessed: new Date() },
    });

    return session;
  }

  /**
   * Refresh a session using refresh token
   */
  async refreshSession(refreshToken: string, sessionData?: SessionData): Promise<UserSession | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    // Generate new tokens
    const newSessionToken = this.generateSecureToken();
    const newRefreshToken = this.generateSecureToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const updatedSession = await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        sessionToken: newSessionToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        lastAccessed: new Date(),
        userAgent: sessionData?.userAgent || session.userAgent,
        ipAddress: sessionData?.ipAddress || session.ipAddress,
        deviceInfo: sessionData?.deviceInfo || session.deviceInfo,
      },
    });

    return updatedSession;
  }

  /**
   * Deactivate a session
   */
  async deactivateSession(sessionToken: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { sessionToken },
      data: { isActive: false },
    });
  }

  /**
   * Deactivate all sessions for a user
   */
  async deactivateAllUserSessions(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    return this.prisma.userSession.findMany({
      where: { userId, isActive: true },
      orderBy: { lastAccessed: 'desc' },
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false },
        ],
      },
    });

    return result.count;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(userId?: string): Promise<{
    totalSessions: number;
    activeSessions: number;
      expiredSessions: number;
  }> {
    const totalSessions = await this.prisma.userSession.count({
      where: userId ? { userId } : {},
    });

    const activeSessions = await this.prisma.userSession.count({
      where: {
        ...(userId ? { userId } : {}),
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    const expiredSessions = await this.prisma.userSession.count({
      where: {
        ...(userId ? { userId } : {}),
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false },
        ],
      },
    });

    return { totalSessions, activeSessions, expiredSessions };
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(length: number = 32): string {
    return crypto({ length, type: 'url-safe' });
  }

  /**
   * Extract client information from request
   */
  static extractClientData(request: any): SessionData {
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip || request.connection.remoteAddress,
      deviceInfo: request.headers['x-device-info'],
    };
  }
}
