import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SessionJwtStrategy } from './session-jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { SessionService } from './session.service';
import { SessionCleanupService } from './session-cleanup.service';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailModule } from '../email/email.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    ScheduleModule,
    PassportModule,
    EmailModule,
    NotificationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    SessionCleanupService,
    VerificationService,
    JwtStrategy,
    SessionJwtStrategy,
    GoogleStrategy,
    PrismaService,
  ],
  exports: [AuthService, SessionService, VerificationService],
})
export class AuthModule {}
