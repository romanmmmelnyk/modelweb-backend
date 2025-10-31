import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  Get,
  HttpCode,
  BadRequestException,
  Query,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: { email: string; password: string }, @Request() req) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    // Extract client information for session
    const sessionData = SessionService.extractClientData(req);
    const result = await this.authService.login(user, sessionData);
    
    // If 2FA is enabled, return partial token
    if (user.twoFactorEnabled) {
      return {
        message: '2FA required',
        partialToken: result.token,
        requires2FA: true,
      };
    }

    return result;
  }

  @Post('verify-2fa')
  @HttpCode(200)
  async verify2FA(@Body() verifyDto: { token: string; partialToken: string }) {
    // Verify the partial token first
    const decoded = this.authService.verifyPartialToken(verifyDto.partialToken);
    
    if (!decoded) {
      throw new BadRequestException('Invalid partial token');
    }

    const verified = await this.authService.verify2FA(decoded.sub, verifyDto.token);
    
    if (!verified.success) {
      throw new BadRequestException('Invalid 2FA token');
    }

    // Return full token for authenticated user
    const user = await this.authService.validateUserByEmail(decoded.email);
    return this.authService.login(user);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req) {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req) {
    const result = await this.authService.loginWithGoogle(req.user);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup-2fa')
  @HttpCode(200)
  async setup2FA(@Request() req) {
    return this.authService.setup2FA(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('enable-2fa')
  @HttpCode(200)
  async enable2FA(
    @Request() req,
    @Body() enableDto: { token: string },
  ) {
    return this.authService.enable2FA(req.user.id, enableDto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disable-2fa')
  @HttpCode(200)
  async disable2FA(@Request() req) {
    return this.authService.disable2FA(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto.currentPassword, changePasswordDto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(200)
  async getProfile(@Request() req) {
    const user = await this.authService.validateUserByEmail(req.user.email);
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      provider: user.provider,
      twoFactorEnabled: user.twoFactorEnabled,
      hasSeenOnboarding: user.hasSeenOnboarding,
      profile: user.profile,
    };
  }

  // Session Management Endpoints
  
  @UseGuards(JwtAuthGuard)
  @Post('refresh-token')
  @HttpCode(200)
  async refreshToken(
    @Body() refreshDto: { refreshToken: string },
    @Request() req,
  ) {
    const sessionData = SessionService.extractClientData(req);
    const session = await this.sessionService.refreshSession(refreshDto.refreshToken, sessionData);
    
    if (!session) {
      throw new BadRequestException('Invalid refresh token');
    }

    const user = await this.authService.validateUserByEmail(req.user.email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const payload: any = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      twoFactorEnabled: user.twoFactorEnabled,
      sessionToken: session.sessionToken,
    };

    return {
      token: this.authService.signToken(payload),
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

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(@Request() req) {
    // If JWT contains session token, deactivate that specific session
    if (req.user.sessionToken) {
      await this.sessionService.deactivateSession(req.user.sessionToken);
    }
    
    return { success: true, message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(@Request() req) {
    await this.sessionService.deactivateAllUserSessions(req.user.id);
    return { success: true, message: 'Logged out from all devices' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getUserSessions(@Request() req) {
    const sessions = await this.sessionService.getUserSessions(req.user.id);
    const stats = await this.sessionService.getSessionStats(req.user.id);
    
    return {
      sessions: sessions.map(session => ({
        id: session.id,
        userAgent: session.userAgent,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastAccessed: session.lastAccessed,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
      })),
      stats,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('revoke-session/:sessionId')
  @HttpCode(200)
  async revokeSession(
    @Request() req,
    @Body() params: { sessionId: string }
  ) {
    const sessions = await this.sessionService.getUserSessions(req.user.id);
    const sessionExists = sessions.find(s => s.id === params.sessionId && s.sessionToken);
    
    if (!sessionExists) {
      throw new BadRequestException('Session not found');
    }
    
    await this.sessionService.deactivateSession(sessionExists.sessionToken);
    return { success: true, message: 'Session revoked successfully' };
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() registerDto: { email: string; password: string }, @Request() req) {
    const sessionData = SessionService.extractClientData(req);
    return this.authService.register(registerDto.email, registerDto.password, sessionData);
  }

  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    return this.authService.checkEmail(email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-onboarding')
  @HttpCode(200)
  async completeOnboarding(@Request() req) {
    return this.authService.markOnboardingComplete(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(200)
  async deleteAccount(@Request() req) {
    await this.authService.deleteAccount(req.user.id);
    return { success: true, message: 'Account deleted successfully' };
  }

  @Post('send-verification-code')
  @HttpCode(200)
  async sendVerificationCode(@Body() body: { email: string }) {
    return this.authService.sendVerificationCode(body.email);
  }

  @Post('verify-email-code')
  @HttpCode(200)
  async verifyEmailCode(@Body() body: { email: string; code: string }) {
    return this.authService.verifyEmailCode(body.email, body.code);
  }
}
