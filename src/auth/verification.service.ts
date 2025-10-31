import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Generate a random 6-digit code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification code to email
   */
  async sendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Delete any expired or old codes for this email
    await this.prisma.emailVerification.deleteMany({
      where: {
        email,
        OR: [
          { expiresAt: { lt: new Date() } },
          { verified: true },
        ],
      },
    });

    // Check rate limiting - max 3 active codes per email
    const activeCount = await this.prisma.emailVerification.count({
      where: {
        email,
        verified: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeCount >= 3) {
      throw new BadRequestException('Too many verification requests. Please try again later.');
    }

    // Generate verification code
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification code in database
    await this.prisma.emailVerification.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    // Send email with verification code
    const emailResult = await this.emailService.sendVerificationCode(email, code);

    if (!emailResult.success) {
      this.logger.error(`Failed to send verification email to ${email}: ${emailResult.error}`);
      throw new BadRequestException('Failed to send verification email');
    }

    this.logger.log(`✅ Verification code sent to ${email}`);

    return {
      success: true,
      message: 'Verification code sent to your email',
    };
  }

  /**
   * Verify the code submitted by user
   */
  async verifyCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
    // Find the most recent valid code for this email
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        code,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verification) {
      // Check if there's a verification record to update attempts
      const anyVerification = await this.prisma.emailVerification.findFirst({
        where: {
          email,
          verified: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (anyVerification) {
        // Increment failed attempts
        await this.prisma.emailVerification.update({
          where: { id: anyVerification.id },
          data: { attempts: anyVerification.attempts + 1 },
        });

        // Lock out after 5 failed attempts
        if (anyVerification.attempts >= 4) {
          await this.prisma.emailVerification.delete({
            where: { id: anyVerification.id },
          });
          throw new BadRequestException('Too many failed attempts. Please request a new code.');
        }
      }

      throw new BadRequestException('Invalid or expired verification code');
    }

    // Mark as verified
    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { verified: true },
    });

    // Clean up old verification codes for this email
    await this.prisma.emailVerification.deleteMany({
      where: {
        email,
        id: { not: verification.id },
      },
    });

    this.logger.log(`✅ Email verified successfully for ${email}`);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * Check if email has been verified recently (within last 24 hours)
   */
  async isEmailVerified(email: string): Promise<boolean> {
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        verified: true,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return !!verification;
  }

  /**
   * Clean up expired verification codes (can be called periodically)
   */
  async cleanupExpiredCodes(): Promise<void> {
    const deleted = await this.prisma.emailVerification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    this.logger.log(`🧹 Cleaned up ${deleted.count} expired verification codes`);
  }
}

