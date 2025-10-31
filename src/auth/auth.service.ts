import { Injectable, UnauthorizedException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { SessionService, SessionData } from './session.service';
import { VerificationService } from './verification.service';
import { NotificationService } from '../notification/notification.service';

export interface PayloadType {
  sub: string;
  email: string;
  tenantId: string;
  twoFactorEnabled?: boolean;
  sessionToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private notificationService: NotificationService,
    @Inject(forwardRef(() => VerificationService))
    private verificationService: VerificationService,
  ) {}

  verifyPartialToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      return null;
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (user && user.password && await bcrypt.compare(password, user.password)) {
      return user;
    }
    return null;
  }

  async validateUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    return user;
  }

  async login(user: any, sessionData?: SessionData) {
    // Create a new session
    const session = await this.sessionService.createSession({
      userId: user.id,
      sessionData,
      expiresInDays: 7, // Sessions last for 1 week
    });

    const payload: PayloadType = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      twoFactorEnabled: user.twoFactorEnabled,
      sessionToken: session.sessionToken,
    };

    // Check if this is first login
    const isFirstLogin = !user.lastLogin;

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Create welcome notification on first login
    if (isFirstLogin) {
      try {
        await this.notificationService.createWelcomeNotification(
          user.id,
          user.profile?.firstName,
        );
      } catch (error) {
        // Don't fail login if notification creation fails
        console.error('Failed to create welcome notification:', error);
      }
    }

    return {
      token: this.jwtService.sign(payload),
      refreshToken: session.refreshToken,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        lastAccessed: session.lastAccessed,
      },
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        provider: user.provider,
        twoFactorEnabled: user.twoFactorEnabled,
        hasSeenOnboarding: user.hasSeenOnboarding,
        profile: user.profile,
      },
    };
  }

  async loginWithGoogle(googleUser: any) {
    let user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: googleUser.email },
            { providerId: googleUser.id }
          ]
        },
      include: { profile: true },
    });

    if (!user) {
      // Create new user from Google data
      const defaultTenant = await this.getDefaultTenant();
      
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          provider: 'google',
          providerId: googleUser.id,
          tenantId: defaultTenant.id,
        },
        include: { profile: true },
      });
    } else if (!user.providerId) {
      // Link existing email user with Google
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          provider: 'google',
          providerId: googleUser.id,
        },
      });
    }

    return this.login(user);
  }

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `Management System (${user.email})`,
      length: 32,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  async enable2FA(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('Invalid setup');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { success: true };
  }

  async verify2FA(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not enabled');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    return { success: true };
  }

  async disable2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new UnauthorizedException('2FA is not enabled');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        twoFactorEnabled: false,
        twoFactorSecret: null, // Clear the secret for security
      },
    });

    return { success: true, message: '2FA disabled successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new UnauthorizedException('User not found or no password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { success: true, message: 'Password changed successfully' };
  }

  private async getDefaultTenant() {
    let tenant = await this.prisma.tenant.findFirst();
    
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: 'Default Tenant',
          description: 'Default tenant for new users',
        },
      });
    }

    return tenant;
  }

  async createTestAdmin() {
    const defaultTenant = await this.getDefaultTenant();
    const hashedPassword = await bcrypt.hash('admin', 10);

    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: 'admin@admin.com' },
    });

    if (!existingAdmin) {
      const admin = await this.prisma.user.create({
        data: {
          email: 'admin@admin.com',
          password: hashedPassword,
          provider: 'email',
          tenantId: defaultTenant.id,
          twoFactorEnabled: false,
        },
        include: { profile: true },
      });

      // Create profile for admin
      await this.prisma.profile.create({
        data: {
          userId: admin.id,
          firstName: 'Admin',
          lastName: 'User',
        },
      });

      console.log('✅ Test admin user created: admin@admin.com / admin');
      return admin;
    }

    console.log('ℹ️ Admin user already exists');
    return existingAdmin;
  }

  signToken(payload: PayloadType): string {
    return this.jwtService.sign(payload);
  }

  async register(email: string, password: string, sessionData?: SessionData) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Get or create default tenant
    const defaultTenant = await this.getDefaultTenant();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        provider: 'email',
        tenantId: defaultTenant.id,
      },
      include: { profile: true },
    });

    // Auto login the new user
    return this.login(user, sessionData);
  }

  async checkEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return {
      email,
      available: !user,
      taken: !!user,
    };
  }

  async markOnboardingComplete(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hasSeenOnboarding: true },
    });

    return { success: true, message: 'Onboarding marked as complete' };
  }

  async deleteAccount(userId: string) {
    // Delete user account and all associated data
    // Prisma cascade deletes will handle related records
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true, message: 'Account deleted successfully' };
  }

  async sendVerificationCode(email: string) {
    return this.verificationService.sendVerificationCode(email);
  }

  async verifyEmailCode(email: string, code: string) {
    return this.verificationService.verifyCode(email, code);
  }
}
